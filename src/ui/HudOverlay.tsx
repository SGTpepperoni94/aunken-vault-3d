import React, { useMemo, useRef } from 'react';
import { Backpack, Pause, Volume2, VolumeX } from 'lucide-react';
import type { DungeonMap, HudSnapshot } from '../game/types';
import { getUiPixelAtlas } from '../render/uiBaker';
import { MinimapCanvas } from './MinimapCanvas';

interface HudOverlayProps {
  hud: HudSnapshot;
  map: DungeonMap;
  minimapEnemies: Array<{ x: number; z: number; isBoss: boolean }>;
  minimapLoot: Array<{ x: number; z: number; isLegendary: boolean }>;
  onSwapStance: () => void;
  onHotbarClick: (slot: number) => void;
  onOpenCamp: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onTouchJoystick: (nx: number, ny: number) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onMobileAction: (action: 'attack' | 'heavy' | 'parry' | 'dodge' | 'swap' | 'interact') => void;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  hud,
  map,
  minimapEnemies,
  minimapLoot,
  onSwapStance,
  onHotbarClick,
  onOpenCamp,
  onTogglePause,
  onToggleMute,
  onTouchJoystick,
  onTouchLook,
  onMobileAction,
}) => {
  const icons = useMemo(() => getUiPixelAtlas(), []);
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);
  const lookPrev = useRef<{ x: number; y: number } | null>(null);

  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const ghostPct = Math.max(0, Math.min(100, (hud.ghostHp / Math.max(1, hud.maxHp)) * 100));
  const mpPct = Math.max(0, Math.min(100, (hud.mp / Math.max(1, hud.maxMp)) * 100));
  const staPct = Math.max(0, Math.min(100, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.xpToNext)) * 100));

  const logToneClass = (tone: HudSnapshot['logs'][number]['tone']): string => {
    switch (tone) {
      case 'kill':
        return 'text-[#7ce687]';
      case 'loot_C':
        return 'text-[#a3ccf5]';
      case 'loot_E':
        return 'text-[#7ff296]';
      case 'loot_R':
        return 'text-[#d5a8ff]';
      case 'loot_L':
        return 'text-[#ffd56b]';
      case 'spell':
        return 'text-[#73d4ff]';
      case 'combat':
        return 'text-[#ffbe6b]';
      case 'danger':
        return 'text-[#ff756b]';
      default:
        return 'text-[#e8dec7]';
    }
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* =================================================================== */}
      {/* SCREEN-PROJECTED GROUND LOOT NAMEPLATES ([C], [E], [R], [L])        */}
      {/* =================================================================== */}
      {hud.projectedLoot.map((tag) => (
        <div
          key={tag.id}
          style={{
            left: `${tag.screenX}%`,
            top: `${tag.screenY}%`,
            transform: 'translate(-50%, -100%)',
          }}
          className="absolute pointer-events-none transition-transform duration-75"
        >
          <div className={`loot-plate-${tag.rarity} px-2.5 py-0.5 text-xs md:text-sm font-body font-semibold whitespace-nowrap text-center`}>
            {tag.label}
          </div>
          {tag.deltaSummary && (
            <div className="text-[11px] font-mono-num text-center text-[#f4e5c0] rpg-text-shadow mt-0.5 whitespace-nowrap">
              {tag.deltaSummary}
            </div>
          )}
        </div>
      ))}

      {/* =================================================================== */}
      {/* SCREEN-PROJECTED ENEMY HP, POISE & ARCANE PRIME BARS                */}
      {/* =================================================================== */}
      {hud.projectedEnemies.map((en) => (
        <div
          key={en.id}
          style={{
            left: `${en.screenX}%`,
            top: `${en.screenY}%`,
            transform: 'translate(-50%, -100%)',
          }}
          className="absolute w-28 pointer-events-none"
        >
          <div className="flex items-center justify-between text-[10px] font-display text-[#f4e4c1] rpg-text-shadow mb-0.5">
            <span className="truncate">{en.name}</span>
            {en.primeStacks > 0 && <span className="text-[#5cd6ff] ml-1">★{en.primeStacks}</span>}
          </div>
          <div className="h-2 bg-[#140e0e] border border-[#755a34]">
            <div className="h-full bg-[#bd2b26]" style={{ width: `${(en.hp / Math.max(1, en.maxHp)) * 100}%` }} />
          </div>
          <div className="h-1 bg-[#140e0e] border-x border-b border-[#594427]">
            <div
              className={`h-full ${en.staggered ? 'bg-[#ffe066]' : 'bg-[#d99d3b]'}`}
              style={{ width: `${(en.poise / Math.max(1, en.maxPoise)) * 100}%` }}
            />
          </div>
          {en.staggered && (
            <div className="text-[10px] font-display text-[#ffe066] text-center rpg-text-shadow mt-0.5">
              STAGGERED [E]
            </div>
          )}
        </div>
      ))}

      {/* =================================================================== */}
      {/* TOP-LEFT CLUSTER: PORTRAIT, HP/MP/STAMINA, LEVEL & DUAL STANCE      */}
      {/* =================================================================== */}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          {/* Beveled Warrior Portrait */}
          <div className="rpg-frame p-0.5 w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16 shrink-0">
            <img
              src={icons.warriorPortrait}
              alt="Warrior Portrait"
              className="w-full h-full pixelated block"
            />
          </div>

          {/* HP, MP, Stamina & Level */}
          <div className="flex flex-col gap-1 w-32 sm:w-44 md:w-52">
            {/* HP Bar with trailing damage ghost */}
            <div className="rpg-bar-track relative h-5 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#d9872b] transition-all duration-150"
                style={{ width: `${ghostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-[#a82420]"
                style={{ width: `${hpPct}%` }}
              />
              <div className="relative z-10 h-full px-2 flex items-center justify-between text-xs font-mono-num text-[#f7ebd2] rpg-text-shadow">
                <span className="font-display font-bold text-[11px]">HP</span>
                <span>
                  {hud.hp} / {hud.maxHp}
                </span>
              </div>
            </div>

            {/* MP Bar */}
            <div className="rpg-bar-track relative h-4 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-[#2d62b5]" style={{ width: `${mpPct}%` }} />
              <div className="relative z-10 h-full px-2 flex items-center justify-between text-[11px] font-mono-num text-[#e6f0ff] rpg-text-shadow">
                <span className="font-display font-bold text-[10px]">MP</span>
                <span>
                  {hud.mp} / {hud.maxMp}
                </span>
              </div>
            </div>

            {/* Stamina Bar (Soulslike combat commitment) */}
            <div className="rpg-bar-track relative h-2.5 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[#48994f]"
                style={{ width: `${staPct}%` }}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-[#e8c674] rpg-text-shadow font-display">
              <span>LVL {hud.level}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-[#f2d68d]">{hud.soulEmbers} Embers</span>
            </div>
          </div>
        </div>

        {/* Dual-Stance Switcher (Vanguard vs Arcanist) + Vault Pressure */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              if (hud.stance !== 'vanguard') onSwapStance();
            }}
            aria-label="Vanguard Stance (Sword & Shield)"
            title="Vanguard Stance (Tab)"
            className={`w-9 h-9 p-0.5 cursor-pointer ${hud.stance === 'vanguard' ? 'rpg-slot-active' : 'rpg-slot opacity-75'}`}
          >
            <img src={icons.swordIcon} alt="" className="w-full h-full pixelated" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              if (hud.stance !== 'arcanist') onSwapStance();
            }}
            aria-label="Arcanist Stance (Staff & Spells)"
            title="Arcanist Stance (Tab)"
            className={`w-9 h-9 p-0.5 cursor-pointer ${hud.stance === 'arcanist' ? 'rpg-slot-active' : 'rpg-slot opacity-75'}`}
          >
            <img src={icons.magePortrait} alt="" className="w-full h-full pixelated" />
          </button>

          <div className="text-xs leading-tight rpg-text-shadow">
            <div className="font-display text-[#f4e2bc]">
              {hud.stance === 'vanguard' ? 'Vanguard' : 'Arcanist'} <span className="text-[#b8a582]">[Tab]</span>
            </div>
            {hud.floorNumber > 0 ? (
              <div className="text-[11px] font-mono-num text-[#e6aa53]">
                Pressure {hud.vaultPressure}% · Unbound {hud.unboundCount}
              </div>
            ) : (
              <div className="text-[11px] text-[#c7b798]">Surface Camp Safe Zone</div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TOP-CENTER: ACTIVE FLOOR BOSS HEALTH & POISE BAR                    */}
      {/* =================================================================== */}
      {hud.activeBoss && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(460px,54vw)]">
          <div className="flex items-center justify-between text-xs md:text-sm font-display tracking-wider text-[#f7e7c1] rpg-text-shadow mb-1">
            <span>{hud.activeBoss.name}</span>
            <span className="font-mono-num">
              {hud.activeBoss.hp} / {hud.activeBoss.maxHp}
            </span>
          </div>
          <div className="rpg-bar-track h-4 overflow-hidden">
            <div
              className="h-full bg-[#b8201e] transition-all duration-100"
              style={{ width: `${(hud.activeBoss.hp / Math.max(1, hud.activeBoss.maxHp)) * 100}%` }}
            />
          </div>
          <div className="rpg-bar-track h-1.5 mt-0.5 overflow-hidden">
            <div
              className={`h-full ${hud.activeBoss.staggered ? 'bg-[#ffe269]' : 'bg-[#d99d3b]'}`}
              style={{ width: `${(hud.activeBoss.poise / Math.max(1, hud.activeBoss.maxPoise)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TOP-RIGHT CLUSTER: OBJECTIVE, CIRCULAR MINIMAP & UTILITY BUTTONS    */}
      {/* =================================================================== */}
      <div className="absolute top-3 right-3 flex items-start gap-3">
        <div className="hidden sm:flex flex-col items-end text-right mt-1 max-w-[230px]">
          <div className="text-xs font-display tracking-wide text-[#e8c674] rpg-text-shadow">Objective</div>
          <div className="text-sm font-body font-semibold text-[#f3e7ce] rpg-text-shadow leading-snug">
            {hud.objective}
          </div>

          <div className="flex items-center gap-1.5 mt-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCamp();
              }}
              aria-label="Open Gear, Runes & Forge"
              title="Gear, Runes & Forge (I)"
              className="rpg-btn w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <Backpack className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={hud.muted ? 'Unmute Audio' : 'Mute Audio'}
              title="Toggle Audio (M)"
              className="rpg-btn w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onTogglePause();
              }}
              aria-label="Pause Game"
              title="Pause (P / Esc)"
              className="rpg-btn w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        <MinimapCanvas
          map={map}
          playerX={hud.playerX}
          playerZ={hud.playerZ}
          playerYaw={hud.playerYaw}
          enemies={minimapEnemies}
          loot={minimapLoot}
          locationLabel={hud.locationLabel}
        />
      </div>

      {/* =================================================================== */}
      {/* EXACT CENTER RETICLE, CHARGE METER & CONTEXTUAL INTERACT PROMPT     */}
      {/* =================================================================== */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
        <div
          className={`w-2.5 h-2.5 rotate-45 border ${
            hud.ripostePrompt
              ? 'border-[#ffe066] bg-[#ffaa22]/70 scale-125'
              : hud.isBlocking
                ? 'border-[#73c9ff] bg-[#73c9ff]/30'
                : 'border-[#f5e4be]/80 bg-[#0d0a09]/50'
          }`}
        />

        {hud.isChargingHeavy && (
          <div className="mt-3 w-24 h-1.5 bg-[#140e0e] border border-[#9e7a3f]">
            <div className="h-full bg-[#ffaa2b]" style={{ width: `${hud.heavyChargePct}%` }} />
          </div>
        )}

        {hud.isChannelingPortal && (
          <div className="mt-4 rpg-frame px-3 py-1.5 text-center">
            <div className="text-xs font-display text-[#8cd8ff] mb-1">Channeling Portal Extraction</div>
            <div className="w-36 h-2 bg-[#111521] border border-[#4c7ba8]">
              <div className="h-full bg-[#4ec2ff]" style={{ width: `${hud.portalProgress}%` }} />
            </div>
          </div>
        )}

      </div>

      {/* Contextual Interact / Riposte Prompt anchored cleanly above hotbar (never covers center loot tags!) */}
      {hud.interactPrompt && !hud.isChannelingPortal && (
        <div className="fixed bottom-[94px] left-1/2 -translate-x-1/2 pointer-events-none rpg-frame-dark px-3.5 py-1.5 text-center">
          <div className="text-xs md:text-sm font-display text-[#ffe49e] whitespace-nowrap">
            [{hud.interactPrompt.key}] {hud.interactPrompt.label}
          </div>
          {hud.interactPrompt.sublabel && (
            <div className="text-[11px] text-[#cbbca0]">{hud.interactPrompt.sublabel}</div>
          )}
        </div>
      )}

      {/* Whispering Floor Rune quote */}
      {hud.whisperMessage && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 max-w-lg rpg-frame-dark px-5 py-2.5 text-center">
          <div className="text-xs font-display tracking-widest text-[#e6b355] mb-0.5">WHISPERING RUNE</div>
          <div className="text-sm italic text-[#efe3c8]">{hud.whisperMessage}</div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MINIMALIST CINZEL DRAMATIC BANNERS (GREAT FOE FELLED / YOU DIED)    */}
      {/* =================================================================== */}
      {hud.banner && (
        <div className="fixed inset-x-0 top-[28%] flex flex-col items-center justify-center py-4 bg-[#090708]/78 border-y border-[#7d6034]/60 pointer-events-none">
          <div
            className={`font-display text-2xl md:text-4xl font-bold tracking-[0.22em] rpg-text-shadow ${
              hud.banner.tone === 'crimson'
                ? 'text-[#d9362b]'
                : hud.banner.tone === 'arcane'
                  ? 'text-[#7cd6ff]'
                  : 'text-[#f2c65e]'
            }`}
          >
            {hud.banner.title}
          </div>
          {hud.banner.subtitle && (
            <div className="font-body text-sm md:text-base text-[#e3d3b1] mt-1 tracking-wide">
              {hud.banner.subtitle}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* BOTTOM-LEFT: BEVELED 16-BIT COMBAT & LOOT FEED                      */}
      {/* =================================================================== */}
      <div className="hidden md:block absolute bottom-3 left-3 w-72 rpg-frame-dark px-3 py-2">
        <div className="flex flex-col gap-0.5 text-xs leading-snug font-body">
          {hud.logs.slice(-4).map((entry) => (
            <div key={entry.id} className={`${logToneClass(entry.tone)} rpg-text-shadow truncate`}>
              {entry.text}
            </div>
          ))}
          {hud.logs.length === 0 && (
            <div className="text-[#b8a88d] italic">Click viewport to lock mouse · Press [I] for Gear & Runes</div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM-CENTER: 8-SLOT PIXEL HOTBAR + XP BAR (REFERENCE PARITY!)     */}
      {/* =================================================================== */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-1">
          {[
            { slot: 1, icon: icons.swordIcon, label: 'Steel Strike (1)', count: undefined },
            { slot: 2, icon: icons.shieldIcon, label: 'Parry / Guard (2)', count: undefined },
            { slot: 3, icon: icons.fireballIcon, label: 'Fireball (3)', count: undefined },
            { slot: 4, icon: hud.stance === 'vanguard' ? icons.cleaveIcon : icons.arcaneIcon, label: hud.stance === 'vanguard' ? 'Heavy Cleave (4)' : 'Arcane Nova (4)', count: undefined },
            { slot: 5, icon: icons.flaskIcon, label: 'Crimson Ember Flask (5 / R)', count: hud.flaskCharges },
            { slot: 6, icon: hud.socketedRuneNames[0] ? icons.runeIcon : null, label: hud.socketedRuneNames[0] ?? 'Empty Rune Slot (I)', count: undefined },
            { slot: 7, icon: hud.socketedRuneNames[1] ? icons.arcaneIcon : null, label: hud.socketedRuneNames[1] ?? 'Empty Rune Slot (I)', count: undefined },
            { slot: 8, icon: icons.scrollIcon, label: 'Portal Scroll Extraction (8)', count: hud.portalScrolls > 0 ? `x${hud.portalScrolls}` : 0 },
          ].map((b) => (
            <button
              key={b.slot}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onHotbarClick(b.slot);
              }}
              aria-label={b.label}
              title={b.label}
              className={`relative w-10 h-10 md:w-11 md:h-11 p-0.5 cursor-pointer ${
                hud.activeHotbarSlot === b.slot ? 'rpg-slot-active' : 'rpg-slot'
              }`}
            >
              {b.icon ? (
                <img src={b.icon} alt="" className="w-full h-full pixelated block" />
              ) : (
                <div className="w-full h-full bg-[#120e0d]" />
              )}
              <span className="absolute top-0 left-1 text-[10px] font-mono-num text-[#f2e2be] rpg-text-shadow">
                {b.slot}
              </span>
              {b.count !== undefined && (
                <span className="absolute bottom-0 right-1 text-[10px] font-mono-num font-bold text-[#fff2cc] rpg-text-shadow">
                  {b.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Horizontal XP Bar directly under hotbar */}
        <div className="rpg-bar-track relative w-full h-4 overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-[#529936]" style={{ width: `${xpPct}%` }} />
          <div className="relative z-10 h-full flex items-center justify-center text-[10px] font-display tracking-wider text-[#f7ecd2] rpg-text-shadow">
            XP Bar ({hud.xp} / {hud.xpToNext})
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MOBILE AUTO-SWITCH TOUCH CONTROLS (Revealed only on touchstart!)    */}
      {/* =================================================================== */}
      {hud.touchMode && (
        <div className="fixed inset-0 z-20 pointer-events-none">
          {/* Left Floating Joystick */}
          <div
            className="absolute bottom-24 left-5 w-28 h-28 rounded-full border-2 border-[#b8924d]/65 bg-[#120e0c]/55 pointer-events-auto touch-none flex items-center justify-center"
            onTouchStart={(e) => {
              const t = e.touches[0];
              joyOrigin.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!joyOrigin.current) return;
              const t = e.touches[0];
              const dx = (t.clientX - joyOrigin.current.x) / 42;
              const dy = -(t.clientY - joyOrigin.current.y) / 42;
              onTouchJoystick(dx, dy);
            }}
            onTouchEnd={() => {
              joyOrigin.current = null;
              onTouchJoystick(0, 0);
            }}
          >
            <div className="w-10 h-10 rounded-full border border-[#eab84b]/75 bg-[#362717]/75" />
          </div>

          {/* Right Drag-to-Look Zone */}
          <div
            className="absolute top-20 right-0 w-1/2 h-1/2 pointer-events-auto touch-none"
            onTouchStart={(e) => {
              const t = e.touches[0];
              lookPrev.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchMove={(e) => {
              if (!lookPrev.current) return;
              const t = e.touches[0];
              onTouchLook(t.clientX - lookPrev.current.x, t.clientY - lookPrev.current.y);
              lookPrev.current = { x: t.clientX, y: t.clientY };
            }}
            onTouchEnd={() => {
              lookPrev.current = null;
            }}
          />

          {/* Compact Combat Buttons */}
          <div className="absolute bottom-24 right-4 grid grid-cols-2 gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => onMobileAction('attack')}
              className="rpg-btn rpg-btn-primary px-3.5 py-2.5 text-xs font-display"
            >
              Attack
            </button>
            <button
              type="button"
              onClick={() => onMobileAction('parry')}
              className="rpg-btn px-3.5 py-2.5 text-xs font-display"
            >
              Parry
            </button>
            <button
              type="button"
              onClick={() => onMobileAction('dodge')}
              className="rpg-btn px-3.5 py-2.5 text-xs font-display"
            >
              Dodge
            </button>
            <button
              type="button"
              onClick={() => onMobileAction('swap')}
              className="rpg-btn px-3.5 py-2.5 text-xs font-display"
            >
              Swap
            </button>
            <button
              type="button"
              onClick={() => onMobileAction('interact')}
              className="rpg-btn col-span-2 px-3.5 py-2 text-xs font-display text-[#ffe49e]"
            >
              Use / Riposte
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
