import { useState, useEffect } from 'react';
import { useWallet } from './hooks/useWallet';
import { useTheme } from './hooks/useTheme';
import { startWalletBridge, setApprovalCallback, setWalletSource } from './services/WalletBridge';
import type { PendingApproval } from './services/WalletBridge';
import type { GameConfig } from './games';
import { WalletPanel } from './components/WalletPanel';
import { GameSelector } from './components/GameSelector';
import { GameFrame } from './components/GameFrame';
import { TxApprovalModal } from './components/TxApprovalModal';

export default function App() {
  const wallet = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [activeGame, setActiveGame] = useState<GameConfig | null>(null);
  const [pendingTx, setPendingTx] = useState<PendingApproval | null>(null);

  useEffect(() => {
    const cleanup = startWalletBridge();
    setApprovalCallback((pending) => {
      setPendingTx(pending);
      const originalResolve = pending.resolve;
      pending.resolve = (approved: boolean) => {
        setPendingTx(null);
        originalResolve(approved);
      };
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (wallet.walletSource) {
      setWalletSource(wallet.walletSource);
    }
  }, [wallet.walletSource]);

  if (activeGame) {
    return (
      <div className="h-screen flex flex-col bg-[#fafafa] dark:bg-[#09090b]">
        <GameFrame game={activeGame} onBack={() => setActiveGame(null)} />
        {pendingTx && <TxApprovalModal pending={pendingTx} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-gray-900 dark:text-white relative">
      <div className="bg-mesh" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="fixed top-5 right-5 z-50 w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/15 transition-all"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
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

        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-xs text-indigo-500 dark:text-indigo-400 mb-6 tracking-wide uppercase font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 pulse-dot" />
            BSV Gaming Hub
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-3 text-gray-900 dark:text-white">
            Alunel<span className="text-xs align-super">™</span> Games
          </h1>
          <p className="text-lg text-gray-400 dark:text-gray-500 max-w-md mx-auto">
            One wallet. All your games. Real BSV micropayments.
          </p>
        </header>

        {/* Wallet */}
        <div className="max-w-md mx-auto mb-12">
          <WalletPanel wallet={wallet} />
        </div>

        {/* Games */}
        {wallet.connected ? (
          <GameSelector onSelect={setActiveGame} />
        ) : (
          <div className="card rounded-2xl p-14 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-3xl mb-5">🎮</div>
            <p className="text-gray-700 dark:text-gray-300 text-lg font-medium mb-1">Connect your wallet to play</p>
            <p className="text-gray-400 dark:text-gray-600 text-sm max-w-xs">Create or unlock your master wallet to access all games</p>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="fixed bottom-4 left-0 right-0 text-center text-xs text-gray-300 dark:text-gray-700 z-10">
        Powered by BSV blockchain
      </footer>

      {pendingTx && <TxApprovalModal pending={pendingTx} />}
    </div>
  );
}
