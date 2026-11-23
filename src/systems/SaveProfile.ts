import type {
  BossRemembrance,
  CodexEntry,
  ConstellationNode,
  GearItem,
  GearSlot,
  LostEcho,
  MysticRune,
  RunRecord,
  SaveProfile,
} from '../game/types';
import { createStarterEquipment, generateMysticRune, computeGearPowerScore } from './LootAndForge';

export const SAVE_STORAGE_KEY = 'sunken_vaults_save_v1';
export const MAX_STASH_SLOTS = 24;

export function createDefaultConstellations(): ConstellationNode[] {
  return [
    {
      id: 'vitality',
      name: 'Star of Iron Blood',
      description: '+35 Max HP per rank permanently.',
      rank: 0,
      maxRank: 5,
      baseCost: 45,
    },
    {
      id: 'poise',
      name: 'Star of the Colossus',
      description: '+7 Poise Break, +10 Max Stamina & +2 Stamina/s per rank.',
      rank: 0,
      maxRank: 5,
      baseCost: 50,
    },
    {
      id: 'arcana',
      name: 'Star of the Pyre',
      description: '+18 Max MP & +2.5 MP Regen/s per rank.',
      rank: 0,
      maxRank: 5,
      baseCost: 50,
    },
    {
      id: 'fortune',
      name: 'Star of Gilded Ash',
      description: '+2% Crit Chance & +15% Soul Embers gained per rank.',
      rank: 0,
      maxRank: 5,
      baseCost: 55,
    },
    {
      id: 'flasks',
      name: 'Star of the Crimson Vial',
      description: '+1 Maximum Crimson Ember Flask charge per rank.',
      rank: 0,
      maxRank: 4,
      baseCost: 70,
    },
    {
      id: 'extraction',
      name: 'Star of Safe Passage',
      description: '+1 Starting Portal Scroll & 25% faster Portal channeling per rank.',
      rank: 0,
      maxRank: 3,
      baseCost: 65,
    },
  ];
}

export function createDefaultCodex(): Record<string, CodexEntry> {
  return {
    goblin: {
      id: 'goblin',
      name: 'Dungeon Goblin',
      category: 'bestiary',
      kills: 0,
      discovered: true,
      description: 'Scavenging crypt raiders wielding jagged spears. Swift in packs, vulnerable to Timed Parries.',
      weakness: 'Low Poise — Parry shatters immediately.',
    },
    spider: {
      id: 'spider',
      name: 'Giant Vault Spider',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Chitinous ambush arachnid that circles and lunges from mossy alcoves.',
      weakness: 'Weak to Fireball & Resonance Ignition.',
    },
    cultist: {
      id: 'cultist',
      name: 'Ember Cultist',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Cloaked heretic keeping distance while hurling scorching arcane orbs.',
      weakness: 'Close gap with Dodge; interrupts easily with Steel.',
    },
    sentinel: {
      id: 'sentinel',
      name: 'Armored Vault Sentinel',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Ironclad guardian bearing a tower shield. Relentless frontal advance.',
      weakness: 'Prime with Arcane Spells then Heavy Cleave to shatter Poise.',
    },
    boss_b1: {
      id: 'boss_b1',
      name: 'The Drowned Warden (B1 Boss)',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Keeper of the Flooded Crypt. Swings a rusted anchor-blade in wide, telegraphed arcs.',
      weakness: 'Timed Parry breaks stance for massive Ripostes.',
    },
    boss_b2: {
      id: 'boss_b2',
      name: 'Gilded Adjudicator (B2 Boss)',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Golden-masked colossus guarding the Gilded Sanctum treasury.',
      weakness: 'Arcane Prime + Heavy Cleave Resonance.',
    },
    boss_b3: {
      id: 'boss_b3',
      name: 'Cinder Sovereign (B3 Boss)',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Lord of the Ember Core, keeper of the Fire Heart.',
      weakness: 'Dodge flame bursts and counter during recovery.',
    },
    boss_b4: {
      id: 'boss_b4',
      name: 'Hollow Eclipse (B4 Abyss Boss)',
      category: 'bestiary',
      kills: 0,
      discovered: false,
      description: 'Ancient void shade dwelling at the root of the Sunken Vaults.',
      weakness: 'Sustained Dual-Stance Resonance & Poise breaks.',
    },
    lore_bridge: {
      id: 'lore_bridge',
      name: 'The Twilight Crossing',
      category: 'lore',
      discovered: true,
      description:
        'A weathered stone causeway spanning the pine gorge beneath the ruined spires of Castle Vael. Only Bound relics survive the Vault curse.',
    },
  };
}

