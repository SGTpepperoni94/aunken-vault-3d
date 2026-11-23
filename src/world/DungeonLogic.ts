import type { BiomeId, DungeonMap, EnemyArchetype, Interactable, RoomRect } from '../game/types';
import { mulberry32 } from '../systems/LootAndForge';

export interface BiomePalette {
  id: BiomeId;
  name: string;
  floorLabel: string;
  objective: string;
  wallPrimary: string;
  wallSecondary: string;
  mossColor: string;
  floorPrimary: string;
  floorAccent: string;
  fogColor: number;
  fogDensity: number;
  ambientSky: number;
  ambientGround: number;
  torchColor: number;
}

export const BIOME_PALETTES: Record<BiomeId, BiomePalette> = {
  hub: {
    id: 'hub',
    name: 'Surface Bridge',
    floorLabel: 'Twilight Bridge — Surface Camp',
    objective: 'Cross the bridge into The Sunken Vaults',
    wallPrimary: '#524b57',
    wallSecondary: '#3b3542',
    mossColor: '#3f5a38',
    floorPrimary: '#544e52',
    floorAccent: '#3d373d',
    fogColor: 0x261d34,
    fogDensity: 0.015,
    ambientSky: 0x6c598c,
    ambientGround: 0x241d29,
    torchColor: 0xff9d42,
  },
  b1: {
    id: 'b1',
    name: 'The Sunken Vaults - B1',
    floorLabel: 'Flooded Crypt — B1',
    objective: 'Slay The Drowned Warden beyond the Fog Gate',
    wallPrimary: '#574c41',
    wallSecondary: '#3b332c',
    mossColor: '#567031',
    floorPrimary: '#4d463c',
    floorAccent: '#363129',
    fogColor: 0x161210,
    fogDensity: 0.036,
    ambientSky: 0x5c4f44,
    ambientGround: 0x1e1915,
    torchColor: 0xff9438,
  },
  b2: {
    id: 'b2',
    name: 'The Sunken Vaults - B2',
    floorLabel: 'Gilded Sanctum — B2',
    objective: 'Defeat the Gilded Adjudicator',
    wallPrimary: '#6a5b44',
    wallSecondary: '#473c2d',
    mossColor: '#7a6f35',
    floorPrimary: '#5a4e3c',
    floorAccent: '#3d3427',
    fogColor: 0x1c1710,
    fogDensity: 0.034,
    ambientSky: 0x736146,
    ambientGround: 0x241d15,
    torchColor: 0xffb347,
  },
  b3: {
    id: 'b3',
    name: 'The Sunken Vaults - B3',
    floorLabel: 'Ember Core — B3',
    objective: 'Retrieve the Fire Heart from the Cinder Sovereign',
    wallPrimary: '#523c36',
    wallSecondary: '#362623',
    mossColor: '#824626',
    floorPrimary: '#453530',
    floorAccent: '#2e211e',
    fogColor: 0x1d110e,
    fogDensity: 0.035,
    ambientSky: 0x7a4636,
    ambientGround: 0x261410,
    torchColor: 0xff7729,
  },
  b4: {
    id: 'b4',
    name: 'The Sunken Vaults - B4',
    floorLabel: 'The Hollow Abyss — B4',
    objective: 'Vanquish the Hollow Eclipse',
    wallPrimary: '#3e384d',
    wallSecondary: '#272333',
    mossColor: '#4f3f7a',
    floorPrimary: '#353042',
    floorAccent: '#221e2b',
    fogColor: 0x110e1a,
    fogDensity: 0.038,
    ambientSky: 0x574c78,
    ambientGround: 0x171324,
    torchColor: 0x9978ff,
  },
};

export function biomeForFloor(floorNumber: number): BiomeId {
  if (floorNumber <= 0) return 'hub';
  if (floorNumber === 1) return 'b1';
  if (floorNumber === 2) return 'b2';
  if (floorNumber === 3) return 'b3';
  return 'b4';
}

