import type {
  ConstellationNode,
  GearItem,
  GearSlot,
  MysticRune,
  Stance,
} from '../game/types';
import { computeEquippedSetCounts, getActiveRunesFromEquipped, getRuneRank } from './LootAndForge';

export const STAMINA_COSTS = {
  lightAttack: 16,
  heavyAttack: 30,
  dodge: 22,
  parryAttempt: 10,
  blockHitBase: 16,
  spellCast: 8,
} as const;

export const MANA_COSTS = {
  arcaneBolt: 10,
  fireball: 22,
  resonanceNova: 34,
} as const;

export const PARRY_WINDOW_SEC = 0.24;
export const GUARD_HALF_ANGLE_RAD = (60 * Math.PI) / 180; // 120° total frontal guard arc

export interface DerivedPlayerStats {
  maxHp: number;
  maxMp: number;
  maxStamina: number;
  attack: number;
  spellPower: number;
  defense: number;
  poiseBreak: number;
  critChance: number;
  staminaRegen: number;
  mpRegen: number;
  maxFlaskCharges: number;
  vanguard2pc: boolean;
  vanguard3pc: boolean;
  arcanist2pc: boolean;
  arcanist3pc: boolean;
  stalker2pc: boolean;
  stalker3pc: boolean;
  activeRunes: MysticRune[];
}

export function computeDerivedStats(
  level: number,
  equipped: Record<GearSlot, GearItem | null>,
  constellations: ConstellationNode[]
): DerivedPlayerStats {
  const rankOf = (id: string) => constellations.find((c) => c.id === id)?.rank ?? 0;

  let attack = 16 + (level - 1) * 3;
  let spellPower = 18 + (level - 1) * 3;
  let defense = 6 + (level - 1) * 2;
  let poiseBreak = 18 + rankOf('poise') * 7;
  let maxHp = 220 + (level - 1) * 24 + rankOf('vitality') * 35;
  let maxMp = 90 + (level - 1) * 8 + rankOf('arcana') * 18;
  let maxStamina = 100 + (level - 1) * 4 + rankOf('poise') * 10;
  let critChance = 0.06 + rankOf('fortune') * 0.02;

  for (const slot of Object.keys(equipped) as GearSlot[]) {
    const item = equipped[slot];
    if (!item) continue;
    attack += item.stats.attack;
    spellPower += item.stats.spellPower;
    defense += item.stats.defense;
    poiseBreak += item.stats.poiseBreak;
    maxHp += item.stats.maxHp;
    maxStamina += item.stats.maxStamina;
    critChance += item.stats.critChance;
  }

  const sets = computeEquippedSetCounts(equipped);
  const stalker2pc = sets.vault_stalker >= 2;
  const activeRunes = getActiveRunesFromEquipped(equipped);

  return {
    maxHp,
    maxMp,
    maxStamina,
    attack,
    spellPower,
    defense,
    poiseBreak,
    critChance: Math.min(0.65, critChance),
    staminaRegen: (stalker2pc ? 34 : 27) + rankOf('poise') * 2,
    mpRegen: 7 + rankOf('arcana') * 2.5,
    maxFlaskCharges: 4 + rankOf('flasks'),
    vanguard2pc: sets.ashen_vanguard >= 2,
    vanguard3pc: sets.ashen_vanguard >= 3,
    arcanist2pc: sets.pyre_arcanist >= 2,
    arcanist3pc: sets.pyre_arcanist >= 3,
    stalker2pc,
    stalker3pc: sets.vault_stalker >= 3,
    activeRunes,
  };
}

export interface AttackHitResult {
  damage: number;
  poiseDamage: number;
  isCrit: boolean;
  resonanceDetonated: boolean;
  resonanceBonusDamage: number;
  igniteDps: number;
  mpRefund: number;
}

