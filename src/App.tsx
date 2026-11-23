/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useRef, useState } from 'react';
import type { HudSnapshot, SaveProfile } from './game/types';
import { GameEngine } from './engine/GameEngine';
import { loadSaveProfile } from './systems/SaveProfile';
import { TitleScreen } from './ui/TitleScreen';
import { HudOverlay } from './ui/HudOverlay';
import { CampAndInventoryModal } from './ui/CampAndInventoryModal';
import { KindledShrineModal, StatusModals } from './ui/ShrineAndStatusModals';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [profile, setProfile] = useState<SaveProfile>(() => loadSaveProfile());
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const params = new URLSearchParams(window.location.search);
    const autostart = params.get('autostart') === '1';
    const startFloor = params.get('floor');

    const engine = new GameEngine(
      el,
      (snap) => setHud(snap),
      (nextProfile) => setProfile(nextProfile),
      autostart
    );
    engineRef.current = engine;

    if (autostart && startFloor === '1') {
      engine.descendToFloor(1);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const engine = engineRef.current;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b090c]">
      {/* Isolated WebGL2 Retro-3D Canvas Mount (never re-created on HUD updates) */}
      <div
        ref={mountRef}
        data-testid="retro-webgl-viewport"
        className="w-full h-full"
      />

      {/* Title Screen Overlay over Live Twilight Bridge Camera Tour */}
      {hud && hud.screen === 'title' && (
        <TitleScreen
          profile={profile}
          onStartBridge={() => engine?.startGame(false)}
          onQuickDelve={() => engine?.startGame(true)}
        />
      )}

      {/* Active Gameplay 16-Bit RPG HUD */}
      {hud && hud.screen !== 'title' && engine && (
        <HudOverlay
          hud={hud}
          map={engine.getDungeonMap()}
          minimapEnemies={engine.getEnemiesForMinimap()}
          minimapLoot={engine.getLootForMinimap()}
          onSwapStance={() => engine.swapStance()}
          onHotbarClick={(slot) => engine.useHotbarSlot(slot)}
          onOpenCamp={() => engine.setCampTab(hud.campTab ? null : 'inventory')}
          onTogglePause={() => engine.togglePause()}
          onToggleMute={() => engine.toggleMute()}
          onTouchJoystick={(nx, ny) => engine.setTouchJoystick(nx, ny)}
          onTouchLook={(dx, dy) => engine.addTouchLookDelta(dx, dy)}
          onMobileAction={(action) => engine.triggerMobileAction(action)}
        />
      )}

      {/* Character, On-the-Fly Mystic Runes, Ember Forge, Bound Stash, Constellations & Codex */}
      {hud && hud.campTab && engine && (
        <CampAndInventoryModal
          hud={hud}
          profile={profile}
          onSelectTab={(tab) => engine.setCampTab(tab)}
          onClose={() => engine.setCampTab(null)}
          onEquipItem={(id, src) => engine.equipItem(id, src)}
          onSocketRune={(runeId, slot, src) => engine.socketRuneIntoWeapon(runeId, slot, src)}
          onUnsocketRune={(slot, runeId) => engine.unsocketRuneFromWeapon(slot, runeId)}
          onReforgeItem={(id) => engine.reforgeEquippedOrStash(id)}
          onUpgradeRune={(id) => engine.upgradeStoredRune(id)}
          onTransposeRemembrance={(id) => engine.transposeRemembrance(id)}
          onUpgradeConstellation={(id) => engine.upgradeConstellation(id)}
        />
      )}

      {/* Kindled Shrine Modal */}
      {hud && hud.shrineOpen && engine && (
        <KindledShrineModal
          hud={hud}
          onBindItem={(id) => engine.shrineBindItem(id)}
          onRest={() => engine.shrineRestAndRefill()}
          onClose={() => engine.closeShrine()}
        />
      )}

      {/* Pause, Extraction Victory & Defeat Status Modals */}
      {hud && (hud.screen === 'paused' || hud.screen === 'gameover') && engine && (
        <StatusModals
          hud={hud}
          onResume={() => engine.togglePause()}
          onReturnToBridge={() => engine.returnToBridge()}
          onRetryDelve={() => engine.startGame(true)}
          onReturnToTitle={() => engine.returnToTitle()}
        />
      )}
    </main>
  );
}
