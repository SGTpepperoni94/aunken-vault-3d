export type Rarity = 'C' | 'E' | 'R' | 'L';

export type GearSlot = 'weapon' | 'staff' | 'shield' | 'armor' | 'boots';

export type GearSetId = 'ashen_vanguard' | 'pyre_arcanist' | 'vault_stalker';

export type RuneId =
  | 'splitting'
  | 'ignition'
  | 'shattering'
  | 'leeching'
  | 'tempest'
  | 'aegis';

export type Stance = 'vanguard' | 'arcanist';

export type BiomeId = 'hub' | 'b1' | 'b2' | 'b3' | 'b4';

export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export interface ItemStats {
  attack: number;
  spellPower: number;
  defense: number;
  poiseBreak: number;
  maxHp: number;
  maxStamina: number;
  critChance: number; // 0..1
}

export interface GearItem {
  id: string;
  name: string;
  baseType: string;
  slot: GearSlot;
  rarity: Rarity;
  level: number;
  stats: ItemStats;
  affixes: string[];
  setId?: GearSetId;
  bound: boolean;
  isSignature?: boolean;
  flameEffect?: boolean;
  runeSlots: number;
  socketedRunes: MysticRune[];
  valueEmbers: number;
}

export interface MysticRune {
  id: string;
  runeId: RuneId;
  name: string;
  rank: number; // 1..5
  rarity: Rarity;
  description: string;
  bound: boolean;
}

export interface BossRemembrance {
  id: string;
  bossId: string;
  bossName: string;
  floor: number;
  signatureWeaponName: string;
  transposed: boolean;
}

export type EnemyArchetype =
  | 'goblin'
  | 'spider'
  | 'cultist'
  | 'sentinel'
  | 'boss_b1'
  | 'boss_b2'
  | 'boss_b3'
  | 'boss_b4';

export type EnemyBehavior = 'swarmer' | 'flanker' | 'kiter' | 'shielded' | 'boss';

export type EnemyAIState =
  | 'idle'
  | 'patrol'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'staggered'
  | 'ko';

export interface EnemyEntity {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  behavior: EnemyBehavior;
  isBoss: boolean;
  isElite: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  damage: number;
  speed: number;
  attackRange: number;
  aggroRange: number;
  aiState: EnemyAIState;
  stateTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  staggerTimer: number;
  koTimer: number;
  arcanePrimeStacks: number; // 0..3
  burnTimer: number;
  burnDps: number;
  roomIndex: number;
  xpReward: number;
  emberReward: number;
  scale: number;
  animTime: number;
  hasHitDuringSwing: boolean;
}

export interface GroundLoot {
  id: string;
  x: number;
  z: number;
  kind: 'gear' | 'rune' | 'embers' | 'flask_charge' | 'portal_scroll';
  item?: GearItem;
  rune?: MysticRune;
  amount?: number;
  rarity: Rarity;
  label: string;
  collected: boolean;
  spawnTime: number;
}

export type InteractableKind =
  | 'cavern_entrance'
  | 'ember_forge'
  | 'bound_stash'
  | 'constellation_altar'
  | 'codex_lectern'
  | 'kindled_shrine'
  | 'chest'
  | 'fog_gate'
  | 'stairs_down'
  | 'secret_wall'
  | 'whisper_rune'
  | 'lost_echo';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  x: number;
  z: number;
  label: string;
  sublabel?: string;
  used: boolean;
  floor?: number;
  whisperText?: string;
}

export interface RoomRect {
  index: number;
  gx: number;
  gz: number;
  gw: number;
  gh: number;
  kind: 'spawn' | 'combat' | 'shrine' | 'vault' | 'secret' | 'boss';
  cleared: boolean;
  discovered: boolean;
}

export type TileKind = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = solid wall, 1 = stone floor, 2 = trap floor, 3 = fog gate, 4 = secret cracked wall, 5 = bridge/courtyard

export interface DungeonMap {
  biome: BiomeId;
  floorNumber: number;
  title: string;
  objective: string;
  seed: number;
  width: number;
  height: number;
  tileSize: number;
  tiles: Uint8Array;
  rooms: RoomRect[];
  spawnX: number;
  spawnZ: number;
  spawnYaw: number;
  braziers: Array<{ x: number; z: number }>;
  props: Array<{ kind: 'barrel' | 'bones' | 'pillar' | 'crate'; x: number; z: number; rot: number }>;
  interactables: Interactable[];
  enemySpawns: Array<{ archetype: EnemyArchetype; x: number; z: number; roomIndex: number; isElite: boolean }>;
  bossRoomIndex: number;
}