export function generateHubMap(): DungeonMap {
  const tileSize = 2.0;
  const width = 18;
  const height = 28;
  const tiles = new Uint8Array(width * height); // 0 = abyss/parapet wall, 5 = bridge/courtyard walkable

  // Walkable bridge from z=22 down to z=12 (4 tiles = 8m wide, centered at x=7..10)
  for (let z = 11; z <= 24; z++) {
    for (let x = 7; x <= 10; x++) {
      tiles[z * width + x] = 5;
    }
  }
  // Courtyard apron right in front of the Cavern Mouth (z=5..11, x=4..13)
  for (let z = 5; z <= 11; z++) {
    for (let x = 4; x <= 13; x++) {
      tiles[z * width + x] = 5;
    }
  }
  // Cavern entrance tunnel mouth (z=2..5, x=7..10)
  for (let z = 2; z <= 5; z++) {
    for (let x = 7; x <= 10; x++) {
      tiles[z * width + x] = 1;
    }
  }

  const spawnX = 9 * tileSize;
  const spawnZ = 22.2 * tileSize;

  const braziers = [
    { x: 7.2 * tileSize, z: 20.5 * tileSize },
    { x: 10.8 * tileSize, z: 20.5 * tileSize },
    { x: 7.2 * tileSize, z: 15.5 * tileSize },
    { x: 10.8 * tileSize, z: 15.5 * tileSize },
    { x: 6.4 * tileSize, z: 7.2 * tileSize },
    { x: 11.6 * tileSize, z: 7.2 * tileSize },
    { x: 7.5 * tileSize, z: 4.8 * tileSize },
    { x: 10.5 * tileSize, z: 4.8 * tileSize },
  ];

  const props: DungeonMap['props'] = [
    { kind: 'barrel', x: 5.0 * tileSize, z: 10.2 * tileSize, rot: 0.4 },
    { kind: 'barrel', x: 5.5 * tileSize, z: 10.8 * tileSize, rot: 1.2 },
    { kind: 'crate', x: 12.8 * tileSize, z: 10.3 * tileSize, rot: 0.2 },
    { kind: 'bones', x: 11.8 * tileSize, z: 6.2 * tileSize, rot: 0.7 },
  ];

  const interactables: Interactable[] = [
    {
      id: 'cavern_mouth',
      kind: 'cavern_entrance',
      x: 9.0 * tileSize,
      z: 3.4 * tileSize,
      label: 'Enter The Sunken Vaults (B1)',
      sublabel: 'Descend into the Flooded Crypt',
      used: false,
      floor: 1,
    },
    {
      id: 'camp_forge',
      kind: 'ember_forge',
      x: 5.1 * tileSize,
      z: 7.5 * tileSize,
      label: 'Ember Forge',
      sublabel: 'Reforge Gear · Upgrade Runes · Transpose Remembrances',
      used: false,
    },
    {
      id: 'camp_stash',
      kind: 'bound_stash',
      x: 12.6 * tileSize,
      z: 7.5 * tileSize,
      label: 'Bound Stash Chest',
      sublabel: '24-Slot Safe Vault Storage',
      used: false,
    },
    {
      id: 'camp_constellation',
      kind: 'constellation_altar',
      x: 5.6 * tileSize,
      z: 9.6 * tileSize,
      label: 'Constellation Altar',
      sublabel: 'Permanent Meta-Tree Upgrades',
      used: false,
    },
    {
      id: 'camp_codex',
      kind: 'codex_lectern',
      x: 12.2 * tileSize,
      z: 9.6 * tileSize,
      label: 'Bestiary & Vault Codex',
      sublabel: 'Discovered Foes & Run History',
      used: false,
    },
    {
      id: 'hub_whisper',
      kind: 'whisper_rune',
      x: 9.0 * tileSize,
      z: 17.5 * tileSize,
      label: 'Whispering Floor Rune',
      sublabel: 'Read inscribed warning',
      whisperText:
        '"Steel breaks the staggered; Arcane primes the flesh. Tap [Tab] to weave both, or bind thy treasure at a Kindled Shrine."',
      used: false,
    },
  ];

  return {
    biome: 'hub',
    floorNumber: 0,
    title: BIOME_PALETTES.hub.name,
    objective: BIOME_PALETTES.hub.objective,
    seed: 101,
    width,
    height,
    tileSize,
    tiles,
    rooms: [
      {
        index: 0,
        gx: 4,
        gz: 2,
        gw: 10,
        gh: 22,
        kind: 'spawn',
        cleared: true,
        discovered: true,
      },
    ],
    spawnX,
    spawnZ,
    spawnYaw: 0, // Facing -Z (straight down the stone bridge into the cavern mouth!)
    braziers,
    props,
    interactables,
    enemySpawns: [],
    bossRoomIndex: -1,
  };
}

