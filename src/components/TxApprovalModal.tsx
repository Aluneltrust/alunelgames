import type { PendingApproval } from '../services/WalletBridge';

interface TxApprovalModalProps {
  pending: PendingApproval;
}

export function TxApprovalModal({ pending }: TxApprovalModalProps) {
  const { request, origin } = pending;
  const amount = request.payload?.amount || 0;
  const to = request.payload?.toAddress || '???';

  return (
    <div className="fixed inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-elevated rounded-2xl p-7 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">Transaction Request</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">{origin}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 mb-6">
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 text-center">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">Amount</p>
            <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white">{amount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">satoshis</p>
          </div>
          <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3.5">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">To</p>
            <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all leading-relaxed">{to}</p>
          </div>
          {request.payload?.memo && (
            <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3.5">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-1">Memo</p>
              <p className="text-xs text-gray-600 dark:text-gray-300">{request.payload.memo}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => pending.resolve(false)}
            className="flex-1 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-sm font-medium rounded-xl transition-all"
          >
            Reject
          </button>
          <button
            onClick={() => pending.resolve(true)}
            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-all shadow-sm shadow-indigo-500/20"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
