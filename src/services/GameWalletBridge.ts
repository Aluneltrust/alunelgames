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

let requestId = 0;

interface WalletResponse {
  type: 'WALLET_RESPONSE';
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

function sendRequest(action: string, payload?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = `wallet_${++requestId}_${Date.now()}`;

    const handler = (event: MessageEvent) => {
      const data = event.data as WalletResponse;
      if (data?.type !== 'WALLET_RESPONSE' || data.id !== id) return;
      window.removeEventListener('message', handler);
      if (data.success) {
        resolve(data.data);
      } else {
        reject(new Error(data.error || 'Wallet request failed'));
      }
    };

    window.addEventListener('message', handler);

    // Timeout after 60s (user may need time to approve)
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Wallet request timed out'));
    }, 60000);

    window.parent.postMessage(
      { type: 'WALLET_REQUEST', id, action, payload },
      '*', // Parent origin — games don't know the parent's origin
    );
  });
}

export const gameWallet = {
  async getAddress(): Promise<string> {
    return sendRequest('getAddress') as Promise<string>;
  },

  async getBalance(): Promise<number> {
    return sendRequest('getBalance') as Promise<number>;
  },

  async getPublicKey(): Promise<string> {
    return sendRequest('getPublicKey') as Promise<string>;
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
