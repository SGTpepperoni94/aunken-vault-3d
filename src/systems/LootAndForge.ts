import type {
  BossRemembrance,
  GearItem,
  GearSetId,
  GearSlot,
  ItemStats,
  MysticRune,
  Rarity,
  RuneId,
} from '../game/types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let uidCounter = 1;
export function nextUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export interface GearSetDefinition {
  id: GearSetId;
  name: string;
  bonus2pc: string;
  bonus3pc: string;
}

export const GEAR_SETS: Record<GearSetId, GearSetDefinition> = {
  ashen_vanguard: {
    id: 'ashen_vanguard',
    name: 'Ashen Vanguard',
    bonus2pc: '2pc: +25% Parry & Poise Break damage',
    bonus3pc: '3pc: Critical Ripostes restore 25% HP & unleash shockwave',
  },
  pyre_arcanist: {
    id: 'pyre_arcanist',
    name: 'Pyre Arcanist',
    bonus2pc: '2pc: +30% Resonance Detonation damage',
    bonus3pc: '3pc: Spells refund 20% MP on hit & prime +1 extra stack',
  },
  vault_stalker: {
    id: 'vault_stalker',
    name: 'Vault Stalker',
    bonus2pc: '2pc: +25% Stamina Regen & faster Dodge recovery',
    bonus3pc: '3pc: +35% Rare & Legendary drop odds in the Vaults',
  },
};

export interface RuneCatalogEntry {
  runeId: RuneId;
  name: string;
  description: (rank: number) => string;
}

export const RUNE_CATALOG: Record<RuneId, RuneCatalogEntry> = {
  splitting: {
    runeId: 'splitting',
    name: 'Rune of Splitting',
    description: (rank) =>
      `Fireball splits into ${rank >= 4 ? 5 : 3} spreading embers (+${(rank - 1) * 8}% bolt dmg).`,
  },
  ignition: {
    runeId: 'ignition',
    name: 'Rune of Ignition',
    description: (rank) =>
      `Fireball & Heavy Cleave ignite foes for ${8 + rank * 5} burning damage/s over 3s.`,
  },
  shattering: {
    runeId: 'shattering',
    name: 'Rune of Shattering',
    description: (rank) =>
      `Steel strikes & Parries deal +${25 + rank * 12}% Poise damage to shatter guards.`,
  },
  leeching: {
    runeId: 'leeching',
    name: 'Rune of Leeching',
    description: (rank) =>
      `Defeating a foe restores ${14 + rank * 6} HP and ${12 + rank * 4} Stamina.`,
  },
  tempest: {
    runeId: 'tempest',
    name: 'Rune of Tempest',
    description: (rank) =>
      `Arcane Bolt chains to ${1 + Math.floor(rank / 2)} nearby foes & primes Arcane Resonance.`,
  },
  aegis: {
    runeId: 'aegis',
    name: 'Rune of Aegis',
    description: (rank) =>
      `Timed Parry blasts nearby foes for ${24 + rank * 10} shock damage and restores ${20 + rank * 5} Stamina.`,
  },
};

const PREFIXES: Record<Rarity, string[]> = {
  C: ['Weathered', 'Sturdy', 'Tempered', 'Ironbound', 'Worn'],
  E: ['Runed', 'Gilded', 'Vigilant', 'Ashen', 'Cindered'],
  R: ['Bloodforged', 'Dread', 'Obsidian', 'Sanctified', 'Cryptborn'],
  L: ['Legendary Flame', 'Sovereign', 'Eclipse', 'Cinderking', 'Abyssal'],
};

const BASES: Record<GearSlot, string[]> = {
  weapon: ['Broadsword', 'Longsword', 'Bastard Sword', 'Claymore', 'Warblade'],
  staff: ['Ashwood Staff', 'Arcane Rod', 'Pyre Scepter', 'Void Spire'],
  shield: ['Kite Shield', 'Heater Shield', 'Tower Buckler', 'Iron Aegis'],
  armor: ['Brigandine', 'Mail Hauberk', 'Vault Plate', 'Cinder Cuirass'],
  boots: ['Iron Boots', 'Greaves', 'Crypt Treads', 'Stalker Sabatons'],
};

