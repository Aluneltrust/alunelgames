import { walletService, WalletService } from './WalletService';
import type { PaymentResult } from './WalletService';
import { yoursWalletService } from './YoursWalletService';
import type { WalletSource } from '../hooks/useWallet';
import { GAMES } from '../games';

const BRIDGE_VERSION = 1;
const MAX_PAYMENT_SATS = 21_000_000 * 1e8;
const DUST_LIMIT = 546;

// Message types between parent (this app) and child iframes (games)
export interface WalletRequest {
  type: 'WALLET_REQUEST';
  version?: number;
  id: string;
  action: 'getAddress' | 'getBalance' | 'getPublicKey' | 'getUsername' | 'signTransaction' | 'sendPayment';
  payload?: {
    toAddress?: string;
    amount?: number;
    memo?: string;
  };
}

export interface WalletResponse {
  type: 'WALLET_RESPONSE';
  version: number;
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export type PendingApproval = {
  request: WalletRequest;
  origin: string;
  source: MessageEventSource;
  resolve: (approved: boolean) => void;
};

// Provider interface — injected once at init, reads live values via getters
export interface WalletProvider {
  getSource: () => WalletSource | null;
  getBalance: () => number;
}

let provider: WalletProvider | null = null;
let approvalCallback: ((pending: PendingApproval) => void) | null = null;
let pendingApprovalId: string | null = null;

export function setApprovalCallback(cb: (pending: PendingApproval) => void): void {
  approvalCallback = cb;
}

// Derive allowed origins from game registry + production domains
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  ...GAMES.map(g => new URL(g.url).origin),
  'https://royalsonchain.com',
  'https://www.royalsonchain.com',
  'https://sheeponchain.com',
  'https://www.sheeponchain.com',
]);

function sendResponse(source: MessageEventSource, response: WalletResponse, origin: string): void {
  (source as Window).postMessage(response, origin);
}

function sendHandshake(source: MessageEventSource, origin: string): void {
  (source as Window).postMessage(
    { type: 'WALLET_BRIDGE_READY', version: BRIDGE_VERSION, origin: window.location.origin },
    origin,
  );
}

async function handleRequest(request: WalletRequest, origin: string, source: MessageEventSource): Promise<void> {
  const respond = (success: boolean, data?: unknown, error?: string) => {
    sendResponse(source, { type: 'WALLET_RESPONSE', version: BRIDGE_VERSION, id: request.id, success, data, error }, origin);
  };

  // Username doesn't require wallet connection
  if (request.action === 'getUsername') {
    respond(true, localStorage.getItem('alunel_username') || '');
    return;
  }

  if (!provider) {
    respond(false, undefined, 'Bridge not initialized');
    return;
  }

  const walletSource = provider.getSource();
  const isYours = walletSource === 'yours';
  const isWalletConnected = isYours ? yoursWalletService.isConnected() : walletService.isConnected();

  if (!isWalletConnected) {
    respond(false, undefined, 'Wallet not connected');
    return;
  }

  switch (request.action) {
    case 'getAddress':
      respond(true, isYours ? yoursWalletService.getAddress() : walletService.getAddress());
      break;

    case 'getBalance':
      respond(true, provider.getBalance());
      break;

    case 'getPublicKey':
      if (isYours) {
        respond(false, undefined, 'Public key not available from browser wallet');
      } else {
        respond(true, walletService.getPublicKeyHex());
      }
      break;

    case 'signTransaction':
    case 'sendPayment': {
      const { toAddress, amount, memo } = request.payload ?? {};

      if (!toAddress || !amount) {
        respond(false, undefined, 'Missing toAddress or amount');
        return;
      }

      // Validate address format
      if (!WalletService.isValidAddress(toAddress)) {
        respond(false, undefined, 'Invalid BSV address');
        return;
      }

      // Validate amount is a positive integer within bounds
      if (!Number.isInteger(amount) || amount < DUST_LIMIT || amount > MAX_PAYMENT_SATS) {
        respond(false, undefined, `Invalid amount: must be integer between ${DUST_LIMIT} and ${MAX_PAYMENT_SATS}`);
        return;
      }

      // Reject concurrent approval requests
      if (pendingApprovalId) {
        respond(false, undefined, 'Another transaction is pending approval');
        return;
      }

      // Require user approval for signing (local wallet only — Yours Wallet shows its own approval)
      if (!isYours && approvalCallback) {
        pendingApprovalId = request.id;
        const approved = await new Promise<boolean>((resolve) => {
          approvalCallback!({ request, origin, source, resolve });
        });
        pendingApprovalId = null;

        if (!approved) {
          respond(false, undefined, 'User rejected transaction');
          return;
        }
      }

      try {
        if (isYours) {
          const result = await yoursWalletService.sendBsv(toAddress, amount, memo);
          respond(true, { success: true, txid: result.txid, rawTxHex: result.rawtx, amount });
        } else {
          const result: PaymentResult = request.action === 'sendPayment'
            ? await walletService.sendPayment(toAddress, amount, memo)
            : await walletService.signTransaction(toAddress, amount, memo);
          respond(result.success, result, result.error);
        }
      } catch (e: unknown) {
        respond(false, undefined, e instanceof Error ? e.message : String(e));
      }
      break;
    }

    default:
      respond(false, undefined, `Unknown action: ${(request as WalletRequest).action}`);
  }
}

export function startWalletBridge(walletProvider: WalletProvider): () => void {
  provider = walletProvider;

  const handler = (event: MessageEvent) => {
    // Validate origin
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    if (!event.source) return;

    const data = event.data;

    // Respond to handshake requests from games
    if (data?.type === 'WALLET_BRIDGE_INIT') {
      sendHandshake(event.source, event.origin);
      return;
    }

    if (!data || data.type !== 'WALLET_REQUEST' || !data.id || !data.action) return;

    handleRequest(data as WalletRequest, event.origin, event.source);
  };

  window.addEventListener('message', handler);
  return () => {
    window.removeEventListener('message', handler);
    provider = null;
  };
}
