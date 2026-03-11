import { Transaction, PrivateKey, P2PKH, Script } from '@bsv/sdk';

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  rawTx: string;
  script: string;
}

export interface PaymentResult {
  success: boolean;
  txid?: string;
  rawTxHex?: string;
  amount?: number;
  error?: string;
}

export interface WalletState {
  connected: boolean;
  address: string;
  balance: number;
  publicKey: string;
}

const NETWORK_FEE_SATS = 100;
const DUST_LIMIT = 546;
const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main';

function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class WalletService {
  private privateKey: PrivateKey | null = null;
  private cachedUtxos: UTXO[] = [];
  private lastUtxoFetch = 0;

  connect(wif?: string): WalletState {
    this.privateKey = wif ? PrivateKey.fromWif(wif) : PrivateKey.fromRandom();
    return {
      connected: true,
      address: this.getAddress(),
      balance: 0,
      publicKey: this.getPublicKeyHex(),
    };
  }

  disconnect(): void {
    this.privateKey = null;
    this.cachedUtxos = [];
  }

  isConnected(): boolean {
    return this.privateKey !== null;
  }

  getAddress(): string {
    if (!this.privateKey) throw new Error('Wallet not connected');
    return this.privateKey.toPublicKey().toAddress('mainnet');
  }

  getPublicKeyHex(): string {
    if (!this.privateKey) throw new Error('Wallet not connected');
    return this.privateKey.toPublicKey().toString();
  }

  exportWif(): string {
    if (!this.privateKey) throw new Error('Wallet not connected');
    return this.privateKey.toWif();
  }

  async getBalance(): Promise<number> {
    const utxos = await this.getUtxos();
    return utxos.reduce((sum, u) => sum + u.satoshis, 0);
  }

  async getUtxos(forceRefresh = false): Promise<UTXO[]> {
    if (!this.privateKey) throw new Error('Wallet not connected');
    const now = Date.now();
    if (!forceRefresh && this.cachedUtxos.length > 0 && now - this.lastUtxoFetch < 15000) {
      return this.cachedUtxos;
    }

    const address = this.getAddress();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
        const res = await fetch(`${WOC_BASE}/address/${address}/unspent`);
        if (res.status === 429) continue;
        if (!res.ok) throw new Error(`WOC error: ${res.status}`);

        const list = await res.json();
        list.sort((a: { value: number }, b: { value: number }) => b.value - a.value);

        const enriched: UTXO[] = [];
        for (const utxo of list.slice(0, 5)) {
          try {
            const txRes = await fetch(`${WOC_BASE}/tx/${utxo.tx_hash}/hex`);
            if (!txRes.ok) continue;
            const rawTx = await txRes.text();
            const tx = Transaction.fromHex(rawTx);
            const script = tx.outputs[utxo.tx_pos].lockingScript?.toHex() || '';
            enriched.push({ txid: utxo.tx_hash, vout: utxo.tx_pos, satoshis: utxo.value, rawTx, script });
          } catch { /* skip */ }
        }

        this.cachedUtxos = enriched;
        this.lastUtxoFetch = now;
        return enriched;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    return this.cachedUtxos;
  }

  private selectUtxos(amount: number, utxos: UTXO[]): UTXO[] {
    const sorted = [...utxos].sort((a, b) => b.satoshis - a.satoshis);
    const selected: UTXO[] = [];
    let total = 0;
    for (const utxo of sorted) {
      selected.push(utxo);
      total += utxo.satoshis;
      if (total >= amount) break;
    }
    if (total < amount) throw new Error(`Insufficient funds: need ${amount}, have ${total}`);
    return selected;
  }

  async signTransaction(toAddress: string, amountSats: number, memo?: string): Promise<PaymentResult> {
    if (!this.privateKey) return { success: false, error: 'Wallet not connected' };
    if (amountSats < DUST_LIMIT) return { success: false, error: `Amount ${amountSats} below dust limit` };

    try {
      const utxos = await this.getUtxos(true);
      const totalNeeded = amountSats + NETWORK_FEE_SATS;
      const selected = this.selectUtxos(totalNeeded, utxos);
      const totalInput = selected.reduce((s, u) => s + u.satoshis, 0);

      const tx = new Transaction();
      for (const utxo of selected) {
        tx.addInput({
          sourceTransaction: Transaction.fromHex(utxo.rawTx),
          sourceOutputIndex: utxo.vout,
          unlockingScriptTemplate: new P2PKH().unlock(this.privateKey),
        });
      }

      tx.addOutput({ lockingScript: new P2PKH().lock(toAddress), satoshis: amountSats });

      if (memo) {
        tx.addOutput({
          lockingScript: Script.fromASM(`OP_FALSE OP_RETURN ${stringToHex(memo)}`),
          satoshis: 0,
        });
      }

      const change = totalInput - amountSats - NETWORK_FEE_SATS;
      if (change > DUST_LIMIT) {
        tx.addOutput({ lockingScript: new P2PKH().lock(this.getAddress()), satoshis: change });
      }

      await tx.sign();
      return { success: true, rawTxHex: tx.toHex(), amount: amountSats };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async broadcastTransaction(rawTx: string): Promise<{ success: boolean; txid?: string; error?: string }> {
    try {
      const res = await fetch(`${WOC_BASE}/tx/raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txhex: rawTx }),
      });
      const text = await res.text();
      if (res.ok) {
        this.cachedUtxos = [];
        return { success: true, txid: text.replace(/"/g, '') };
      }
      return { success: false, error: text };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async sendPayment(toAddress: string, amount: number, memo?: string): Promise<PaymentResult> {
    const result = await this.signTransaction(toAddress, amount, memo);
    if (!result.success || !result.rawTxHex) return result;
    const broadcast = await this.broadcastTransaction(result.rawTxHex);
    return { ...result, ...broadcast };
  }

  static isValidAddress(address: string): boolean {
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
  }
}

export const walletService = new WalletService();
