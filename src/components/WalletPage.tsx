import { useState, useEffect, useCallback } from 'react';
import type { WalletHook } from '../hooks/useWallet';
import { walletService } from '../services/WalletService';

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
    const amount = parseInt(sendAmount, 10);
    if (!sendTo.trim()) { setSendError('Enter a recipient address'); return; }
    if (!amount || amount < 1) { setSendError('Enter a valid amount in sats'); return; }
    if (amount > wallet.balance - 200) { setSendError('Insufficient balance'); return; }

    setSending(true);
    try {
      const result = await walletService.sendPayment(sendTo.trim(), amount);
      if (!result.success) throw new Error(result.error || 'Send failed');
      setSendSuccess(`Sent! TX: ${(result.txid || '').substring(0, 16)}...`);
      setSendTo('');
      setSendAmount('');
      wallet.refreshBalance();
    } catch (err: any) {
      setSendError(err.message);
    }
    setSending(false);
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
    setSendAmount(String(Math.min(sats, Math.max(0, wallet.balance - 200))));
  };

  const tabs: { id: TabId; label: string }[] = isYours
    ? [{ id: 'receive', label: 'Receive' }, { id: 'history', label: 'History' }]
    : [{ id: 'receive', label: 'Receive' }, { id: 'send', label: 'Send' }, { id: 'history', label: 'History' }];

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
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(wallet.address)}`}
                    alt="QR" width={160} height={160}
                  />
                </div>
              )}
              {!isYours && (
                <button className="wp-btn-sm wp-full wp-export" onClick={() => {
                  const wif = wallet.exportWif();
                  if (wif) {
                    navigator.clipboard.writeText(wif).catch(() => {});
                    alert('WIF copied to clipboard. Store it safely!');
                  }
                }}>
                  Export WIF
                </button>
              )}
            </div>
          )}

          {activeTab === 'send' && !isYours && (
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
                  <button className="wp-helper" onClick={() => setAmountHelper(Math.max(0, wallet.balance - 200))}>Max</button>
                </div>
              </div>

              {sendAmount && parseInt(sendAmount, 10) > 0 && (
                <div className="wp-preview">
                  <div className="wp-preview-row"><span>Amount</span><span>{parseInt(sendAmount, 10).toLocaleString()} sats</span></div>
                  <div className="wp-preview-row"><span>Est. fee</span><span>~200 sats</span></div>
                  <div className="wp-preview-row wp-total"><span>Total</span><span>{(parseInt(sendAmount, 10) + 200).toLocaleString()} sats</span></div>
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
