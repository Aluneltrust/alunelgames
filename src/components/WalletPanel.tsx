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

  const yoursButton = (size: 'sm' | 'md' = 'md') => (
    <>
      <div className="flex items-center gap-2 mt-3 mb-2">
        <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
        <span className="text-[8px] text-gray-300 dark:text-gray-600 uppercase tracking-wider font-medium">or</span>
        <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
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
        className={`w-full ${size === 'sm' ? 'py-1 text-[8px]' : 'py-1.5 text-[9px]'} bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 disabled:opacity-50 text-white font-medium rounded transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/10`}
      >
        <svg className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M22 10H2" />
          <circle cx="18" cy="14" r="1" />
        </svg>
        {wallet.loading ? 'Connecting...' : 'Connect Yours Wallet'}
      </button>
      {!wallet.yoursAvailable && (
        <p className="text-[8px] text-gray-300 dark:text-gray-600 text-center mt-1">Extension not detected</p>
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
      <div className="card-elevated rounded-lg px-3 py-4">
        <h2 className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 text-center mb-3">Unlock Wallet</h2>
        {wallet.addressHint && (
          <p className="text-[8px] text-gray-400 font-mono truncate mb-2 text-center">{wallet.addressHint}</p>
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
          className="cursor-pointer rounded border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03] hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all py-2 mb-2"
        >
          {pinDots}
          <p className="text-center text-[7px] text-gray-400">Tap here to enter PIN</p>
        </div>

        <button
          onClick={handleUnlock}
          disabled={pin.length !== 4}
          className="w-full py-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-100 dark:disabled:bg-white/[0.04] disabled:text-gray-300 dark:disabled:text-gray-600 text-white text-[8px] font-medium rounded transition-all shadow-sm shadow-indigo-500/20"
        >
          Unlock
        </button>

        <button onClick={() => { setView('import'); setError(''); setPin(''); }} className="w-full mt-1 py-1 text-[8px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded transition-all font-medium">
          Import Key
        </button>
        {confirmDelete ? (
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => { wallet.deleteWallet(); setView('create'); setConfirmDelete(false); }}
              className="flex-1 py-1 text-[8px] text-white bg-red-500 hover:bg-red-600 rounded transition-all font-medium"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1 text-[8px] text-gray-400 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded transition-all font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-1 py-1 text-[8px] text-red-300 hover:text-red-500 bg-gray-50 dark:bg-white/[0.03] hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all font-medium"
          >
            Delete
          </button>
        )}

        {yoursButton('sm')}
      </div>
    );
  }

  // Create / Import view
  return (
    <div className="card-elevated rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {view === 'import' ? 'Import Wallet' : 'Create Wallet'}
        </h2>
      </div>
      <p className="text-[11px] text-gray-400 mb-5 ml-10">
        {view === 'import' ? 'Paste your WIF private key below' : 'Set a 4-digit PIN to encrypt your wallet'}
      </p>

      {errorBox}

      {view === 'import' && (
        <input
          type="text"
          placeholder="WIF private key"
          value={wif}
          onChange={e => setWif(e.target.value.trim())}
          className="w-full px-4 py-3 mb-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl text-gray-800 dark:text-white text-xs font-mono placeholder:font-sans placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      )}

      <input
        type="password"
        maxLength={4}
        inputMode="numeric"
        placeholder="4-digit PIN"
        value={pin}
        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl text-gray-800 dark:text-white text-center text-xl tracking-[0.5em] font-mono placeholder:text-sm placeholder:tracking-normal placeholder:font-sans placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
      />

      <button
        onClick={view === 'import' ? handleImport : handleCreate}
        disabled={pin.length !== 4 || (view === 'import' && !wif)}
        className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-100 dark:disabled:bg-white/[0.04] disabled:text-gray-300 dark:disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/25"
      >
        {view === 'import' ? 'Import & Encrypt' : 'Create Wallet'}
      </button>

      <button
        onClick={() => { setView(view === 'import' ? 'create' : 'import'); setError(''); setPin(''); setWif(''); }}
        className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium transition-colors"
      >
        {view === 'import' ? 'Create new wallet instead' : 'Import existing key instead'}
      </button>

      {yoursButton()}
    </div>
  );
}
