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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-[#0a0a12] border-b border-gray-100 dark:border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-all font-medium"
        >
          <span>&larr;</span>
          <span>Back</span>
        </button>
        <div className="h-4 w-px bg-gray-200 dark:bg-white/[0.06]" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: game.color }} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{game.name}</span>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={game.url}
        className="flex-1 w-full border-0 bg-white dark:bg-black"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="origin"
        onLoad={handleIframeLoad}
        title={game.name}
      />
    </div>
  );
}