function carveRect(tiles: Uint8Array, width: number, height: number, gx: number, gz: number, gw: number, gh: number, val = 1) {
  for (let z = gz; z < gz + gh; z++) {
    for (let x = gx; x < gx + gw; x++) {
      if (x > 0 && x < width - 1 && z > 0 && z < height - 1) {
        tiles[z * width + x] = val;
      }
    }
  }
}

function carveWideCorridor(
  tiles: Uint8Array,
  width: number,
  height: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number
) {
  // Always carve >= 2-tile-wide corridors (actually 3 tiles wide for grand arched vaults!)
  let cx = x0;
  let cz = z0;
  while (cx !== x1) {
    carveRect(tiles, width, height, cx - 1, cz - 1, 3, 3, 1);
    cx += cx < x1 ? 1 : -1;
  }
  while (cz !== z1) {
    carveRect(tiles, width, height, cx - 1, cz - 1, 3, 3, 1);
    cz += cz < z1 ? 1 : -1;
  }
  carveRect(tiles, width, height, x1 - 1, z1 - 1, 3, 3, 1);
}

const WHISPER_LORE = [
  '"Tap Right-Click as the blade falls — a Timed Parry shatters poise and opens a Critical Riposte."',
  '"Deeper rooms stoke Vault Pressure. Greed yields Golden Pillars, yet death claims all Unbound relics."',
  '"Strike the cracked stonework along the northern flanks — the builders hid chests behind false mortar."',
  '"Prime thy foe with Fireball, then cleave with steel to trigger Arcane Resonance."',
];

