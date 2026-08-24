import type { PendingApproval } from '../services/WalletBridge';

interface TxApprovalModalProps {
  pending: PendingApproval;
}

export function TxApprovalModal({ pending }: TxApprovalModalProps) {
  const { request, origin } = pending;
  const amount = request.payload?.amount || 0;
  const to = request.payload?.toAddress || '???';

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* panel-bezel: the portal's opaque dark panel with a gold ring. This
          modal used card-elevated, the translucent glass card, which reads as
          a floating surface rather than a payment confirmation. */}
      <div className="panel-bezel max-w-md w-full">
        <div className="p-7">
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
            </div>
            <div className="surface-bar p-3.5">
              <p className="text-[10px] text-[#8a7a5c] uppercase tracking-wider font-semibold mb-1">To</p>
              <p className="text-xs font-mono text-[#e7c98b] break-all leading-relaxed">{to}</p>
            </div>
            {request.payload?.memo && (
              <div className="surface-bar p-3.5">
                <p className="text-[10px] text-[#8a7a5c] uppercase tracking-wider font-semibold mb-1">Memo</p>
                <p className="text-xs font-mono text-[#e7c98b] break-all leading-relaxed">{request.payload.memo}</p>
              </div>
            )}
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