const SUFFIXES: Array<{ label: string; stat: keyof ItemStats; mult: number }> = [
  { label: 'of Embers', stat: 'attack', mult: 0.2 },
  { label: 'of the Vault', stat: 'defense', mult: 0.25 },
  { label: 'of Shattering', stat: 'poiseBreak', mult: 0.3 },
  { label: 'of Arcana', stat: 'spellPower', mult: 0.25 },
  { label: 'of Vitality', stat: 'maxHp', mult: 0.25 },
  { label: 'of Swiftness', stat: 'maxStamina', mult: 0.22 },
];

export function rollRarity(
  floor: number,
  vaultPressure: number,
  stalker3pc: boolean,
  rng: () => number = Math.random
): Rarity {
  const pressureBoost = Math.min(0.45, vaultPressure * 0.004);
  const floorBoost = Math.max(0, floor - 1) * 0.055;
  const setBoost = stalker3pc ? 0.12 : 0;
  const roll = rng();

  const legThreshold = Math.min(0.32, 0.06 + floorBoost * 0.65 + pressureBoost * 0.45 + setBoost * 0.45);
  const rareThreshold = legThreshold + Math.min(0.36, 0.18 + floorBoost * 0.7 + pressureBoost * 0.4 + setBoost * 0.55);
  const enchThreshold = rareThreshold + 0.34;

  if (roll < legThreshold) return 'L';
  if (roll < rareThreshold) return 'R';
  if (roll < enchThreshold) return 'E';
  return 'C';
}

