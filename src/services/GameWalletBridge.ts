// ============================================================================
// GAME WALLET BRIDGE (Drop-in for games)
// ============================================================================
// This file is meant to be copied into each game's frontend to replace
// their local BsvWalletService. Instead of holding a private key locally,
// it communicates with the parent AlunelGames app via postMessage.
//
// Usage in a game:
//   import { gameWallet } from './GameWalletBridge';
//   const address = await gameWallet.getAddress();
//   const result = await gameWallet.signTransaction(escrowAddr, 1000, 'wager');
// ============================================================================

const BRIDGE_VERSION = 1;

let requestId = 0;
let parentOrigin: string | null = null;

interface WalletResponse {
  type: 'WALLET_RESPONSE';
  version?: number;
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

interface BridgeReady {
  type: 'WALLET_BRIDGE_READY';
  version: number;
  origin: string;
}

// Origins permitted to act as the parent. Anything else is ignored outright.
// This list is the entire trust boundary — a game that widens it, or that
// derives the parent from the message body, has no trust boundary at all.
const ALLOWED_PARENT_ORIGINS = new Set<string>([
  'https://alunelgames.com',
  'https://www.alunelgames.com',
  'https://alunelgames.netlify.app',
  'https://alunel.games',
  'https://www.alunel.games',
]);

/**
 * Discover the parent's origin via handshake.
 *
 * Two rules make this safe, and both were previously missing:
 *
 *  1. The origin is taken from `event.origin`, which the browser sets and no
 *     sender can forge. It used to be read from `data.origin` — a field in
 *     the message body, chosen by whoever sent it. Any page could frame the
 *     game, announce itself as AlunelGames, and become the trusted parent.
 *
 *  2. There is no '*' fallback. The old 2-second timeout set parentOrigin to
 *     '*', which then disabled the response-origin check further down
 *     (`parentOrigin !== '*'` short-circuits it) and broadcast every outbound
 *     request to any listener. Failing closed is the only safe default when
 *     the counterparty cannot be identified.
 */
function initHandshake(): Promise<string> {
  if (parentOrigin) return Promise.resolve(parentOrigin);

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      // Validate the origin BEFORE looking at the payload.
      if (!ALLOWED_PARENT_ORIGINS.has(event.origin)) return;

      const data = event.data as BridgeReady;
      if (data?.type !== 'WALLET_BRIDGE_READY') return;

      parentOrigin = event.origin;
      window.removeEventListener('message', handler);
      clearTimeout(timeoutId);
      resolve(parentOrigin);
    };

    window.addEventListener('message', handler);

    // The INIT probe carries no secrets, so a wildcard target is acceptable
    // here — we simply do not act on any reply we cannot attribute.
    window.parent.postMessage({ type: 'WALLET_BRIDGE_INIT' }, '*');

    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('No trusted parent wallet detected'));
    }, 2000);
  });
}

function sendRequest(action: string, payload?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // Unguessable. The id was a counter plus a millisecond timestamp, which an
    // attacker who could see or predict it could use to race a forged reply
    // against the real one.
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? `wallet_${crypto.randomUUID()}`
      : `wallet_${++requestId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Fail closed: without an identified parent there is nobody to ask.
    const target = parentOrigin;
    if (!target || target === '*') {
      reject(new Error('No trusted parent wallet — call gameWallet.init() first'));
      return;
    }

    let settled = false;

    const handler = (event: MessageEvent) => {
      // Unconditional origin check — no escape hatch for an unknown parent.
      if (event.origin !== target) return;

      const data = event.data as WalletResponse;
      if (data?.type !== 'WALLET_RESPONSE' || data.id !== id) return;
      if (settled) return;
      settled = true;

      clearTimeout(timeoutId);
      window.removeEventListener('message', handler);
      if (data.success) {
        resolve(data.data);
      } else {
        reject(new Error(data.error || 'Wallet request failed'));
      }
    };

    window.addEventListener('message', handler);

    // Timeout after 60s (user may need time to approve)
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', handler);
      reject(new Error('Wallet request timed out'));
    }, 60000);

    window.parent.postMessage(
      { type: 'WALLET_REQUEST', version: BRIDGE_VERSION, id, action, payload },
      target,
    );
  });
}

export const gameWallet = {
  async init(): Promise<void> {
    await initHandshake();
  },

  async getAddress(): Promise<string> {
    return sendRequest('getAddress') as Promise<string>;
  },

  async getBalance(): Promise<number> {
    return sendRequest('getBalance') as Promise<number>;
  },

  async getPublicKey(): Promise<string> {
    return sendRequest('getPublicKey') as Promise<string>;
  },

  async getUsername(): Promise<string> {
    return sendRequest('getUsername') as Promise<string>;
  },

  async signTransaction(toAddress: string, amount: number, memo?: string) {
    return sendRequest('signTransaction', { toAddress, amount, memo });
  },

  async sendPayment(toAddress: string, amount: number, memo?: string) {
    return sendRequest('sendPayment', { toAddress, amount, memo });
  },

  isEmbedded(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  },
};

// Auto-init handshake when embedded.
//
// The rejection is swallowed deliberately: being framed by something other
// than AlunelGames is a normal, expected outcome, not an error the page
// should surface. sendRequest() re-checks and fails closed on its own, so
// nothing proceeds on an unidentified parent. Without this catch, every such
// load would raise an unhandled promise rejection.
if (gameWallet.isEmbedded()) {
  initHandshake().catch(() => { /* no trusted parent; bridge stays unavailable */ });
}
