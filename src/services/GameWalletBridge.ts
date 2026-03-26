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

// Discover the parent's origin via handshake
function initHandshake(): Promise<string> {
  if (parentOrigin) return Promise.resolve(parentOrigin);

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      const data = event.data as BridgeReady;
      if (data?.type === 'WALLET_BRIDGE_READY' && data.origin) {
        parentOrigin = data.origin;
        window.removeEventListener('message', handler);
        resolve(parentOrigin);
      }
    };

    window.addEventListener('message', handler);

    // Request handshake — use '*' only for this init message
    window.parent.postMessage({ type: 'WALLET_BRIDGE_INIT' }, '*');

    // Fallback: if no handshake response in 2s, use '*' (backwards compat)
    setTimeout(() => {
      if (!parentOrigin) {
        window.removeEventListener('message', handler);
        parentOrigin = '*';
        resolve('*');
      }
    }, 2000);
  });
}

function sendRequest(action: string, payload?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `wallet_${++requestId}_${Date.now()}`;

    const handler = (event: MessageEvent) => {
      const data = event.data as WalletResponse;
      if (data?.type !== 'WALLET_RESPONSE' || data.id !== id) return;

      // Validate origin if we know it
      if (parentOrigin && parentOrigin !== '*' && event.origin !== parentOrigin) return;

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
      window.removeEventListener('message', handler);
      reject(new Error('Wallet request timed out'));
    }, 60000);

    const target = parentOrigin || '*';
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

// Auto-init handshake when embedded
if (gameWallet.isEmbedded()) {
  initHandshake();
}
