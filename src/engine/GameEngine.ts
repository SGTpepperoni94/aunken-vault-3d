import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  ActiveBanner,
  DungeonMap,
  EnemyArchetype,
  EnemyEntity,
  GameScreenState,
  GearItem,
  GearSlot,
  GroundLoot,
  HudSnapshot,
  Interactable,
  LogEntry,
  MysticRune,
  ProjectedEnemyTag,
  ProjectedLootTag,
  Rarity,
  RunSummary,
  SaveProfile,
  Stance,
} from '../game/types';
import {
  BIOME_PALETTES,
  generateDungeonFloor,
  generateHubMap,
  isWorldPosWalkable,
} from '../world/DungeonLogic';
import { buildWorldGeometry, type BuiltWorldHandles } from '../world/HubAndDungeonGen';
import {
  compareItems,
  generateGearItem,
  generateMysticRune,
  getActiveSetBonusLabels,
  getRuneRank,
  nextUid,
  reforgeItemAffixes,
  transposeBossRemembrance,
  upgradeRuneRank,
} from '../systems/LootAndForge';
import {
  computeDerivedStats,
  computePressureEnemyScale,
  computeVaultPressure,
  MANA_COSTS,
  PARRY_WINDOW_SEC,
  resolveIncomingEnemyHit,
  resolvePlayerStrike,
  STAMINA_COSTS,
} from '../systems/CombatSystem';
import {
  addBossRemembranceToProfile,
  applyDefeatToProfile,
  applyExtractionToProfile,
  equipFromStashOrBag,
  grantXpToProfile,
  loadSaveProfile,
  MAX_STASH_SLOTS,
  persistSaveProfile,
  recordKillInCodex,
  upgradeConstellationNode,
} from '../systems/SaveProfile';
import {
  getEnemySpriteTexture,
  getFlameFrameTexture,
  getLootSpriteTexture,
  getPropSpriteTexture,
  type SpriteAnimFrame,
} from '../render/billboardSprites';
import { getBiomeTexturePack } from '../render/textureBaker';
import { buildViewmodelRig, type ViewmodelRig } from '../render/viewmodelBuilder';
import { RetroAudio } from '../audio/RetroAudio';

const VIRTUAL_W = 480;
const VIRTUAL_H = 270;
const PLAYER_EYE_Y = 1.68;
const PLAYER_RADIUS = 0.42;

const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  kind: 'fireball' | 'arcane_bolt' | 'enemy_orb';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  poiseDamage: number;
  igniteDps: number;
  life: number;
  mesh: THREE.Mesh;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

interface EnemyVisual {
  group: THREE.Group;
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  shadow: THREE.Mesh;
  lastFrame: SpriteAnimFrame;
}

interface LootVisual {
  group: THREE.Group;
  sprite: THREE.Sprite;
  pillar?: THREE.Mesh;
}

