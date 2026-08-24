import { useState, useEffect, useCallback } from 'react';
import type { WalletHook } from '../hooks/useWallet';
import { walletService, WalletService, NETWORK_FEE_SATS, DUST_LIMIT } from '../services/WalletService';
import { yoursWalletService } from '../services/YoursWalletService';
import { decryptStoredWif } from '../services/pinCrypto';
import { QRCodeSVG } from 'qrcode.react';

type TabId = 'receive' | 'send' | 'history';

interface HistoryTx {
  txid: string;
  time: number;
  confirmations: number;
  balanceChange: number;
}

const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main';
const WOC_EXPLORER = 'https://whatsonchain.com/tx';

function formatSats(sats: number): string {
  return Math.abs(sats).toLocaleString();
}

function timeAgo(ts: number): string {
  if (!ts) return 'Unconfirmed';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function WalletPage({ wallet, onClose }: { wallet: WalletHook; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('receive');
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // WIF export, gated on re-entering the PIN. Previously one click on an
  // unlocked session copied the private key straight to the OS clipboard —
  // where Windows clipboard history and cloud sync then persist it outside
  // the app — and the success alert fired even when the copy had failed.
  const [exportPrompt, setExportPrompt] = useState(false);
  const [exportPin, setExportPin] = useState('');
  const [exportError, setExportError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportedWif, setExportedWif] = useState('');
  const [copiedWif, setCopiedWif] = useState(false);

  const revealWif = async () => {
    setExportError('');
    setExportBusy(true);
    try {
      // Verified against the stored blob, so an unlocked session alone is not
      // enough to reveal the key.
      const revealed = await decryptStoredWif(exportPin);
      setExportedWif(revealed);
      setExportPrompt(false);
      setExportPin('');
    } catch {
      setExportError('Incorrect PIN');
    }
    setExportBusy(false);
  };

  const handleCopyWif = async () => {
    try {
      // Awaited, so a rejected write is not reported as success. clipboard
      // writes fail on insecure contexts, denied permission, or an unfocused
      // document — and a user who trusts a false "copied" message and then
      // clears their wallet loses the funds.
      await navigator.clipboard.writeText(exportedWif);
      setCopiedWif(true);
      setTimeout(() => setCopiedWif(false), 2000);
    } catch {
      setExportError('Copy failed — select the key above and copy it manually.');
    }
  };

  // Send state
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [sending, setSending] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryTx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const isYours = wallet.walletSource === 'yours';

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = wallet.address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [wallet.address]);

  const handleSend = async () => {
    setSendError('');
    setSendSuccess('');
    const recipient = sendTo.trim();
    const amount = parseInt(sendAmount, 10);
    // Yours handles fees itself; only subtract buffer on the local path.
    const reserve = isYours ? 0 : NETWORK_FEE_SATS;
    if (!recipient) { setSendError('Enter a recipient address'); return; }
    if (!WalletService.isValidAddress(recipient)) { setSendError('Invalid BSV address'); return; }
    if (!amount || amount < DUST_LIMIT) { setSendError(`Amount must be at least ${DUST_LIMIT} sats`); return; }
    if (amount > wallet.balance - reserve) { setSendError('Insufficient balance'); return; }

    setSending(true);
    try {
      let txid: string;
      if (isYours) {
        const result = await yoursWalletService.sendBsv(recipient, amount);
        txid = result.txid;
      } else {
        const result = await walletService.sendPayment(recipient, amount);
        if (!result.success) throw new Error(result.error || 'Send failed');
        txid = result.txid || '';
      }
      setSendSuccess(`Sent! TX: ${txid.substring(0, 16)}...`);
      setSendTo('');
      setSendAmount('');
      wallet.refreshBalance();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    if (!wallet.address) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await fetch(`${WOC_BASE}/address/${wallet.address}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const txList: Array<{ tx_hash: string }> = await res.json();
      const recent = txList.slice(-20).reverse();
      const details: HistoryTx[] = [];

      for (const item of recent) {
        try {
          const txRes = await fetch(`${WOC_BASE}/tx/hash/${item.tx_hash}`);
          if (!txRes.ok) continue;
          const txData = await txRes.json();

          let incoming = 0;
          let isOutgoing = false;

          for (const vout of txData.vout) {
            if (vout.addresses?.includes(wallet.address)) {
              incoming += Math.round(parseFloat(vout.value) * 1e8);
            }
          }
          for (const vin of txData.vin) {
            if (vin.addresses?.includes(wallet.address)) isOutgoing = true;
          }

          const totalOut = isOutgoing
            ? txData.vout.reduce((sum: number, v: any) => {
                if (!v.addresses?.includes(wallet.address)) return sum + Math.round(parseFloat(v.value) * 1e8);
                return sum;
              }, 0)
            : 0;

          details.push({
            txid: txData.txid,
            time: txData.time || 0,
            confirmations: txData.confirmations || 0,
            balanceChange: isOutgoing ? -totalOut : incoming,
          });
        } catch { /* skip */ }
      }

      setHistory(details);
    } catch (err: any) {
      setHistoryError(err.message);
    }
    setHistoryLoading(false);
  }, [wallet.address]);

  useEffect(() => {
    if (activeTab === 'history' && history.length === 0 && !historyLoading) {
      fetchHistory();
    }
  }, [activeTab]);

  const setAmountHelper = (sats: number) => {
    const reserve = isYours ? 0 : NETWORK_FEE_SATS;
    setSendAmount(String(Math.min(sats, Math.max(0, wallet.balance - reserve))));
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'receive', label: 'Receive' },
    { id: 'send', label: 'Send' },
    { id: 'history', label: 'History' },
  ];

  return (
    <div className="wp-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wp-container">
        {/* Header */}
        <div className="wp-header">
          <button className="wp-back" onClick={onClose}>Back</button>
          <span className="wp-title">Wallet</span>
          <div className="wp-spacer" />
        </div>

        {/* Balance */}
        <div className="wp-balance">
          <span className="wp-balance-label">Balance</span>
          <span className="wp-balance-sats">{formatSats(wallet.balance)}</span>
          <span className="wp-balance-sub">sats</span>
          <button className="wp-refresh" onClick={wallet.refreshBalance}>Refresh</button>
        </div>

        {/* Tabs */}
        <div className="wp-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`wp-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="wp-content">
          {activeTab === 'receive' && (
            <div className="wp-section">
              <span className="wp-label">Your Address</span>
              <div className="wp-address-row">
                <code className="wp-address">{wallet.address}</code>
                <button className="wp-btn-sm" onClick={copyAddress}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button className="wp-btn-sm wp-full" onClick={() => setShowQr(!showQr)}>
                {showQr ? 'Hide QR' : 'Show QR'}
              </button>
              {showQr && (
                <div className="wp-qr">
                  {/* Generated locally. This used to be an <img> pointing at
                      api.qrserver.com, which meant a third party rendered the
                      code people scan to SEND money here — if that service
                      were compromised or MITM'd it could return a QR encoding
                      someone else's address, and the text address shown below
                      is not what gets scanned. It also disclosed every user's
                      address to an outside host. */}
                  <QRCodeSVG value={wallet.address} size={160} level="M" />
                </div>
              )}
              {!isYours && (
                <button
                  className="wp-btn-sm wp-full wp-export"
                  onClick={() => {
                    if (exportPrompt || exportedWif) {
                      setExportPrompt(false); setExportedWif(''); setExportPin(''); setExportError('');
                    } else {
                      setExportPrompt(true); setExportPin(''); setExportError('');
                    }
                  }}
                >
                  {exportPrompt || exportedWif ? 'Hide WIF' : 'Export WIF'}
                </button>
              )}

              {/* PIN gate */}
              {!isYours && exportPrompt && (
                <div className="wp-export-gate">
                  <p>Re-enter your PIN to reveal the private key.</p>
                  <div className="wp-export-row">
                    <input
                      type="password"
                      inputMode="numeric"
                      autoFocus
                      value={exportPin}
                      onChange={(e) => { setExportPin(e.target.value); setExportError(''); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && exportPin && !exportBusy) revealWif(); }}
                      placeholder="PIN"
                    />
                    <button onClick={revealWif} disabled={!exportPin || exportBusy}>
                      {exportBusy ? '...' : 'Reveal'}
                    </button>
                  </div>
                  {exportError && <p className="wp-export-error">{exportError}</p>}
                </div>
              )}

              {/* Reveal — shown on screen with an explicit copy, rather than
                  written to the clipboard automatically. */}
              {!isYours && exportedWif && (
                <div className="wp-export-reveal">
                  <p>Anyone with this key controls your funds.</p>
                  <code>{exportedWif}</code>
                  <button onClick={() => handleCopyWif()}>
                    {copiedWif ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'send' && (
            <div className="wp-section">
              <div className="wp-field">
                <span className="wp-label">Recipient Address</span>
                <input
                  className="wp-input"
                  type="text"
                  placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                  value={sendTo}
                  onChange={e => { setSendTo(e.target.value); setSendError(''); setSendSuccess(''); }}
                />
              </div>
              <div className="wp-field">
                <span className="wp-label">Amount (satoshis)</span>
                <input
                  className="wp-input"
                  type="number"
                  placeholder="10000"
                  value={sendAmount}
                  onChange={e => { setSendAmount(e.target.value); setSendError(''); setSendSuccess(''); }}
                />
                <div className="wp-helpers">
                  <button className="wp-helper" onClick={() => setAmountHelper(10000)}>10k</button>
                  <button className="wp-helper" onClick={() => setAmountHelper(100000)}>100k</button>
                  <button className="wp-helper" onClick={() => setAmountHelper(500000)}>500k</button>
                  <button className="wp-helper" onClick={() => setAmountHelper(wallet.balance)}>Max</button>
                </div>
              </div>

              {sendAmount && parseInt(sendAmount, 10) > 0 && (
                <div className="wp-preview">
                  <div className="wp-preview-row"><span>Amount</span><span>{parseInt(sendAmount, 10).toLocaleString()} sats</span></div>
                  {!isYours && <div className="wp-preview-row"><span>Est. fee</span><span>~{NETWORK_FEE_SATS} sats</span></div>}
                  {!isYours && <div className="wp-preview-row wp-total"><span>Total</span><span>{(parseInt(sendAmount, 10) + NETWORK_FEE_SATS).toLocaleString()} sats</span></div>}
                </div>
              )}

              {sendError && <div className="wp-error">{sendError}</div>}
              {sendSuccess && <div className="wp-success">{sendSuccess}</div>}

              <button className="wp-send-btn" onClick={handleSend} disabled={sending || !sendTo.trim() || !sendAmount}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="wp-history">
              {historyLoading && <div className="wp-history-empty">Loading transactions...</div>}
              {historyError && <div className="wp-error">{historyError}</div>}
              {!historyLoading && !historyError && history.length === 0 && (
                <div className="wp-history-empty">No transactions found</div>
              )}
              {history.map(tx => (
                <a key={tx.txid} className="wp-tx" href={`${WOC_EXPLORER}/${tx.txid}`} target="_blank" rel="noopener noreferrer">
                  <div className="wp-tx-left">
                    <span className="wp-tx-id">{tx.txid.substring(0, 12)}...{tx.txid.slice(-6)}</span>
                    <span className="wp-tx-time">{timeAgo(tx.time)}</span>
                  </div>
                  <div className="wp-tx-right">
                    <span className={`wp-tx-amount ${tx.balanceChange >= 0 ? 'in' : 'out'}`}>
                      {tx.balanceChange >= 0 ? '+' : '-'}{formatSats(tx.balanceChange)} sats
                    </span>
                    <span className={`wp-tx-conf ${tx.confirmations === 0 ? 'pending' : ''}`}>
                      {tx.confirmations === 0 ? 'Pending' : `${tx.confirmations} conf`}
                    </span>
                  </div>
                </a>
              ))}
              {!historyLoading && history.length > 0 && (
                <button className="wp-refresh" style={{ alignSelf: 'center', marginTop: 12 }} onClick={fetchHistory}>
                  Refresh History
                </button>
              )}
            </div>
          )}
        </div>

        {/* Network badge */}
        <div className="wp-network">Mainnet</div>
      </div>
    </div>
  );
}