export function generateGearItem(options: {
  floor: number;
  vaultPressure?: number;
  forcedRarity?: Rarity;
  forcedSlot?: GearSlot;
  bound?: boolean;
  stalker3pc?: boolean;
  rng?: () => number;
}): GearItem {
  const rng = options.rng ?? Math.random;
  const floor = Math.max(1, options.floor);
  const rarity =
    options.forcedRarity ?? rollRarity(floor, options.vaultPressure ?? 0, Boolean(options.stalker3pc), rng);
  const slots: GearSlot[] = ['weapon', 'staff', 'shield', 'armor', 'boots'];
  const slot = options.forcedSlot ?? slots[Math.floor(rng() * slots.length)];

  const rarityMult = rarity === 'L' ? 1.85 : rarity === 'R' ? 1.42 : rarity === 'E' ? 1.18 : 1.0;
  const scale = (1 + (floor - 1) * 0.32) * rarityMult;

  const prefixList = PREFIXES[rarity];
  const baseList = BASES[slot];
  const prefix = prefixList[Math.floor(rng() * prefixList.length)];
  const base = baseList[Math.floor(rng() * baseList.length)];
  const suffix = rarity === 'C' ? null : SUFFIXES[Math.floor(rng() * SUFFIXES.length)];

  const stats: ItemStats = {
    attack: 0,
    spellPower: 0,
    defense: 0,
    poiseBreak: 0,
    maxHp: 0,
    maxStamina: 0,
    critChance: 0,
  };

  if (slot === 'weapon') {
    stats.attack = Math.round((18 + rng() * 8) * scale);
    stats.poiseBreak = Math.round((14 + rng() * 6) * scale);
    stats.critChance = Number((0.05 + (rarity === 'L' ? 0.1 : rarity === 'R' ? 0.06 : 0.02)).toFixed(2));
  } else if (slot === 'staff') {
    stats.spellPower = Math.round((20 + rng() * 9) * scale);
    stats.attack = Math.round((6 + rng() * 4) * scale);
    stats.poiseBreak = Math.round((8 + rng() * 4) * scale);
    stats.critChance = Number((0.06 + (rarity === 'L' ? 0.12 : 0.03)).toFixed(2));
  } else if (slot === 'shield') {
    stats.defense = Math.round((10 + rng() * 5) * scale);
    stats.poiseBreak = Math.round((12 + rng() * 6) * scale);
    stats.maxStamina = Math.round((10 + rng() * 6) * scale);
  } else if (slot === 'armor') {
    stats.defense = Math.round((14 + rng() * 6) * scale);
    stats.maxHp = Math.round((45 + rng() * 25) * scale);
  } else if (slot === 'boots') {
    stats.defense = Math.round((8 + rng() * 4) * scale);
    stats.maxStamina = Math.round((16 + rng() * 8) * scale);
    stats.maxHp = Math.round((20 + rng() * 12) * scale);
  }

  const affixes: string[] = [];
  if (suffix) {
    const bonusVal = Math.max(4, Math.round(12 * scale * suffix.mult * 2));
    if (suffix.stat === 'critChance') {
      stats.critChance = Number((stats.critChance + 0.05).toFixed(2));
      affixes.push(`+5% Crit Chance`);
    } else {
      stats[suffix.stat] += bonusVal;
      affixes.push(`+${bonusVal} ${formatStatName(suffix.stat)}`);
    }
  }
  if (rarity === 'R' || rarity === 'L') {
    const extra = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
    const extraVal = Math.max(5, Math.round(14 * scale * extra.mult * 1.8));
    stats[extra.stat] += extraVal;
    affixes.push(`+${extraVal} ${formatStatName(extra.stat)}`);
  }

  let setId: GearSetId | undefined;
  if (rarity === 'R' || rarity === 'L') {
    if (rng() < (rarity === 'L' ? 0.78 : 0.45)) {
      const setIds: GearSetId[] = ['ashen_vanguard', 'pyre_arcanist', 'vault_stalker'];
      setId = setIds[Math.floor(rng() * setIds.length)];
    }
  }

  const runeSlots = slot === 'weapon' || slot === 'staff' ? (rarity === 'L' ? 2 : rarity === 'R' ? 2 : 1) : 0;
  const flameEffect = rarity === 'L' || prefix.includes('Flame') || prefix.includes('Cinder');
  const fullName = suffix && rarity !== 'L' ? `${prefix} ${base} ${suffix.label}` : `${prefix} ${base}`;

  return {
    id: nextUid('gear'),
    name: fullName,
    baseType: base,
    slot,
    rarity,
    level: floor * 4 + Math.floor(rng() * 3),
    stats,
    affixes,
    setId,
    bound: Boolean(options.bound),
    flameEffect,
    runeSlots,
    socketedRunes: [],
    valueEmbers: Math.round((rarity === 'L' ? 140 : rarity === 'R' ? 70 : rarity === 'E' ? 35 : 15) * (1 + floor * 0.25)),
  };
}

export function generateMysticRune(
  floor: number,
  forcedRuneId?: RuneId,
  bound = false,
  rng: () => number = Math.random
): MysticRune {
  const runeIds: RuneId[] = ['splitting', 'ignition', 'shattering', 'leeching', 'tempest', 'aegis'];
  const runeId = forcedRuneId ?? runeIds[Math.floor(rng() * runeIds.length)];
  const rank = Math.min(5, Math.max(1, Math.floor(floor * 0.7 + rng() * 1.6)));
  const rarity: Rarity = rank >= 4 ? 'L' : rank >= 3 ? 'R' : 'E';
  const entry = RUNE_CATALOG[runeId];
  return {
    id: nextUid('rune'),
    runeId,
    name: entry.name,
    rank,
    rarity,
    description: entry.description(rank),
    bound,
  };
}

