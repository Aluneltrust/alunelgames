import { useState } from 'react';
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

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
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
    wallet.disconnectWallet();
    setView(wallet.hasStored ? 'locked' : 'create');
    setExportedWif('');
    setShowWif(false);
  };

  const formatBalance = (sats: number) => {
    if (sats >= 100_000_000) return `${(sats / 100_000_000).toFixed(4)} BSV`;
    return `${sats.toLocaleString()} sats`;
  };

  const pinDots = (
    <div className="flex justify-center gap-3 my-4">
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
      <div className="flex items-center gap-3 mt-5 mb-3">
        <div className="flex-1 h-px bg-gray-100 dark:bg-white/[0.06]" />
        <span className="text-[10px] text-gray-300 dark:text-gray-600 uppercase tracking-wider font-medium">or</span>
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
        className={`w-full ${size === 'sm' ? 'py-2.5 text-xs' : 'py-3 text-sm'} bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/15`}
      >
        <svg className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M22 10H2" />
          <circle cx="18" cy="14" r="1" />
        </svg>
        {wallet.loading ? 'Connecting...' : 'Connect Yours Wallet'}
      </button>
      {!wallet.yoursAvailable && (
        <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center mt-1.5">Extension not detected</p>
      )}
    </>
  );

  // Connected view
  if (wallet.connected || view === 'connected') {
    const isYours = wallet.walletSource === 'yours';

    return (
      <div className={`rounded-2xl p-6 ${isYours ? 'card-elevated' : 'card-elevated glow-connected'}`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {isYours ? 'Yours Wallet' : 'Master Wallet'}
              </h2>
              {isYours && (
                <span className="text-[10px] text-violet-500 dark:text-violet-400 font-medium">Browser Extension</span>
              )}
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 text-[11px] font-medium rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            Connected
          </span>
        </div>

        <div className="space-y-4">
          {/* Balance */}
          <div className="text-center py-4 rounded-xl bg-gray-50/80 dark:bg-white/[0.03]">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">Balance</p>
            <p className="text-3xl font-bold font-mono text-gray-900 dark:text-white">
              {wallet.loading ? (
                <span className="text-gray-300 dark:text-gray-600">...</span>
              ) : (
                formatBalance(wallet.balance)
              )}
            </p>
            <button onClick={wallet.refreshBalance} className="mt-1.5 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors">
              Refresh
            </button>
          </div>

          {/* Address */}
          <div className="rounded-xl bg-gray-50/80 dark:bg-white/[0.03] p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Address</span>
              <button onClick={() => handleCopy(wallet.address, 'address')} className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium transition-colors">
                {copied === 'address' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="text-xs text-gray-500 dark:text-gray-400 break-all leading-relaxed">{wallet.address}</code>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
            {!isYours && (
              <>
                <button
                  onClick={() => {
                    if (showWif) { setShowWif(false); setExportedWif(''); }
                    else { setExportedWif(wallet.exportWif()); setShowWif(true); }
                  }}
                  className="w-full py-2.5 text-xs bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl transition-all font-medium"
                >
                  {showWif ? 'Hide Private Key' : 'Export Private Key'}
                </button>

                {showWif && (
                  <div className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-xl p-3">
                    <p className="text-[10px] text-red-400 mb-2">Anyone with this key controls your funds.</p>
                    <div className="flex items-start gap-2">
                      <code className="text-[10px] text-red-600/70 dark:text-red-300/80 break-all flex-1 leading-relaxed">{exportedWif}</code>
                      <button onClick={() => handleCopy(exportedWif, 'wif')} className="text-[10px] text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium shrink-0 mt-0.5">
                        {copied === 'wif' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 text-xs bg-gray-50 dark:bg-white/[0.04] hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-all font-medium"
            >
              {isYours ? 'Disconnect' : 'Lock Wallet'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Unlock view
  if (view === 'locked') {
    return (
      <div className="card-elevated rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Unlock Wallet</h2>
        </div>
        {wallet.addressHint && (
          <p className="text-[10px] text-gray-400 font-mono truncate mb-3 ml-10">{wallet.addressHint}</p>
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
        />
        <div onClick={() => (document.querySelector('input[type=password]') as HTMLElement)?.focus()}>
          {pinDots}
        </div>
        <p className="text-center text-[10px] text-gray-400 mb-4">Enter your 4-digit PIN</p>

        <button
          onClick={handleUnlock}
          disabled={pin.length !== 4}
          className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-100 dark:disabled:bg-white/[0.04] disabled:text-gray-300 dark:disabled:text-gray-600 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-indigo-500/20 hover:shadow-md hover:shadow-indigo-500/25"
        >
          Unlock
        </button>

        <div className="flex gap-2 mt-3">
          <button onClick={() => { setView('import'); setError(''); setPin(''); }} className="flex-1 py-2.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-xl transition-all font-medium">
            Import Key
          </button>
          <button
            onClick={() => { if (confirm('Delete stored wallet? This cannot be undone.')) { wallet.deleteWallet(); setView('create'); } }}
            className="py-2.5 px-4 text-xs text-red-300 hover:text-red-500 bg-gray-50 dark:bg-white/[0.03] hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all font-medium"
          >
            Delete
          </button>
        </div>

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