export interface ConstellationNode {
  id: string;
  name: string;
  description: string;
  rank: number;
  maxRank: number;
  baseCost: number;
}

export interface LostEcho {
  floor: number;
  x: number;
  z: number;
  embers: number;
  bestItem?: GearItem;
}

export interface CodexEntry {
  id: string;
  name: string;
  category: 'bestiary' | 'lore' | 'set';
  kills?: number;
  discovered: boolean;
  description: string;
  weakness?: string;
}

export interface RunRecord {
  id: string;
  date: string;
  outcome: 'extracted' | 'defeated' | 'boss_slain';
  maxFloor: number;
  kills: number;
  embersEarned: number;
  pressurePeak: number;
}

export interface SaveProfile {
  version: number;
  level: number;
  xp: number;
  xpToNext: number;
  soulEmbers: number;
  highestFloor: number;
  equipped: Record<GearSlot, GearItem | null>;
  stash: GearItem[]; // up to 24 bound items
  runesStash: MysticRune[];
  remembrances: BossRemembrance[];
  constellations: ConstellationNode[];
  lostEcho: LostEcho | null;
  codex: Record<string, CodexEntry>;
  runHistory: RunRecord[];
}

export interface ProjectedLootTag {
  id: string;
  label: string;
  rarity: Rarity;
  screenX: number; // 0..100 percentage
  screenY: number; // 0..100 percentage
  distance: number;
  isLegendary: boolean;
  deltaSummary?: string;
}

export interface ProjectedEnemyTag {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  staggered: boolean;
  primeStacks: number;
  isBoss: boolean;
  isElite: boolean;
  screenX: number;
  screenY: number;
  distance: number;
}

export interface LogEntry {
  id: number;
  text: string;
  tone: 'normal' | 'kill' | 'loot_C' | 'loot_E' | 'loot_R' | 'loot_L' | 'combat' | 'spell' | 'danger';
}

export interface ActiveBanner {
  title: string;
  subtitle?: string;
  tone: 'gold' | 'crimson' | 'arcane';
  expiresAt: number;
}

export interface RunSummary {
  outcome: 'extracted' | 'defeated' | 'boss_slain';
  floorReached: number;
  kills: number;
  embersBanked: number;
  itemsSecured: number;
  itemsLost: number;
  vaultPressure: number;
  lostEchoFloor?: number;
  durationSec: number;
}

export interface HudSnapshot {
  screen: GameScreenState;
  biome: BiomeId;
  floorNumber: number;
  locationLabel: string;
  objective: string;
  hp: number;
  maxHp: number;
  ghostHp: number;
  mp: number;
  maxMp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNext: number;
  soulEmbers: number;
  stance: Stance;
  activeHotbarSlot: number;
  flaskCharges: number;
  maxFlaskCharges: number;
  portalScrolls: number;
  vaultPressure: number; // 0..100+
  roomsCleared: number;
  totalCombatRooms: number;
  unboundCount: number;
  bagItems: GearItem[];
  bagRunes: MysticRune[];
  equipped: Record<GearSlot, GearItem | null>;
  activeSetBonuses: string[];
  socketedRuneNames: string[];
  isBlocking: boolean;
  isChargingHeavy: boolean;
  heavyChargePct: number;
  isChannelingPortal: boolean;
  portalProgress: number;
  pointerLocked: boolean;
  touchMode: boolean;
  muted: boolean;
  interactPrompt: { label: string; sublabel?: string; key: string } | null;
  ripostePrompt: boolean;
  activeBoss: { name: string; hp: number; maxHp: number; poise: number; maxPoise: number; staggered: boolean } | null;
  projectedLoot: ProjectedLootTag[];
  projectedEnemies: ProjectedEnemyTag[];
  logs: LogEntry[];
  banner: ActiveBanner | null;
  shrineOpen: boolean;
  campTab: 'inventory' | 'forge' | 'stash' | 'constellation' | 'codex' | null;
  runSummary: RunSummary | null;
  whisperMessage: string | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
}