export function generateDungeonFloor(floorNumber: number, seed: number): DungeonMap {
  const rng = mulberry32(seed + floorNumber * 7919);
  const biome = biomeForFloor(floorNumber);
  const palette = BIOME_PALETTES[biome];
  const tileSize = 2.0;
  const width = 34;
  const height = 42;
  const tiles = new Uint8Array(width * height);

  // Structured multi-wing vaulted floor guaranteeing clear open sightlines, >=2-tile corridors,
  // a rich grand entry gallery (matching the reference screenshot immediately ahead of spawn!),
  // west Shrine wing, east Treasure Vault + Secret room, central Crucible hall, and north Boss Arena behind a Fog Gate.
  const rooms: RoomRect[] = [
    // 0: Entry Vault Hall (spawn south looking north straight into the main arched gallery with braziers, chest, goblins & spider!)
    { index: 0, gx: 13, gz: 31, gw: 8, gh: 8, kind: 'spawn', cleared: true, discovered: true },
    // 1: Grand Vault Nave (directly north of spawn — rich atmospheric combat chamber)
    { index: 1, gx: 12, gz: 19, gw: 10, gh: 9, kind: 'combat', cleared: false, discovered: false },
    // 2: West Kindled Shrine Wing
    { index: 2, gx: 3, gz: 20, gw: 6, gh: 7, kind: 'shrine', cleared: true, discovered: false },
    // 3: East Guarded Treasury Vault
    { index: 3, gx: 25, gz: 20, gw: 6, gh: 7, kind: 'vault', cleared: false, discovered: false },
    // 4: Northern Antechamber (combat + whispering rune + trap grates)
    { index: 4, gx: 13, gz: 11, gw: 8, gh: 6, kind: 'combat', cleared: false, discovered: false },
    // 5: Secret Alcove off East Vault (behind cracked wall)
    { index: 5, gx: 26, gz: 12, gw: 5, gh: 5, kind: 'secret', cleared: true, discovered: false },
    // 6: Boss Sanctum (north behind Fog Gate)
    { index: 6, gx: 11, gz: 2, gw: 12, gh: 7, kind: 'boss', cleared: false, discovered: false },
  ];

  for (const r of rooms) {
    carveRect(tiles, width, height, r.gx, r.gz, r.gw, r.gh, 1);
  }

  // Carve wide 3-tile vaulted corridors linking rooms
  const center = (r: RoomRect) => ({ cx: Math.floor(r.gx + r.gw / 2), cz: Math.floor(r.gz + r.gh / 2) });
  const c0 = center(rooms[0]);
  const c1 = center(rooms[1]);
  const c2 = center(rooms[2]);
  const c3 = center(rooms[3]);
  const c4 = center(rooms[4]);
  const c5 = center(rooms[5]);
  const c6 = center(rooms[6]);

  carveWideCorridor(tiles, width, height, c0.cx, c0.cz, c1.cx, c1.cz);
  carveWideCorridor(tiles, width, height, c1.cx, c1.cz, c2.cx, c2.cz);
  carveWideCorridor(tiles, width, height, c1.cx, c1.cz, c3.cx, c3.cz);
  carveWideCorridor(tiles, width, height, c1.cx, c1.cz, c4.cx, c4.cz);
  carveWideCorridor(tiles, width, height, c4.cx, c4.cz, c6.cx, c6.cz);
  // Secret passage from East Vault north into Secret Alcove (with a breakable cracked wall tile row)
  carveWideCorridor(tiles, width, height, c3.cx, c3.cz, c5.cx, c5.cz);
  for (let x = c3.cx - 1; x <= c3.cx + 1; x++) {
    tiles[18 * width + x] = 4; // Cracked secret wall
  }

  // Mark Fog Gate row between Antechamber (room 4) and Boss Sanctum (room 6)
  for (let x = c4.cx - 1; x <= c4.cx + 1; x++) {
    tiles[9 * width + x] = 3; // Fog Gate barrier until interacted with!
  }

  // Floor trap pressure grates in Antechamber
  tiles[(c4.cz) * width + (c4.cx - 2)] = 2;
  tiles[(c4.cz) * width + (c4.cx + 2)] = 2;

  const braziers: Array<{ x: number; z: number }> = [];
  const props: DungeonMap['props'] = [];
  const interactables: Interactable[] = [];
  const enemySpawns: DungeonMap['enemySpawns'] = [];

  for (const r of rooms) {
    // Corner braziers inside rooms for warm chiaroscuro torchlight
    const bx1 = (r.gx + 1.2) * tileSize;
    const bx2 = (r.gx + r.gw - 1.2) * tileSize;
    const bz1 = (r.gz + 1.2) * tileSize;
    const bz2 = (r.gz + r.gh - 1.2) * tileSize;
    braziers.push({ x: bx1, z: bz1 }, { x: bx2, z: bz1 });
    if (r.gh >= 7) {
      braziers.push({ x: bx1, z: bz2 }, { x: bx2, z: bz2 });
    }

    // Clustered barrels, crates & bone piles near room walls (matching reference!)
    props.push(
      { kind: 'barrel', x: (r.gx + 0.85) * tileSize, z: (r.gz + r.gh * 0.5) * tileSize, rot: rng() * Math.PI },
      { kind: 'barrel', x: (r.gx + 1.45) * tileSize, z: (r.gz + r.gh * 0.5 + 0.55) * tileSize, rot: rng() * Math.PI },
      { kind: 'bones', x: (r.gx + r.gw - 1.2) * tileSize, z: (r.gz + r.gh * 0.6) * tileSize, rot: rng() * Math.PI },
      { kind: 'crate', x: (r.gx + r.gw - 0.9) * tileSize, z: (r.gz + r.gh * 0.35) * tileSize, rot: rng() * Math.PI }
    );
  }

  // Interactables: Chests, Kindled Shrine, Fog Gate, Cracked Secret Wall, Whispering Rune, Descending Stairs
  interactables.push(
    {
      id: `chest_nave_${floorNumber}`,
      kind: 'chest',
      x: c1.cx * tileSize,
      z: (c1.cz + 1.2) * tileSize,
      label: 'Gilded Vault Chest',
      sublabel: 'Open for loot & Mystic Runes',
      used: false,
    },
    {
      id: `chest_vault_${floorNumber}`,
      kind: 'chest',
      x: c3.cx * tileSize,
      z: c3.cz * tileSize,
      label: 'Treasury Strongbox',
      sublabel: 'High-rarity Vault cache',
      used: false,
    },
    {
      id: `chest_secret_${floorNumber}`,
      kind: 'chest',
      x: c5.cx * tileSize,
      z: c5.cz * tileSize,
      label: 'Relic Chest of the Forgotten',
      sublabel: 'Guaranteed Rare or Legendary relic',
      used: false,
    },
    {
      id: `shrine_${floorNumber}`,
      kind: 'kindled_shrine',
      x: c2.cx * tileSize,
      z: c2.cz * tileSize,
      label: 'Kindled Shrine',
      sublabel: 'Bind 1 Unbound Item OR Rest & Refill Flasks',
      used: false,
    },
    {
      id: `fog_gate_${floorNumber}`,
      kind: 'fog_gate',
      x: c4.cx * tileSize,
      z: 9.5 * tileSize,
      label: 'Traverse the Mist',
      sublabel: 'Enter Floor Boss Sanctum',
      used: false,
    },
    {
      id: `secret_wall_${floorNumber}`,
      kind: 'secret_wall',
      x: c3.cx * tileSize,
      z: 18.5 * tileSize,
      label: 'Cracked Stonework',
      sublabel: 'Shatter wall to reveal secret alcove',
      used: false,
    },
    {
      id: `whisper_${floorNumber}`,
      kind: 'whisper_rune',
      x: c0.cx * tileSize,
      z: (c0.cz - 2.2) * tileSize,
      label: 'Whispering Floor Rune',
      sublabel: 'Read spectral inscription',
      whisperText: WHISPER_LORE[(floorNumber - 1) % WHISPER_LORE.length],
      used: false,
    },
    {
      id: `stairs_down_${floorNumber}`,
      kind: 'stairs_down',
      x: c6.cx * tileSize,
      z: (rooms[6].gz + 1.4) * tileSize,
      label: `Descend to Vault B${floorNumber + 1}`,
      sublabel: 'Press deeper (higher Pressure & Legendary odds)',
      used: false,
      floor: floorNumber + 1,
    }
  );

  // Enemy spawns with distinct archetypes (Goblin swarmer, Spider flanker, Cultist kiter, Sentinel shielded, Floor Boss)
  // Room 1 (Grand Vault Nave): Iconic goblin + spider + cultist vignette visible down the arched vault!
  enemySpawns.push(
    { archetype: 'goblin', x: (c1.cx - 2.1) * tileSize, z: (c1.cz - 2.0) * tileSize, roomIndex: 1, isElite: false },
    { archetype: 'spider', x: (c1.cx) * tileSize, z: (c1.cz - 2.4) * tileSize, roomIndex: 1, isElite: false },
    { archetype: 'goblin', x: (c1.cx + 2.1) * tileSize, z: (c1.cz - 2.0) * tileSize, roomIndex: 1, isElite: false },
    { archetype: 'cultist', x: (c1.cx + 2.8) * tileSize, z: (c1.cz + 0.6) * tileSize, roomIndex: 1, isElite: floorNumber >= 2 }
  );

  // Room 3 (East Treasury Vault): Armored Sentinel + Spider
  enemySpawns.push(
    { archetype: 'sentinel', x: (c3.cx - 0.8) * tileSize, z: (c3.cz + 0.5) * tileSize, roomIndex: 3, isElite: true },
    { archetype: 'spider', x: (c3.cx + 1.2) * tileSize, z: (c3.cz - 1.0) * tileSize, roomIndex: 3, isElite: false }
  );

  // Room 4 (Northern Antechamber): Cultist + Sentinel + Goblin
  enemySpawns.push(
    { archetype: 'cultist', x: (c4.cx - 1.8) * tileSize, z: (c4.cz - 0.8) * tileSize, roomIndex: 4, isElite: false },
    { archetype: 'sentinel', x: (c4.cx + 1.5) * tileSize, z: (c4.cz) * tileSize, roomIndex: 4, isElite: floorNumber >= 2 },
    { archetype: 'goblin', x: (c4.cx) * tileSize, z: (c4.cz + 1.2) * tileSize, roomIndex: 4, isElite: false }
  );

  // Room 6 (Boss Sanctum)
  const bossArchetype: EnemyArchetype =
    floorNumber === 1 ? 'boss_b1' : floorNumber === 2 ? 'boss_b2' : floorNumber === 3 ? 'boss_b3' : 'boss_b4';
  enemySpawns.push({
    archetype: bossArchetype,
    x: c6.cx * tileSize,
    z: (c6.cz - 0.3) * tileSize,
    roomIndex: 6,
    isElite: true,
  });

  // Spawn at the northern threshold of Entry Hall looking directly into the vaulted Grand Nave gallery!
  const spawnX = c0.cx * tileSize;
  const spawnZ = (rooms[0].gz + 1.2) * tileSize;

  return {
    biome,
    floorNumber,
    title: floorNumber > 4 ? `The Sunken Vaults - B${floorNumber}` : palette.name,
    objective: palette.objective,
    seed,
    width,
    height,
    tileSize,
    tiles,
    rooms,
    spawnX,
    spawnZ,
    spawnYaw: 0, // Facing -Z straight into the vaulted nave!
    braziers,
    props,
    interactables,
    enemySpawns,
    bossRoomIndex: 6,
  };
}