export function createDefaultSaveProfile(): SaveProfile {
  const starterRune = generateMysticRune(1, 'splitting', true, () => 0.25);
  return {
    version: 1,
    level: 1,
    xp: 0,
    xpToNext: 100,
    soulEmbers: 60,
    highestFloor: 1,
    equipped: createStarterEquipment(),
    stash: [],
    runesStash: [starterRune],
    remembrances: [],
    constellations: createDefaultConstellations(),
    lostEcho: null,
    codex: createDefaultCodex(),
    runHistory: [],
  };
}

export function loadSaveProfile(): SaveProfile {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultSaveProfile();
    }
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return createDefaultSaveProfile();
    const parsed = JSON.parse(raw) as Partial<SaveProfile>;
    const defaults = createDefaultSaveProfile();
    return {
      ...defaults,
      ...parsed,
      equipped: { ...defaults.equipped, ...(parsed.equipped ?? {}) },
      constellations:
        Array.isArray(parsed.constellations) && parsed.constellations.length > 0
          ? parsed.constellations
          : defaults.constellations,
      codex: { ...defaults.codex, ...(parsed.codex ?? {}) },
      stash: Array.isArray(parsed.stash) ? parsed.stash.slice(0, MAX_STASH_SLOTS) : [],
      runesStash: Array.isArray(parsed.runesStash) ? parsed.runesStash : defaults.runesStash,
      remembrances: Array.isArray(parsed.remembrances) ? parsed.remembrances : [],
      runHistory: Array.isArray(parsed.runHistory) ? parsed.runHistory.slice(0, 12) : [],
    };
  } catch {
    return createDefaultSaveProfile();
  }
}

export function persistSaveProfile(profile: SaveProfile): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota / sandbox errors gracefully
  }
}

export function upgradeConstellationNode(profile: SaveProfile, nodeId: string): { profile: SaveProfile; success: boolean } {
  const node = profile.constellations.find((n) => n.id === nodeId);
  if (!node || node.rank >= node.maxRank) return { profile, success: false };
  const cost = node.baseCost * (node.rank + 1);
  if (profile.soulEmbers < cost) return { profile, success: false };

  const nextNodes = profile.constellations.map((n) => (n.id === nodeId ? { ...n, rank: n.rank + 1 } : n));
  return {
    success: true,
    profile: {
      ...profile,
      soulEmbers: profile.soulEmbers - cost,
      constellations: nextNodes,
    },
  };
}

export function applyExtractionToProfile(
  profile: SaveProfile,
  bagItems: GearItem[],
  bagRunes: MysticRune[],
  runEmbers: number,
  record: RunRecord
): { profile: SaveProfile; itemsSecured: number } {
  const boundGear = bagItems.map((i) => ({ ...i, bound: true }));
  const boundRunes = bagRunes.map((r) => ({ ...r, bound: true }));
  const availableSlots = Math.max(0, MAX_STASH_SLOTS - profile.stash.length);
  const bankedGear = boundGear.slice(0, availableSlots);
  const overflowEmbers = boundGear.slice(availableSlots).reduce((acc, i) => acc + i.valueEmbers, 0);

  return {
    itemsSecured: bankedGear.length + boundRunes.length,
    profile: {
      ...profile,
      soulEmbers: profile.soulEmbers + runEmbers + overflowEmbers,
      highestFloor: Math.max(profile.highestFloor, record.maxFloor),
      stash: [...profile.stash, ...bankedGear],
      runesStash: [...profile.runesStash, ...boundRunes],
      runHistory: [record, ...profile.runHistory].slice(0, 12),
    },
  };
}

