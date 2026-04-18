import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from './hooks/useWallet';
import { useTheme } from './hooks/useTheme';
import { startWalletBridge, setApprovalCallback } from './services/WalletBridge';
import type { PendingApproval } from './services/WalletBridge';
import { GAMES } from './games';
import type { GameConfig } from './games';
import { WalletPanel } from './components/WalletPanel';
import { GameSelector } from './components/GameSelector';
import { GameFrame } from './components/GameFrame';
import { TxApprovalModal } from './components/TxApprovalModal';
import { InteractiveBg } from './components/InteractiveBg';
import WalletPage from './components/WalletPage';
import { LegalPage } from './components/LegalPage';
import type { LegalDoc } from './components/LegalPage';

export default function App() {
  const wallet = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [activeGame, setActiveGame] = useState<GameConfig | null>(null);
  const [pendingTx, setPendingTx] = useState<PendingApproval | null>(null);
  const [showWalletPage, setShowWalletPage] = useState(false);
  const [showWalletPopover, setShowWalletPopover] = useState(false);
  const [legalOpen, setLegalOpen] = useState<LegalDoc | null>(null);

  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  const handleApproval = useCallback((pending: PendingApproval) => {
    setPendingTx(pending);
    const originalResolve = pending.resolve;
    pending.resolve = (approved: boolean) => {
      setPendingTx(null);
      originalResolve(approved);
    };
  }, []);

  useEffect(() => {
    const cleanup = startWalletBridge({
      getSource: () => walletRef.current.walletSource,
      getBalance: () => walletRef.current.balance,
    });
    setApprovalCallback(handleApproval);
    return cleanup;
  }, [handleApproval]);

  // Close modal on Escape key
  useEffect(() => {
    if (!showWalletPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowWalletPopover(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showWalletPopover]);

  // Auto-close popover once the wallet becomes connected
  useEffect(() => {
    if (wallet.connected && showWalletPopover) {
      const t = setTimeout(() => setShowWalletPopover(false), 400);
      return () => clearTimeout(t);
    }
  }, [wallet.connected, showWalletPopover]);

  const handleGameSelect = (game: GameConfig) => {
    if (!wallet.connected) {
      setShowWalletPopover(true);
      return;
    }
    setActiveGame(game);
  };

  const formatBalance = (sats: number) => {
    if (sats >= 100_000_000) return `${(sats / 100_000_000).toFixed(4)} BSV`;
    if (sats >= 1000) return `${(sats / 1000).toFixed(1)}k sats`;
    return `${sats.toLocaleString()} sats`;
  };

  if (activeGame) {
    return (
      <div className="h-screen flex flex-col bg-[#fafafa] dark:bg-[#09090b]">
        <GameFrame game={activeGame} onBack={() => setActiveGame(null)} />
        {pendingTx && <TxApprovalModal pending={pendingTx} />}
      </div>
    );
  }

  const featured = GAMES[0];
  const rest = GAMES.slice(1);

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] dark:bg-[#09090b] text-gray-900 dark:text-white relative">
      <InteractiveBg />

      {/* ===== NAVBAR ===== */}
      <header className="sticky top-3 z-40 px-3 sm:px-4 pt-3">
        <div className="surface-bar relative max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="ALUNEL Games" className="h-7 sm:h-8" />
          </div>

          {/* Centered title */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-sm sm:text-base font-bold tracking-[0.22em] uppercase bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
              Alunel Games
            </span>
          </div>

          {/* Right side: theme + wallet */}
          <div className="flex items-center gap-2 shrink-0">
            {wallet.connected && (
              <button
                onClick={toggleTheme}
                className="btn-ghost-icon"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </button>
            )}

            {/* Wallet button / chip */}
            <div>
              {wallet.connected ? (
                <button
                  onClick={() => setShowWalletPage(true)}
                  className="btn-bezel btn-bezel-sm btn-bezel-hairline"
                  aria-label="Open wallet"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
                  <span className="font-mono">{formatBalance(wallet.balance)}</span>
                </button>
              ) : (
                <button
                  onClick={() => setShowWalletPopover(v => !v)}
                  className="btn-bezel btn-bezel-sm btn-bezel-hairline uppercase"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M22 10H2" />
                  </svg>
                  Connect
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        {/* ===== SEARCH ===== */}
        <div className="mb-6 max-w-xl mx-auto">
          <div className="surface-bar bezel-ring-thin relative flex items-center h-11 px-3">
            <svg className="w-4 h-4 text-amber-500/50 shrink-0 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search games..."
              className="flex-1 h-full bg-transparent border-0 outline-none text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>
        </div>

        {/* ===== HERO — FEATURED GAME ===== */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Featured</h2>
            <span className="text-[10px] uppercase tracking-widest text-amber-500/80 font-semibold">BSV</span>
          </div>

          <button
            onClick={() => handleGameSelect(featured)}
            className="game-card surface-rim group relative w-full overflow-hidden rounded-2xl h-56 sm:h-72 md:h-80 text-left"
          >
            {featured.bg ? (
              <img
                src={featured.bg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${featured.color}33 0%, ${featured.color}11 50%, #09090b 100%)` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 max-w-xl">
              <span
                className="inline-block w-fit mb-3 px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded"
                style={{ background: `${featured.color}33`, color: featured.color, border: `1px solid ${featured.color}55` }}
              >
                Play & Earn
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg mb-2">
                {featured.name}
              </h1>
              <p className="text-sm sm:text-base text-white/80 mb-5 max-w-md">{featured.description}</p>
              <span className="btn-bezel btn-bezel-lg w-fit uppercase group-hover:scale-105 transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Play Now
              </span>
            </div>
          </button>
        </section>

        {/* ===== ALL GAMES GRID ===== */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100">All Games</h2>
            <span className="text-xs text-gray-400 dark:text-gray-600">{GAMES.length} titles</span>
          </div>

          <GameSelector games={rest} onSelect={handleGameSelect} />
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-auto py-5 text-center text-xs text-gray-400 dark:text-gray-600 space-y-2">
        <div className="flex items-center justify-center gap-4 text-[11px]">
          <button
            onClick={() => setLegalOpen('terms')}
            className="text-gray-500 dark:text-gray-500 hover:text-amber-400 transition-colors"
          >
            Terms of Service
          </button>
          <span className="text-gray-700">•</span>
          <button
            onClick={() => setLegalOpen('privacy')}
            className="text-gray-500 dark:text-gray-500 hover:text-amber-400 transition-colors"
          >
            Privacy Policy
          </button>
        </div>
        <p className="text-[10px] text-amber-700/60 tracking-wide">
          Play at your own risk. Start with small stakes.
        </p>
        <p>Powered by BSV blockchain</p>
      </footer>

      {pendingTx && <TxApprovalModal pending={pendingTx} />}
      {showWalletPage && <WalletPage wallet={wallet} onClose={() => setShowWalletPage(false)} />}
      {legalOpen && <LegalPage doc={legalOpen} onClose={() => setLegalOpen(null)} />}

      {showWalletPopover && !wallet.connected && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[wpFadeIn_0.18s_ease]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowWalletPopover(false); }}
        >
          <div className="panel-bezel w-full max-w-[22rem] relative">
            <button
              onClick={() => setShowWalletPopover(false)}
              className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-black border border-amber-500/40 text-amber-300/80 hover:text-amber-200 hover:border-amber-400 flex items-center justify-center text-sm transition-all"
              aria-label="Close"
            >
              ×
            </button>
            <WalletPanel wallet={wallet} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
