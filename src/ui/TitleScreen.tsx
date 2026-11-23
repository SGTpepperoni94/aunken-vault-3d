import React from 'react';
import type { SaveProfile } from '../game/types';

interface TitleScreenProps {
  profile: SaveProfile;
  onStartBridge: () => void;
  onQuickDelve: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ profile, onStartBridge, onQuickDelve }) => {
  const hasProgress = profile.level > 1 || profile.runHistory.length > 0 || profile.stash.length > 0;

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none px-6 py-8 md:py-12">
      {/* Upper Twilight Sky Negative Space: Bespoke SVG Gothic Crest Lockup */}
      <div className="flex flex-col items-center text-center mt-2 md:mt-6 pointer-events-auto">
        <svg
          viewBox="0 0 560 152"
          className="w-[min(520px,90vw)] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.92)]"
          role="img"
          aria-label="The Sunken Vaults"
        >
          {/* Gothic bronze ornament line & crest sword cleanly above display lettering */}
          <path
            d="M74 28 L236 28 M324 28 L486 28"
            stroke="#c99c45"
            strokeWidth="1.8"
            strokeOpacity="0.88"
          />
          <polygon points="280,6 291,24 280,46 269,24" fill="#d9a443" stroke="#1d140c" strokeWidth="2" />
          <polygon points="280,12 286,24 280,38 274,24" fill="#ffdf8a" />
          <path d="M254 28 L306 28" stroke="#c99c45" strokeWidth="3" />
          <circle cx="250" cy="28" r="3" fill="#eab84b" />
          <circle cx="310" cy="28" r="3" fill="#eab84b" />

          {/* Main carved display title */}
          <text
            x="280"
            y="92"
            textAnchor="middle"
            fill="#f5e7c6"
            stroke="#160f0b"
            strokeWidth="6"
            paintOrder="stroke fill"
            style={{
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '42px',
              fontWeight: 800,
              letterSpacing: '0.11em',
            }}
          >
            THE SUNKEN VAULTS
          </text>

          {/* Lower bronze rule */}
          <path
            d="M112 106 L258 106 M302 106 L448 106"
            stroke="#9a7538"
            strokeWidth="1.5"
          />
          <polygon points="280,99 287,106 280,113 273,106" fill="#d9a443" />

          <text
            x="280"
            y="134"
            textAnchor="middle"
            fill="#d4c09b"
            stroke="#120c09"
            strokeWidth="3"
            paintOrder="stroke fill"
            style={{
              fontFamily: 'Cinzel, Georgia, serif',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.26em',
            }}
          >
            FIRST-PERSON DARK FANTASY ARPG
          </text>
        </svg>
      </div>

      {/* Center-Lower Primary Action Cluster (leaves bridge & gothic spires visible above!) */}
      <div className="flex flex-col items-center gap-4 mb-2 pointer-events-auto">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-start="true"
            onClick={onStartBridge}
            className="rpg-btn rpg-btn-primary font-display text-base md:text-lg tracking-wider px-8 py-3 cursor-pointer whitespace-nowrap"
          >
            {hasProgress ? 'Continue at Surface Bridge' : 'Enter the Vaults'}
          </button>

          <button
            type="button"
            onClick={onQuickDelve}
            className="rpg-btn font-display text-sm md:text-base tracking-wider px-6 py-3 cursor-pointer whitespace-nowrap"
          >
            Descend to B1 Crypt
          </button>
        </div>

        {hasProgress && (
          <div className="text-xs md:text-sm text-[#d9c8a5] rpg-text-shadow font-mono-num">
            Level {profile.level} · {profile.soulEmbers} Soul Embers · Deepest Vault B{profile.highestFloor}
          </div>
        )}

        {/* Single flat borderless control hint line */}
        <p className="text-xs md:text-sm text-[#cbbda0]/90 rpg-text-shadow text-center tracking-wide">
          WASD Move · Mouse Look · Left-Click Combo / Hold Heavy · Right-Click Parry / Guard · Space Dodge · Tab Swap Stance · E Interact
        </p>
      </div>
    </div>
  );
};
