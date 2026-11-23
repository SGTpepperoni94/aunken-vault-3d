import React from 'react';
import { X } from 'lucide-react';
import type { GearItem, GearSlot, HudSnapshot, SaveProfile } from '../game/types';
import { compareItems, GEAR_SETS } from '../systems/LootAndForge';
import { MAX_STASH_SLOTS } from '../systems/SaveProfile';

interface CampAndInventoryModalProps {
  hud: HudSnapshot;
  profile: SaveProfile;
  onSelectTab: (tab: NonNullable<HudSnapshot['campTab']>) => void;
  onClose: () => void;
  onEquipItem: (itemId: string, source: 'bag' | 'stash') => void;
  onSocketRune: (runeId: string, slot: 'weapon' | 'staff', source: 'bag' | 'stash') => void;
  onUnsocketRune: (slot: 'weapon' | 'staff', runeId: string) => void;
  onReforgeItem: (itemId: string) => void;
  onUpgradeRune: (runeId: string) => void;
  onTransposeRemembrance: (remId: string) => void;
  onUpgradeConstellation: (nodeId: string) => void;
}

const SLOT_LABELS: Record<GearSlot, string> = {
  weapon: 'Vanguard Blade',
  staff: 'Arcanist Staff',
  shield: 'Off-Hand Shield',
  armor: 'Cuirass',
  boots: 'Greaves',
};

function rarityColor(r: GearItem['rarity']): string {
  if (r === 'L') return 'text-[#ffd56b] border-[#d99d3b]';
  if (r === 'R') return 'text-[#d5a8ff] border-[#9b5ee0]';
  if (r === 'E') return 'text-[#87f09a] border-[#4ca85a]';
  return 'text-[#b5d6f5] border-[#4c7ba8]';
}

