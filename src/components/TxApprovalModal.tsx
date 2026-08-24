import { useEffect } from 'react';
import type { PendingApproval } from '../services/WalletBridge';

interface TxApprovalModalProps {
  pending: PendingApproval;
}

// Mirrors NETWORK_FEE_SATS in WalletService.ts, which is module-private there.
// Keep the two in step — this figure is shown to the user before they approve.
const NETWORK_FEE_SATS = 100;

export function TxApprovalModal({ pending }: TxApprovalModalProps) {
  const { request, origin } = pending;
  const amount = request.payload?.amount || 0;
  const to = request.payload?.toAddress || '???';

  // 'sendPayment' broadcasts straight away. 'signTransaction' hands the game a
  // signed transaction it can publish whenever it likes — which is the same
  // irreversible authorisation, just deferred. The modal rendered both
  // identically, so "sign" read as harmless when it is not.
  const willBroadcastNow = request.action === 'sendPayment';
  const total = amount + NETWORK_FEE_SATS;

  // Escape rejects. There was no dismiss path at all — no Escape, no backdrop
  // click — so a prompt the user could not act on could not be cleared, and
  // the bridge stayed wedged behind pendingApprovalId.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') pending.resolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending]);

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => pending.resolve(false)}
    >
      {/* panel-bezel: the portal's opaque dark panel with a gold ring. This
          modal used card-elevated, the translucent glass card, which reads as
          a floating surface rather than a payment confirmation.
          max-h/overflow keep an oversized memo inside the panel instead of
          pushing the buttons off-screen. */}
      <div
        className="panel-bezel max-w-md w-full max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-7 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-black/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-wide text-[#fde68a]">Transaction Request</h2>
              <p className="text-[10px] text-[#8a7a5c] truncate">{origin}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 mb-6">
            <div className="surface-bar bezel-ring-thin p-4 text-center">
              <p className="text-[10px] text-[#8a7a5c] uppercase tracking-wider font-semibold mb-1">Amount</p>
              <p className="text-3xl font-bold font-mono text-[#fff2c9] leading-none">{amount.toLocaleString()}</p>
              <p className="text-[10px] text-[#8a7a5c] mt-1.5">satoshis</p>
              {/* The fee was never disclosed, so the figure above was not what
                  actually left the wallet. */}
              <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex justify-between text-[10px]">
                <span className="text-[#8a7a5c]">Network fee</span>
                <span className="font-mono text-[#e7c98b]">{NETWORK_FEE_SATS.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className="text-[#8a7a5c] font-semibold uppercase tracking-wider">Total</span>
                <span className="font-mono font-bold text-[#fff2c9]">{total.toLocaleString()} sats</span>
              </div>
            </div>
            <div className="surface-bar p-3.5">
              <p className="text-[10px] text-[#8a7a5c] uppercase tracking-wider font-semibold mb-1">To</p>
              <p className="text-xs font-mono text-[#e7c98b] break-all leading-relaxed">{to}</p>
            </div>
            {request.payload?.memo && (
              <div className="surface-bar p-3.5">
                <p className="text-[10px] text-[#8a7a5c] uppercase tracking-wider font-semibold mb-1">Memo</p>
                <p className="text-xs font-mono text-[#e7c98b] break-all leading-relaxed max-h-24 overflow-y-auto">
                  {request.payload.memo}
                </p>
              </div>
            )}
            {/* Say plainly which of the two this is. */}
            <div className="surface-bar p-3 flex items-start gap-2">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${willBroadcastNow ? 'bg-amber-400' : 'bg-orange-500'}`} />
              <p className="text-[10px] text-[#8a7a5c] leading-relaxed">
                {willBroadcastNow
                  ? 'This payment is broadcast to the network immediately and cannot be reversed.'
                  : 'The game receives a signed transaction and can broadcast it at any time. Approving spends these funds.'}
              </p>
            </div>
          </div>

          {/* Actions — Approve carries the gold bezel, Reject stays recessive
              so the destructive-by-default choice is never the loud one. */}
          <div className="flex gap-3">
            <button
              onClick={() => pending.resolve(false)}
              className="flex-1 h-11 rounded-[14px] hairline-gray bg-white/[0.03] hover:bg-white/[0.07] text-[#8a8578] hover:text-[#e4e0d6] text-xs font-bold tracking-wider uppercase transition-all"
            >
              Reject
            </button>
            <button
              onClick={() => pending.resolve(true)}
              className="btn-bezel btn-bezel-md flex-1 uppercase"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