export class GameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onProfileChange: (profile: SaveProfile) => void;

  private renderer!: THREE.WebGLRenderer;
  private isSoftwareGl = false;
  private pixelTarget!: THREE.WebGLRenderTarget;
  private postScene!: THREE.Scene;
  private postCamera!: THREE.OrthographicCamera;
  private postMat!: THREE.ShaderMaterial;

  private worldScene!: THREE.Scene;
  private worldCamera!: THREE.PerspectiveCamera;
  private vmScene!: THREE.Scene;
  private vmCamera!: THREE.PerspectiveCamera;
  private vmRig!: ViewmodelRig;

  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private playerTorchLight!: THREE.PointLight;

  private audio = new RetroAudio();
  private profile: SaveProfile;
  private map: DungeonMap;
  private worldHandles: BuiltWorldHandles | null = null;

  // Game State Machine
  private screen: GameScreenState = 'title';
  private runSeed = 2026;
  private runStartTime = 0;
  private runKills = 0;
  private runEmbers = 0;
  private restCount = 0;
  private fogGateOpen = false;
  private secretWallOpen = false;
  private shrineOpen = false;
  private campTab: HudSnapshot['campTab'] = null;
  private runSummary: RunSummary | null = null;
  private whisperMessage: string | null = null;
  private whisperTimer = 0;
  private banner: ActiveBanner | null = null;

  // Player state
  private px = 0;
  private py = PLAYER_EYE_Y;
  private pz = 0;
  private yaw = 0;
  private pitch = 0;
  private hp = 260;
  private ghostHp = 260;
  private mp = 90;
  private stamina = 100;
  private staminaRegenDelay = 0;
  private stance: Stance = 'vanguard';
  private activeHotbarSlot = 1;
  private flaskCharges = 4;
  private portalScrolls = 2;
  private bagItems: GearItem[] = [];
  private bagRunes: MysticRune[] = [];

  // Combat feel & animations
  private comboStep = 0;
  private comboResetTimer = 0;
  private attackTimer = 0;
  private attackDuration = 0;
  private attackDidHit = false;
  private currentSwingKind: 'light1' | 'light2' | 'light3' | 'heavy' | 'riposte' = 'light1';
  private isChargingHeavy = false;
  private heavyChargeTime = 0;
  private isBlocking = false;
  private parryTimer = 0;
  private parryCooldown = 0;
  private dodgeTimer = 0;
  private dodgeVx = 0;
  private dodgeVz = 0;
  private dodgeCooldown = 0;
  private isChannelingPortal = false;
  private portalProgress = 0;
  private spellAnimTimer = 0;
  private stanceSwapTimer = 0;
  private walkDist = 0;
  private stepDist = 0;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private damageFlash = 0;
  private parryFlash = 0;
  private trapCooldown = 0;
  private defeatBeatTimer = 0;
  private pendingDefeat = false;

  // Entities & Visuals
  private enemies: EnemyEntity[] = [];
  private enemyVisuals = new Map<string, EnemyVisual>();
  private groundLoot: GroundLoot[] = [];
  private lootVisuals = new Map<string, LootVisual>();
  private lostEchoSprite: THREE.Sprite | null = null;
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private particleInst!: THREE.InstancedMesh;

  // Input state
  private keys = new Set<string>();
  private pointerLocked = false;
  private touchMode = false;
  private mouseLeftDown = false;
  private mouseRightDown = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private hudSyncAccum = 0;
  private elapsed = 0;
  private lastTime = 0;
  private frameId = 0;
  private disposed = false;

  private logs: LogEntry[] = [];
  private nextLogId = 1;

  // Bound event listeners for clean teardown
  private boundKeyDown!: (e: KeyboardEvent) => void;
  private boundKeyUp!: (e: KeyboardEvent) => void;
  private boundMouseMove!: (e: MouseEvent) => void;
  private boundMouseDown!: (e: MouseEvent) => void;
  private boundMouseUp!: (e: MouseEvent) => void;
  private boundContextMenu!: (e: MouseEvent) => void;
  private boundPointerLock!: () => void;
  private boundTouchStart!: () => void;
  private boundResize!: () => void;
  private boundBlur!: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onProfileChange: (profile: SaveProfile) => void,
    autostart = false
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onProfileChange = onProfileChange;
    this.profile = loadSaveProfile();
    this.map = generateHubMap();

    this.initRenderer();
    this.initScenes();
    this.initPools();
    this.loadMap(this.map, true);
    this.syncPlayerCaps(true);
    this.bindEvents();

    if (autostart) {
      this.startGame(false);
    } else {
      document.body.dataset.state = 'title';
      this.emitHud();
    }

    this.lastTime = performance.now();
    this.tick();
  }

  private detectSoftwareGl(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRenderer(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false; // Crisp retro-3D lighting via dynamic flickering torches + contact shadows
    this.renderer.autoClear = false;

    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(200, this.container.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h);
    this.renderer.domElement.className = 'w-full h-full block pixelated';
    this.renderer.domElement.style.imageRendering = 'pixelated';
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // Aspect-matched low-res WebGLRenderTarget (480x270 on 16:9 desktop, square pixels on portrait mobile!)
    const { vw, vh } = this.computeVirtualRes(w, h);
    this.pixelTarget = new THREE.WebGLRenderTarget(vw, vh, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });

    // Post-processing fullscreen quad: Nearest upscale + 16-bit color quantization + 4x4 Bayer ordered dithering
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.pixelTarget.texture },
        uResolution: { value: new THREE.Vector2(vw, vh) },
        uDamageFlash: { value: 0 },
        uParryFlash: { value: 0 },
        uLowHp: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uDamageFlash;
        uniform float uParryFlash;
        uniform float uLowHp;
        varying vec2 vUv;

        float bayer4(vec2 p) {
          vec2 f = floor(mod(p, 4.0));
          int x = int(f.x);
          int y = int(f.y);
          int idx = y * 4 + x;
          if (idx == 0) return 0.0 / 16.0;
          if (idx == 1) return 8.0 / 16.0;
          if (idx == 2) return 2.0 / 16.0;
          if (idx == 3) return 10.0 / 16.0;
          if (idx == 4) return 12.0 / 16.0;
          if (idx == 5) return 4.0 / 16.0;
          if (idx == 6) return 14.0 / 16.0;
          if (idx == 7) return 6.0 / 16.0;
          if (idx == 8) return 3.0 / 16.0;
          if (idx == 9) return 11.0 / 16.0;
          if (idx == 10) return 1.0 / 16.0;
          if (idx == 11) return 9.0 / 16.0;
          if (idx == 12) return 15.0 / 16.0;
          if (idx == 13) return 7.0 / 16.0;
          if (idx == 14) return 13.0 / 16.0;
          return 5.0 / 16.0;
        }

        void main() {
          // Snap UVs cleanly to virtual 480x270 pixel centers
          vec2 pixelCoord = floor(vUv * uResolution);
          vec2 snappedUv = (pixelCoord + 0.5) / uResolution;
          vec3 col = texture2D(tDiffuse, snappedUv).rgb;

          // Subtle 4x4 Bayer ordered dithering strongest in darker shadow bands
          float lum = dot(col, vec3(0.299, 0.587, 0.114));
          float dither = (bayer4(pixelCoord) - 0.5) * mix(0.055, 0.018, clamp(lum * 1.4, 0.0, 1.0));

          // Painterly 16-bit color quantization (30 tonal bands per channel)
          float levels = 30.0;
          col = floor((col + dither) * levels + 0.5) / levels;
          col = clamp(col, 0.0, 1.0);

          // Atmospheric dark-fantasy edge vignette + damage/parry cues
          vec2 centered = vUv - 0.5;
          float dist = length(centered);
          float vig = smoothstep(0.44, 0.92, dist);
          col *= mix(1.0, 0.72, vig);

          // Low HP / hit crimson edge tint
          float redPulse = max(uDamageFlash, uLowHp * 0.45);
          col = mix(col, vec3(0.75, 0.08, 0.06), vig * redPulse * 0.85);

          // Parry gold/steel flash
          col += vec3(0.85, 0.68, 0.25) * uParryFlash * 0.22;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.postScene.add(quad);
  }

  private computeVirtualRes(w: number, h: number): { vw: number; vh: number } {
    const aspect = Math.max(0.4, Math.min(2.6, w / Math.max(1, h)));
    if (aspect >= 1) {
      return { vw: Math.round(VIRTUAL_H * aspect), vh: VIRTUAL_H };
    }
    const baseW = 240;
    return { vw: baseW, vh: Math.round(baseW / aspect) };
  }

  private initScenes(): void {
    const w = Math.max(320, this.container.clientWidth || window.innerWidth);
    const h = Math.max(200, this.container.clientHeight || window.innerHeight);
    const aspect = w / h;

    this.worldScene = new THREE.Scene();
    this.worldCamera = new THREE.PerspectiveCamera(68, aspect, 0.12, 130);

    // Mandatory studio environment map for metallic reflections on weapons, armor, chests
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.worldScene.environment = envTex;
    pmrem.dispose();

    // Balanced warm/cool lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x6c598c, 0x241d29, 0.85);
    this.worldScene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffcb8c, 0.9);
    this.dirLight.position.set(16, 28, 12);
    this.worldScene.add(this.dirLight);

    // Warm personal lantern glow so dungeon stonework, vaulted arches & enemies stay richly legible
    this.playerTorchLight = new THREE.PointLight(0xffa654, 2.1, 16.0, 1.35);
    this.worldScene.add(this.playerTorchLight);

    // Dedicated Foreground Viewmodel Scene (rendered after depth clear so weapons NEVER clip walls!)
    // Deliberately omit RoomEnvironment on vmScene so hammered pixel steel never blows out to white glare!
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(56, aspect, 0.05, 8);

    const vmHemi = new THREE.HemisphereLight(0xe3ecff, 0x594435, 1.35);
    this.vmScene.add(vmHemi);
    const vmKey = new THREE.DirectionalLight(0xfff0d8, 1.85);
    vmKey.position.set(-1.2, 2.2, 2.5);
    this.vmScene.add(vmKey);

    this.vmRig = buildViewmodelRig();
    this.vmScene.add(this.vmRig.root);
    this.refreshViewmodelWeaponVisuals();
  }

  private initPools(): void {
    // Pre-allocated pooled 3D particle ring buffer (zero GC per frame!)
    const maxParticles = 140;
    const pGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInst = new THREE.InstancedMesh(pGeo, pMat, maxParticles);
    this.particleInst.frustumCulled = false;
    this.worldScene.add(this.particleInst);

    const zeroMat = new THREE.Matrix4().makeScale(0, 0, 0);
    const defaultCol = new THREE.Color(0xffffff);
    for (let i = 0; i < maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        r: 1,
        g: 1,
        b: 1,
      });
      this.particleInst.setMatrixAt(i, zeroMat);
      this.particleInst.setColorAt(i, defaultCol);
    }

    // Pre-allocated projectile pool (fireballs, arcane bolts, cultist orbs)
    const projGeo = new THREE.OctahedronGeometry(0.22, 1);
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(
        projGeo,
        new THREE.MeshBasicMaterial({ color: 0xff8424 })
      );
      mesh.visible = false;
      this.worldScene.add(mesh);
      this.projectiles.push({
        active: false,
        fromPlayer: true,
        kind: 'fireball',
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        damage: 0,
        poiseDamage: 0,
        igniteDps: 0,
        life: 0,
        mesh,
      });
    }
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColor: number,
    speed = 3.6,
    size = 1.0
  ): void {
    const col = new THREE.Color(hexColor);
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const theta = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.25) * 1.4;
        const spd = speed * (0.45 + Math.random() * 0.75);
        p.vx = Math.cos(theta) * spd;
        p.vy = 1.4 + elev * spd;
        p.vz = Math.sin(theta) * spd;
        p.maxLife = 0.28 + Math.random() * 0.34;
        p.life = p.maxLife;
        p.size = size * (0.7 + Math.random() * 0.6);
        p.r = col.r;
        p.g = col.g;
        p.b = col.b;
        spawned++;
      }
    }
  }

  private clearDynamicEntities(): void {
    this.enemyVisuals.forEach((v) => {
      this.worldScene.remove(v.group);
      v.mat.dispose();
    });
    this.enemyVisuals.clear();
    this.enemies = [];

    this.lootVisuals.forEach((v) => {
      this.worldScene.remove(v.group);
    });
    this.lootVisuals.clear();
    this.groundLoot = [];

    if (this.lostEchoSprite) {
      this.worldScene.remove(this.lostEchoSprite);
      this.lostEchoSprite = null;
    }

    for (const pr of this.projectiles) {
      pr.active = false;
      pr.mesh.visible = false;
    }
  }

  private loadMap(nextMap: DungeonMap, resetPlayerPos = true): void {
    if (this.worldHandles) {
      this.worldScene.remove(this.worldHandles.root);
      this.worldHandles.dispose();
      this.worldHandles = null;
    }
    this.clearDynamicEntities();

    this.map = nextMap;
    this.fogGateOpen = false;
    this.secretWallOpen = false;

    const pal = BIOME_PALETTES[nextMap.biome];
    this.worldScene.background = new THREE.Color(pal.fogColor);
    this.worldScene.fog = new THREE.FogExp2(pal.fogColor, pal.fogDensity);
    this.hemiLight.color.setHex(pal.ambientSky);
    this.hemiLight.groundColor.setHex(pal.ambientGround);
    this.hemiLight.intensity = nextMap.biome === 'hub' ? 1.15 : 0.82;
    this.dirLight.intensity = nextMap.biome === 'hub' ? 1.05 : 0.45;

    this.worldHandles = buildWorldGeometry(nextMap);
    this.worldScene.add(this.worldHandles.root);

    if (resetPlayerPos) {
      this.px = nextMap.spawnX;
      this.pz = nextMap.spawnZ;
      this.py = PLAYER_EYE_Y;
      this.yaw = nextMap.spawnYaw;
      this.pitch = 0;
    }

    // Spawn enemies on dungeon floors
    if (nextMap.floorNumber > 0) {
      this.spawnEnemiesForCurrentFloor();

      // Place an immediate atmospheric starter loot vignette in the Grand Vault Nave (matching reference!)
      const c1 = nextMap.rooms[1];
      if (c1) {
        const cx = (c1.gx + c1.gw / 2) * nextMap.tileSize;
        const cz = (c1.gz + c1.gh / 2 + 1.2) * nextMap.tileSize;
        const legDrop = generateGearItem({
          floor: nextMap.floorNumber,
          vaultPressure: this.getVaultPressure(),
          forcedRarity: 'L',
          forcedSlot: 'weapon',
          bound: false,
        });
        legDrop.name = nextMap.floorNumber === 1 ? 'Legendary Flame Sword' : legDrop.name;
        this.spawnGroundLoot(cx, cz - 0.9, 'gear', legDrop.rarity, `${legDrop.name} [L]`, legDrop);

        const bootsDrop = generateGearItem({
          floor: nextMap.floorNumber,
          forcedRarity: 'C',
          forcedSlot: 'boots',
          bound: false,
        });
        bootsDrop.name = 'Sturdy Iron Boots';
        this.spawnGroundLoot(cx - 1.0, cz + 0.2, 'gear', 'C', `${bootsDrop.name} [C]`, bootsDrop);

        const runeDrop = generateMysticRune(nextMap.floorNumber);
        this.spawnGroundLoot(cx + 1.1, cz + 0.3, 'rune', runeDrop.rarity, `${runeDrop.name} [${runeDrop.rarity}]`, undefined, runeDrop);
      }

      // Spawn Lost Echo if player died on this floor!
      if (this.profile.lostEcho && this.profile.lostEcho.floor === nextMap.floorNumber) {
        const echo = this.profile.lostEcho;
        const mat = new THREE.SpriteMaterial({ map: getPropSpriteTexture('lost_echo'), transparent: true });
        this.lostEchoSprite = new THREE.Sprite(mat);
        this.lostEchoSprite.position.set(echo.x, 1.0, echo.z);
        this.lostEchoSprite.scale.set(1.25, 1.25, 1);
        this.worldScene.add(this.lostEchoSprite);
        this.map.interactables.push({
          id: 'lost_echo_site',
          kind: 'lost_echo',
          x: echo.x,
          z: echo.z,
          label: 'Reclaim Lost Echo',
          sublabel: `+${echo.embers} Soul Embers${echo.bestItem ? ` & ${echo.bestItem.name}` : ''}`,
          used: false,
        });
      }
    }

    this.audio.setBossMode(false);
    this.emitHud();
  }

  private spawnEnemiesForCurrentFloor(): void {
    const pressure = this.getVaultPressure();
    const scale = computePressureEnemyScale(pressure);
    const floorScale = 1 + (this.map.floorNumber - 1) * 0.36;
    const shadowTex = getBiomeTexturePack(this.map.biome).contactShadowMap;

    for (const sp of this.map.enemySpawns) {
      const entity = this.createEnemyEntity(sp.archetype, sp.x, sp.z, sp.roomIndex, sp.isElite, floorScale, scale);
      this.enemies.push(entity);

      const group = new THREE.Group();
      group.position.set(entity.x, 0, entity.z);

      const mat = new THREE.SpriteMaterial({
        map: getEnemySpriteTexture(entity.archetype, 'idle'),
        transparent: true,
        color: 0xffffff,
      });
      const sprite = new THREE.Sprite(mat);
      const h = entity.isBoss ? 2.75 : entity.archetype === 'spider' ? 1.25 : 1.88;
      const w = entity.isBoss ? 2.65 : entity.archetype === 'spider' ? 1.7 : 1.6;
      sprite.scale.set(w * entity.scale, h * entity.scale, 1);
      sprite.position.y = (h * entity.scale) / 2;
      group.add(sprite);

      // Ground contact shadow disc (zero floating!)
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(entity.isBoss ? 1.25 : 0.72, 12),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.55, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      group.add(shadow);

      this.worldScene.add(group);
      this.enemyVisuals.set(entity.id, { group, sprite, mat, shadow, lastFrame: 'idle' });
    }
  }

  private createEnemyEntity(
    archetype: EnemyArchetype,
    x: number,
    z: number,
    roomIndex: number,
    isElite: boolean,
    floorScale: number,
    pressureScale: { hpMult: number; dmgMult: number }
  ): EnemyEntity {
    const eliteMult = isElite ? 1.45 : 1.0;
    const isBoss = archetype.startsWith('boss_');

    const configs: Record<
      EnemyArchetype,
      { name: string; behavior: EnemyEntity['behavior']; hp: number; poise: number; dmg: number; speed: number; range: number; xp: number; embers: number; scale: number }
    > = {
      goblin: { name: 'Dungeon Goblin', behavior: 'swarmer', hp: 74, poise: 45, dmg: 18, speed: 3.1, range: 1.9, xp: 28, embers: 14, scale: 1.0 },
      spider: { name: 'Giant Vault Spider', behavior: 'flanker', hp: 68, poise: 40, dmg: 22, speed: 3.6, range: 2.0, xp: 34, embers: 18, scale: 1.0 },
      cultist: { name: 'Ember Cultist', behavior: 'kiter', hp: 66, poise: 35, dmg: 24, speed: 2.4, range: 9.5, xp: 40, embers: 22, scale: 1.05 },
      sentinel: { name: 'Armored Vault Sentinel', behavior: 'shielded', hp: 130, poise: 95, dmg: 30, speed: 2.1, range: 2.25, xp: 58, embers: 32, scale: 1.15 },
      boss_b1: { name: 'The Drowned Warden', behavior: 'boss', hp: 380, poise: 150, dmg: 38, speed: 2.6, range: 2.9, xp: 220, embers: 140, scale: 1.1 },
      boss_b2: { name: 'Gilded Adjudicator', behavior: 'boss', hp: 480, poise: 185, dmg: 44, speed: 2.8, range: 3.0, xp: 300, embers: 190, scale: 1.15 },
      boss_b3: { name: 'Cinder Sovereign', behavior: 'boss', hp: 580, poise: 210, dmg: 50, speed: 3.0, range: 3.2, xp: 400, embers: 260, scale: 1.2 },
      boss_b4: { name: 'Hollow Eclipse', behavior: 'boss', hp: 700, poise: 240, dmg: 56, speed: 3.2, range: 3.3, xp: 520, embers: 340, scale: 1.25 },
    };

    const c = configs[archetype];
    const maxHp = Math.round(c.hp * floorScale * pressureScale.hpMult * (isBoss ? 1 : eliteMult));
    const maxPoise = Math.round(c.poise * (1 + (this.map.floorNumber - 1) * 0.2) * (isElite && !isBoss ? 1.25 : 1));
    const damage = Math.round(c.dmg * floorScale * pressureScale.dmgMult);

    return {
      id: nextUid('enemy'),
      name: isElite && !isBoss ? `Elite ${c.name}` : c.name,
      archetype,
      behavior: c.behavior,
      isBoss,
      isElite,
      x,
      y: 0,
      z,
      vx: 0,
      vz: 0,
      facingAngle: 0,
      hp: maxHp,
      maxHp,
      poise: maxPoise,
      maxPoise,
      damage,
      speed: c.speed,
      attackRange: c.range,
      aggroRange: isBoss ? 18 : 11.5,
      aiState: 'idle',
      stateTimer: 0.4,
      attackCooldown: 0.6 + Math.random() * 0.5,
      hitFlashTimer: 0,
      staggerTimer: 0,
      koTimer: 0,
      arcanePrimeStacks: 0,
      burnTimer: 0,
      burnDps: 0,
      roomIndex,
      xpReward: Math.round(c.xp * floorScale),
      emberReward: Math.round(c.embers * floorScale),
      scale: isElite && !isBoss ? c.scale * 1.12 : c.scale,
      animTime: Math.random() * 4,
      hasHitDuringSwing: false,
    };
  }

  private spawnGroundLoot(
    x: number,
    z: number,
    kind: GroundLoot['kind'],
    rarity: Rarity,
    label: string,
    item?: GearItem,
    rune?: MysticRune,
    amount?: number
  ): void {
    const drop: GroundLoot = {
      id: nextUid('drop'),
      x,
      z,
      kind,
      item,
      rune,
      amount,
      rarity,
      label,
      collected: false,
      spawnTime: this.elapsed,
    };
    this.groundLoot.push(drop);

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const spriteMat = new THREE.SpriteMaterial({
      map: getLootSpriteTexture(kind, rarity, item?.slot),
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 0.45;
    sprite.scale.set(0.75, 0.75, 1);
    group.add(sprite);

    // Subtle ground glow ring
    const ringColor = rarity === 'L' ? 0xffbf36 : rarity === 'R' ? 0xa962f5 : rarity === 'E' ? 0x43d96b : 0x5ca0e6;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.42, 12),
      new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);

    // VERTICAL GOLDEN LIGHT PILLAR for Legendaries (Golden Standard Directive!)
    let pillar: THREE.Mesh | undefined;
    if (rarity === 'L') {
      pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.28, 6.2, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffc845,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      pillar.position.y = 3.1;
      group.add(pillar);
      this.audio.playLegendaryChime();
    }

    this.worldScene.add(group);
    this.lootVisuals.set(drop.id, { group, sprite, pillar });
  }

  private getVaultPressure(): number {
    if (this.map.floorNumber <= 0) return 0;
    const cleared = this.map.rooms.filter((r) => r.kind !== 'spawn' && r.kind !== 'shrine' && r.cleared).length;
    return computeVaultPressure(this.map.floorNumber, cleared, this.restCount);
  }

  private syncPlayerCaps(fullRefill = false): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    if (fullRefill) {
      this.hp = stats.maxHp;
      this.ghostHp = stats.maxHp;
      this.mp = stats.maxMp;
      this.stamina = stats.maxStamina;
      this.flaskCharges = stats.maxFlaskCharges;
      const extRank = this.profile.constellations.find((c) => c.id === 'extraction')?.rank ?? 0;
      this.portalScrolls = 2 + extRank;
    } else {
      this.hp = Math.min(this.hp, stats.maxHp);
      this.mp = Math.min(this.mp, stats.maxMp);
      this.stamina = Math.min(this.stamina, stats.maxStamina);
    }
    this.refreshViewmodelWeaponVisuals();
  }

  private refreshViewmodelWeaponVisuals(): void {
    const wep = this.profile.equipped.weapon;
    this.vmRig.setFlameBlade(Boolean(wep?.flameEffect || wep?.rarity === 'L'));
  }

  private pushLog(text: string, tone: LogEntry['tone'] = 'normal'): void {
    this.logs.push({ id: this.nextLogId++, text, tone });
    if (this.logs.length > 6) this.logs.shift();
  }

  private showBanner(title: string, subtitle: string | undefined, tone: ActiveBanner['tone'], durationSec = 2.8): void {
    this.banner = { title, subtitle, tone, expiresAt: this.elapsed + durationSec };
  }

  // =========================================================================
  // PUBLIC CONTROLLER API (Called from React UI & Keyboard/Touch)
  // =========================================================================

  public getProfile(): SaveProfile {
    return this.profile;
  }

  public getDungeonMap(): DungeonMap {
    return this.map;
  }

  public getEnemiesForMinimap(): Array<{ x: number; z: number; isBoss: boolean }> {
    return this.enemies
      .filter((e) => e.aiState !== 'ko')
      .map((e) => ({ x: e.x, z: e.z, isBoss: e.isBoss }));
  }

  public getLootForMinimap(): Array<{ x: number; z: number; isLegendary: boolean }> {
    return this.groundLoot
      .filter((l) => !l.collected)
      .map((l) => ({ x: l.x, z: l.z, isLegendary: l.rarity === 'L' }));
  }

  public startGame(jumpIntoDungeon = false): void {
    this.audio.unlock();
    this.keys.clear();
    this.mouseLeftDown = false;
    this.mouseRightDown = false;
    this.screen = 'playing';
    this.runSummary = null;
    this.shrineOpen = false;
    this.campTab = null;
    this.pendingDefeat = false;
    this.runStartTime = performance.now();
    this.runKills = 0;
    this.runEmbers = 0;
    this.restCount = 0;
    this.bagItems = [];
    this.bagRunes = [];
    this.syncPlayerCaps(true);

    document.body.dataset.state = 'playing';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (jumpIntoDungeon) {
      this.descendToFloor(1);
    } else {
      this.loadMap(generateHubMap(), true);
      this.pushLog('You stand upon the Twilight Bridge. The Sunken Vaults yawn ahead.', 'normal');
      this.showBanner('THE TWILIGHT CROSSING', 'Surface Camp & Cavern Mouth', 'gold', 1.5);
    }
    this.emitHud();
  }

  public descendToFloor(floorNumber: number): void {
    this.audio.unlock();
    this.runSeed = (Date.now() & 0xffff) + floorNumber * 131;
    const nextMap = generateDungeonFloor(floorNumber, this.runSeed);
    this.loadMap(nextMap, true);
    const pal = BIOME_PALETTES[nextMap.biome];
    this.pushLog(`Descended into ${pal.floorLabel}. Vault Pressure rises!`, 'combat');
    this.showBanner(`THE SUNKEN VAULTS — B${floorNumber}`, pal.floorLabel, 'gold', 1.5);
    this.emitHud();
  }

  public returnToBridge(): void {
    this.screen = 'playing';
    this.campTab = null;
    this.shrineOpen = false;
    this.runSummary = null;
    this.pendingDefeat = false;
    document.body.dataset.state = 'playing';
    this.syncPlayerCaps(true);
    this.loadMap(generateHubMap(), true);
    this.pushLog('Returned safely to the Twilight Bridge Surface Camp.', 'normal');
    this.emitHud();
  }

  public togglePause(): void {
    if (this.screen === 'title' || this.screen === 'gameover') return;
    if (this.campTab || this.shrineOpen) {
      this.campTab = null;
      this.shrineOpen = false;
      this.emitHud();
      return;
    }
    if (this.screen === 'playing') {
      this.screen = 'paused';
      document.body.dataset.state = 'paused';
      document.exitPointerLock?.();
      this.keys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
    } else if (this.screen === 'paused') {
      this.screen = 'playing';
      document.body.dataset.state = 'playing';
    }
    this.emitHud();
  }

  public returnToTitle(): void {
    this.screen = 'title';
    this.campTab = null;
    this.shrineOpen = false;
    this.runSummary = null;
    document.body.dataset.state = 'title';
    document.exitPointerLock?.();
    this.loadMap(generateHubMap(), true);
    this.emitHud();
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.emitHud();
  }

  public setCampTab(tab: HudSnapshot['campTab']): void {
    this.campTab = tab;
    if (tab) {
      document.exitPointerLock?.();
      this.keys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
    }
    this.emitHud();
  }

  public closeShrine(): void {
    this.shrineOpen = false;
    this.emitHud();
  }

  public swapStance(): void {
    if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;
    this.stance = this.stance === 'vanguard' ? 'arcanist' : 'vanguard';
    this.stanceSwapTimer = 0.25;
    this.isBlocking = false;
    this.isChargingHeavy = false;
    this.activeHotbarSlot = this.stance === 'vanguard' ? 1 : 3;
    this.audio.playStanceSwap();
    this.pushLog(
      this.stance === 'vanguard' ? 'Swapped to Vanguard Stance (Sword & Shield).' : 'Swapped to Arcanist Stance (Arcane Staff).',
      'spell'
    );
    this.emitHud();
  }

  public useHotbarSlot(slot: number): void {
    if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;
    this.audio.unlock();
    this.activeHotbarSlot = slot;
    if (slot === 1) {
      if (this.stance !== 'vanguard') this.swapStance();
      this.performPrimaryAttack(false);
    } else if (slot === 2) {
      if (this.stance !== 'vanguard') this.swapStance();
      this.triggerParryAttempt();
    } else if (slot === 3) {
      if (this.stance !== 'arcanist') this.swapStance();
      this.castFireball();
    } else if (slot === 4) {
      if (this.stance === 'vanguard') this.performPrimaryAttack(true);
      else this.castResonanceNova();
    } else if (slot === 5) {
      this.drinkCrimsonFlask();
    } else if (slot === 6 || slot === 7) {
      this.setCampTab('inventory');
    } else if (slot === 8) {
      this.beginPortalExtraction();
    }
    this.emitHud();
  }

  public equipItem(itemId: string, source: 'bag' | 'stash'): void {
    const list = source === 'bag' ? this.bagItems : this.profile.stash;
    const idx = list.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const item = list[idx];
    const { nextEquipped, replaced } = equipFromStashOrBag(this.profile.equipped, item);

    if (source === 'bag') {
      this.bagItems.splice(idx, 1);
      if (replaced) this.bagItems.push(replaced);
    } else {
      const nextStash = [...this.profile.stash];
      nextStash.splice(idx, 1);
      if (replaced && nextStash.length < MAX_STASH_SLOTS) nextStash.push({ ...replaced, bound: true });
      this.profile = { ...this.profile, stash: nextStash };
    }

    this.profile = { ...this.profile, equipped: nextEquipped };
    persistSaveProfile(this.profile);
    this.syncPlayerCaps(false);
    this.onProfileChange(this.profile);
    this.pushLog(`Equipped ${item.name} [${item.rarity}].`, `loot_${item.rarity}`);
    this.audio.playPickup();
    this.emitHud();
  }

  public socketRuneIntoWeapon(runeId: string, targetSlot: 'weapon' | 'staff', source: 'bag' | 'stash'): void {
    const weapon = this.profile.equipped[targetSlot];
    if (!weapon || weapon.socketedRunes.length >= weapon.runeSlots) return;

    const list = source === 'bag' ? this.bagRunes : this.profile.runesStash;
    const idx = list.findIndex((r) => r.id === runeId);
    if (idx === -1) return;
    const rune = list[idx];

    if (source === 'bag') {
      this.bagRunes.splice(idx, 1);
    } else {
      const nextRunes = [...this.profile.runesStash];
      nextRunes.splice(idx, 1);
      this.profile = { ...this.profile, runesStash: nextRunes };
    }

    const updatedWeapon: GearItem = {
      ...weapon,
      socketedRunes: [...weapon.socketedRunes, rune],
    };
    this.profile = {
      ...this.profile,
      equipped: { ...this.profile.equipped, [targetSlot]: updatedWeapon },
    };
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.pushLog(`Socketed ${rune.name} (Rank ${rune.rank}) into ${weapon.name}!`, 'spell');
    this.audio.playResonanceDetonate();
    this.emitHud();
  }

  public unsocketRuneFromWeapon(targetSlot: 'weapon' | 'staff', runeId: string): void {
    const weapon = this.profile.equipped[targetSlot];
    if (!weapon) return;
    const rune = weapon.socketedRunes.find((r) => r.id === runeId);
    if (!rune) return;

    const updatedWeapon: GearItem = {
      ...weapon,
      socketedRunes: weapon.socketedRunes.filter((r) => r.id !== runeId),
    };
    this.profile = {
      ...this.profile,
      equipped: { ...this.profile.equipped, [targetSlot]: updatedWeapon },
      runesStash: [...this.profile.runesStash, rune],
    };
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.emitHud();
  }

  public reforgeEquippedOrStash(itemId: string): void {
    const cost = 35;
    if (this.profile.soulEmbers < cost) return;

    for (const slot of Object.keys(this.profile.equipped) as GearSlot[]) {
      const it = this.profile.equipped[slot];
      if (it && it.id === itemId) {
        const updated = reforgeItemAffixes(it);
        this.profile = {
          ...this.profile,
          soulEmbers: this.profile.soulEmbers - cost,
          equipped: { ...this.profile.equipped, [slot]: updated },
        };
        persistSaveProfile(this.profile);
        this.syncPlayerCaps(false);
        this.onProfileChange(this.profile);
        this.audio.playParryClang();
        this.pushLog(`Ember Forge reforged ${updated.name}!`, 'loot_R');
        this.emitHud();
        return;
      }
    }

    const sIdx = this.profile.stash.findIndex((i) => i.id === itemId);
    if (sIdx >= 0) {
      const nextStash = [...this.profile.stash];
      nextStash[sIdx] = reforgeItemAffixes(nextStash[sIdx]);
      this.profile = {
        ...this.profile,
        soulEmbers: this.profile.soulEmbers - cost,
        stash: nextStash,
      };
      persistSaveProfile(this.profile);
      this.onProfileChange(this.profile);
      this.audio.playParryClang();
      this.emitHud();
    }
  }

  public upgradeStoredRune(runeId: string): void {
    const idx = this.profile.runesStash.findIndex((r) => r.id === runeId);
    if (idx === -1) return;
    const rune = this.profile.runesStash[idx];
    const cost = 30 * rune.rank;
    if (rune.rank >= 5 || this.profile.soulEmbers < cost) return;

    const nextRunes = [...this.profile.runesStash];
    nextRunes[idx] = upgradeRuneRank(rune);
    this.profile = {
      ...this.profile,
      soulEmbers: this.profile.soulEmbers - cost,
      runesStash: nextRunes,
    };
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.audio.playLegendaryChime();
    this.pushLog(`Upgraded ${nextRunes[idx].name} to Rank ${nextRunes[idx].rank}!`, 'spell');
    this.emitHud();
  }

  public transposeRemembrance(remId: string): void {
    const idx = this.profile.remembrances.findIndex((r) => r.id === remId && !r.transposed);
    if (idx === -1) return;
    const rem = this.profile.remembrances[idx];
    const sigWeapon = transposeBossRemembrance(rem);
    const nextRems = this.profile.remembrances.map((r, i) => (i === idx ? { ...r, transposed: true } : r));

    this.profile = {
      ...this.profile,
      remembrances: nextRems,
      stash: [sigWeapon, ...this.profile.stash].slice(0, MAX_STASH_SLOTS),
    };
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.audio.playLegendaryChime();
    this.pushLog(`Transposed ${sigWeapon.name} [L] into Bound Stash!`, 'loot_L');
    this.emitHud();
  }

  public upgradeConstellation(nodeId: string): void {
    const { profile, success } = upgradeConstellationNode(this.profile, nodeId);
    if (!success) return;
    this.profile = profile;
    persistSaveProfile(this.profile);
    this.syncPlayerCaps(false);
    this.onProfileChange(this.profile);
    this.audio.playResonanceDetonate();
    this.emitHud();
  }

  public shrineBindItem(itemId: string): void {
    const item = this.bagItems.find((i) => i.id === itemId && !i.bound);
    if (!item) return;
    item.bound = true;
    this.shrineOpen = false;
    this.audio.playLegendaryChime();
    this.pushLog(`Bound [${item.name}] permanently at the Kindled Shrine!`, 'loot_L');
    this.showBanner('RELIC BOUND', `${item.name} will survive death`, 'gold', 2.2);
    this.emitHud();
  }

  public shrineRestAndRefill(): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.hp = stats.maxHp;
    this.ghostHp = stats.maxHp;
    this.mp = stats.maxMp;
    this.stamina = stats.maxStamina;
    this.flaskCharges = stats.maxFlaskCharges;
    this.restCount += 1;
    this.shrineOpen = false;

    // Soulslike trade-off: Resting refills flasks & HP, but respawns all non-boss enemies on the floor!
    const aliveBosses = this.enemies.filter((e) => e.isBoss && e.aiState !== 'ko');
    this.enemyVisuals.forEach((v, id) => {
      if (!aliveBosses.some((b) => b.id === id)) {
        this.worldScene.remove(v.group);
        v.mat.dispose();
        this.enemyVisuals.delete(id);
      }
    });
    this.enemies = aliveBosses;

    const pressure = this.getVaultPressure();
    const pScale = computePressureEnemyScale(pressure);
    const floorScale = 1 + (this.map.floorNumber - 1) * 0.36;
    const shadowTex = getBiomeTexturePack(this.map.biome).contactShadowMap;

    for (const sp of this.map.enemySpawns) {
      if (sp.archetype.startsWith('boss_')) continue;
      const entity = this.createEnemyEntity(sp.archetype, sp.x, sp.z, sp.roomIndex, sp.isElite, floorScale, pScale);
      this.enemies.push(entity);
      const group = new THREE.Group();
      group.position.set(entity.x, 0, entity.z);
      const mat = new THREE.SpriteMaterial({ map: getEnemySpriteTexture(entity.archetype, 'idle'), transparent: true });
      const sprite = new THREE.Sprite(mat);
      const h = entity.archetype === 'spider' ? 1.25 : 1.88;
      const w = entity.archetype === 'spider' ? 1.7 : 1.6;
      sprite.scale.set(w * entity.scale, h * entity.scale, 1);
      sprite.position.y = (h * entity.scale) / 2;
      group.add(sprite);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 12),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.55, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      group.add(shadow);
      this.worldScene.add(group);
      this.enemyVisuals.set(entity.id, { group, sprite, mat, shadow, lastFrame: 'idle' });
    }

    this.audio.playResonanceDetonate();
    this.pushLog('Rested at Kindled Shrine. Flasks refilled; fallen foes awaken!', 'combat');
    this.showBanner('SHRINE KINDLED', 'Crimson Flasks Refilled · Vault Foes Respawned', 'gold', 2.4);
    this.emitHud();
  }

  public setTouchJoystick(nx: number, ny: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, nx));
    this.touchMoveY = Math.max(-1, Math.min(1, ny));
  }

  public addTouchLookDelta(dx: number, dy: number): void {
    if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;
    this.yaw -= dx * 0.0055;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0042, -0.58, 0.58);
  }

  public triggerMobileAction(action: 'attack' | 'heavy' | 'parry' | 'dodge' | 'swap' | 'interact'): void {
    if (this.screen !== 'playing') return;
    this.audio.unlock();
    if (action === 'attack') {
      if (this.stance === 'vanguard') this.performPrimaryAttack(false);
      else this.castArcaneBolt();
    } else if (action === 'heavy') {
      if (this.stance === 'vanguard') this.performPrimaryAttack(true);
      else this.castFireball();
    } else if (action === 'parry') {
      this.triggerParryAttempt();
    } else if (action === 'dodge') {
      this.triggerDodge();
    } else if (action === 'swap') {
      this.swapStance();
    } else if (action === 'interact') {
      this.triggerInteractOrRiposte();
    }
  }

  // =========================================================================
  // COMBAT, INTERACTION, FLASK & EXTRACTION MECHANICS
  // =========================================================================

  private performPrimaryAttack(heavy: boolean): void {
    if (this.attackTimer > 0 || this.dodgeTimer > 0 || this.isChannelingPortal) return;
    const cost = heavy ? STAMINA_COSTS.heavyAttack : STAMINA_COSTS.lightAttack;
    if (this.stamina < cost * 0.6) {
      this.pushLog('Not enough Stamina!', 'danger');
      return;
    }

    this.stamina = Math.max(0, this.stamina - cost);
    this.staminaRegenDelay = 0.65;
    this.isBlocking = false;

    if (heavy) {
      this.currentSwingKind = 'heavy';
      this.attackDuration = 0.52;
      this.comboStep = 0;
    } else {
      this.comboStep = this.comboResetTimer > 0 ? (this.comboStep % 3) + 1 : 1;
      this.comboResetTimer = 0.95;
      this.currentSwingKind = this.comboStep === 1 ? 'light1' : this.comboStep === 2 ? 'light2' : 'light3';
      this.attackDuration = this.comboStep === 3 ? 0.42 : 0.32;
    }
    this.attackTimer = this.attackDuration;
    this.attackDidHit = false;
    this.audio.playSwordSwing(heavy);
  }

  private executeMeleeHitCheck(): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const reach = this.currentSwingKind === 'heavy' ? 3.5 : 2.95;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);

    let hitSomething = false;
    for (const enemy of this.enemies) {
      if (enemy.aiState === 'ko') continue;
      const dx = enemy.x - this.px;
      const dz = enemy.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist > reach + (enemy.isBoss ? 0.6 : 0)) continue;

      const dot = (dx * fx + dz * fz) / Math.max(0.001, dist);
      if (dot < 0.42) continue;

      const result = resolvePlayerStrike({
        stats,
        stance: this.stance,
        attackKind: this.currentSwingKind,
        targetPrimeStacks: enemy.arcanePrimeStacks,
        targetStaggered: enemy.aiState === 'staggered',
      });

      // Armored Sentinel reduces un-primed frontal light steel hits by 40%
      let finalDamage = result.damage;
      if (enemy.behavior === 'shielded' && enemy.aiState !== 'staggered' && !result.resonanceDetonated && this.currentSwingKind !== 'heavy') {
        finalDamage = Math.round(finalDamage * 0.6);
      }

      this.applyDamageToEnemy(enemy, finalDamage, result.poiseDamage, result.igniteDps, result.resonanceDetonated, result.isCrit);
      hitSomething = true;
    }

    // Also allow smashing the cracked secret wall by swinging at it!
    if (!this.secretWallOpen) {
      const sw = this.map.interactables.find((i) => i.kind === 'secret_wall' && !i.used);
      if (sw && Math.hypot(sw.x - this.px, sw.z - this.pz) < 3.2) {
        this.openSecretWall(sw);
        hitSomething = true;
      }
    }

    if (hitSomething) {
      this.hitstopTimer = this.currentSwingKind === 'heavy' ? 0.068 : 0.036;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + (this.currentSwingKind === 'heavy' ? 0.42 : 0.2));
      this.audio.playSteelHit(this.currentSwingKind === 'heavy');
    }
  }

  private castArcaneBolt(): void {
    if (this.spellAnimTimer > 0 || this.isChannelingPortal) return;
    if (this.mp < MANA_COSTS.arcaneBolt) {
      this.pushLog('Not enough MP!', 'danger');
      return;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.mp -= MANA_COSTS.arcaneBolt;
    this.spellAnimTimer = 0.28;
    const hit = resolvePlayerStrike({
      stats,
      stance: 'arcanist',
      attackKind: 'arcane_bolt',
      targetPrimeStacks: 0,
      targetStaggered: false,
    });
    this.spawnPlayerProjectile('arcane_bolt', 0, hit.damage, hit.poiseDamage, 0);
    this.audio.playStanceSwap();
  }

  private castFireball(): void {
    if (this.spellAnimTimer > 0 || this.isChannelingPortal) return;
    if (this.mp < MANA_COSTS.fireball) {
      this.pushLog('Not enough MP for Fireball!', 'danger');
      return;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.mp -= MANA_COSTS.fireball;
    this.spellAnimTimer = 0.36;

    const hit = resolvePlayerStrike({
      stats,
      stance: 'arcanist',
      attackKind: 'fireball',
      targetPrimeStacks: 0,
      targetStaggered: false,
    });

    // Mystic Rune of Splitting mutates Fireball into a 3-way (or 5-way at rank 4+) spread!
    const splitRank = getRuneRank(stats.activeRunes, 'splitting');
    if (splitRank > 0) {
      const angles = splitRank >= 4 ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.15, 0, 0.15];
      const dmg = Math.round(hit.damage * (0.72 + (splitRank - 1) * 0.08));
      for (const a of angles) {
        this.spawnPlayerProjectile('fireball', a, dmg, Math.round(hit.poiseDamage * 0.7), hit.igniteDps);
      }
      this.pushLog(`Cast Split Fireball (${angles.length}x)!`, 'spell');
    } else {
      this.spawnPlayerProjectile('fireball', 0, hit.damage, hit.poiseDamage, hit.igniteDps);
      this.pushLog('Cast Fireball!', 'spell');
    }
    this.audio.playFireball();
  }

  private castResonanceNova(): void {
    if (this.spellAnimTimer > 0 || this.isChannelingPortal) return;
    if (this.mp < MANA_COSTS.resonanceNova) {
      this.pushLog('Not enough MP for Arcane Nova!', 'danger');
      return;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.mp -= MANA_COSTS.resonanceNova;
    this.spellAnimTimer = 0.44;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
    this.audio.playResonanceDetonate();
    this.spawnParticles(this.px, 1.2, this.pz, 24, 0x58d4ff, 6.0, 1.3);

    const hit = resolvePlayerStrike({
      stats,
      stance: 'arcanist',
      attackKind: 'nova',
      targetPrimeStacks: 0,
      targetStaggered: false,
    });

    for (const enemy of this.enemies) {
      if (enemy.aiState === 'ko') continue;
      if (Math.hypot(enemy.x - this.px, enemy.z - this.pz) <= 5.5) {
        enemy.arcanePrimeStacks = Math.min(3, enemy.arcanePrimeStacks + (stats.arcanist3pc ? 2 : 1));
        this.applyDamageToEnemy(enemy, hit.damage, hit.poiseDamage, hit.igniteDps, false, hit.isCrit);
      }
    }
    this.pushLog('Unleashed Arcane Nova! Nearby foes Primed.', 'spell');
  }

  private spawnPlayerProjectile(
    kind: 'fireball' | 'arcane_bolt',
    yawOffset: number,
    damage: number,
    poiseDamage: number,
    igniteDps: number
  ): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    const angle = this.yaw + yawOffset;
    const speed = kind === 'fireball' ? 14.5 : 19.0;
    const fx = -Math.sin(angle);
    const fz = -Math.cos(angle);

    slot.active = true;
    slot.fromPlayer = true;
    slot.kind = kind;
    slot.x = this.px + fx * 0.65;
    slot.y = this.py - 0.14;
    slot.z = this.pz + fz * 0.65;
    slot.vx = fx * speed;
    slot.vy = Math.sin(this.pitch) * speed * 0.7;
    slot.vz = fz * speed;
    slot.damage = damage;
    slot.poiseDamage = poiseDamage;
    slot.igniteDps = igniteDps;
    slot.life = 2.0;

    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(kind === 'fireball' ? 0xff7c24 : 0x52c8ff);
    slot.mesh.scale.setScalar(kind === 'fireball' ? 1.15 : 0.72);
    slot.mesh.position.set(slot.x, slot.y, slot.z);
    slot.mesh.visible = true;
  }

  private spawnEnemyOrb(enemy: EnemyEntity): void {
    const slot = this.projectiles.find((p) => !p.active);
    if (!slot) return;
    const dx = this.px - enemy.x;
    const dz = this.pz - enemy.z;
    const dist = Math.max(0.1, Math.hypot(dx, dz));
    const speed = 9.5;
    slot.active = true;
    slot.fromPlayer = false;
    slot.kind = 'enemy_orb';
    slot.x = enemy.x;
    slot.y = 1.35;
    slot.z = enemy.z;
    slot.vx = (dx / dist) * speed;
    slot.vy = 0;
    slot.vz = (dz / dist) * speed;
    slot.damage = enemy.damage;
    slot.poiseDamage = 0;
    slot.igniteDps = 0;
    slot.life = 2.4;
    (slot.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x47c5ff);
    slot.mesh.scale.setScalar(0.9);
    slot.mesh.position.set(slot.x, slot.y, slot.z);
    slot.mesh.visible = true;
  }

  private triggerParryAttempt(): void {
    if (this.parryCooldown > 0 || this.dodgeTimer > 0) return;
    if (this.stamina < STAMINA_COSTS.parryAttempt) return;
    this.stamina = Math.max(0, this.stamina - STAMINA_COSTS.parryAttempt);
    this.staminaRegenDelay = 0.45;
    this.parryTimer = PARRY_WINDOW_SEC;
    this.parryCooldown = 0.55;
    this.audio.playSwordSwing(false);
  }

  private triggerDodge(): void {
    if (this.dodgeTimer > 0 || this.dodgeCooldown > 0 || this.isChannelingPortal) return;
    if (this.stamina < STAMINA_COSTS.dodge * 0.7) {
      this.pushLog('Too exhausted to Dodge!', 'danger');
      return;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.stamina = Math.max(0, this.stamina - STAMINA_COSTS.dodge);
    this.staminaRegenDelay = 0.55;
    this.isBlocking = false;
    this.isChargingHeavy = false;

    const moveF = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + this.touchMoveY;
    const moveR = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touchMoveX;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);

    let dx = fx * moveF + rx * moveR;
    let dz = fz * moveF + rz * moveR;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) {
      dx = -fx; // Backstep if no directional key held
      dz = -fz;
    } else {
      dx /= len;
      dz /= len;
    }

    const speed = stats.stalker2pc ? 11.8 : 9.8;
    this.dodgeVx = dx * speed;
    this.dodgeVz = dz * speed;
    this.dodgeTimer = 0.28;
    this.dodgeCooldown = stats.stalker2pc ? 0.45 : 0.62;
    this.audio.playFootstep();
  }

  private drinkCrimsonFlask(): void {
    if (this.flaskCharges <= 0) {
      this.pushLog('Crimson Ember Flask is empty! Rest at a Kindled Shrine.', 'danger');
      return;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    if (this.hp >= stats.maxHp) return;
    this.flaskCharges -= 1;
    const heal = Math.round(stats.maxHp * 0.52);
    this.hp = Math.min(stats.maxHp, this.hp + heal);
    this.audio.playPickup();
    this.spawnParticles(this.px, 1.2, this.pz, 10, 0xe83b3b, 2.2, 0.8);
    this.pushLog(`Drank Crimson Ember Flask (+${heal} HP).`, 'normal');
    this.emitHud();
  }

  private beginPortalExtraction(): void {
    if (this.map.floorNumber <= 0) {
      this.pushLog('Already on the Surface Bridge.', 'normal');
      return;
    }
    if (this.portalScrolls <= 0) {
      this.pushLog('No Portal Scrolls remaining!', 'danger');
      return;
    }
    this.isChannelingPortal = true;
    this.portalProgress = 0;
    this.audio.playResonanceDetonate();
    this.pushLog('Channeling Portal Scroll — hold steady to extract!', 'spell');
  }

  private completeExtraction(): void {
    this.isChannelingPortal = false;
    this.portalProgress = 0;
    this.portalScrolls = Math.max(0, this.portalScrolls - 1);

    const record = {
      id: nextUid('run'),
      date: new Date().toISOString().slice(0, 10),
      outcome: 'extracted' as const,
      maxFloor: this.map.floorNumber,
      kills: this.runKills,
      embersEarned: this.runEmbers,
      pressurePeak: this.getVaultPressure(),
    };
    const { profile, itemsSecured } = applyExtractionToProfile(
      this.profile,
      this.bagItems,
      this.bagRunes,
      this.runEmbers,
      record
    );
    this.profile = profile;
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);

    this.runSummary = {
      outcome: 'extracted',
      floorReached: this.map.floorNumber,
      kills: this.runKills,
      embersBanked: this.runEmbers,
      itemsSecured,
      itemsLost: 0,
      vaultPressure: this.getVaultPressure(),
      durationSec: Math.max(1, Math.round((performance.now() - this.runStartTime) / 1000)),
    };
    this.bagItems = [];
    this.bagRunes = [];
    this.screen = 'gameover';
    document.body.dataset.state = 'gameover';
    document.exitPointerLock?.();
    this.audio.playLegendaryChime();
    this.showBanner('VAULT EXTRACTED', 'All Unbound relics secured to Bound Stash', 'gold', 3.5);
    this.emitHud();
  }

  private triggerDefeat(): void {
    const record = {
      id: nextUid('run'),
      date: new Date().toISOString().slice(0, 10),
      outcome: 'defeated' as const,
      maxFloor: Math.max(1, this.map.floorNumber),
      kills: this.runKills,
      embersEarned: this.runEmbers,
      pressurePeak: this.getVaultPressure(),
    };
    const { profile, lostCount, echo } = applyDefeatToProfile(
      this.profile,
      this.bagItems,
      this.bagRunes,
      this.runEmbers,
      { floor: Math.max(1, this.map.floorNumber), x: this.px, z: this.pz },
      record
    );
    this.profile = profile;
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);

    this.runSummary = {
      outcome: 'defeated',
      floorReached: Math.max(1, this.map.floorNumber),
      kills: this.runKills,
      embersBanked: Math.round(this.runEmbers * 0.25),
      itemsSecured: this.bagItems.filter((i) => i.bound).length,
      itemsLost: lostCount,
      vaultPressure: this.getVaultPressure(),
      lostEchoFloor: echo.floor,
      durationSec: Math.max(1, Math.round((performance.now() - this.runStartTime) / 1000)),
    };
    this.bagItems = [];
    this.bagRunes = [];
    this.screen = 'gameover';
    document.body.dataset.state = 'gameover';
    document.exitPointerLock?.();
    this.showBanner('YOU DIED', `Lost Echo condensed on Vault B${echo.floor}`, 'crimson', 4.0);
    this.emitHud();
  }

  private findStaggeredRiposteTarget(): EnemyEntity | null {
    for (const e of this.enemies) {
      if (e.aiState === 'staggered' && Math.hypot(e.x - this.px, e.z - this.pz) < 3.4) {
        return e;
      }
    }
    return null;
  }

  private findClosestLoot(): GroundLoot | null {
    let best: GroundLoot | null = null;
    let bestDist = 2.6;
    for (const l of this.groundLoot) {
      if (l.collected) continue;
      const d = Math.hypot(l.x - this.px, l.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = l;
      }
    }
    return best;
  }

  private findClosestInteractable(): Interactable | null {
    let best: Interactable | null = null;
    let bestDist = 3.1;
    for (const inter of this.map.interactables) {
      if (inter.used && inter.kind !== 'ember_forge' && inter.kind !== 'bound_stash' && inter.kind !== 'constellation_altar' && inter.kind !== 'codex_lectern' && inter.kind !== 'kindled_shrine' && inter.kind !== 'cavern_entrance' && inter.kind !== 'stairs_down' && inter.kind !== 'whisper_rune') {
        continue;
      }
      const d = Math.hypot(inter.x - this.px, inter.z - this.pz);
      if (d < bestDist) {
        bestDist = d;
        best = inter;
      }
    }
    return best;
  }

  public triggerInteractOrRiposte(): void {
    if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;

    // 1. Critical Riposte on staggered enemy takes top combat priority!
    const riposteTarget = this.findStaggeredRiposteTarget();
    if (riposteTarget) {
      const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
      const hit = resolvePlayerStrike({
        stats,
        stance: 'vanguard',
        attackKind: 'riposte',
        targetPrimeStacks: riposteTarget.arcanePrimeStacks,
        targetStaggered: true,
      });
      this.currentSwingKind = 'riposte';
      this.attackDuration = 0.45;
      this.attackTimer = 0.45;
      this.attackDidHit = true;
      this.hitstopTimer = 0.08;
      this.cameraTrauma = 0.65;
      this.parryFlash = 0.85;
      this.audio.playPoiseBreak();
      this.audio.playSteelHit(true);
      this.applyDamageToEnemy(riposteTarget, hit.damage, 0, 0, hit.resonanceDetonated, true);
      riposteTarget.aiState = riposteTarget.hp <= 0 ? 'ko' : 'recover';
      riposteTarget.poise = riposteTarget.maxPoise;
      if (stats.vanguard3pc) {
        const heal = Math.round(stats.maxHp * 0.25);
        this.hp = Math.min(stats.maxHp, this.hp + heal);
        this.spawnParticles(riposteTarget.x, 1.2, riposteTarget.z, 22, 0xffaa33, 5.5, 1.2);
      }
      this.pushLog(`CRITICAL RIPOSTE! Dealt ${hit.damage} damage!`, 'combat');
      this.emitHud();
      return;
    }

    // 2. Ground loot pickup
    const loot = this.findClosestLoot();
    if (loot) {
      this.collectGroundLoot(loot);
      return;
    }

    // 3. World interactables (Cavern mouth, Forge, Stash, Shrine, Chest, Fog Gate, Secret Wall, Whispering Rune, Stairs)
    const inter = this.findClosestInteractable();
    if (!inter) return;

    switch (inter.kind) {
      case 'cavern_entrance':
        this.descendToFloor(inter.floor ?? 1);
        break;
      case 'stairs_down': {
        const bossAlive = this.enemies.some((e) => e.isBoss && e.aiState !== 'ko');
        if (bossAlive) {
          this.pushLog('Defeat the Floor Boss before descending deeper!', 'danger');
        } else {
          this.descendToFloor(inter.floor ?? this.map.floorNumber + 1);
        }
        break;
      }
      case 'ember_forge':
        this.setCampTab('forge');
        break;
      case 'bound_stash':
        this.setCampTab('stash');
        break;
      case 'constellation_altar':
        this.setCampTab('constellation');
        break;
      case 'codex_lectern':
        this.setCampTab('codex');
        break;
      case 'kindled_shrine':
        this.shrineOpen = true;
        document.exitPointerLock?.();
        this.keys.clear();
        this.emitHud();
        break;
      case 'chest':
        this.openChest(inter);
        break;
      case 'fog_gate':
        this.traverseFogGate(inter);
        break;
      case 'secret_wall':
        this.openSecretWall(inter);
        break;
      case 'whisper_rune':
        this.whisperMessage = inter.whisperText ?? 'An ancient inscription fades into ash.';
        this.whisperTimer = 6.0;
        this.audio.playStanceSwap();
        this.emitHud();
        break;
      case 'lost_echo':
        this.reclaimLostEcho(inter);
        break;
    }
  }

  private collectGroundLoot(loot: GroundLoot): void {
    loot.collected = true;
    const vis = this.lootVisuals.get(loot.id);
    if (vis) {
      this.worldScene.remove(vis.group);
      this.lootVisuals.delete(loot.id);
    }

    if (loot.kind === 'gear' && loot.item) {
      this.bagItems.push(loot.item);
      this.pushLog(`Found [${loot.item.name}] [${loot.item.rarity}]!`, `loot_${loot.item.rarity}`);
    } else if (loot.kind === 'rune' && loot.rune) {
      this.bagRunes.push(loot.rune);
      this.pushLog(`Found [${loot.rune.name} R${loot.rune.rank}]!`, `loot_${loot.rune.rarity}`);
    } else if (loot.kind === 'embers') {
      const amt = loot.amount ?? 20;
      this.runEmbers += amt;
      this.pushLog(`Gathered +${amt} Soul Embers.`, 'loot_L');
    } else if (loot.kind === 'portal_scroll') {
      this.portalScrolls += 1;
      this.pushLog('Found +1 Portal Scroll!', 'loot_E');
    }
    this.audio.playPickup();
    this.emitHud();
  }

  private openChest(inter: Interactable): void {
    inter.used = true;
    const cm = this.worldHandles?.chestMeshes.get(inter.id);
    if (cm) {
      cm.lid.rotation.x = -1.1;
      cm.lid.position.z = -0.25;
      cm.glow.visible = true;
    }
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const isSecret = inter.id.includes('secret');
    const gear = generateGearItem({
      floor: this.map.floorNumber,
      vaultPressure: this.getVaultPressure() + (isSecret ? 35 : 15),
      forcedRarity: isSecret ? (Math.random() < 0.55 ? 'L' : 'R') : undefined,
      stalker3pc: stats.stalker3pc,
    });
    this.spawnGroundLoot(inter.x - 0.5, inter.z + 0.75, 'gear', gear.rarity, `${gear.name} [${gear.rarity}]`, gear);
    const rune = generateMysticRune(this.map.floorNumber);
    this.spawnGroundLoot(inter.x + 0.6, inter.z + 0.75, 'rune', rune.rarity, `${rune.name} [${rune.rarity}]`, undefined, rune);
    this.spawnGroundLoot(inter.x, inter.z + 1.05, 'embers', 'E', `+${35 + this.map.floorNumber * 18} Soul Embers`, undefined, undefined, 35 + this.map.floorNumber * 18);
    this.spawnParticles(inter.x, 0.8, inter.z, 18, 0xffc845, 3.8, 1.0);
    this.audio.playPickup();
    this.pushLog(`Opened ${inter.label}! Loot scattered across the flagstones.`, 'loot_L');
  }

  private traverseFogGate(inter: Interactable): void {
    inter.used = true;
    this.fogGateOpen = true;
    if (this.worldHandles?.fogGateMesh) {
      this.worldHandles.fogGateMesh.visible = false;
    }
    // Step player smoothly past the mist into the Boss Sanctum
    this.pz = inter.z - 2.2;
    this.audio.setBossMode(true);
    this.audio.playPoiseBreak();
    const boss = this.enemies.find((e) => e.isBoss);
    if (boss) {
      boss.aiState = 'chase';
      this.showBanner(boss.name.toUpperCase(), `Floor B${this.map.floorNumber} Guardian`, 'crimson', 3.0);
      this.pushLog(`Traversed the Mist — ${boss.name} awakens!`, 'danger');
    }
    this.emitHud();
  }

  private openSecretWall(inter: Interactable): void {
    inter.used = true;
    this.secretWallOpen = true;
    if (this.worldHandles) {
      for (const m of this.worldHandles.secretWallMeshes) {
        m.visible = false;
      }
    }
    this.spawnParticles(inter.x, 1.8, inter.z, 26, 0x9e8c72, 4.5, 1.4);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
    this.audio.playPoiseBreak();
    this.pushLog('Shattered a cracked false wall! Secret Relic Alcove revealed!', 'loot_L');
    this.showBanner('SECRET ALCOVE REVEALED', 'An ancient vault cache lies ahead', 'gold', 2.4);
  }

  private reclaimLostEcho(inter: Interactable): void {
    const echo = this.profile.lostEcho;
    if (!echo) return;
    inter.used = true;
    if (this.lostEchoSprite) {
      this.worldScene.remove(this.lostEchoSprite);
      this.lostEchoSprite = null;
    }
    this.runEmbers += echo.embers;
    if (echo.bestItem) {
      this.bagItems.push({ ...echo.bestItem, bound: true });
    }
    this.profile = { ...this.profile, lostEcho: null };
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.audio.playLegendaryChime();
    this.pushLog(`Reclaimed Lost Echo (+${echo.embers} Embers${echo.bestItem ? ` & ${echo.bestItem.name}` : ''})!`, 'loot_L');
    this.showBanner('LOST ECHO RECLAIMED', 'Your fallen relics return to you', 'arcane', 2.6);
    this.emitHud();
  }

  private applyDamageToEnemy(
    enemy: EnemyEntity,
    damage: number,
    poiseDamage: number,
    igniteDps: number,
    resonanceDetonated: boolean,
    isCrit: boolean
  ): void {
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlashTimer = 0.09;
    enemy.aiState = enemy.aiState === 'idle' ? 'chase' : enemy.aiState;

    if (resonanceDetonated) {
      enemy.arcanePrimeStacks = 0;
      this.audio.playResonanceDetonate();
      this.spawnParticles(enemy.x, 1.25, enemy.z, 22, 0x52c8ff, 5.2, 1.2);
      this.pushLog(`RESONANCE DETONATION! ${damage} dmg to ${enemy.name}!`, 'spell');
    } else if (isCrit) {
      this.spawnParticles(enemy.x, 1.25, enemy.z, 16, 0xffd15c, 4.5, 1.1);
    } else {
      this.spawnParticles(enemy.x, 1.15, enemy.z, 10, 0xd94330, 3.6, 0.9);
    }

    if (igniteDps > 0) {
      enemy.burnTimer = 3.0;
      enemy.burnDps = Math.max(enemy.burnDps, igniteDps);
    }

    // Poise break -> Staggered to one knee!
    if (enemy.hp > 0 && enemy.aiState !== 'staggered' && poiseDamage > 0) {
      enemy.poise = Math.max(0, enemy.poise - poiseDamage);
      if (enemy.poise <= 0) {
        enemy.aiState = 'staggered';
        enemy.staggerTimer = 3.2;
        this.audio.playPoiseBreak();
        this.spawnParticles(enemy.x, 1.35, enemy.z, 18, 0xffc845, 4.5, 1.15);
        this.pushLog(`${enemy.name} POISE BROKEN! Press [E] for Critical Riposte!`, 'combat');
      }
    }

    if (enemy.hp <= 0) {
      this.handleEnemyKilled(enemy);
    }
  }

  private handleEnemyKilled(enemy: EnemyEntity): void {
    enemy.aiState = 'ko';
    enemy.koTimer = 0.42;
    this.runKills += 1;

    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const fortuneRank = this.profile.constellations.find((c) => c.id === 'fortune')?.rank ?? 0;
    const embers = Math.round(enemy.emberReward * (1 + fortuneRank * 0.15));
    this.runEmbers += embers;

    // Rune of Leeching heals HP & Stamina on kill!
    const leechRank = getRuneRank(stats.activeRunes, 'leeching');
    if (leechRank > 0) {
      this.hp = Math.min(stats.maxHp, this.hp + 14 + leechRank * 6);
      this.stamina = Math.min(stats.maxStamina, this.stamina + 12 + leechRank * 4);
    }

    // Record bestiary discovery + XP progression permanently
    let nextProf = recordKillInCodex(this.profile, enemy.archetype);
    const { profile: xpProf, leveledUp } = grantXpToProfile(nextProf, enemy.xpReward);
    nextProf = xpProf;

    if (enemy.isBoss) {
      nextProf = addBossRemembranceToProfile(nextProf, this.map.floorNumber, enemy.archetype, enemy.name);
      nextProf = { ...nextProf, highestFloor: Math.max(nextProf.highestFloor, this.map.floorNumber + 1) };
      this.audio.setBossMode(false);
      this.audio.playLegendaryChime();
      this.showBanner('GREAT FOE FELLED', `${enemy.name} vanquished · Remembrance Obtained`, 'gold', 3.6);
      this.pushLog(`GREAT FOE FELLED! ${enemy.name} dropped a Boss Remembrance & Legendary Relic!`, 'loot_L');

      const leg = generateGearItem({
        floor: this.map.floorNumber,
        vaultPressure: this.getVaultPressure() + 30,
        forcedRarity: 'L',
        stalker3pc: stats.stalker3pc,
      });
      this.spawnGroundLoot(enemy.x, enemy.z, 'gear', 'L', `${leg.name} [L]`, leg);
      const rune = generateMysticRune(this.map.floorNumber + 1);
      this.spawnGroundLoot(enemy.x + 0.85, enemy.z + 0.4, 'rune', rune.rarity, `${rune.name} [${rune.rarity}]`, undefined, rune);
    } else {
      this.pushLog(`You defeated ${enemy.name}! (+${enemy.xpReward} XP, +${embers} Embers)`, 'kill');
      const dropChance = enemy.isElite ? 0.95 : 0.62;
      if (Math.random() < dropChance) {
        if (Math.random() < 0.3) {
          const rune = generateMysticRune(this.map.floorNumber);
          this.spawnGroundLoot(enemy.x, enemy.z, 'rune', rune.rarity, `${rune.name} [${rune.rarity}]`, undefined, rune);
        } else {
          const gear = generateGearItem({
            floor: this.map.floorNumber,
            vaultPressure: this.getVaultPressure(),
            stalker3pc: stats.stalker3pc,
          });
          this.spawnGroundLoot(enemy.x, enemy.z, 'gear', gear.rarity, `${gear.name} [${gear.rarity}]`, gear);
        }
      } else {
        this.spawnGroundLoot(enemy.x, enemy.z, 'embers', 'C', `+${embers} Soul Embers`, undefined, undefined, embers);
      }
    }

    if (leveledUp) {
      this.pushLog(`LEVEL UP! Reached Level ${nextProf.level}!`, 'loot_L');
      this.showBanner(`LEVEL ${nextProf.level}`, 'Strength & Arcane Mastery Increased', 'gold', 2.2);
    }

    // Check if room is now cleared -> raises Vault Pressure!
    const room = this.map.rooms[enemy.roomIndex];
    if (room && !room.cleared) {
      const remaining = this.enemies.some((e) => e.roomIndex === enemy.roomIndex && e.aiState !== 'ko');
      if (!remaining) {
        room.cleared = true;
        this.pushLog(`Chamber cleared! Vault Pressure rises to ${this.getVaultPressure()}%.`, 'combat');
      }
    }

    this.profile = nextProf;
    persistSaveProfile(this.profile);
    this.onProfileChange(this.profile);
    this.syncPlayerCaps(false);
    this.spawnParticles(enemy.x, 1.1, enemy.z, enemy.isBoss ? 32 : 16, 0xffaa44, 4.8, 1.2);
  }

  // =========================================================================
  // MAIN SIMULATION LOOP (60Hz Clamped dt, Hit-stop, Software-WebGL Paced)
  // =========================================================================

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    // Hitstop freezes simulation physics briefly while flashes & camera trauma continue ticking!
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.6);
    this.parryFlash = Math.max(0, this.parryFlash - dt * 3.2);
    if (this.banner && this.elapsed > this.banner.expiresAt) {
      this.banner = null;
    }
    if (this.whisperTimer > 0) {
      this.whisperTimer -= dt;
      if (this.whisperTimer <= 0) this.whisperMessage = null;
    }

    if (this.screen === 'title') {
      this.updateTitleCameraTour(dt);
      this.updateWorldAnimations(dt);
    } else if (this.screen === 'playing' && !this.campTab && !this.shrineOpen) {
      if (this.pendingDefeat) {
        this.defeatBeatTimer -= dt;
        this.damageFlash = Math.min(1, this.damageFlash + dt * 1.4);
        if (this.defeatBeatTimer <= 0) {
          this.pendingDefeat = false;
          this.triggerDefeat();
        }
      } else if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.updatePlayer(dt);
        this.updateEnemies(dt);
        this.updateProjectiles(dt);
      }
      this.updateWorldAnimations(dt);
      this.updateParticles(dt);
      this.updateViewmodel(dt);
    }

    this.audio.tickAmbient(dt, this.screen !== 'playing' || Boolean(this.campTab) || this.shrineOpen);
    this.renderFrame();

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.09) {
      this.hudSyncAccum = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 90);
    }
  }

  private updateTitleCameraTour(dt: number): void {
    const t = this.elapsed * 0.28;
    const cx = this.map.spawnX + Math.sin(t) * 1.8;
    const cy = 2.45 + Math.sin(t * 1.3) * 0.16;
    const cz = this.map.spawnZ - 2.0 + Math.cos(t * 0.6) * 2.2;
    this.worldCamera.position.set(cx, cy, cz);
    this.worldCamera.lookAt(this.map.spawnX, 3.2, 4.0);
    this.playerTorchLight.position.set(cx, cy, cz);
    this.vmRig.root.visible = false;
    void dt;
  }

  private updatePlayer(dt: number): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.vmRig.root.visible = true;

    // Keyboard turn fallback (ArrowLeft / ArrowRight or Q) so keyboard-only / headless tests can look around cleanly
    const turnSpeed = 2.1;
    if (this.keys.has('ArrowLeft')) this.yaw += turnSpeed * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= turnSpeed * dt;

    // Portal Scroll extraction channeling
    if (this.isChannelingPortal) {
      const extRank = this.profile.constellations.find((c) => c.id === 'extraction')?.rank ?? 0;
      const channelDuration = Math.max(1.2, 2.8 * (1 - extRank * 0.22));
      this.portalProgress += dt / channelDuration;
      if (this.portalProgress >= 1) {
        this.completeExtraction();
        return;
      }
    }

    // Regenerate Stamina & MP + smooth trailing ghost HP bar
    this.ghostHp = THREE.MathUtils.damp(this.ghostHp, this.hp, 4.5, dt);
    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay -= dt;
    } else {
      const regenRate = this.isBlocking ? stats.staminaRegen * 0.35 : stats.staminaRegen;
      this.stamina = Math.min(stats.maxStamina, this.stamina + regenRate * dt);
    }
    this.mp = Math.min(stats.maxMp, this.mp + stats.mpRegen * dt);

    if (this.comboResetTimer > 0) this.comboResetTimer -= dt;
    if (this.parryTimer > 0) this.parryTimer -= dt;
    if (this.parryCooldown > 0) this.parryCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
    if (this.spellAnimTimer > 0) this.spellAnimTimer -= dt;
    if (this.stanceSwapTimer > 0) this.stanceSwapTimer -= dt;
    if (this.trapCooldown > 0) this.trapCooldown -= dt;

    // Hold Left-Click to charge Heavy Cleave in Vanguard stance
    if (this.mouseLeftDown && this.stance === 'vanguard' && this.attackTimer <= 0) {
      this.heavyChargeTime += dt;
      if (this.heavyChargeTime > 0.22) {
        this.isChargingHeavy = true;
      }
    }

    // Active melee swing phase (windup -> active hit frame -> recovery)
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      const progress = 1 - this.attackTimer / Math.max(0.01, this.attackDuration);
      if (!this.attackDidHit && progress >= 0.38) {
        this.attackDidHit = true;
        this.executeMeleeHitCheck();
      }
    }

    // Movement (WASD / ArrowUp/Down / Touch Joystick) with wall sliding collision
    let vx = 0;
    let vz = 0;

    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      vx = this.dodgeVx;
      vz = this.dodgeVz;
    } else {
      const moveF =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
        this.touchMoveY;
      const moveR = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.touchMoveX;

      if (Math.abs(moveF) > 0.04 || Math.abs(moveR) > 0.04) {
        this.isChannelingPortal = false;
        const fx = -Math.sin(this.yaw);
        const fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw);
        const rz = -Math.sin(this.yaw);
        let dx = fx * moveF + rx * moveR;
        let dz = fz * moveF + rz * moveR;
        const len = Math.hypot(dx, dz);
        if (len > 1) {
          dx /= len;
          dz /= len;
        }
        const baseSpeed = this.isBlocking ? 3.2 : this.isChargingHeavy ? 3.0 : this.attackTimer > 0 ? 3.6 : 5.8;
        vx = dx * baseSpeed;
        vz = dz * baseSpeed;
      }
    }

    const nextX = this.px + vx * dt;
    const nextZ = this.pz + vz * dt;
    if (isWorldPosWalkable(this.map, nextX, this.pz, PLAYER_RADIUS, this.fogGateOpen, this.secretWallOpen)) {
      this.px = nextX;
    }
    if (isWorldPosWalkable(this.map, this.px, nextZ, PLAYER_RADIUS, this.fogGateOpen, this.secretWallOpen)) {
      this.pz = nextZ;
    }

    // Distance-synced gait bob & footsteps
    const moved = Math.hypot(vx * dt, vz * dt);
    if (moved > 0.002 && this.dodgeTimer <= 0) {
      this.walkDist += moved;
      this.stepDist += moved;
      if (this.stepDist >= 2.2) {
        this.stepDist = 0;
        this.audio.playFootstep();
      }
    }

    // Mark discovered rooms on minimap
    const gx = Math.floor(this.px / this.map.tileSize);
    const gz = Math.floor(this.pz / this.map.tileSize);
    for (const r of this.map.rooms) {
      if (gx >= r.gx - 1 && gx <= r.gx + r.gw && gz >= r.gz - 1 && gz <= r.gz + r.gh) {
        r.discovered = true;
      }
    }

    // Floor spike grate traps (tile === 2)
    if (this.map.floorNumber > 0 && this.trapCooldown <= 0 && this.dodgeTimer <= 0) {
      const t = this.map.tiles[gz * this.map.width + gx];
      if (t === 2) {
        this.trapCooldown = 1.6;
        this.applyDamageToPlayer(16 + this.map.floorNumber * 5, this.px, this.pz, true);
        this.pushLog('Triggered iron spike trap!', 'danger');
      }
    }

    // Seamless walk-through into Cavern Mouth from Surface Bridge!
    if (this.map.biome === 'hub' && this.pz < 4.4 * this.map.tileSize && Math.abs(this.px - 9 * this.map.tileSize) < 3.0) {
      this.descendToFloor(1);
      return;
    }

    // Camera position + subtle head bob + trauma shake
    const bobY = Math.sin(this.walkDist * 2.8) * 0.055;
    const shake = this.cameraTrauma * this.cameraTrauma;
    const sx = (Math.random() - 0.5) * shake * 0.14;
    const sy = (Math.random() - 0.5) * shake * 0.14;
    const sRoll = (Math.random() - 0.5) * shake * 0.05;

    this.worldCamera.position.set(this.px + sx, this.py + bobY + sy, this.pz);
    this.worldCamera.rotation.order = 'YXZ';
    this.worldCamera.rotation.set(this.pitch, this.yaw, sRoll);
    this.playerTorchLight.position.set(this.px, this.py + 0.1, this.pz);
  }

  private updateEnemies(dt: number): void {
    // Limit simultaneous melee windups via crowd attack token pool (max 2 concurrent attackers!)
    let activeAttackers = this.enemies.filter((e) => e.aiState === 'windup' || e.aiState === 'attack').length;

    for (const enemy of this.enemies) {
      const vis = this.enemyVisuals.get(enemy.id);
      if (!vis) continue;

      if (enemy.aiState === 'ko') {
        enemy.koTimer -= dt;
        vis.sprite.scale.y = Math.max(0.05, vis.sprite.scale.y * (1 - dt * 4.5));
        vis.mat.opacity = Math.max(0, enemy.koTimer / 0.42);
        if (enemy.koTimer <= 0) {
          vis.group.visible = false;
        }
        continue;
      }

      enemy.animTime += dt;
      if (enemy.hitFlashTimer > 0) enemy.hitFlashTimer -= dt;
      if (enemy.attackCooldown > 0) enemy.attackCooldown -= dt;

      // Burn DoT from Rune of Ignition
      if (enemy.burnTimer > 0) {
        enemy.burnTimer -= dt;
        enemy.hp = Math.max(0, enemy.hp - enemy.burnDps * dt);
        if (Math.random() < dt * 8) {
          this.spawnParticles(enemy.x, 1.0, enemy.z, 2, 0xff7722, 1.8, 0.7);
        }
        if (enemy.hp <= 0) {
          this.handleEnemyKilled(enemy);
          continue;
        }
      }

      const dx = this.px - enemy.x;
      const dz = this.pz - enemy.z;
      const dist = Math.hypot(dx, dz);

      if (enemy.aiState === 'staggered') {
        enemy.staggerTimer -= dt;
        if (enemy.staggerTimer <= 0) {
          enemy.aiState = 'chase';
          enemy.poise = enemy.maxPoise;
        }
      } else if (enemy.aiState === 'windup') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          enemy.aiState = 'attack';
          enemy.stateTimer = 0.24;
          enemy.hasHitDuringSwing = false;
        }
      } else if (enemy.aiState === 'attack') {
        enemy.stateTimer -= dt;
        if (!enemy.hasHitDuringSwing) {
          enemy.hasHitDuringSwing = true;
          if (enemy.behavior === 'kiter') {
            this.spawnEnemyOrb(enemy);
            this.audio.playFireball();
          } else if (dist <= enemy.attackRange + 0.55) {
            this.resolveEnemyMeleeOnPlayer(enemy);
          }
        }
        if (enemy.stateTimer <= 0) {
          enemy.aiState = 'recover';
          enemy.stateTimer = enemy.isBoss ? 0.62 : 0.45;
          enemy.attackCooldown = enemy.isBoss ? 1.15 : 1.05;
        }
      } else if (enemy.aiState === 'recover') {
        enemy.stateTimer -= dt;
        if (enemy.stateTimer <= 0) {
          enemy.aiState = 'chase';
        }
      } else {
        // Idle -> Aggro check (Boss waits behind Fog Gate until opened!)
        if (enemy.isBoss && !this.fogGateOpen) {
          enemy.aiState = 'idle';
        } else if (dist < enemy.aggroRange) {
          enemy.aiState = 'chase';
        }

        if (enemy.aiState === 'chase') {
          // Distinct movement policies per archetype (swarmer, flanker, kiter, shielded, boss)
          const dirX = dx / Math.max(0.001, dist);
          const dirZ = dz / Math.max(0.001, dist);
          let moveX = 0;
          let moveZ = 0;

          if (enemy.behavior === 'kiter') {
            // Ember Cultist keeps optimal mid-range (6m - 8.5m) and strafes
            if (dist < 4.5) {
              moveX = -dirX * enemy.speed * 0.85;
              moveZ = -dirZ * enemy.speed * 0.85;
            } else if (dist > 8.5) {
              moveX = dirX * enemy.speed;
              moveZ = dirZ * enemy.speed;
            } else {
              const strafe = Math.sin(enemy.animTime * 1.5) > 0 ? 1 : -1;
              moveX = -dirZ * strafe * enemy.speed * 0.7;
              moveZ = dirX * strafe * enemy.speed * 0.7;
            }
          } else if (enemy.behavior === 'flanker') {
            // Giant Spider weaves laterally while closing
            const weave = Math.sin(enemy.animTime * 3.4) * 0.72;
            moveX = (dirX - dirZ * weave) * enemy.speed;
            moveZ = (dirZ + dirX * weave) * enemy.speed;
          } else {
            // Swarmer, Shielded Sentinel & Boss advance directly
            if (dist > enemy.attackRange * 0.78) {
              moveX = dirX * enemy.speed;
              moveZ = dirZ * enemy.speed;
            }
          }

          const nx = enemy.x + moveX * dt;
          const nz = enemy.z + moveZ * dt;
          if (isWorldPosWalkable(this.map, nx, enemy.z, 0.45, this.fogGateOpen, this.secretWallOpen)) {
            enemy.x = nx;
          }
          if (isWorldPosWalkable(this.map, enemy.x, nz, 0.45, this.fogGateOpen, this.secretWallOpen)) {
            enemy.z = nz;
          }

          // Initiate telegraphed attack if in range & token available
          if (dist <= enemy.attackRange && enemy.attackCooldown <= 0 && activeAttackers < 2) {
            enemy.aiState = 'windup';
            enemy.stateTimer = enemy.isBoss ? 0.62 : enemy.behavior === 'shielded' ? 0.56 : 0.44;
            activeAttackers += 1;
            this.audio.playEnemyTelegraph();
          }
        }
      }

      // Update sprite position, animation frame & hit/telegraph tint
      vis.group.position.set(enemy.x, 0, enemy.z);
      let frame: SpriteAnimFrame = 'idle';
      if (enemy.aiState === 'staggered') frame = 'stagger';
      else if (enemy.aiState === 'windup') frame = 'windup';
      else if (enemy.aiState === 'attack') frame = 'attack';
      else if (enemy.aiState === 'chase' && Math.floor(enemy.animTime * 5) % 2 === 1) frame = 'walk';

      if (frame !== vis.lastFrame) {
        vis.mat.map = getEnemySpriteTexture(enemy.archetype, frame);
        vis.lastFrame = frame;
      }

      if (enemy.hitFlashTimer > 0) {
        vis.mat.color.setHex(0xffffff);
      } else if (enemy.aiState === 'windup') {
        vis.mat.color.setHex(0xffc994);
      } else if (enemy.aiState === 'staggered') {
        vis.mat.color.setHex(0xffe07d);
      } else if (enemy.arcanePrimeStacks > 0) {
        vis.mat.color.setHex(0x9ee6ff);
      } else {
        vis.mat.color.setHex(0xe8e0d5);
      }
    }
  }

  private resolveEnemyMeleeOnPlayer(enemy: EnemyEntity): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const dx = enemy.x - this.px;
    const dz = enemy.z - this.pz;
    const dist = Math.max(0.01, Math.hypot(dx, dz));
    const dot = THREE.MathUtils.clamp((dx * fx + dz * fz) / dist, -1, 1);
    const angleDiff = Math.acos(dot);

    const res = resolveIncomingEnemyHit({
      rawDamage: enemy.damage,
      playerDefense: stats.defense,
      playerStamina: this.stamina,
      isBlocking: this.isBlocking && this.stance === 'vanguard',
      parryTimer: this.parryTimer,
      angleDiffRad: angleDiff,
      isDodgingInvuln: this.dodgeTimer > 0.04,
      stats,
    });

    if (res.outcome === 'parried') {
      this.parryTimer = 0;
      this.stamina = Math.min(stats.maxStamina, this.stamina + res.staminaRefund);
      this.hitstopTimer = 0.085;
      this.parryFlash = 1.0;
      this.cameraTrauma = 0.48;
      this.audio.playParryClang();
      this.spawnParticles(enemy.x, 1.3, enemy.z, 22, 0xffe27a, 5.2, 1.15);
      this.pushLog(`TIMED PARRY! Shattered ${enemy.name}'s Poise!`, 'combat');

      // Apply massive Parry Poise shatter + optional Rune of Aegis shockwave
      enemy.poise = Math.max(0, enemy.poise - res.parryPoiseDamage);
      if (enemy.poise <= 0) {
        enemy.aiState = 'staggered';
        enemy.staggerTimer = 3.4;
        this.audio.playPoiseBreak();
      }
      if (res.aegisShockDamage > 0) {
        this.applyDamageToEnemy(enemy, res.aegisShockDamage, 20, 0, false, false);
      }
    } else if (res.outcome === 'blocked') {
      if (res.staminaCost > 0) {
        this.stamina = Math.max(0, this.stamina - res.staminaCost);
        this.staminaRegenDelay = 0.6;
        this.hp = Math.max(0, this.hp - res.hpDamage);
        this.audio.playGuardBlock();
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.18);
        this.pushLog(`Guarded ${enemy.name}'s blow (-${res.staminaCost} STA).`, 'normal');
      }
    } else if (res.outcome === 'guard_broken') {
      this.stamina = 0;
      this.isBlocking = false;
      this.applyDamageToPlayer(res.hpDamage, enemy.x, enemy.z, false);
      this.pushLog(`GUARD BROKEN by ${enemy.name}! (-${res.hpDamage} HP)`, 'danger');
    } else {
      this.applyDamageToPlayer(res.hpDamage, enemy.x, enemy.z, false);
      this.pushLog(`${enemy.name} struck you for ${res.hpDamage} damage!`, 'danger');
    }
  }

  private applyDamageToPlayer(amount: number, srcX: number, srcZ: number, ignoreInterrupt: boolean): void {
    void srcX;
    void srcZ;
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = 0.9;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
    if (!ignoreInterrupt) this.isChannelingPortal = false;
    this.audio.playPlayerHurt();

    if (this.hp <= 0 && !this.pendingDefeat) {
      this.pendingDefeat = true;
      this.defeatBeatTimer = 0.55;
      this.showBanner('YOU DIED', undefined, 'crimson', 2.0);
    }
  }

  private updateProjectiles(dt: number): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const tempestRank = getRuneRank(stats.activeRunes, 'tempest');

    for (const pr of this.projectiles) {
      if (!pr.active) continue;
      pr.life -= dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      pr.mesh.rotation.y += dt * 9;

      if (pr.life <= 0 || !isWorldPosWalkable(this.map, pr.x, pr.z, 0.12, this.fogGateOpen, this.secretWallOpen)) {
        pr.active = false;
        pr.mesh.visible = false;
        this.spawnParticles(pr.x, pr.y, pr.z, 8, pr.kind === 'fireball' ? 0xff7c24 : 0x52c8ff, 3.0, 0.8);
        continue;
      }

      if (pr.fromPlayer) {
        for (const enemy of this.enemies) {
          if (enemy.aiState === 'ko') continue;
          const hitRad = enemy.isBoss ? 1.35 : 0.92;
          if (Math.hypot(enemy.x - pr.x, enemy.z - pr.z) < hitRad) {
            pr.active = false;
            pr.mesh.visible = false;
            enemy.arcanePrimeStacks = Math.min(3, enemy.arcanePrimeStacks + (stats.arcanist3pc ? 2 : 1));
            this.applyDamageToEnemy(enemy, pr.damage, pr.poiseDamage, pr.igniteDps, false, false);
            if (stats.arcanist3pc) {
              this.mp = Math.min(stats.maxMp, this.mp + 5);
            }
            this.spawnParticles(pr.x, pr.y, pr.z, 14, pr.kind === 'fireball' ? 0xff8822 : 0x52c8ff, 4.2, 1.0);

            // Rune of Tempest chains Arcane Bolt to nearby enemies!
            if (pr.kind === 'arcane_bolt' && tempestRank > 0) {
              let chains = 1 + Math.floor(tempestRank / 2);
              for (const other of this.enemies) {
                if (chains <= 0) break;
                if (other.id === enemy.id || other.aiState === 'ko') continue;
                if (Math.hypot(other.x - enemy.x, other.z - enemy.z) <= 5.5) {
                  other.arcanePrimeStacks = Math.min(3, other.arcanePrimeStacks + 1);
                  this.applyDamageToEnemy(other, Math.round(pr.damage * 0.72), Math.round(pr.poiseDamage * 0.6), 0, false, false);
                  this.spawnParticles(other.x, 1.3, other.z, 10, 0x70dcff, 3.5, 0.9);
                  chains -= 1;
                }
              }
            }
            break;
          }
        }
      } else {
        // Enemy orb hitting player
        if (Math.hypot(this.px - pr.x, this.pz - pr.z) < 0.75) {
          pr.active = false;
          pr.mesh.visible = false;
          const fx = -Math.sin(this.yaw);
          const fz = -Math.cos(this.yaw);
          const dot = THREE.MathUtils.clamp(((-pr.vx) * fx + (-pr.vz) * fz) / Math.max(0.01, Math.hypot(pr.vx, pr.vz)), -1, 1);
          const res = resolveIncomingEnemyHit({
            rawDamage: pr.damage,
            playerDefense: stats.defense,
            playerStamina: this.stamina,
            isBlocking: this.isBlocking && this.stance === 'vanguard',
            parryTimer: this.parryTimer,
            angleDiffRad: Math.acos(dot),
            isDodgingInvuln: this.dodgeTimer > 0.04,
            stats,
          });
          if (res.outcome === 'parried') {
            this.parryFlash = 0.8;
            this.audio.playParryClang();
            this.pushLog('Parried arcane orb!', 'combat');
          } else if (res.outcome === 'blocked') {
            this.stamina = Math.max(0, this.stamina - res.staminaCost);
            this.hp = Math.max(0, this.hp - res.hpDamage);
            this.audio.playGuardBlock();
          } else {
            this.applyDamageToPlayer(res.hpDamage, pr.x, pr.z, false);
            this.pushLog(`Scorched by Cultist orb (-${res.hpDamage} HP)!`, 'danger');
          }
        }
      }
    }
  }

  private updateWorldAnimations(dt: number): void {
    if (!this.worldHandles) return;

    // Animate 4-frame flickering brazier flames
    const frameStep = Math.floor(this.elapsed * 9);
    for (const f of this.worldHandles.flameSprites) {
      const frame = (frameStep + Math.floor(f.phase * 3)) % 4;
      f.sprite.material.map = getFlameFrameTexture(frame, f.tint);
    }

    // Dynamically assign the 5 pooled PointLights to the 5 nearest braziers around camera for silky chiaroscuro!
    const camX = this.worldCamera.position.x;
    const camZ = this.worldCamera.position.z;
    const sorted = this.map.braziers
      .map((b) => ({ b, d: (b.x - camX) * (b.x - camX) + (b.z - camZ) * (b.z - camZ) }))
      .sort((a, b) => a.d - b.d);

    this.worldHandles.torchLights.forEach((tl, i) => {
      const target = sorted[i];
      if (target) {
        tl.light.position.set(target.b.x, 2.05, target.b.z);
        const flicker = Math.sin(this.elapsed * 11 + tl.phase) * 0.24 + Math.cos(this.elapsed * 17.3 + tl.phase) * 0.14;
        tl.light.intensity = tl.baseIntensity + flicker;
      }
    });

    // Gentle hover bob on ground loot & golden light pillars
    for (const drop of this.groundLoot) {
      if (drop.collected) continue;
      const vis = this.lootVisuals.get(drop.id);
      if (vis) {
        vis.sprite.position.y = 0.48 + Math.sin(this.elapsed * 3.1 + drop.x) * 0.08;
        if (vis.pillar) {
          vis.pillar.rotation.y += dt * 1.1;
        }
      }
    }

    if (this.lostEchoSprite) {
      this.lostEchoSprite.position.y = 1.05 + Math.sin(this.elapsed * 3.2) * 0.14;
    }
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    const col = new THREE.Color();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _scale.set(0, 0, 0);
        _mat4.compose(_v3.set(0, -50, 0), _quat, _scale);
        this.particleInst.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= 9.5 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.05, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const s = p.size * (p.life / p.maxLife);
      _scale.set(s, s, s);
      _mat4.compose(_v3.set(p.x, p.y, p.z), _quat, _scale);
      this.particleInst.setMatrixAt(i, _mat4);
      col.setRGB(p.r, p.g, p.b);
      this.particleInst.setColorAt(i, col);
    }
    if (anyChanged) {
      this.particleInst.instanceMatrix.needsUpdate = true;
      if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;
    }
  }

  private updateViewmodel(dt: number): void {
    const isVanguard = this.stance === 'vanguard';
    this.vmRig.vanguardRight.visible = isVanguard;
    this.vmRig.vanguardLeft.visible = isVanguard;
    this.vmRig.arcanistRight.visible = !isVanguard;
    this.vmRig.arcanistLeft.visible = !isVanguard;

    const bobX = Math.cos(this.walkDist * 1.4) * 0.025;
    const bobY = Math.abs(Math.sin(this.walkDist * 1.4)) * 0.028;
    const swapDrop = Math.max(0, this.stanceSwapTimer) * 1.4;

    if (isVanguard) {
      // Right-hand Broadsword swing arc / heavy charge recoil (matches viewmodelBuilder.ts rest frame!)
      let targetX = 0.39 + bobX;
      let targetY = -0.34 - bobY - swapDrop;
      let targetZ = -0.94;
      let rotX = 0.18;
      let rotY = -0.14;
      let rotZ = 0.22;

      if (this.isChargingHeavy) {
        const c = Math.min(1, this.heavyChargeTime / 0.7);
        targetX += c * 0.14;
        targetY += c * 0.1;
        rotX -= c * 0.45;
        rotZ -= c * 0.4;
      } else if (this.attackTimer > 0) {
        const t = 1 - this.attackTimer / Math.max(0.01, this.attackDuration);
        const arc = Math.sin(t * Math.PI);
        if (this.currentSwingKind === 'light2') {
          targetX -= arc * 0.5;
          targetY += arc * 0.08;
          targetZ -= arc * 0.22;
          rotZ += arc * 1.2;
          rotX -= arc * 0.68;
        } else if (this.currentSwingKind === 'heavy' || this.currentSwingKind === 'riposte') {
          targetX -= arc * 0.38;
          targetY -= arc * 0.18;
          targetZ -= arc * 0.34;
          rotX -= arc * 1.3;
          rotZ += arc * 0.8;
        } else {
          targetX -= arc * 0.42;
          targetY -= arc * 0.1;
          targetZ -= arc * 0.24;
          rotX -= arc * 1.0;
          rotZ += arc * 0.68;
        }
      }

      this.vmRig.vanguardRight.position.x = THREE.MathUtils.damp(this.vmRig.vanguardRight.position.x, targetX, 18, dt);
      this.vmRig.vanguardRight.position.y = THREE.MathUtils.damp(this.vmRig.vanguardRight.position.y, targetY, 18, dt);
      this.vmRig.vanguardRight.position.z = THREE.MathUtils.damp(this.vmRig.vanguardRight.position.z, targetZ, 18, dt);
      this.vmRig.vanguardRight.rotation.x = THREE.MathUtils.damp(this.vmRig.vanguardRight.rotation.x, rotX, 18, dt);
      this.vmRig.vanguardRight.rotation.y = THREE.MathUtils.damp(this.vmRig.vanguardRight.rotation.y, rotY, 18, dt);
      this.vmRig.vanguardRight.rotation.z = THREE.MathUtils.damp(this.vmRig.vanguardRight.rotation.z, rotZ, 18, dt);

      // Left-hand Kite Shield Guard / Parry snap
      let shX = -0.48 - bobX * 0.6;
      let shY = -0.45 - bobY * 0.6 - swapDrop;
      let shZ = -0.88;
      let shRotY = 0.46;
      let shRotZ = -0.16;

      if (this.parryTimer > 0) {
        shX = -0.18;
        shY = -0.22;
        shZ = -0.68;
        shRotY = -0.15;
        shRotZ = -0.58;
      } else if (this.isBlocking) {
        shX = -0.28;
        shY = -0.28;
        shZ = -0.68;
        shRotY = 0.14;
        shRotZ = -0.06;
      }

      this.vmRig.vanguardLeft.position.x = THREE.MathUtils.damp(this.vmRig.vanguardLeft.position.x, shX, 18, dt);
      this.vmRig.vanguardLeft.position.y = THREE.MathUtils.damp(this.vmRig.vanguardLeft.position.y, shY, 18, dt);
      this.vmRig.vanguardLeft.position.z = THREE.MathUtils.damp(this.vmRig.vanguardLeft.position.z, shZ, 18, dt);
      this.vmRig.vanguardLeft.rotation.y = THREE.MathUtils.damp(this.vmRig.vanguardLeft.rotation.y, shRotY, 18, dt);
      this.vmRig.vanguardLeft.rotation.z = THREE.MathUtils.damp(this.vmRig.vanguardLeft.rotation.z, shRotZ, 18, dt);
    } else {
      // Arcanist Staff & Sigil Casting Hand
      const recoil = Math.sin(Math.max(0, this.spellAnimTimer) * 9) * 0.16;
      this.vmRig.arcanistRight.position.set(0.4 + bobX, -0.38 - bobY - swapDrop, -0.92 + recoil);
      this.vmRig.arcanistRight.rotation.x = 0.14 - recoil * 1.4;
      this.vmRig.staffCrystal.rotation.y += dt * 2.4;
      this.vmRig.arcaneSigil.rotation.z -= dt * 3.2;
      this.vmRig.arcanistLeft.position.set(-0.48 - bobX * 0.5, -0.4 - bobY - swapDrop + recoil * 0.6, -0.74 - recoil);
    }
  }

  private renderFrame(): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    this.postMat.uniforms.uDamageFlash.value = this.damageFlash;
    this.postMat.uniforms.uParryFlash.value = this.parryFlash;
    this.postMat.uniforms.uLowHp.value = this.hp / Math.max(1, stats.maxHp) < 0.28 ? 1 : 0;

    // Pass 1: Render 3D world into locked 480x270 NearestFilter target
    this.renderer.setRenderTarget(this.pixelTarget);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.worldScene, this.worldCamera);

    // Pass 2: Clear depth buffer & render first-person foreground viewmodel (never clips into dungeon walls!)
    if (this.vmRig.root.visible) {
      this.renderer.clearDepth();
      this.renderer.render(this.vmScene, this.vmCamera);
    }

    // Pass 3: Upscale nearest-neighbor + color quantization + 4x4 Bayer dithering to screen
    this.renderer.setRenderTarget(null);
    this.renderer.clear(true, true, false);
    this.renderer.render(this.postScene, this.postCamera);
  }

  // =========================================================================
  // SCREEN-SPACE PROJECTION FOR LOOT NAMEPLATES & ENEMY POISE BARS
  // =========================================================================

  private computeProjectedTags(): { loot: ProjectedLootTag[]; enemies: ProjectedEnemyTag[] } {
    const loot: ProjectedLootTag[] = [];
    const enemies: ProjectedEnemyTag[] = [];
    if (this.screen !== 'playing') return { loot, enemies };

    this.worldCamera.updateMatrixWorld();

    for (const drop of this.groundLoot) {
      if (drop.collected) continue;
      const dist = Math.hypot(drop.x - this.px, drop.z - this.pz);
      if (dist > 22) continue;

      const yAnchor = drop.rarity === 'L' ? 1.85 : drop.rarity === 'C' ? 1.3 : 1.05;
      _proj.set(drop.x, yAnchor, drop.z).project(this.worldCamera);
      if (_proj.z < -1 || _proj.z > 1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * 100;
      const sy = (-_proj.y * 0.5 + 0.5) * 100;
      if (sx < 4 || sx > 96 || sy < 8 || sy > 88) continue;

      let deltaSummary: string | undefined;
      if (drop.item && dist < 5.5) {
        deltaSummary = compareItems(drop.item, this.profile.equipped[drop.item.slot]).summary;
      }

      loot.push({
        id: drop.id,
        label: drop.label,
        rarity: drop.rarity,
        screenX: sx,
        screenY: sy,
        distance: dist,
        isLegendary: drop.rarity === 'L',
        deltaSummary,
      });
    }

    for (const enemy of this.enemies) {
      if (enemy.aiState === 'ko' || enemy.isBoss) continue;
      const dist = Math.hypot(enemy.x - this.px, enemy.z - this.pz);
      if (dist > 14) continue;
      if (enemy.hp >= enemy.maxHp && enemy.poise >= enemy.maxPoise && enemy.arcanePrimeStacks === 0 && dist > 6.5) continue;

      _proj.set(enemy.x, enemy.archetype === 'spider' ? 1.55 : 2.25, enemy.z).project(this.worldCamera);
      if (_proj.z < -1 || _proj.z > 1) continue;
      const sx = (_proj.x * 0.5 + 0.5) * 100;
      const sy = (-_proj.y * 0.5 + 0.5) * 100;
      if (sx < 6 || sx > 94 || sy < 8 || sy > 84) continue;

      enemies.push({
        id: enemy.id,
        name: enemy.name,
        hp: Math.round(enemy.hp),
        maxHp: enemy.maxHp,
        poise: Math.round(enemy.poise),
        maxPoise: enemy.maxPoise,
        staggered: enemy.aiState === 'staggered',
        primeStacks: enemy.arcanePrimeStacks,
        isBoss: enemy.isBoss,
        isElite: enemy.isElite,
        screenX: sx,
        screenY: sy,
        distance: dist,
      });
    }

    // Sort by rarity priority + distance and gently de-overlap stacked loot plates like the reference screenshot!
    const rarityRank: Record<Rarity, number> = { L: 0, R: 1, E: 2, C: 3 };
    loot.sort((a, b) => rarityRank[a.rarity] - rarityRank[b.rarity] || a.distance - b.distance);
    const topLoot = loot.slice(0, 6);
    for (let i = 1; i < topLoot.length; i++) {
      for (let j = 0; j < i; j++) {
        if (Math.abs(topLoot[i].screenX - topLoot[j].screenX) < 18 && Math.abs(topLoot[i].screenY - topLoot[j].screenY) < 6.2) {
          topLoot[i].screenY = Math.min(82, topLoot[j].screenY + 6.4);
        }
      }
    }

    enemies.sort((a, b) => a.distance - b.distance);
    return { loot: topLoot, enemies: enemies.slice(0, 4) };
  }

  private emitHud(): void {
    const stats = computeDerivedStats(this.profile.level, this.profile.equipped, this.profile.constellations);
    const { loot, enemies } = this.computeProjectedTags();
    const riposteTarget = this.findStaggeredRiposteTarget();
    const closestLoot = this.findClosestLoot();
    const closestInter = this.findClosestInteractable();

    let interactPrompt: HudSnapshot['interactPrompt'] = null;
    if (riposteTarget) {
      interactPrompt = { label: `Critical Riposte ${riposteTarget.name}`, sublabel: 'Staggered Foe', key: 'E' };
    } else if (closestLoot) {
      interactPrompt = { label: `Pick up ${closestLoot.label}`, key: 'E' };
    } else if (closestInter) {
      interactPrompt = { label: closestInter.label, sublabel: closestInter.sublabel, key: 'E' };
    }

    const boss = this.enemies.find((e) => e.isBoss && e.aiState !== 'ko' && (this.fogGateOpen || e.hp < e.maxHp));
    const combatRooms = this.map.rooms.filter((r) => r.kind === 'combat' || r.kind === 'vault' || r.kind === 'boss');
    const clearedRooms = combatRooms.filter((r) => r.cleared).length;

    const snap: HudSnapshot = {
      screen: this.screen,
      biome: this.map.biome,
      floorNumber: this.map.floorNumber,
      locationLabel: this.map.title,
      objective: this.map.objective,
      hp: Math.round(this.hp),
      maxHp: stats.maxHp,
      ghostHp: Math.round(this.ghostHp),
      mp: Math.round(this.mp),
      maxMp: stats.maxMp,
      stamina: Math.round(this.stamina),
      maxStamina: stats.maxStamina,
      level: this.profile.level,
      xp: this.profile.xp,
      xpToNext: this.profile.xpToNext,
      soulEmbers: this.profile.soulEmbers + this.runEmbers,
      stance: this.stance,
      activeHotbarSlot: this.activeHotbarSlot,
      flaskCharges: this.flaskCharges,
      maxFlaskCharges: stats.maxFlaskCharges,
      portalScrolls: this.portalScrolls,
      vaultPressure: this.getVaultPressure(),
      roomsCleared: clearedRooms,
      totalCombatRooms: combatRooms.length,
      unboundCount: this.bagItems.filter((i) => !i.bound).length + this.bagRunes.filter((r) => !r.bound).length,
      bagItems: [...this.bagItems],
      bagRunes: [...this.bagRunes],
      equipped: this.profile.equipped,
      activeSetBonuses: getActiveSetBonusLabels(this.profile.equipped),
      socketedRuneNames: stats.activeRunes.map((r) => `${r.name} R${r.rank}`),
      isBlocking: this.isBlocking,
      isChargingHeavy: this.isChargingHeavy,
      heavyChargePct: Math.min(100, Math.round((this.heavyChargeTime / 0.7) * 100)),
      isChannelingPortal: this.isChannelingPortal,
      portalProgress: Math.min(100, Math.round(this.portalProgress * 100)),
      pointerLocked: this.pointerLocked,
      touchMode: this.touchMode,
      muted: this.audio.isMuted(),
      interactPrompt,
      ripostePrompt: Boolean(riposteTarget),
      activeBoss: boss
        ? {
            name: boss.name,
            hp: Math.round(boss.hp),
            maxHp: boss.maxHp,
            poise: Math.round(boss.poise),
            maxPoise: boss.maxPoise,
            staggered: boss.aiState === 'staggered',
          }
        : null,
      projectedLoot: loot,
      projectedEnemies: enemies,
      logs: [...this.logs],
      banner: this.banner,
      shrineOpen: this.shrineOpen,
      campTab: this.campTab,
      runSummary: this.runSummary,
      whisperMessage: this.whisperMessage,
      playerX: this.px,
      playerZ: this.pz,
      playerYaw: this.yaw,
    };

    this.onHudUpdate(snap);
  }

  // =========================================================================
  // EVENT LISTENERS (Desktop Pointer Lock + Keyboard + Mobile Auto-Switch)
  // =========================================================================

  private bindEvents(): void {
    this.boundKeyDown = (e: KeyboardEvent) => {
      this.touchMode = false;
      if (this.screen === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          this.startGame(false);
        }
        return;
      }

      if (e.code === 'KeyP' || (e.code === 'Escape' && !this.pointerLocked)) {
        e.preventDefault();
        this.togglePause();
        return;
      }
      if (e.code === 'KeyM') {
        this.toggleMute();
        return;
      }

      if (this.screen !== 'playing') return;

      if (e.code === 'KeyI' || e.code === 'KeyC') {
        e.preventDefault();
        this.setCampTab(this.campTab ? null : 'inventory');
        return;
      }
      if (this.campTab || this.shrineOpen) return;

      this.keys.add(e.code);

      if (e.repeat) return;
      if (e.code === 'Tab') {
        e.preventDefault();
        this.swapStance();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.triggerDodge();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        e.preventDefault();
        this.triggerInteractOrRiposte();
      } else if (e.code === 'KeyR' || e.code === 'Digit5') {
        this.drinkCrimsonFlask();
      } else if (e.code === 'Digit1') {
        this.useHotbarSlot(1);
      } else if (e.code === 'Digit2') {
        this.useHotbarSlot(2);
      } else if (e.code === 'Digit3') {
        this.useHotbarSlot(3);
      } else if (e.code === 'Digit4') {
        this.useHotbarSlot(4);
      } else if (e.code === 'Digit8') {
        this.useHotbarSlot(8);
      }
    };

    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    this.boundMouseMove = (e: MouseEvent) => {
      if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;
      if (this.pointerLocked) {
        this.yaw -= e.movementX * 0.0024;
        this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.002, -0.62, 0.62);
      }
    };

    this.boundMouseDown = (e: MouseEvent) => {
      this.touchMode = false;
      if (this.screen !== 'playing' || this.campTab || this.shrineOpen) return;
      if (e.target !== this.renderer.domElement) return;
      this.audio.unlock();

      // Request Pointer Lock on canvas click for authentic first-person mouse look
      if (!this.pointerLocked && this.renderer.domElement.requestPointerLock) {
        try {
          this.renderer.domElement.requestPointerLock();
        } catch {
          // Headless / iframe fallback: attacks still work without pointer lock!
        }
      }

      if (e.button === 0) {
        this.mouseLeftDown = true;
        this.heavyChargeTime = 0;
        this.isChargingHeavy = false;
        if (this.stance === 'arcanist') {
          this.castArcaneBolt();
        }
      } else if (e.button === 2) {
        this.mouseRightDown = true;
        if (this.stance === 'vanguard') {
          this.triggerParryAttempt();
          this.isBlocking = true;
        } else {
          this.castFireball();
        }
      }
    };

    this.boundMouseUp = (e: MouseEvent) => {
      if (e.button === 0 && this.mouseLeftDown) {
        this.mouseLeftDown = false;
        if (this.screen === 'playing' && !this.campTab && !this.shrineOpen && this.stance === 'vanguard') {
          const heavy = this.heavyChargeTime >= 0.34;
          this.isChargingHeavy = false;
          this.heavyChargeTime = 0;
          this.performPrimaryAttack(heavy);
        }
      } else if (e.button === 2 && this.mouseRightDown) {
        this.mouseRightDown = false;
        this.isBlocking = false;
      }
    };

    this.boundContextMenu = (e: MouseEvent) => {
      if (this.screen === 'playing') e.preventDefault();
    };

    this.boundPointerLock = () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      this.emitHud();
    };

    this.boundTouchStart = () => {
      if (!this.touchMode) {
        this.touchMode = true;
        this.emitHud();
      }
    };

    this.boundResize = () => {
      const w = Math.max(320, this.container.clientWidth || window.innerWidth);
      const h = Math.max(200, this.container.clientHeight || window.innerHeight);
      this.renderer.setSize(w, h);
      const { vw, vh } = this.computeVirtualRes(w, h);
      this.pixelTarget.setSize(vw, vh);
      this.postMat.uniforms.uResolution.value.set(vw, vh);
      const aspect = w / h;
      this.worldCamera.aspect = aspect;
      this.worldCamera.updateProjectionMatrix();
      this.vmCamera.aspect = aspect;
      this.vmCamera.updateProjectionMatrix();
    };

    this.boundBlur = () => {
      this.keys.clear();
      this.mouseLeftDown = false;
      this.mouseRightDown = false;
      this.isBlocking = false;
      this.isChargingHeavy = false;
    };

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('contextmenu', this.boundContextMenu);
    document.addEventListener('pointerlockchange', this.boundPointerLock);
    window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
    window.addEventListener('resize', this.boundResize);
    window.addEventListener('blur', this.boundBlur);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('contextmenu', this.boundContextMenu);
    document.removeEventListener('pointerlockchange', this.boundPointerLock);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('blur', this.boundBlur);

    this.worldHandles?.dispose();
    this.clearDynamicEntities();
    this.pixelTarget.dispose();
    this.postMat.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
