import type { YoursProviderType, Balance, Addresses } from 'yours-wallet-provider';

declare global {
  interface Window {
    yours?: YoursProviderType;
  }
}

export class YoursWalletService {
  private provider: YoursProviderType | null = null;
  private address = '';

  isExtensionAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.yours?.isReady;
  }

  async connect(): Promise<{ address: string }> {
    if (!this.isExtensionAvailable()) {
      throw new Error('Yours Wallet extension not detected. Please install it first.');
    }

    this.provider = window.yours!;
    const identityAddress = await this.provider.connect();
    if (!identityAddress) {
      throw new Error('Connection rejected by user');
    }

    const addresses: Addresses | undefined = await this.provider.getAddresses();
    if (!addresses?.bsvAddress) {
      throw new Error('Could not retrieve BSV address');
    }

    this.address = addresses.bsvAddress;
    return { address: this.address };
  }

  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
    }
    this.provider = null;
    this.address = '';
  }

  isConnected(): boolean {
    return this.provider !== null && this.address !== '';
  }

  getAddress(): string {
    if (!this.address) throw new Error('Yours Wallet not connected');
    return this.address;
  }

  async getBalance(): Promise<number> {
    if (!this.provider) throw new Error('Yours Wallet not connected');
    const balance: Balance | undefined = await this.provider.getBalance();
    return balance?.satoshis ?? 0;
  }

  async sendBsv(toAddress: string, satoshis: number, memo?: string): Promise<{ txid: string; rawtx: string }> {
    if (!this.provider) throw new Error('Yours Wallet not connected');

    const params: { address: string; satoshis: number; data?: string[] }[] = [
      { address: toAddress, satoshis },
    ];

    if (memo) {
      params[0].data = [memo];
    }

    const result = await this.provider.sendBsv(params);
    if (!result) {
      throw new Error('Transaction rejected by user');
    }
    return result;
  }
}

export const yoursWalletService = new YoursWalletService();