export function isWalkableTile(map: DungeonMap, gx: number, gz: number, fogGateOpen: boolean, secretWallOpen: boolean): boolean {
  if (gx < 0 || gz < 0 || gx >= map.width || gz >= map.height) return false;
  const t = map.tiles[gz * map.width + gx];
  if (t === 1 || t === 2 || t === 5) return true;
  if (t === 3 && fogGateOpen) return true;
  if (t === 4 && secretWallOpen) return true;
  return false;
}

export function isWorldPosWalkable(
  map: DungeonMap,
  wx: number,
  wz: number,
  radius: number,
  fogGateOpen: boolean,
  secretWallOpen: boolean
): boolean {
  const offsets = [
    [radius, radius],
    [-radius, radius],
    [radius, -radius],
    [-radius, -radius],
  ];
  for (const [ox, oz] of offsets) {
    const gx = Math.floor((wx + ox) / map.tileSize);
    const gz = Math.floor((wz + oz) / map.tileSize);
    if (!isWalkableTile(map, gx, gz, fogGateOpen, secretWallOpen)) {
      return false;
    }
  }
  return true;
}

/**
 * Verifies via BFS that spawn can reach every non-secret room (and Boss room once Fog Gate opens).
 */
export function verifyDungeonConnectivity(map: DungeonMap): {
  spawnWalkable: boolean;
  allRoomsReachable: boolean;
  bossReachableThroughFog: boolean;
} {
  const sx = Math.floor(map.spawnX / map.tileSize);
  const sz = Math.floor(map.spawnZ / map.tileSize);
  const spawnWalkable = isWalkableTile(map, sx, sz, true, true);
  if (!spawnWalkable) {
    return { spawnWalkable: false, allRoomsReachable: false, bossReachableThroughFog: false };
  }

  const visited = new Uint8Array(map.width * map.height);
  const queue: Array<[number, number]> = [[sx, sz]];
  visited[sz * map.width + sx] = 1;

  while (queue.length > 0) {
    const [x, z] = queue.shift()!;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= map.width || nz >= map.height) continue;
      const idx = nz * map.width + nx;
      if (visited[idx]) continue;
      if (isWalkableTile(map, nx, nz, true, true)) {
        visited[idx] = 1;
        queue.push([nx, nz]);
      }
    }
  }

  let allRoomsReachable = true;
  let bossReachableThroughFog = true;
  for (const r of map.rooms) {
    const cx = Math.floor(r.gx + r.gw / 2);
    const cz = Math.floor(r.gz + r.gh / 2);
    const reached = visited[cz * map.width + cx] === 1;
    if (!reached) allRoomsReachable = false;
    if (r.kind === 'boss') bossReachableThroughFog = reached;
  }

  return { spawnWalkable, allRoomsReachable, bossReachableThroughFog };
}
