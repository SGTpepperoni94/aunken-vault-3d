import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareItems,
  createStarterEquipment,
  generateGearItem,
  generateMysticRune,
  getActiveSetBonusLabels,
  mulberry32,
  reforgeItemAffixes,
  transposeBossRemembrance,
  upgradeRuneRank,
} from '../systems/LootAndForge';
import {
  computeDerivedStats,
  computePressureEnemyScale,
  computeVaultPressure,
  resolveIncomingEnemyHit,
  resolvePlayerStrike,
} from '../systems/CombatSystem';
import {
  addBossRemembranceToProfile,
  applyDefeatToProfile,
  applyExtractionToProfile,
  createDefaultSaveProfile,
  grantXpToProfile,
  upgradeConstellationNode,
} from '../systems/SaveProfile';
import {
  generateDungeonFloor,
  generateHubMap,
  isWorldPosWalkable,
  verifyDungeonConnectivity,
} from '../world/DungeonLogic';

test('Dungeon generator creates connected Hub and B1-B4 floors with walkable open spawns', () => {
  const hub = generateHubMap();
  const hubConn = verifyDungeonConnectivity(hub);
  assert.equal(hubConn.spawnWalkable, true);
  assert.equal(isWorldPosWalkable(hub, hub.spawnX, hub.spawnZ - 2, 0.35, false, false), true);

  for (let floor = 1; floor <= 4; floor++) {
    const map = generateDungeonFloor(floor, 4242);
    const conn = verifyDungeonConnectivity(map);
    assert.equal(conn.spawnWalkable, true, `Floor ${floor} spawn must be walkable`);
    assert.equal(conn.allRoomsReachable, true, `Floor ${floor} all rooms must be reachable`);
    assert.equal(conn.bossReachableThroughFog, true, `Floor ${floor} boss room must connect via fog gate`);
    // Player spawns facing -Z (north); verify path straight ahead is open
    assert.equal(isWorldPosWalkable(map, map.spawnX, map.spawnZ - 2.0, 0.35, false, false), true);
  }
});

test('Soulslike combat resolves Timed Parry, Directional Guard, and Resonance Detonation accurately', () => {
  const profile = createDefaultSaveProfile();
  const stats = computeDerivedStats(profile.level, profile.equipped, profile.constellations);

  // Timed parry inside 120 deg guard arc deals 0 HP damage and high poise shatter
  const parry = resolveIncomingEnemyHit({
    rawDamage: 45,
    playerDefense: stats.defense,
    playerStamina: 80,
    isBlocking: true,
    parryTimer: 0.15,
    angleDiffRad: 0.2,
    isDodgingInvuln: false,
    stats,
  });
  assert.equal(parry.outcome, 'parried');
  assert.equal(parry.hpDamage, 0);
  assert.ok(parry.parryPoiseDamage >= 75);

  // Directional guard absorbs most damage into stamina
  const block = resolveIncomingEnemyHit({
    rawDamage: 45,
    playerDefense: stats.defense,
    playerStamina: 80,
    isBlocking: true,
    parryTimer: 0,
    angleDiffRad: 0.3,
    isDodgingInvuln: false,
    stats,
  });
  assert.equal(block.outcome, 'blocked');
  assert.ok(block.staminaCost > 0);
  assert.ok(block.hpDamage < 12);

  // Flanked hit outside 120 deg arc bypasses shield
  const flanked = resolveIncomingEnemyHit({
    rawDamage: 45,
    playerDefense: stats.defense,
    playerStamina: 80,
    isBlocking: true,
    parryTimer: 0.15,
    angleDiffRad: 2.2,
    isDodgingInvuln: false,
    stats,
  });
  assert.equal(flanked.outcome, 'hit');
  assert.ok(flanked.hpDamage > block.hpDamage);

  // Steel strike detonates Arcane Prime stacks for Resonance bonus
  const plain = resolvePlayerStrike({
    stats,
    stance: 'vanguard',
    attackKind: 'light1',
    targetPrimeStacks: 0,
    targetStaggered: false,
    rng: () => 0.99,
  });
  const resonance = resolvePlayerStrike({
    stats,
    stance: 'vanguard',
    attackKind: 'light1',
    targetPrimeStacks: 2,
    targetStaggered: false,
    rng: () => 0.99,
  });
  assert.equal(resonance.resonanceDetonated, true);
  assert.ok(resonance.damage > plain.damage);
  assert.ok(resonance.poiseDamage > plain.poiseDamage);
});