export const CampAndInventoryModal: React.FC<CampAndInventoryModalProps> = ({
  hud,
  profile,
  onSelectTab,
  onClose,
  onEquipItem,
  onSocketRune,
  onUnsocketRune,
  onReforgeItem,
  onUpgradeRune,
  onTransposeRemembrance,
  onUpgradeConstellation,
}) => {
  const activeTab = hud.campTab;
  if (!activeTab) return null;

  const isAtSurfaceCamp = hud.biome === 'hub';

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#060507]/80 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Character, Runes, and Surface Camp Stations"
    >
      <div className="rpg-frame w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b-2 border-[#6b5330] bg-[#1a1410]">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg text-[#f5e3bc] tracking-wider">
              {isAtSurfaceCamp ? 'Surface Camp & Character' : 'Delve Pack & Runes'}
            </h2>
            <span className="text-xs font-mono-num text-[#e6ba5c]">
              {profile.soulEmbers} Banked Embers · Level {profile.level}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Camp Menu"
            className="rpg-btn p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-2.5 border-b border-[#4a3922] bg-[#140f0d]">
          {(
            [
              { id: 'inventory', label: 'Gear & Runes' },
              { id: 'forge', label: 'Ember Forge' },
              { id: 'stash', label: `Bound Stash (${profile.stash.length}/${MAX_STASH_SLOTS})` },
              { id: 'constellation', label: 'Constellations' },
              { id: 'codex', label: 'Codex & Runs' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-display tracking-wide cursor-pointer whitespace-nowrap ${
                activeTab === tab.id ? 'rpg-btn rpg-btn-primary' : 'rpg-btn opacity-80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left: Equipped Gear & Active Sets */}
              <div className="flex flex-col gap-3">
                <h3 className="font-display text-sm text-[#e8c674] tracking-wider">Equipped Gear</h3>
                <div className="flex flex-col gap-2">
                  {(Object.keys(SLOT_LABELS) as GearSlot[]).map((slot) => {
                    const item = profile.equipped[slot];
                    return (
                      <div key={slot} className="rpg-frame-dark p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-display text-[#a89677]">{SLOT_LABELS[slot]}</span>
                          {item?.setId && (
                            <span className="text-[11px] text-[#e6b355]">{GEAR_SETS[item.setId].name}</span>
                          )}
                        </div>
                        {item ? (
                          <>
                            <div className={`text-sm font-semibold mt-0.5 ${rarityColor(item.rarity).split(' ')[0]}`}>
                              {item.name} [{item.rarity}]
                            </div>
                            <div className="text-xs font-mono-num text-[#d4c6ab] mt-1">
                              ATK {item.stats.attack} · MAG {item.stats.spellPower} · DEF {item.stats.defense} · POISE{' '}
                              {item.stats.poiseBreak}
                            </div>
                            {item.runeSlots > 0 && (
                              <div className="mt-2 pt-2 border-t border-[#3b2d1b] flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-[#9e8e72]">
                                  Runes ({item.socketedRunes.length}/{item.runeSlots}):
                                </span>
                                {item.socketedRunes.map((r) => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    onClick={() => onUnsocketRune(slot as 'weapon' | 'staff', r.id)}
                                    className="rpg-btn px-2 py-0.5 text-[11px] text-[#93f09d] cursor-pointer"
                                    title="Click to unsocket rune"
                                  >
                                    {r.name} R{r.rank} ×
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-[#7d705c] italic">Empty Slot</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {hud.activeSetBonuses.length > 0 && (
                  <div className="rpg-frame-dark p-3">
                    <div className="text-xs font-display text-[#f2c65e] mb-1">Active Gear Set Bonuses</div>
                    {hud.activeSetBonuses.map((b) => (
                      <div key={b} className="text-xs text-[#dfd1b2]">
                        {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Delve Bag & On-the-Fly Mystic Rune Socketing */}
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="font-display text-sm text-[#e8c674] tracking-wider mb-2">
                    Delve Pack ({hud.bagItems.length} Items)
                  </h3>
                  {hud.bagItems.length === 0 ? (
                    <div className="rpg-frame-dark p-4 text-xs text-[#9e8e74]">
                      Defeat foes or open Vault chests to collect Unbound gear. Extract with a Portal Scroll to keep it.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {hud.bagItems.map((item) => {
                        const cmp = compareItems(item, profile.equipped[item.slot]);
                        return (
                          <div key={item.id} className="rpg-frame-dark p-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-sm font-semibold truncate ${rarityColor(item.rarity).split(' ')[0]}`}>
                                {item.name} [{item.rarity}]
                              </div>
                              <div className="text-[11px] font-mono-num text-[#cbbca0]">
                                {SLOT_LABELS[item.slot]} · {item.bound ? 'Bound' : 'Unbound'} ·{' '}
                                <span className={cmp.scoreDiff >= 0 ? 'text-[#87f09a]' : 'text-[#f08787]'}>
                                  {cmp.summary}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onEquipItem(item.id, 'bag')}
                              className="rpg-btn px-3 py-1 text-xs font-display cursor-pointer shrink-0"
                            >
                              Equip
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-display text-sm text-[#87f09a] tracking-wider mb-2">
                    Mystic Runes (On-the-Fly Socketing)
                  </h3>
                  {[...hud.bagRunes.map((r) => ({ r, src: 'bag' as const })), ...profile.runesStash.map((r) => ({ r, src: 'stash' as const }))].length === 0 ? (
                    <div className="rpg-frame-dark p-4 text-xs text-[#9e8e74]">
                      No unsocketed Mystic Runes available.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {[
                        ...hud.bagRunes.map((r) => ({ r, src: 'bag' as const })),
                        ...profile.runesStash.map((r) => ({ r, src: 'stash' as const })),
                      ].map(({ r, src }) => (
                        <div key={r.id} className="rpg-frame-dark p-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${rarityColor(r.rarity).split(' ')[0]}`}>
                              {r.name} (Rank {r.rank})
                            </span>
                            <span className="text-[11px] text-[#a3947a]">{r.bound ? 'Bound' : 'Unbound'}</span>
                          </div>
                          <div className="text-xs text-[#d6c9ae]">{r.description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => onSocketRune(r.id, 'weapon', src)}
                              className="rpg-btn px-2.5 py-1 text-[11px] font-display cursor-pointer"
                            >
                              Socket Sword
                            </button>
                            <button
                              type="button"
                              onClick={() => onSocketRune(r.id, 'staff', src)}
                              className="rpg-btn px-2.5 py-1 text-[11px] font-display cursor-pointer"
                            >
                              Socket Staff
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'forge' && (
            <div className="flex flex-col gap-5">
              {!isAtSurfaceCamp && (
                <div className="rpg-frame-dark p-3 text-xs text-[#f0c05a]">
                  Viewing Ember Forge preview. Extract to the Surface Bridge Camp to channel Ember Forge crafting.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Reforge Affixes */}
                <div className="flex flex-col gap-2.5">
                  <h3 className="font-display text-sm text-[#e8c674] tracking-wider">Reforge Gear Affixes (35 Embers)</h3>
                  {(Object.values(profile.equipped).filter(Boolean) as GearItem[]).map((item) => (
                    <div key={item.id} className="rpg-frame-dark p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${rarityColor(item.rarity).split(' ')[0]}`}>
                          {item.name} [{item.rarity}]
                        </div>
                        <div className="text-[11px] text-[#c7b79a] truncate">
                          {item.affixes.length > 0 ? item.affixes.join(' · ') : 'No forged affixes yet'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!isAtSurfaceCamp || profile.soulEmbers < 35}
                        onClick={() => onReforgeItem(item.id)}
                        className="rpg-btn px-3 py-1 text-xs font-display cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        Reforge
                      </button>
                    </div>
                  ))}
                </div>

                {/* Upgrade Runes + Transpose Boss Remembrances */}
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="font-display text-sm text-[#87f09a] tracking-wider mb-2">Upgrade Mystic Runes</h3>
                    {profile.runesStash.length === 0 ? (
                      <div className="rpg-frame-dark p-3 text-xs text-[#9e8e74]">Unsocket a rune to upgrade its rank here.</div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {profile.runesStash.map((r) => {
                          const cost = 30 * r.rank;
                          return (
                            <div key={r.id} className="rpg-frame-dark p-3 flex items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-[#93f09d]">
                                  {r.name} (Rank {r.rank}/5)
                                </div>
                                <div className="text-[11px] text-[#cbbca0]">{r.description}</div>
                              </div>
                              <button
                                type="button"
                                disabled={!isAtSurfaceCamp || r.rank >= 5 || profile.soulEmbers < cost}
                                onClick={() => onUpgradeRune(r.id)}
                                className="rpg-btn px-3 py-1 text-xs font-display cursor-pointer disabled:opacity-40 shrink-0"
                              >
                                {r.rank >= 5 ? 'Max' : `${cost} E`}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display text-sm text-[#ffd56b] tracking-wider mb-2">Boss Remembrances</h3>
                    {profile.remembrances.length === 0 ? (
                      <div className="rpg-frame-dark p-3 text-xs text-[#9e8e74]">
                        Vanquish Floor Bosses beyond the Fog Gate to transpose their Signature Legendary weapons.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {profile.remembrances.map((rem) => (
                          <div key={rem.id} className="rpg-frame-dark p-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[#ffd56b]">{rem.signatureWeaponName}</div>
                              <div className="text-[11px] text-[#cbbca0]">Remembrance of {rem.bossName}</div>
                            </div>
                            <button
                              type="button"
                              disabled={!isAtSurfaceCamp || rem.transposed}
                              onClick={() => onTransposeRemembrance(rem.id)}
                              className="rpg-btn rpg-btn-primary px-3 py-1 text-xs font-display cursor-pointer disabled:opacity-40"
                            >
                              {rem.transposed ? 'Transposed' : 'Transpose'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stash' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm text-[#e8c674] tracking-wider">
                  24-Slot Bound Stash ({profile.stash.length} / {MAX_STASH_SLOTS})
                </h3>
                <span className="text-xs text-[#b8a789]">Bound relics persist safely across all delves.</span>
              </div>
              {profile.stash.length === 0 ? (
                <div className="rpg-frame-dark p-6 text-center text-sm text-[#9e8e74]">
                  Your Bound Stash is empty. Extract from the Vaults via Portal Scroll [8] or bind relics at Kindled Shrines.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {profile.stash.map((item) => {
                    const cmp = compareItems(item, profile.equipped[item.slot]);
                    return (
                      <div key={item.id} className="rpg-frame-dark p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold truncate ${rarityColor(item.rarity).split(' ')[0]}`}>
                            {item.name} [{item.rarity}]
                          </div>
                          <div className="text-[11px] font-mono-num text-[#cbbca0]">
                            {SLOT_LABELS[item.slot]} ·{' '}
                            <span className={cmp.scoreDiff >= 0 ? 'text-[#87f09a]' : 'text-[#f08787]'}>{cmp.summary}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEquipItem(item.id, 'stash')}
                          className="rpg-btn px-3 py-1 text-xs font-display cursor-pointer shrink-0"
                        >
                          Equip
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'constellation' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm text-[#7cd6ff] tracking-wider">Constellation Meta-Tree (Permanent Mastery)</h3>
                <span className="text-xs font-mono-num text-[#f2c65e]">Available: {profile.soulEmbers} Banked Embers</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.constellations.map((node) => {
                  const cost = node.baseCost * (node.rank + 1);
                  const maxed = node.rank >= node.maxRank;
                  return (
                    <div key={node.id} className="rpg-frame-dark p-3.5 flex flex-col justify-between gap-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm text-[#f5e3bc]">{node.name}</span>
                          <span className="font-mono-num text-xs text-[#7cd6ff]">
                            Rank {node.rank}/{node.maxRank}
                          </span>
                        </div>
                        <p className="text-xs text-[#cbbca0] mt-1">{node.description}</p>
                      </div>
                      <button
                        type="button"
                        disabled={maxed || profile.soulEmbers < cost}
                        onClick={() => onUpgradeConstellation(node.id)}
                        className="rpg-btn rpg-btn-primary px-3 py-1.5 text-xs font-display cursor-pointer disabled:opacity-40 self-end"
                      >
                        {maxed ? 'Mastered' : `Awaken (${cost} Embers)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'codex' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-sm text-[#e8c674] tracking-wider">Bestiary & Vault Codex</h3>
                {Object.values(profile.codex).map((entry) => (
                  <div key={entry.id} className="rpg-frame-dark p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm text-[#f3e3be]">
                        {entry.discovered ? entry.name : '??? (Undiscovered)'}
                      </span>
                      {entry.kills !== undefined && (
                        <span className="text-[11px] font-mono-num text-[#b8a789]">Slain: {entry.kills}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#cbbca0] mt-1">
                      {entry.discovered ? entry.description : 'Encounter this foe within the Sunken Vaults to record its nature.'}
                    </p>
                    {entry.discovered && entry.weakness && (
                      <div className="text-[11px] text-[#e6b355] mt-1">Tactic: {entry.weakness}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="font-display text-sm text-[#e8c674] tracking-wider">Recent Delve History</h3>
                {profile.runHistory.length === 0 ? (
                  <div className="rpg-frame-dark p-4 text-xs text-[#9e8e74]">No recorded delves yet.</div>
                ) : (
                  profile.runHistory.map((run) => (
                    <div key={run.id} className="rpg-frame-dark p-3 flex items-center justify-between text-xs font-mono-num">
                      <div>
                        <span className={run.outcome === 'extracted' ? 'text-[#87f09a]' : 'text-[#ff7a70]'}>
                          {run.outcome === 'extracted' ? 'EXTRACTED' : 'FALLEN'}
                        </span>{' '}
                        · Floor B{run.maxFloor} · {run.kills} Kills
                      </div>
                      <div className="text-[#e6ba5c]">+{run.embersEarned} E</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
