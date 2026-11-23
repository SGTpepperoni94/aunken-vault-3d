import * as THREE from 'three';
import type { DungeonMap } from '../game/types';
import { BIOME_PALETTES } from './DungeonLogic';
import { getBiomeTexturePack } from '../render/textureBaker';
import { getFlameFrameTexture, getPropSpriteTexture } from '../render/billboardSprites';

export interface BuiltWorldHandles {
  root: THREE.Group;
  flameSprites: Array<{ sprite: THREE.Sprite; tint: 'orange' | 'violet' | 'crimson'; phase: number }>;
  torchLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number; x: number; z: number }>;
  fogGateMesh: THREE.Mesh | null;
  secretWallMeshes: THREE.Mesh[];
  chestMeshes: Map<string, { lid: THREE.Mesh; glow: THREE.Mesh }>;
  dispose: () => void;
}

function buildCompositeBrazier(
  wallMat: THREE.Material,
  flameMat: THREE.SpriteMaterial,
  x: number,
  z: number,
  yOffset = 0
): { group: THREE.Group; flameSprite: THREE.Sprite } {
  const group = new THREE.Group();
  group.position.set(x, yOffset, z);

  // Fluted stone pedestal base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.18, 6), wallMat);
  base.position.y = 0.09;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.72, 6), wallMat);
  column.position.y = 0.54;
  group.add(column);

  // Flared stone bowl basin
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.22, 0.34, 7), wallMat);
  bowl.position.y = 1.04;
  group.add(bowl);

  // Glowing ember bed inside bowl
  const coalMat = new THREE.MeshBasicMaterial({ color: 0xff6e1a });
  const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.08, 7), coalMat);
  coals.position.y = 1.21;
  group.add(coals);

  const flameSprite = new THREE.Sprite(flameMat);
  flameSprite.position.set(0, 1.66, 0);
  flameSprite.scale.set(0.95, 1.15, 1);
  group.add(flameSprite);

  return { group, flameSprite };
}

function buildCompositeBarrel(woodMat: THREE.Material, x: number, z: number, rot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  // Bulged wooden barrel (3-part composite)
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.55, 10), woodMat);
  lower.position.y = 0.275;
  g.add(lower);

  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.55, 10), woodMat);
  upper.position.y = 0.825;
  g.add(upper);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 10), woodMat);
  cap.position.y = 1.1;
  g.add(cap);

  return g;
}

function buildCompositeChest(
  chestMat: THREE.Material,
  x: number,
  z: number,
  rot: number
): { group: THREE.Group; lid: THREE.Mesh; glow: THREE.Mesh } {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;

  const box = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.56, 0.68), chestMat);
  box.position.y = 0.28;
  g.add(box);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.04, 8, 1, false, 0, Math.PI), chestMat);
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 0.56, 0);
  g.add(lid);

  const claspMat = new THREE.MeshStandardMaterial({ color: 0xe3b149, roughness: 0.35, metalness: 0.65 });
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), claspMat);
  clasp.position.set(0, 0.5, 0.35);
  g.add(clasp);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.52),
    new THREE.MeshBasicMaterial({ color: 0xffc845, side: THREE.DoubleSide })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.57, 0);
  glow.visible = false;
  g.add(glow);

  return { group: g, lid, glow };
}

function buildDarkPineTree(x: number, y: number, z: number, scale: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x261a16, roughness: 0.92 });
  const pineMat1 = new THREE.MeshStandardMaterial({ color: 0x15241f, roughness: 0.88 });
  const pineMat2 = new THREE.MeshStandardMaterial({ color: 0x1c3128, roughness: 0.85 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 2.8, 6), trunkMat);
  trunk.position.y = 1.4;
  g.add(trunk);

  const tier1 = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.6, 7), pineMat1);
  tier1.position.y = 3.6;
  g.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.65, 3.2, 7), pineMat2);
  tier2.position.y = 5.4;
  g.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.8, 7), pineMat1);
  tier3.position.y = 7.0;
  g.add(tier3);

  return g;
}