export function createStarterEquipment(): Record<GearSlot, GearItem | null> {
  return {
    weapon: {
      id: 'starter_sword',
      name: 'Tempered Steel Broadsword',
      baseType: 'Broadsword',
      slot: 'weapon',
      rarity: 'C',
      level: 1,
      stats: { attack: 24, spellPower: 0, defense: 0, poiseBreak: 20, maxHp: 0, maxStamina: 0, critChance: 0.06 },
      affixes: ['Balanced Vault Steel'],
      bound: true,
      runeSlots: 2,
      socketedRunes: [],
      valueEmbers: 10,
    },
    staff: {
      id: 'starter_staff',
      name: 'Cinder-Tipped Ash Staff',
      baseType: 'Ashwood Staff',
      slot: 'staff',
      rarity: 'E',
      level: 1,
      stats: { attack: 8, spellPower: 26, defense: 0, poiseBreak: 12, maxHp: 0, maxStamina: 0, critChance: 0.08 },
      affixes: ['+8 Arcane Priming'],
      bound: true,
      runeSlots: 2,
      socketedRunes: [],
      valueEmbers: 15,
    },
    shield: {
      id: 'starter_shield',
      name: 'Iron-Rimmed Kite Shield',
      baseType: 'Kite Shield',
      slot: 'shield',
      rarity: 'C',
      level: 1,
      stats: { attack: 0, spellPower: 0, defense: 12, poiseBreak: 18, maxHp: 0, maxStamina: 15, critChance: 0 },
      affixes: ['120° Guard Arc'],
      bound: true,
      runeSlots: 0,
      socketedRunes: [],
      valueEmbers: 10,
    },
    armor: {
      id: 'starter_armor',
      name: 'Weathered Brigandine',
      baseType: 'Brigandine',
      slot: 'armor',
      rarity: 'C',
      level: 1,
      stats: { attack: 0, spellPower: 0, defense: 14, poiseBreak: 0, maxHp: 60, maxStamina: 0, critChance: 0 },
      affixes: [],
      bound: true,
      runeSlots: 0,
      socketedRunes: [],
      valueEmbers: 10,
    },
    boots: {
      id: 'starter_boots',
      name: 'Sturdy Iron Boots',
      baseType: 'Iron Boots',
      slot: 'boots',
      rarity: 'C',
      level: 1,
      stats: { attack: 0, spellPower: 0, defense: 8, poiseBreak: 0, maxHp: 20, maxStamina: 15, critChance: 0 },
      affixes: [],
      bound: true,
      runeSlots: 0,
      socketedRunes: [],
      valueEmbers: 10,
    },
  };
}

export function formatStatName(stat: keyof ItemStats): string {
  switch (stat) {
    case 'attack':
      return 'ATK';
    case 'spellPower':
      return 'MAG';
    case 'defense':
      return 'DEF';
    case 'poiseBreak':
      return 'POISE';
    case 'maxHp':
      return 'HP';
    case 'maxStamina':
      return 'STA';
    case 'critChance':
      return 'CRIT';
  }
}

export function computeGearPowerScore(item: GearItem | null): number {
  if (!item) return 0;
  const s = item.stats;
  return Math.round(
    s.attack * 2.2 +
      s.spellPower * 2.2 +
      s.defense * 1.8 +
      s.poiseBreak * 1.4 +
      s.maxHp * 0.45 +
      s.maxStamina * 0.8 +
      s.critChance * 120
  );
}

export function compareItems(
  candidate: GearItem,
  current: GearItem | null
): { deltas: Array<{ label: string; diff: number }>; scoreDiff: number; summary: string } {
  const keys: Array<keyof ItemStats> = ['attack', 'spellPower', 'defense', 'poiseBreak', 'maxHp', 'maxStamina'];
  const deltas: Array<{ label: string; diff: number }> = [];
  for (const k of keys) {
    const diff = candidate.stats[k] - (current?.stats[k] ?? 0);
    if (diff !== 0) {
      deltas.push({ label: formatStatName(k), diff });
    }
  }
  const scoreDiff = computeGearPowerScore(candidate) - computeGearPowerScore(current);
  const top = deltas.slice(0, 2).map((d) => `${d.diff > 0 ? '+' : ''}${d.diff} ${d.label}`);
  const summary = top.length > 0 ? top.join(' · ') : 'Even stats';
  return { deltas, scoreDiff, summary };
}

export function computeEquippedSetCounts(equipped: Record<GearSlot, GearItem | null>): Record<GearSetId, number> {
  const counts: Record<GearSetId, number> = {
    ashen_vanguard: 0,
    pyre_arcanist: 0,
    vault_stalker: 0,
  };
  for (const slot of Object.keys(equipped) as GearSlot[]) {
    const item = equipped[slot];
    if (item?.setId) {
      counts[item.setId] += 1;
    }
  }
  return counts;
}