export function resolvePlayerStrike(params: {
  stats: DerivedPlayerStats;
  stance: Stance;
  attackKind: 'light1' | 'light2' | 'light3' | 'heavy' | 'riposte' | 'fireball' | 'arcane_bolt' | 'nova';
  targetPrimeStacks: number;
  targetStaggered: boolean;
  rng?: () => number;
}): AttackHitResult {
  const { stats, attackKind, targetPrimeStacks, targetStaggered } = params;
  const rng = params.rng ?? Math.random;
  const shatteringRank = getRuneRank(stats.activeRunes, 'shattering');
  const ignitionRank = getRuneRank(stats.activeRunes, 'ignition');

  const isSpell = attackKind === 'fireball' || attackKind === 'arcane_bolt' || attackKind === 'nova';
  const baseStat = isSpell ? stats.spellPower : stats.attack;

  let dmgMult = 1.0;
  let poiseMult = 1.0;

  switch (attackKind) {
    case 'light1':
      dmgMult = 1.0;
      poiseMult = 0.85;
      break;
    case 'light2':
      dmgMult = 1.18;
      poiseMult = 1.0;
      break;
    case 'light3':
      dmgMult = 1.48;
      poiseMult = 1.35;
      break;
    case 'heavy':
      dmgMult = 2.15;
      poiseMult = 2.25;
      break;
    case 'riposte':
      dmgMult = 3.45;
      poiseMult = 0;
      break;
    case 'arcane_bolt':
      dmgMult = 0.92;
      poiseMult = 0.55;
      break;
    case 'fireball':
      dmgMult = 1.65;
      poiseMult = 1.25;
      break;
    case 'nova':
      dmgMult = 2.05;
      poiseMult = 1.8;
      break;
  }

  const isCrit = attackKind === 'riposte' || rng() < stats.critChance;
  const critMult = isCrit ? 1.55 : 1.0;
  const staggerMult = targetStaggered && attackKind !== 'riposte' ? 1.35 : 1.0;

  let damage = Math.round(baseStat * dmgMult * critMult * staggerMult);
  let poiseDamage = Math.round(
    stats.poiseBreak *
      poiseMult *
      (1 + (shatteringRank > 0 && !isSpell ? 0.25 + shatteringRank * 0.12 : 0)) *
      (stats.vanguard2pc && !isSpell ? 1.25 : 1)
  );

  // Resonance Detonation: Steel strike detonating Arcane Prime stacks
  let resonanceDetonated = false;
  let resonanceBonusDamage = 0;
  if (!isSpell && targetPrimeStacks > 0) {
    resonanceDetonated = true;
    const arcanistMult = stats.arcanist2pc ? 1.3 : 1.0;
    resonanceBonusDamage = Math.round((stats.spellPower * 0.85 + 18) * targetPrimeStacks * arcanistMult);
    damage += resonanceBonusDamage;
    poiseDamage += Math.round(22 * targetPrimeStacks);
  }

  const igniteDps =
    ignitionRank > 0 && (attackKind === 'fireball' || attackKind === 'heavy') ? 8 + ignitionRank * 5 : 0;

  const mpRefund = isSpell && stats.arcanist3pc ? Math.round(MANA_COSTS.fireball * 0.22) : 0;

  return {
    damage,
    poiseDamage,
    isCrit,
    resonanceDetonated,
    resonanceBonusDamage,
    igniteDps,
    mpRefund,
  };
}

export interface IncomingHitResolution {
  outcome: 'parried' | 'blocked' | 'guard_broken' | 'hit';
  hpDamage: number;
  staminaCost: number;
  parryPoiseDamage: number;
  aegisShockDamage: number;
  staminaRefund: number;
}

export function resolveIncomingEnemyHit(params: {
  rawDamage: number;
  playerDefense: number;
  playerStamina: number;
  isBlocking: boolean;
  parryTimer: number;
  angleDiffRad: number; // angle between player forward and vector to attacker
  isDodgingInvuln: boolean;
  stats: DerivedPlayerStats;
}): IncomingHitResolution {
  const { rawDamage, playerDefense, playerStamina, isBlocking, parryTimer, angleDiffRad, isDodgingInvuln, stats } =
    params;

  if (isDodgingInvuln) {
    return {
      outcome: 'blocked',
      hpDamage: 0,
      staminaCost: 0,
      parryPoiseDamage: 0,
      aegisShockDamage: 0,
      staminaRefund: 0,
    };
  }

  const mitigated = Math.max(4, Math.round(rawDamage * (100 / (100 + playerDefense * 1.4))));
  const withinGuardArc = Math.abs(angleDiffRad) <= GUARD_HALF_ANGLE_RAD;

  // Timed Parry check
  if (parryTimer > 0 && withinGuardArc) {
    const shatteringRank = getRuneRank(stats.activeRunes, 'shattering');
    const aegisRank = getRuneRank(stats.activeRunes, 'aegis');
    const parryPoiseDamage = Math.round(
      (75 + stats.poiseBreak * 1.1) *
        (stats.vanguard2pc ? 1.25 : 1) *
        (1 + (shatteringRank > 0 ? 0.25 + shatteringRank * 0.12 : 0))
    );
    const aegisShockDamage = aegisRank > 0 ? 24 + aegisRank * 10 : 0;
    const staminaRefund = aegisRank > 0 ? 20 + aegisRank * 5 : 12;
    return {
      outcome: 'parried',
      hpDamage: 0,
      staminaCost: 0,
      parryPoiseDamage,
      aegisShockDamage,
      staminaRefund,
    };
  }

  // Directional Guard check
  if (isBlocking && withinGuardArc) {
    const blockCost = Math.round(STAMINA_COSTS.blockHitBase + mitigated * 0.45);
    if (playerStamina >= blockCost) {
      return {
        outcome: 'blocked',
        hpDamage: Math.max(1, Math.round(mitigated * 0.18)),
        staminaCost: blockCost,
        parryPoiseDamage: 0,
        aegisShockDamage: 0,
        staminaRefund: 0,
      };
    }
    return {
      outcome: 'guard_broken',
      hpDamage: Math.round(mitigated * 0.72),
      staminaCost: playerStamina,
      parryPoiseDamage: 0,
      aegisShockDamage: 0,
      staminaRefund: 0,
    };
  }

  return {
    outcome: 'hit',
    hpDamage: mitigated,
    staminaCost: 0,
    parryPoiseDamage: 0,
    aegisShockDamage: 0,
    staminaRefund: 0,
  };
}

export function computeVaultPressure(floor: number, roomsCleared: number, restCount: number): number {
  return Math.min(100, Math.round((floor - 1) * 18 + roomsCleared * 11 + restCount * 10));
}

export function computePressureEnemyScale(pressure: number): { hpMult: number; dmgMult: number; lootMult: number } {
  const p = Math.max(0, pressure) / 100;
  return {
    hpMult: Number((1 + p * 0.65).toFixed(2)),
    dmgMult: Number((1 + p * 0.48).toFixed(2)),
    lootMult: Number((1 + p * 1.45).toFixed(2)),
  };
}
