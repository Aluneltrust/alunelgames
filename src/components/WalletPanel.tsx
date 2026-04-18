import { useState, useEffect } from 'react';
import type { WalletHook } from '../hooks/useWallet';

type View = 'locked' | 'create' | 'import' | 'connected';

export function WalletPanel({ wallet }: { wallet: WalletHook }) {
  const [view, setView] = useState<View>(wallet.connected ? 'connected' : wallet.hasStored ? 'locked' : 'create');
  const [pin, setPin] = useState('');
  const [wif, setWif] = useState('');
  const [error, setError] = useState('');
  const [showWif, setShowWif] = useState(false);
  const [exportedWif, setExportedWif] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync view when wallet connection state changes externally
  useEffect(() => {
    if (wallet.connected && view !== 'connected') {
      setView('connected');
    } else if (!wallet.connected && view === 'connected') {
      setView(wallet.hasStored ? 'locked' : 'create');
    }
  }, [wallet.connected, wallet.hasStored, view]);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const handleCreate = async () => {
    setError('');
    try {
      await wallet.createWallet(pin);
      setPin('');
      setView('connected');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImport = async () => {
    setError('');
    try {
      await wallet.importWallet(wif, pin);
      setPin('');
      setWif('');
      setView('connected');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnlock = async () => {
    setError('');
    try {
      await wallet.unlockWallet(pin);
      setPin('');
      setView('connected');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDisconnect = () => {
    const hadStored = wallet.hasStored;
    wallet.disconnectWallet();
    setView(hadStored ? 'locked' : 'create');
    setExportedWif('');
    setShowWif(false);
  };

  const formatBalance = (sats: number) => {
    if (sats >= 100_000_000) return `${(sats / 100_000_000).toFixed(4)} BSV`;
    return `${sats.toLocaleString()} sats`;
  };

  const pinDots = (
    <div className="flex justify-center gap-2 my-2">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
      ))}
    </div>
  );

  const errorBox = error && (
    <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2 mb-3">
      <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>
    </div>
  );

  const yoursButton = () => (
    <>
      <div className="flex items-center gap-3 mt-5 mb-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        <span className="text-[9px] text-amber-500/70 uppercase tracking-[0.25em] font-semibold">or</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-500/30 to-transparent" />
      </div>
      <button
        onClick={async () => {
          setError('');
          try {
            await wallet.connectYoursWallet();
            setView('connected');
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        disabled={wallet.loading}
        className="w-full py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold rounded-lg transition-all flex items-center justify-center gap-2 bg-gradient-to-b from-[#14100a] to-[#0a0805] border border-amber-500/30 text-amber-300 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M22 10H2" />
          <circle cx="18" cy="14" r="1" />
        </svg>
        {wallet.loading ? 'Connecting…' : 'Connect Yours Wallet'}
      </button>
      {!wallet.yoursAvailable && (
        <p className="text-[9px] text-amber-700/60 text-center mt-1.5 tracking-wide">Extension not detected</p>
      )}
    </>
  );

  // Connected view
  if (wallet.connected || view === 'connected') {
    const isYours = wallet.walletSource === 'yours';
    const usernameEmpty = !wallet.username.trim();

    return (
      <div className={`rounded-2xl p-4 ${isYours ? 'card-elevated' : 'card-elevated glow-connected'}`}>
        {/* Top row: status + balance + username + address */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <span className="text-[9px] text-green-600 dark:text-green-400 font-medium">
              {isYours ? 'Yours' : 'Master'}
            </span>
          </div>

          {/* Balance */}
          <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-gray-50/80 dark:bg-white/[0.03]">
            <p className="text-xs font-bold font-mono text-gray-900 dark:text-white">
              {wallet.loading ? '...' : formatBalance(wallet.balance)}
            </p>
            <button onClick={wallet.refreshBalance} className="text-[9px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors">
              ↻
            </button>
          </div>

          {/* Username */}
          <div className={`flex items-center gap-1.5 flex-1 min-w-0 rounded-lg bg-gray-50/80 dark:bg-white/[0.03] px-2.5 py-1 ${usernameEmpty ? 'pulse-orange' : ''}`}>
            <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium shrink-0">Name</span>
            <input
              type="text"
              value={wallet.username}
              onChange={e => wallet.setUsername(e.target.value)}
              placeholder="Set username"
              className="text-[10px] text-gray-700 dark:text-gray-300 bg-transparent flex-1 min-w-0 text-center outline-none placeholder:text-orange-400/60 dark:placeholder:text-orange-400/40"
            />
          </div>
        </div>

        {/* Address row */}
        <div className="flex items-center gap-2 rounded-lg bg-gray-50/80 dark:bg-white/[0.03] px-2.5 py-1.5 mb-3">
          <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium shrink-0">Address</span>
          <code className="text-[10px] text-gray-500 dark:text-gray-400 truncate flex-1 text-center">{wallet.address}</code>
          <button onClick={() => handleCopy(wallet.address, 'address')} className="text-[9px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors shrink-0">
            {copied === 'address' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          {!isYours && (
            <button
              onClick={() => {
                if (showWif) { setShowWif(false); setExportedWif(''); }
                else { setExportedWif(wallet.exportWif()); setShowWif(true); }
              }}
              className="flex-1 py-1.5 text-[10px] bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-all font-medium"
            >
              {showWif ? 'Hide Key' : 'Export Key'}
            </button>
          )}
          <button
            onClick={handleDisconnect}
            className="flex-1 py-1.5 text-[10px] bg-gray-50 dark:bg-white/[0.04] hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-all font-medium"
          >
            {isYours ? 'Disconnect' : 'Lock'}
          </button>
        </div>

        {/* Export key reveal (below actions) */}
        {showWif && !isYours && (
          <div className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-lg p-2.5 mt-2">
            <p className="text-[9px] text-red-400 mb-1.5">Anyone with this key controls your funds.</p>
            <div className="flex items-start gap-2">
              <code className="text-[9px] text-red-600/70 dark:text-red-300/80 break-all flex-1 leading-relaxed">{exportedWif}</code>
              <button onClick={() => handleCopy(exportedWif, 'wif')} className="text-[9px] text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium shrink-0 mt-0.5">
                {copied === 'wif' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Unlock view
  if (view === 'locked') {
    return (
      <div className="rounded-lg px-5 py-5">
        <h2 className="text-[11px] font-bold text-center mb-1 tracking-[0.25em] uppercase bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
          Unlock Wallet
        </h2>
        {wallet.addressHint && (
          <p className="text-[9px] text-amber-700/60 font-mono truncate mb-4 text-center">{wallet.addressHint}</p>
        )}

        {errorBox}

        <input
          type="password"
          maxLength={4}
          inputMode="numeric"
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && pin.length === 4 && handleUnlock()}
          className="w-full opacity-0 absolute pointer-events-auto h-0"
          autoFocus
          id="pin-input"
        />
        <div
          onClick={() => document.getElementById('pin-input')?.focus()}
          className="cursor-pointer rounded-xl border border-amber-500/20 bg-black/30 hover:border-amber-400/50 hover:bg-black/40 transition-all py-3 mb-4"
        >
          {pinDots}
          <p className="text-center text-[9px] text-amber-700/70 tracking-wider uppercase mt-1">Tap to enter PIN</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUnlock}
            disabled={pin.length !== 4}
            className="flex-1 py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold rounded-lg transition-all bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-white/[0.04] disabled:to-white/[0.04] disabled:text-gray-600 text-[#0a0805] shadow-sm shadow-amber-500/30 disabled:shadow-none"
          >
            Unlock
          </button>
          <button
            onClick={() => { setView('import'); setError(''); setPin(''); }}
            className="flex-1 py-2.5 text-[11px] uppercase tracking-[0.15em] font-semibold rounded-lg transition-all bg-black/30 border border-white/10 text-gray-400 hover:text-amber-300 hover:border-amber-500/40"
          >
            Import Key
          </button>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { wallet.deleteWallet(); setView('create'); setConfirmDelete(false); }}
              className="flex-1 py-2 text-[10px] uppercase tracking-wider text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-all font-semibold"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 text-[10px] uppercase tracking-wider text-gray-400 bg-black/30 border border-white/10 hover:border-white/20 rounded-lg transition-all font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-2 py-1.5 text-[10px] uppercase tracking-wider text-red-400/60 hover:text-red-400 rounded-lg transition-all font-medium"
          >
            Delete Wallet
          </button>
        )}

        {yoursButton()}
      </div>
    );
  }

  // Create / Import view
  return (
    <div className="rounded-2xl px-5 py-6">
      <div className="flex flex-col items-center text-center mb-5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center mb-3 shadow-[0_0_14px_rgba(245,158,11,0.15)]">
          <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {view === 'import' ? (
              <>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </>
            ) : (
              <>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </>
            )}
          </svg>
        </div>
        <h2 className="text-[13px] font-bold tracking-[0.25em] uppercase bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-transparent">
          {view === 'import' ? 'Import Wallet' : 'Create Wallet'}
        </h2>
        <p className="text-[10px] text-amber-700/60 mt-1 tracking-wide uppercase">
          {view === 'import' ? 'Paste your WIF private key' : 'Set a 4-digit PIN to encrypt'}
        </p>
      </div>

      {errorBox}

      {view === 'import' && (
        <input
          type="text"
          placeholder="WIF private key"
          value={wif}
          onChange={e => setWif(e.target.value.trim())}
          className="w-full px-4 py-3 mb-3 bg-black/30 border border-amber-500/15 rounded-xl text-gray-200 text-xs font-mono placeholder:font-sans placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 focus:bg-black/40 transition-all"
        />
      )}

      <input
        type="password"
        maxLength={4}
        inputMode="numeric"
        placeholder="••••"
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full px-4 py-3 bg-black/30 border border-amber-500/15 rounded-xl text-amber-200 text-center text-2xl tracking-[0.6em] font-mono placeholder:text-base placeholder:tracking-[0.6em] placeholder:text-amber-700/30 focus:outline-none focus:border-amber-500/50 focus:bg-black/40 transition-all"
      />

      <button
        onClick={view === 'import' ? handleImport : handleCreate}
        disabled={pin.length !== 4 || (view === 'import' && !wif)}
        className="w-full mt-4 py-3 text-[12px] uppercase tracking-[0.2em] font-bold rounded-xl transition-all bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:from-white/[0.04] disabled:to-white/[0.04] disabled:text-gray-600 text-[#0a0805] shadow-[0_4px_14px_rgba(245,158,11,0.25)] disabled:shadow-none"
      >
        {view === 'import' ? 'Import & Encrypt' : 'Create Wallet'}
      </button>

      <button
        onClick={() => { setView(view === 'import' ? 'create' : 'import'); setError(''); setPin(''); setWif(''); }}
        className="w-full mt-2 py-2 text-[10px] uppercase tracking-[0.15em] text-amber-700/70 hover:text-amber-400 font-semibold transition-colors"
      >
        {view === 'import' ? 'Create new wallet instead' : 'Import existing key instead'}
      </button>

      {yoursButton()}
    </div>
  );
}