export function getActiveSetBonusLabels(equipped: Record<GearSlot, GearItem | null>): string[] {
  const counts = computeEquippedSetCounts(equipped);
  const out: string[] = [];
  for (const setId of Object.keys(counts) as GearSetId[]) {
    const count = counts[setId];
    const def = GEAR_SETS[setId];
    if (count >= 2) out.push(`${def.name} (${count}/3): ${def.bonus2pc}`);
    if (count >= 3) out.push(`${def.name} (3/3): ${def.bonus3pc}`);
  }
  return out;
}

export function reforgeItemAffixes(item: GearItem, rng: () => number = Math.random): GearItem {
  const bonusScale = 1 + item.level * 0.08;
  const s1 = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
  const s2 = SUFFIXES[Math.floor(rng() * SUFFIXES.length)];
  const nextStats: ItemStats = { ...item.stats };
  const v1 = Math.max(4, Math.round(14 * bonusScale * s1.mult * 2));
  nextStats[s1.stat] = Math.round(nextStats[s1.stat] * 0.92) + v1;
  const affixes = [`+${v1} ${formatStatName(s1.stat)} (Reforged)`];
  if (item.rarity === 'R' || item.rarity === 'L') {
    const v2 = Math.max(4, Math.round(12 * bonusScale * s2.mult * 1.8));
    nextStats[s2.stat] += v2;
    affixes.push(`+${v2} ${formatStatName(s2.stat)}`);
  }
  return {
    ...item,
    stats: nextStats,
    affixes,
  };
}

export function upgradeRuneRank(rune: MysticRune): MysticRune {
  if (rune.rank >= 5) return rune;
  const nextRank = rune.rank + 1;
  const entry = RUNE_CATALOG[rune.runeId];
  return {
    ...rune,
    rank: nextRank,
    rarity: nextRank >= 4 ? 'L' : nextRank >= 3 ? 'R' : 'E',
    description: entry.description(nextRank),
  };
}

export function transposeBossRemembrance(remembrance: BossRemembrance): GearItem {
  const floor = remembrance.floor;
  const isStaff = floor === 3;
  const slot: GearSlot = isStaff ? 'staff' : 'weapon';
  const setId: GearSetId = floor === 1 ? 'ashen_vanguard' : floor === 3 ? 'pyre_arcanist' : 'vault_stalker';

  return {
    id: nextUid('sig'),
    name: remembrance.signatureWeaponName,
    baseType: isStaff ? 'Sovereign Scepter' : 'Signature Greatsword',
    slot,
    rarity: 'L',
    level: floor * 6 + 4,
    stats: {
      attack: isStaff ? 22 + floor * 6 : 48 + floor * 14,
      spellPower: isStaff ? 54 + floor * 16 : 16 + floor * 4,
      defense: 8 + floor * 3,
      poiseBreak: 38 + floor * 10,
      maxHp: 35 + floor * 15,
      maxStamina: 15 + floor * 5,
      critChance: 0.16,
    },
    affixes: [`Boss Signature (${remembrance.bossName})`, '+25% Resonance & Poise Impact'],
    setId,
    bound: true,
    isSignature: true,
    flameEffect: true,
    runeSlots: 2,
    socketedRunes: [],
    valueEmbers: 300 + floor * 100,
  };
}

export function getActiveRunesFromEquipped(equipped: Record<GearSlot, GearItem | null>): MysticRune[] {
  const list: MysticRune[] = [];
  if (equipped.weapon) list.push(...equipped.weapon.socketedRunes);
  if (equipped.staff) list.push(...equipped.staff.socketedRunes);
  return list;
}

export function getRuneRank(runes: MysticRune[], runeId: RuneId): number {
  let maxRank = 0;
  for (const r of runes) {
    if (r.runeId === runeId && r.rank > maxRank) {
      maxRank = r.rank;
    }
  }
  return maxRank;
}
