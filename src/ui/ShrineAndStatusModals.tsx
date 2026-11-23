import React from 'react';
import type { HudSnapshot } from '../game/types';

interface ShrineModalProps {
  hud: HudSnapshot;
  onBindItem: (itemId: string) => void;
  onRest: () => void;
  onClose: () => void;
}

export const KindledShrineModal: React.FC<ShrineModalProps> = ({ hud, onBindItem, onRest, onClose }) => {
  if (!hud.shrineOpen) return null;
  const unboundGear = hud.bagItems.filter((i) => !i.bound);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#070506]/80 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Kindled Shrine"
    >
      <div className="rpg-frame w-full max-w-lg p-6 flex flex-col gap-4">
        <div className="text-center border-b border-[#6b5330] pb-3">
          <h2 className="font-display text-xl text-[#f5d07a] tracking-widest">KINDLED SHRINE</h2>
          <p className="text-sm text-[#cfc0a3] mt-1">
            Bind a prized relic permanently against death, or rest to refill your Crimson Ember Flasks.
          </p>
        </div>

        {/* Option 1: Bind 1 Unbound Item */}
        <div className="rpg-frame-dark p-3.5 flex flex-col gap-2">
          <div className="font-display text-sm text-[#ffe08a]">1. Permanently Bind an Unbound Item</div>
          {unboundGear.length === 0 ? (
            <div className="text-xs text-[#9c8c72]">No Unbound equipment in your pack right now.</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {unboundGear.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs bg-[#18120f] px-2.5 py-1.5 border border-[#4a3922]">
                  <span className="truncate text-[#f0e2c2]">
                    {item.name} [{item.rarity}]
                  </span>
                  <button
                    type="button"
                    onClick={() => onBindItem(item.id)}
                    className="rpg-btn rpg-btn-primary px-2.5 py-1 text-[11px] font-display cursor-pointer shrink-0"
                  >
                    Bind Relic
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Option 2: Rest & Refill Flasks (Soulslike enemy respawn trade-off) */}
        <div className="rpg-frame-dark p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-sm text-[#ff937d]">2. Rest at the Shrine Flame</div>
            <div className="text-xs text-[#cbbca0]">
              Refills HP, MP & all {hud.maxFlaskCharges} Crimson Ember Flasks. Respawns non-boss foes on this floor.
            </div>
          </div>
          <button
            type="button"
            onClick={onRest}
            className="rpg-btn px-4 py-2 text-xs font-display cursor-pointer shrink-0"
          >
            Rest & Refill
          </button>
        </div>

        <button type="button" onClick={onClose} className="rpg-btn py-2 text-xs font-display cursor-pointer">
          Step Away
        </button>
      </div>
    </div>
  );
};

interface StatusModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onReturnToBridge: () => void;
  onRetryDelve: () => void;
  onReturnToTitle: () => void;
}

export const StatusModals: React.FC<StatusModalsProps> = ({
  hud,
  onResume,
  onReturnToBridge,
  onRetryDelve,
  onReturnToTitle,
}) => {
  if (hud.screen === 'paused') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#060507]/78 p-4 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Game Paused"
      >
        <div className="rpg-frame w-full max-w-sm p-6 flex flex-col gap-3 text-center">
          <h2 className="font-display text-2xl text-[#f5e3bc] tracking-widest mb-1">PAUSED</h2>
          <p className="text-xs text-[#bfb094] mb-2">
            {hud.locationLabel} · Level {hud.level}
          </p>
          <button type="button" onClick={onResume} className="rpg-btn rpg-btn-primary py-2.5 font-display text-sm cursor-pointer">
            Resume Delve
          </button>
          <button type="button" onClick={onReturnToBridge} className="rpg-btn py-2.5 font-display text-sm cursor-pointer">
            Return to Surface Bridge
          </button>
          <button type="button" onClick={onReturnToTitle} className="rpg-btn py-2.5 font-display text-sm cursor-pointer">
            Title Screen
          </button>
        </div>
      </div>
    );
  }

  if (hud.screen === 'gameover' && hud.runSummary) {
    const s = hud.runSummary;
    const isVictory = s.outcome === 'extracted' || s.outcome === 'boss_slain';

    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#060507]/84 p-4 pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label={isVictory ? 'Vault Extraction Complete' : 'You Died'}
      >
        <div className="rpg-frame w-full max-w-md p-6 flex flex-col gap-4 text-center">
          <div>
            <h2
              className={`font-display text-3xl tracking-[0.2em] ${
                isVictory ? 'text-[#f5c85c]' : 'text-[#d9362b]'
              }`}
            >
              {isVictory ? 'VAULT EXTRACTED' : 'YOU DIED'}
            </h2>
            <p className="text-sm text-[#d4c4a5] mt-1">
              {isVictory
                ? 'Your Unbound relics have been bound to the Surface Camp Stash.'
                : `Unbound loot purged — a Lost Echo awaits on Floor B${s.lostEchoFloor ?? 1}.`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rpg-frame-dark p-2.5">
              <div className="text-[10px] font-display text-[#a8987a]">FLOOR</div>
              <div className="text-lg font-mono-num text-[#f5e4be]">B{s.floorReached}</div>
            </div>
            <div className="rpg-frame-dark p-2.5">
              <div className="text-[10px] font-display text-[#a8987a]">FOES SLAIN</div>
              <div className="text-lg font-mono-num text-[#f5e4be]">{s.kills}</div>
            </div>
            <div className="rpg-frame-dark p-2.5">
              <div className="text-[10px] font-display text-[#a8987a]">EMBERS</div>
              <div className="text-lg font-mono-num text-[#f2c65e]">+{s.embersBanked}</div>
            </div>
          </div>

          <div className="text-xs font-mono-num text-[#cbbca0]">
            Relics Secured: {s.itemsSecured} · Lost: {s.itemsLost} · Peak Pressure: {s.vaultPressure}%
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 mt-1">
            <button
              type="button"
              data-start="true"
              onClick={onReturnToBridge}
              className="rpg-btn rpg-btn-primary flex-1 py-2.5 font-display text-sm cursor-pointer"
            >
              Return to Surface Camp
            </button>
            <button
              type="button"
              onClick={onRetryDelve}
              className="rpg-btn flex-1 py-2.5 font-display text-sm cursor-pointer"
            >
              Delve B1 Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
