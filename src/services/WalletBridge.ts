import { walletService } from './WalletService';
import type { PaymentResult } from './WalletService';
import { yoursWalletService } from './YoursWalletService';
import type { WalletSource } from '../hooks/useWallet';

// Message types between parent (this app) and child iframes (games)
export interface WalletRequest {
  type: 'WALLET_REQUEST';
  id: string;
  action: 'getAddress' | 'getBalance' | 'getPublicKey' | 'signTransaction' | 'sendPayment';
  payload?: {
    toAddress?: string;
    amount?: number;
    memo?: string;
  };
}

export interface WalletResponse {
  type: 'WALLET_RESPONSE';
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

type PendingApproval = {
  request: WalletRequest;
  origin: string;
  source: MessageEventSource;
  resolve: (approved: boolean) => void;
};

let approvalCallback: ((pending: PendingApproval) => void) | null = null;
let activeWalletSource: WalletSource = 'local';

export function setApprovalCallback(cb: (pending: PendingApproval) => void): void {
  approvalCallback = cb;
}

export function setWalletSource(source: WalletSource): void {
  activeWalletSource = source;
}

export type { PendingApproval };

// Allowed origins for game iframes — add your deployed game URLs here
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'https://royalsonchain.com',
  'https://www.royalsonchain.com',
  'https://sheeponchain.com',
  'https://www.sheeponchain.com',
]);

export function addAllowedOrigin(origin: string): void {
  ALLOWED_ORIGINS.add(origin);
}

function sendResponse(source: MessageEventSource, response: WalletResponse, origin: string): void {
  (source as Window).postMessage(response, origin);
}

async function handleRequest(request: WalletRequest, origin: string, source: MessageEventSource): Promise<void> {
  const respond = (success: boolean, data?: unknown, error?: string) => {
    sendResponse(source, { type: 'WALLET_RESPONSE', id: request.id, success, data, error }, origin);
  };

  const isYours = activeWalletSource === 'yours';
  const isWalletConnected = isYours ? yoursWalletService.isConnected() : walletService.isConnected();

  if (!isWalletConnected) {
    respond(false, undefined, 'Wallet not connected');
    return;
  }

  switch (request.action) {
    case 'getAddress':
      respond(true, isYours ? yoursWalletService.getAddress() : walletService.getAddress());
      break;

    case 'getBalance': {
      try {
        const balance = isYours
          ? await yoursWalletService.getBalance()
          : await walletService.getBalance();
        respond(true, balance);
      } catch (e: unknown) {
        respond(false, undefined, e instanceof Error ? e.message : String(e));
      }
      break;
    }

    case 'getPublicKey':
      if (isYours) {
        respond(false, undefined, 'Public key not available from browser wallet');
      } else {
        respond(true, walletService.getPublicKeyHex());
      }
      break;

    case 'signTransaction':
    case 'sendPayment': {
      if (!request.payload?.toAddress || !request.payload?.amount) {
        respond(false, undefined, 'Missing toAddress or amount');
        return;
      }

      // Require user approval for signing (local wallet only — Yours Wallet shows its own approval)
      if (!isYours && approvalCallback) {
        const approved = await new Promise<boolean>((resolve) => {
          approvalCallback!({ request, origin, source, resolve });
        });
        if (!approved) {
          respond(false, undefined, 'User rejected transaction');
          return;
        }
      }

      try {
        if (isYours) {
          const result = await yoursWalletService.sendBsv(
            request.payload.toAddress,
            request.payload.amount,
            request.payload.memo,
          );
          respond(true, { success: true, txid: result.txid, rawTxHex: result.rawtx, amount: request.payload.amount });
        } else {
          const result: PaymentResult = request.action === 'sendPayment'
            ? await walletService.sendPayment(request.payload.toAddress, request.payload.amount, request.payload.memo)
            : await walletService.signTransaction(request.payload.toAddress, request.payload.amount, request.payload.memo);
          respond(result.success, result, result.error);
        }
      } catch (e: unknown) {
        respond(false, undefined, e instanceof Error ? e.message : String(e));
      }
      break;
    }

    default:
      respond(false, undefined, `Unknown action: ${request.action}`);
  }
}

export function startWalletBridge(): () => void {
  const handler = (event: MessageEvent) => {
    // Validate origin
    if (!ALLOWED_ORIGINS.has(event.origin)) return;

    const data = event.data;
    if (!data || data.type !== 'WALLET_REQUEST' || !data.id || !data.action) return;
    if (!event.source) return;

    handleRequest(data as WalletRequest, event.origin, event.source);
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