test('Loot generator, Rune upgrades, Set bonuses, Reforging, and Remembrance transposition work', () => {
  const rng = mulberry32(999);
  const legSword = generateGearItem({ floor: 3, vaultPressure: 60, forcedRarity: 'L', forcedSlot: 'weapon', rng });
  assert.equal(legSword.rarity, 'L');
  assert.equal(legSword.runeSlots, 2);

  const starter = createStarterEquipment();
  const cmp = compareItems(legSword, starter.weapon);
  assert.ok(cmp.scoreDiff > 0);

  const reforged = reforgeItemAffixes(legSword, rng);
  assert.ok(reforged.affixes.length >= 1);

  const rune = generateMysticRune(1, 'splitting', false, rng);
  const upgraded = upgradeRuneRank(rune);
  assert.equal(upgraded.rank, Math.min(5, rune.rank + 1));

  // 2pc & 3pc Set bonuses
  const setEquipped = {
    ...starter,
    weapon: { ...starter.weapon!, setId: 'ashen_vanguard' as const },
    shield: { ...starter.shield!, setId: 'ashen_vanguard' as const },
    armor: { ...starter.armor!, setId: 'ashen_vanguard' as const },
  };
  const bonuses = getActiveSetBonusLabels(setEquipped);
  assert.equal(bonuses.length, 2);

  const remProfile = addBossRemembranceToProfile(createDefaultSaveProfile(), 1, 'boss_b1', 'The Drowned Warden');
  assert.equal(remProfile.remembrances.length, 1);
  const sigWeapon = transposeBossRemembrance(remProfile.remembrances[0]);
  assert.equal(sigWeapon.rarity, 'L');
  assert.equal(sigWeapon.isSignature, true);
});

test('Extraction banks Unbound gear while Defeat purges Unbound gear into a reclaimable Lost Echo', () => {
  const rng = mulberry32(77);
  let profile = createDefaultSaveProfile();

  const boundItem = generateGearItem({ floor: 2, forcedRarity: 'R', bound: true, rng });
  const unboundBest = generateGearItem({ floor: 3, forcedRarity: 'L', bound: false, rng });
  const unboundCommon = generateGearItem({ floor: 1, forcedRarity: 'C', bound: false, rng });

  const defeat = applyDefeatToProfile(
    profile,
    [boundItem, unboundBest, unboundCommon],
    [],
    120,
    { floor: 2, x: 14, z: 22 },
    { id: 'r1', date: '2026-11-22', outcome: 'defeated', maxFloor: 2, kills: 7, embersEarned: 120, pressurePeak: 42 }
  );
  assert.equal(defeat.lostCount, 2);
  assert.equal(defeat.profile.stash.length, 1); // Bound item survived!
  assert.equal(defeat.echo.bestItem?.id, unboundBest.id); // Best lost item condensed into Lost Echo!
  assert.equal(defeat.echo.floor, 2);

  // Extraction banks all gear & marks bound
  const extracted = applyExtractionToProfile(
    defeat.profile,
    [unboundBest],
    [],
    150,
    { id: 'r2', date: '2026-11-22', outcome: 'extracted', maxFloor: 3, kills: 14, embersEarned: 150, pressurePeak: 68 }
  );
  assert.equal(extracted.itemsSecured, 1);
  assert.equal(extracted.profile.stash.length, 2);
  assert.equal(extracted.profile.stash[1].bound, true);

  // Constellation Meta-Tree upgrade & XP leveling
  const up = upgradeConstellationNode(extracted.profile, 'vitality');
  assert.equal(up.success, true);
  assert.equal(up.profile.constellations.find((c) => c.id === 'vitality')?.rank, 1);

  const lvl = grantXpToProfile(up.profile, 250);
  assert.equal(lvl.leveledUp, true);
  assert.ok(lvl.profile.level >= 2);

  // Vault Pressure scales smoothly
  const pressure = computeVaultPressure(3, 3, 1);
  const scale = computePressureEnemyScale(pressure);
  assert.ok(pressure > 50);
  assert.ok(scale.lootMult > 1.5);
});