export function applyDefeatToProfile(
  profile: SaveProfile,
  bagItems: GearItem[],
  bagRunes: MysticRune[],
  runEmbers: number,
  deathPos: { floor: number; x: number; z: number },
  record: RunRecord
): { profile: SaveProfile; lostCount: number; echo: LostEcho } {
  // Bound items survive; Unbound items are purged, with best lost item condensed into Lost Echo!
  const keptGear = bagItems.filter((i) => i.bound);
  const lostGear = bagItems.filter((i) => !i.bound);
  const keptRunes = bagRunes.filter((r) => r.bound);
  const lostRunes = bagRunes.filter((r) => !r.bound);

  let bestLostItem: GearItem | undefined;
  let bestScore = -1;
  for (const item of lostGear) {
    const score = computeGearPowerScore(item);
    if (score > bestScore) {
      bestScore = score;
      bestLostItem = item;
    }
  }

  const echo: LostEcho = {
    floor: Math.max(1, deathPos.floor),
    x: deathPos.x,
    z: deathPos.z,
    embers: Math.max(25, Math.round(runEmbers * 0.75) + lostGear.length * 15),
    bestItem: bestLostItem,
  };

  const availableSlots = Math.max(0, MAX_STASH_SLOTS - profile.stash.length);
  const bankedKept = keptGear.slice(0, availableSlots);

  return {
    lostCount: lostGear.length + lostRunes.length,
    echo,
    profile: {
      ...profile,
      soulEmbers: profile.soulEmbers + Math.round(runEmbers * 0.25),
      stash: [...profile.stash, ...bankedKept],
      runesStash: [...profile.runesStash, ...keptRunes],
      lostEcho: echo,
      runHistory: [record, ...profile.runHistory].slice(0, 12),
    },
  };
}

export function addBossRemembranceToProfile(
  profile: SaveProfile,
  floor: number,
  bossId: string,
  bossName: string
): SaveProfile {
  const sigNames: Record<number, string> = {
    1: "Drowned Warden's Anchorblade",
    2: "Gilded Adjudicator's Halberd",
    3: "Cinder Sovereign's Flame Scepter",
    4: 'Abyssal Eclipse Greatsword',
  };
  const alreadyHas = profile.remembrances.some((r) => r.bossId === bossId);
  if (alreadyHas) return profile;

  const rem: BossRemembrance = {
    id: `rem_${bossId}`,
    bossId,
    bossName,
    floor,
    signatureWeaponName: sigNames[floor] ?? 'Legendary Flame Sword',
    transposed: false,
  };

  return {
    ...profile,
    remembrances: [...profile.remembrances, rem],
  };
}

export function grantXpToProfile(profile: SaveProfile, xpAmount: number): { profile: SaveProfile; leveledUp: boolean } {
  let level = profile.level;
  let xp = profile.xp + xpAmount;
  let xpToNext = profile.xpToNext;
  let leveledUp = false;

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(100 * Math.pow(1.28, level - 1));
    leveledUp = true;
  }

  return {
    leveledUp,
    profile: {
      ...profile,
      level,
      xp,
      xpToNext,
    },
  };
}

export function recordKillInCodex(profile: SaveProfile, archetype: string): SaveProfile {
  const existing = profile.codex[archetype];
  if (!existing) return profile;
  return {
    ...profile,
    codex: {
      ...profile.codex,
      [archetype]: {
        ...existing,
        discovered: true,
        kills: (existing.kills ?? 0) + 1,
      },
    },
  };
}

export function equipFromStashOrBag(
  equipped: Record<GearSlot, GearItem | null>,
  item: GearItem
): { nextEquipped: Record<GearSlot, GearItem | null>; replaced: GearItem | null } {
  const replaced = equipped[item.slot];
  return {
    nextEquipped: {
      ...equipped,
      [item.slot]: item,
    },
    replaced,
  };
}
