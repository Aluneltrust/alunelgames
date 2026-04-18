import { useRef, useCallback } from 'react';
import type { GameConfig } from '../games';

interface GameFrameProps {
  game: GameConfig;
  onBack: () => void;
}

export function GameFrame({ game, onBack }: GameFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When the iframe loads, proactively send a WALLET_BRIDGE_READY handshake
  // so the game knows a parent wallet is available (even if referrer is empty)
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const gameOrigin = new URL(game.url).origin;
    iframe.contentWindow.postMessage(
      { type: 'WALLET_BRIDGE_READY', version: 1, origin: window.location.origin },
      gameOrigin,
    );
  }, [game.url]);

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      <div className="px-2 pt-2">
        <div className="surface-bar relative w-full pl-2 pr-3 h-9 flex items-center justify-between gap-3">
          {/* Back button — gold bezel */}
          <button
            onClick={onBack}
            className="btn-bezel btn-bezel-hairline uppercase h-7 text-[10px]"
            aria-label="Back to games"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back
          </button>

          {/* Centered game title */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: game.color, boxShadow: `0 0 6px ${game.color}99` }}
            />
            <span className="text-xs sm:text-sm font-bold tracking-[0.22em] uppercase bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent whitespace-nowrap">
              {game.name}
            </span>
          </div>

          {/* Right spacer — keeps title visually centered */}
          <div className="w-[64px] shrink-0" aria-hidden />
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={game.url}
        className="flex-1 w-full border-0 bg-black mt-3"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="origin"
        onLoad={handleIframeLoad}
        title={game.name}
      />
    </div>
  );
}