function buildHubCampStations(
  root: THREE.Group,
  wallMat: THREE.Material,
  chestMat: THREE.Material,
  flameSprites: BuiltWorldHandles['flameSprites'],
  map: DungeonMap
): void {
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x454c57, roughness: 0.45, metalness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a443, roughness: 0.35, metalness: 0.7 });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x70b8ff,
    emissive: 0x3888ff,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  for (const inter of map.interactables) {
    if (inter.kind === 'ember_forge') {
      const g = new THREE.Group();
      g.position.set(inter.x, 0, inter.z);
      // Stone hearth + glowing forge bed + iron anvil
      const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.4), wallMat);
      hearth.position.y = 0.5;
      g.add(hearth);
      const coalBed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.9), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
      coalBed.position.y = 1.04;
      g.add(coalBed);
      const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.42), ironMat);
      anvilBase.position.set(1.15, 0.225, 0.2);
      g.add(anvilBase);
      const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.28, 0.46), ironMat);
      anvilTop.position.set(1.15, 0.58, 0.2);
      g.add(anvilTop);

      const flameMat = new THREE.SpriteMaterial({ map: getFlameFrameTexture(0, 'orange'), transparent: true });
      const sp = new THREE.Sprite(flameMat);
      sp.position.set(0, 1.55, 0);
      sp.scale.set(1.1, 1.25, 1);
      g.add(sp);
      flameSprites.push({ sprite: sp, tint: 'orange', phase: 0.3 });
      root.add(g);
    } else if (inter.kind === 'bound_stash') {
      const built = buildCompositeChest(chestMat, inter.x, inter.z, -Math.PI / 2);
      built.group.scale.setScalar(1.18);
      root.add(built.group);
    } else if (inter.kind === 'constellation_altar') {
      const g = new THREE.Group();
      g.position.set(inter.x, 0, inter.z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 1.25, 6), wallMat);
      ped.position.y = 0.625;
      g.add(ped);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 12), goldMat);
      ring.position.y = 1.68;
      g.add(ring);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), crystalMat);
      orb.position.y = 1.68;
      g.add(orb);
      root.add(g);
    } else if (inter.kind === 'codex_lectern') {
      const g = new THREE.Group();
      g.position.set(inter.x, 0, inter.z);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.1, 6), wallMat);
      stand.position.y = 0.55;
      g.add(stand);
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.12, 0.58), chestMat);
      desk.position.y = 1.14;
      desk.rotation.x = 0.35;
      g.add(desk);
      const pages = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.08, 0.44),
        new THREE.MeshStandardMaterial({ color: 0xe6d8b5, roughness: 0.9 })
      );
      pages.position.set(0, 1.21, 0);
      pages.rotation.x = 0.35;
      g.add(pages);
      root.add(g);
    }
  }
}

export function buildWorldGeometry(map: DungeonMap): BuiltWorldHandles {
  const root = new THREE.Group();
  const palette = BIOME_PALETTES[map.biome];
  const tex = getBiomeTexturePack(map.biome);
  const ts = map.tileSize;
  const wallHeight = 4.2;

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.wallMap,
      bumpMap: tex.wallBump,
      bumpScale: 0.08,
      roughness: 0.92,
      metalness: 0.05,
    })
  );
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.floorMap,
      roughness: 0.9,
      metalness: 0.06,
    })
  );
  const trapMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.trapFloorMap,
      roughness: 0.72,
      metalness: 0.25,
    })
  );
  const archMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.archMap,
      roughness: 0.92,
      metalness: 0.05,
      side: THREE.BackSide,
    })
  );
  const crackedMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.crackedWallMap,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  const barrelMat = trackMat(new THREE.MeshStandardMaterial({ map: tex.woodBarrelMap, roughness: 0.85, metalness: 0.1 }));
  const chestMat = trackMat(new THREE.MeshStandardMaterial({ map: tex.chestWoodMap, roughness: 0.76, metalness: 0.22 }));
  const mossVineMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tex.mossVineMap,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.95,
    })
  );

  const flameSprites: BuiltWorldHandles['flameSprites'] = [];
  const torchLights: BuiltWorldHandles['torchLights'] = [];
  let fogGateMesh: THREE.Mesh | null = null;
  const secretWallMeshes: THREE.Mesh[] = [];
  const chestMeshes = new Map<string, { lid: THREE.Mesh; glow: THREE.Mesh }>();

  // =========================================================================
  // HUB OVERWORLD: TWILIGHT BRIDGE, GOTHIC SKYBOX, DARK PINE GORGE & CAVERN MOUTH
  // =========================================================================
  if (map.biome === 'hub') {
    // Panoramic Twilight-Violet Mountain & Gothic Castle Skybox Cylinder
    const skyGeo = trackGeo(new THREE.CylinderGeometry(86, 86, 62, 28, 1, true));
    const skyMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: tex.skyboxMap,
        side: THREE.BackSide,
        fog: false,
      })
    );
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    skyMesh.position.set(map.spawnX, 11.5, map.spawnZ - 22);
    // Align skybox u=0.5 (Gothic Castle Spires) straight ahead along -Z!
    skyMesh.rotation.y = Math.PI;
    root.add(skyMesh);

    // Distant twilight ravine floor & flanking mountain cliff slopes (never an empty void!)
    const ravineMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x16141f, roughness: 0.96 }));
    const ravineFloor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(160, 160)), ravineMat);
    ravineFloor.rotation.x = -Math.PI / 2;
    ravineFloor.position.set(map.spawnX, -9.5, map.spawnZ - 16);
    root.add(ravineFloor);

    // Walkable weathered cobblestone bridge & courtyard tiles (instanced for crisp 1x1 UVs)
    const floorTileGeo = trackGeo(new THREE.PlaneGeometry(ts, ts));
    const bridgeMatrices: THREE.Matrix4[] = [];
    const m4 = new THREE.Matrix4();
    const rotFloor = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const one = new THREE.Vector3(1, 1, 1);

    for (let gz = 0; gz < map.height; gz++) {
      for (let gx = 0; gx < map.width; gx++) {
        const t = map.tiles[gz * map.width + gx];
        if (t === 5 || t === 1) {
          m4.compose(new THREE.Vector3((gx + 0.5) * ts, 0, (gz + 0.5) * ts), rotFloor, one);
          bridgeMatrices.push(m4.clone());
        }
      }
    }
    const floorInst = new THREE.InstancedMesh(floorTileGeo, floorMat, bridgeMatrices.length);
    bridgeMatrices.forEach((mat, idx) => floorInst.setMatrixAt(idx, mat));
    floorInst.computeBoundingSphere();
    root.add(floorInst);

    // Bridge stonework substructure arches underneath the bridge deck
    const bridgeUnder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.6, 10, 29)), wallMat);
    bridgeUnder.position.set(9 * ts, -5.05, 17.5 * ts);
    root.add(bridgeUnder);

    const courtyardBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(20.6, 10, 14.5)), wallMat);
    courtyardBase.position.set(9 * ts, -5.05, 8.2 * ts);
    root.add(courtyardBase);

    // Weathered stone bridge parapets + crenellations along both flanks (leaves gothic mountain vista wide open!)
    const parapetGeo = trackGeo(new THREE.BoxGeometry(0.65, 1.15, 2.0));
    const merlonGeo = trackGeo(new THREE.BoxGeometry(0.72, 0.45, 0.85));
    for (let gz = 12; gz <= 24; gz++) {
      for (const sideX of [6.85 * ts, 11.15 * ts]) {
        const p = new THREE.Mesh(parapetGeo, wallMat);
        p.position.set(sideX, 0.57, (gz + 0.5) * ts);
        root.add(p);
        if (gz % 2 === 0) {
          const m = new THREE.Mesh(merlonGeo, wallMat);
          m.position.set(sideX, 1.35, (gz + 0.5) * ts);
          root.add(m);
        }
      }
    }

    // Courtyard low perimeter stone wall
    for (const sideX of [3.85 * ts, 14.15 * ts]) {
      const cw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.7, 1.35, 14.2)), wallMat);
      cw.position.set(sideX, 0.67, 8.5 * ts);
      root.add(cw);
    }

    // Sculpted Gothic Cavern Mouth Gatehouse + Flanking Jagged Rock Crags (keeps upper sky & castle spires wide open!)
    const cliffMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex.wallMap,
        color: 0x675b70,
        roughness: 0.94,
      })
    );
    // Flanking buttress towers framing the dark cavern archway
    const buttressL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 6.2, 4.6)), cliffMat);
    buttressL.position.set(6.3 * ts, 3.1, 3.4 * ts);
    root.add(buttressL);
    const spireL = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.7, 2.8, 4)), cliffMat);
    spireL.rotation.y = Math.PI / 4;
    spireL.position.set(6.3 * ts, 7.6, 3.4 * ts);
    root.add(spireL);

    const buttressR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.8, 6.2, 4.6)), cliffMat);
    buttressR.position.set(11.7 * ts, 3.1, 3.4 * ts);
    root.add(buttressR);
    const spireR = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(1.7, 2.8, 4)), cliffMat);
    spireR.rotation.y = Math.PI / 4;
    spireR.position.set(11.7 * ts, 7.6, 3.4 * ts);
    root.add(spireR);

    // Jagged rocky outcrop mounds flanking the gatehouse (natural slopes, never a giant flat box wall!)
    const cragL = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(4.6, 0)), cliffMat);
    cragL.position.set(3.2 * ts, 1.6, 2.6 * ts);
    cragL.scale.set(1.2, 1.0, 0.9);
    root.add(cragL);

    const cragR = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(4.8, 0)), cliffMat);
    cragR.position.set(14.8 * ts, 1.8, 2.6 * ts);
    cragR.scale.set(1.2, 1.05, 0.9);
    root.add(cragR);

    // Carved stone archway lintel right over the cavern mouth
    const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(8.8, 1.4, 4.2)), cliffMat);
    lintel.position.set(9.0 * ts, 5.4, 3.4 * ts);
    root.add(lintel);

    // Arched stone portal framing the dark cavern mouth
    const portalArch = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(3.8, 3.8, 7.6, 14, 1, true, 0, Math.PI)),
      archMat
    );
    portalArch.rotation.z = Math.PI / 2;
    portalArch.rotation.y = Math.PI / 2;
    portalArch.position.set(9 * ts, 1.6, 3.4 * ts);
    root.add(portalArch);

    // Dark cavern interior backwall + eerie amber-violet dungeon mist threshold
    const cavernBack = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(8.2, 6.0)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0x070509 }))
    );
    cavernBack.position.set(9 * ts, 2.8, 1.8 * ts);
    root.add(cavernBack);

    const portalShimmer = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(6.8, 5.0)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: tex.fogGateMap,
          color: 0x9b72cf,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
        })
      )
    );
    portalShimmer.position.set(9 * ts, 2.5, 3.1 * ts);
    root.add(portalShimmer);

    // Hanging moss vines dripping across the cavern mouth arch!
    for (let i = -2; i <= 2; i++) {
      const vine = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.7, 2.2)), mossVineMat);
      vine.position.set((9 + i * 0.72) * ts, 4.1 - Math.abs(i) * 0.28, 5.1 * ts);
      root.add(vine);
    }

    // Dark Pine Canopy lining both sides of the gorge & framing the gothic vista!
    const pineSpots = [
      [2.5, -5.5, 22, 1.35],
      [1.2, -5.0, 17, 1.5],
      [2.8, -4.5, 13, 1.25],
      [0.5, -3.5, 9, 1.6],
      [15.5, -5.5, 22, 1.4],
      [16.8, -4.8, 17, 1.55],
      [15.2, -4.5, 13, 1.3],
      [17.5, -3.5, 9, 1.65],
      [4.0, 1.5, 1.5, 1.3],
      [14.2, 1.5, 1.5, 1.35],
    ];
    for (const [px, py, pz, sc] of pineSpots) {
      root.add(buildDarkPineTree(px * ts, py, pz * ts, sc));
    }

    // Interactive Surface Camp stations (Ember Forge, Bound Stash, Constellation Altar, Codex)
    buildHubCampStations(root, wallMat, chestMat, flameSprites, map);
  } else {
    // =========================================================================
    // VAULTED 3D STONE DUNGEON (B1 Flooded Crypt -> B2 -> B3 -> B4+)
    // =========================================================================
    const floorTileGeo = trackGeo(new THREE.PlaneGeometry(ts, ts));
    const wallTileGeo = trackGeo(new THREE.PlaneGeometry(ts, wallHeight));
    const normalFloors: THREE.Matrix4[] = [];
    const trapFloors: THREE.Matrix4[] = [];
    const wallPanels: THREE.Matrix4[] = [];
    const ceilTiles: THREE.Matrix4[] = [];

    const m4 = new THREE.Matrix4();
    const qFloor = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const qCeil = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const qNorth = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const qSouth = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    const qWest = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    const qEast = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
    const one = new THREE.Vector3(1, 1, 1);

    const tileAt = (gx: number, gz: number) => {
      if (gx < 0 || gz < 0 || gx >= map.width || gz >= map.height) return 0;
      return map.tiles[gz * map.width + gx];
    };

    for (let gz = 0; gz < map.height; gz++) {
      for (let gx = 0; gx < map.width; gx++) {
        const t = tileAt(gx, gz);
        if (t === 0) continue;

        const wx = (gx + 0.5) * ts;
        const wz = (gz + 0.5) * ts;

        if (t === 2) {
          m4.compose(new THREE.Vector3(wx, 0.02, wz), qFloor, one);
          trapFloors.push(m4.clone());
        } else {
          m4.compose(new THREE.Vector3(wx, 0, wz), qFloor, one);
          normalFloors.push(m4.clone());
        }

        // Ceiling fallback slab above arches so zero void gaps ever peek through
        m4.compose(new THREE.Vector3(wx, wallHeight + 1.25, wz), qCeil, one);
        ceilTiles.push(m4.clone());

        // Add exposed vertical wall faces where neighboring tile is solid (0)
        if (tileAt(gx, gz - 1) === 0) {
          m4.compose(new THREE.Vector3(wx, wallHeight / 2, wz - ts / 2), qNorth, one);
          wallPanels.push(m4.clone());
        }
        if (tileAt(gx, gz + 1) === 0) {
          m4.compose(new THREE.Vector3(wx, wallHeight / 2, wz + ts / 2), qSouth, one);
          wallPanels.push(m4.clone());
        }
        if (tileAt(gx - 1, gz) === 0) {
          m4.compose(new THREE.Vector3(wx - ts / 2, wallHeight / 2, wz), qWest, one);
          wallPanels.push(m4.clone());
        }
        if (tileAt(gx + 1, gz) === 0) {
          m4.compose(new THREE.Vector3(wx + ts / 2, wallHeight / 2, wz), qEast, one);
          wallPanels.push(m4.clone());
        }

        // Breakable Cracked Secret Wall blocks (tile === 4)
        if (t === 4) {
          const sw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(ts, wallHeight, ts)), crackedMat);
          sw.position.set(wx, wallHeight / 2, wz);
          root.add(sw);
          secretWallMeshes.push(sw);
        }
      }
    }

    if (normalFloors.length > 0) {
      const inst = new THREE.InstancedMesh(floorTileGeo, floorMat, normalFloors.length);
      normalFloors.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.computeBoundingSphere();
      root.add(inst);
    }
    if (trapFloors.length > 0) {
      const inst = new THREE.InstancedMesh(floorTileGeo, trapMat, trapFloors.length);
      trapFloors.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.computeBoundingSphere();
      root.add(inst);
    }
    if (wallPanels.length > 0) {
      const inst = new THREE.InstancedMesh(wallTileGeo, wallMat, wallPanels.length);
      wallPanels.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.computeBoundingSphere();
      root.add(inst);
    }
    if (ceilTiles.length > 0) {
      const ceilMat = trackMat(new THREE.MeshStandardMaterial({ map: tex.archMap, roughness: 0.95 }));
      const inst = new THREE.InstancedMesh(floorTileGeo, ceilMat, ceilTiles.length);
      ceilTiles.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.computeBoundingSphere();
      root.add(inst);
    }

    // TRUE BARREL-VAULTED ARCHED CEILINGS + STONE RIBS + HANGING MOSS VINES per room (Reference Visual Parity!)
    const ribMat = trackMat(new THREE.MeshStandardMaterial({ map: tex.wallMap, color: 0xb0a596, roughness: 0.92 }));
    for (const r of map.rooms) {
      const rx = (r.gx + r.gw / 2) * ts;
      const rz = (r.gz + r.gh / 2) * ts;
      const spanX = r.gw * ts;
      const spanZ = r.gh * ts;
      const radius = Math.min(spanX * 0.52, 6.2);

      // Barrel vault curved masonry ceiling running along Z
      const vaultGeo = trackGeo(new THREE.CylinderGeometry(radius, radius, spanZ, 12, 1, true, 0, Math.PI));
      const vault = new THREE.Mesh(vaultGeo, archMat);
      vault.rotation.z = Math.PI / 2;
      vault.rotation.y = Math.PI / 2;
      vault.position.set(rx, wallHeight - 1.35, rz);
      vault.scale.set(1, 1, 0.58);
      root.add(vault);

      // Heavy carved stone arch ribs spaced along the room (creates the iconic gothic vaulted tunnel rhythm!)
      const ribCount = Math.max(2, Math.floor(r.gh / 3));
      for (let i = 0; i <= ribCount; i++) {
        const zPos = (r.gz + 0.6 + (i / ribCount) * (r.gh - 1.2)) * ts;
        const rib = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(radius * 0.96, 0.26, 6, 12, Math.PI)),
          ribMat
        );
        rib.position.set(rx, wallHeight - 1.35, zPos);
        rib.scale.set(1, 0.56, 1);
        root.add(rib);

        // Hanging green moss vines dripping from arch ribs!
        for (const ox of [-radius * 0.45, 0, radius * 0.45]) {
          const vine = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.4, 1.9)), mossVineMat);
          vine.position.set(rx + ox, wallHeight - 0.15, zPos + 0.18);
          root.add(vine);
        }
      }
    }

    // Fog Gate swirling mist barrier before Boss Room
    const fogInter = map.interactables.find((i) => i.kind === 'fog_gate');
    if (fogInter) {
      const fogMat = trackMat(
        new THREE.MeshBasicMaterial({
          map: tex.fogGateMap,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      fogGateMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(6.2, wallHeight)), fogMat);
      fogGateMesh.position.set(fogInter.x, wallHeight / 2, fogInter.z);
      root.add(fogGateMesh);
    }

    // Kindled Shrine Pedestal + Sacred Golden Flame + Descending Stairs Portal
    for (const inter of map.interactables) {
      if (inter.kind === 'chest') {
        const built = buildCompositeChest(chestMat, inter.x, inter.z, 0);
        chestMeshes.set(inter.id, { lid: built.lid, glow: built.glow });
        root.add(built.group);
      } else if (inter.kind === 'kindled_shrine') {
        const shrineGroup = new THREE.Group();
        shrineGroup.position.set(inter.x, 0, inter.z);
        const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.26, 8), wallMat);
        dais.position.y = 0.13;
        shrineGroup.add(dais);
        const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.62, 1.1, 7), wallMat);
        altar.position.y = 0.75;
        shrineGroup.add(altar);
        const swordBlade = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 1.35, 0.04),
          trackMat(new THREE.MeshStandardMaterial({ color: 0xd9c293, metalness: 0.7, roughness: 0.3 }))
        );
        swordBlade.position.set(0, 1.58, 0);
        swordBlade.rotation.z = 0.12;
        shrineGroup.add(swordBlade);

        const shrineFlameMat = trackMat(new THREE.SpriteMaterial({ map: getFlameFrameTexture(0, 'orange'), transparent: true }));
        const sp = new THREE.Sprite(shrineFlameMat);
        sp.position.set(0, 1.65, 0);
        sp.scale.set(1.25, 1.45, 1);
        shrineGroup.add(sp);
        flameSprites.push({ sprite: sp, tint: 'orange', phase: 1.1 });
        root.add(shrineGroup);
      } else if (inter.kind === 'stairs_down') {
        const portalGroup = new THREE.Group();
        portalGroup.position.set(inter.x, 0, inter.z);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.25, 6, 12, Math.PI), wallMat);
        frame.position.y = 1.2;
        portalGroup.add(frame);
        const veil = new THREE.Mesh(
          trackGeo(new THREE.CircleGeometry(1.3, 12)),
          trackMat(new THREE.MeshBasicMaterial({ color: 0x3b1f66, transparent: true, opacity: 0.78, side: THREE.DoubleSide }))
        );
        veil.position.y = 1.4;
        portalGroup.add(veil);
        root.add(portalGroup);
      }
    }
  }

  // =========================================================================
  // SHARED PROPS: WHISPERING RUNES, BARRELS, BONES, CRATES & FLICKERING BRAZIERS
  // =========================================================================
  const whisperMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: tex.whisperRuneMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    })
  );
  for (const inter of map.interactables) {
    if (inter.kind === 'whisper_rune') {
      const runePlane = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.5, 1.5)), whisperMat);
      runePlane.rotation.x = -Math.PI / 2;
      runePlane.position.set(inter.x, 0.03, inter.z);
      root.add(runePlane);
    }
  }

  const bonesMat = trackMat(new THREE.SpriteMaterial({ map: getPropSpriteTexture('bones'), transparent: true }));
  for (const prop of map.props) {
    if (prop.kind === 'barrel') {
      root.add(buildCompositeBarrel(barrelMat, prop.x, prop.z, prop.rot));
    } else if (prop.kind === 'crate') {
      const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.95, 0.95)), barrelMat);
      crate.position.set(prop.x, 0.475, prop.z);
      crate.rotation.y = prop.rot;
      root.add(crate);
    } else if (prop.kind === 'bones') {
      const sp = new THREE.Sprite(bonesMat);
      sp.position.set(prop.x, 0.34, prop.z);
      sp.scale.set(0.85, 0.7, 1);
      root.add(sp);
    }
  }

  // Stone Bowl Braziers with flickering pixel flames + dynamic torch pool (capped to 5 closest active PointLights in GameEngine!)
  const flameTint = map.biome === 'b4' ? 'violet' : 'orange';
  map.braziers.forEach((b, idx) => {
    const fMat = trackMat(new THREE.SpriteMaterial({ map: getFlameFrameTexture(idx % 4, flameTint), transparent: true }));
    const { group, flameSprite } = buildCompositeBrazier(wallMat, fMat, b.x, b.z, 0);
    root.add(group);
    flameSprites.push({ sprite: flameSprite, tint: flameTint, phase: idx * 1.37 });
  });

  // Pre-allocate 5 pooled flickering PointLights that dynamically attach to the 5 nearest braziers around the player!
  for (let i = 0; i < 5; i++) {
    const pl = new THREE.PointLight(palette.torchColor, 3.6, 22, 1.35);
    pl.position.set(map.spawnX, 2.35, map.spawnZ);
    root.add(pl);
    torchLights.push({ light: pl, baseIntensity: 3.6, phase: i * 1.7, x: map.spawnX, z: map.spawnZ });
  }

  return {
    root,
    flameSprites,
    torchLights,
    fogGateMesh,
    secretWallMeshes,
    chestMeshes,
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}
