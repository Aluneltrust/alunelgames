import { Transaction, PrivateKey, P2PKH, Script, SatoshisPerKilobyte, Utils } from '@bsv/sdk';

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  rawTx: string;
  script: string;
}

interface RawUTXO {
  tx_hash: string;
  tx_pos: number;
  value: number;
  /** 0 or absent while unconfirmed. WhatsOnChain sends it; we ignored it. */
  height?: number;
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

// Fee rate: 50 sat/KB (~0.05 sat/byte). Safe for current BSV miner policy.
const FEE_RATE = new SatoshisPerKilobyte(50);
// Rough upper bound for UTXO selection buffer — real fee is computed by tx.fee() after signing.
// Covers ~20 P2PKH inputs at 50 sat/KB with margin.
export const NETWORK_FEE_SATS = 200;
export const DUST_LIMIT = 546;
const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main';

function stringToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class WalletService {
  private privateKey: PrivateKey | null = null;
  private cachedRawUtxos: RawUTXO[] = [];
  private lastUtxoFetch = 0;

  /**
   * Outpoints ("txid:vout") already committed to a transaction this session.
   *
   * WhatsOnChain's unspent index lags the mempool, so an input spent seconds
   * ago can still come back listed as unspent. Selection is deterministic —
   * largest first — so it would pick that same input again and produce a
   * transaction double-spending our own pending one. Nodes reject that with
   * "258: txn-mempool-conflict", which is what players hit funding a second
   * wager shortly after the first.
   *
   * Entries expire: if the spend landed the outpoint stops being listed
   * anyway, and if it never landed the input is genuinely still ours.
   */
  private pendingSpends = new Map<string, number>();
  private static readonly PENDING_TTL_MS = 90_000;

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
    this.cachedRawUtxos = [];
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
    if (!this.privateKey) throw new Error('Wallet not connected');
    const address = this.getAddress();
    // Use the balance endpoint directly — avoids CORS issues with tx/hex enrichment
    try {
      const res = await fetch(`${WOC_BASE}/address/${address}/balance`);
      if (!res.ok) throw new Error(`WOC balance error: ${res.status}`);
      const data = await res.json();
      return (data.confirmed ?? 0) + (data.unconfirmed ?? 0);
    } catch {
      // Fallback: sum raw UTXO list (no per-tx enrichment needed)
      try {
        const raw = await this.getRawUtxos();
        return raw.reduce((sum, u) => sum + u.value, 0);
      } catch {
        return 0;
      }
    }
  }

  private async getRawUtxos(forceRefresh = false): Promise<RawUTXO[]> {
    if (!this.privateKey) throw new Error('Wallet not connected');
    const now = Date.now();
    if (!forceRefresh && this.cachedRawUtxos.length > 0 && now - this.lastUtxoFetch < 15000) {
      return this.cachedRawUtxos;
    }

    const address = this.getAddress();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1500 * attempt));
        const res = await fetch(`${WOC_BASE}/address/${address}/unspent`);
        if (res.status === 429) continue;
        if (!res.ok) throw new Error(`WOC error: ${res.status}`);

        const list: RawUTXO[] = await res.json();
        list.sort((a, b) => b.value - a.value);
        this.cachedRawUtxos = list;
        this.lastUtxoFetch = now;
        return list;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
    return this.cachedRawUtxos;
  }

  private async enrichUtxo(raw: RawUTXO): Promise<UTXO | null> {
    try {
      const txRes = await fetch(`${WOC_BASE}/tx/${raw.tx_hash}/hex`);
      if (!txRes.ok) return null;
      const rawTx = await txRes.text();
      const tx = Transaction.fromHex(rawTx);
      const script = tx.outputs[raw.tx_pos].lockingScript?.toHex() || '';
      return { txid: raw.tx_hash, vout: raw.tx_pos, satoshis: raw.value, rawTx, script };
    } catch {
      return null;
    }
  }

  // Rough size estimate: 10 overhead + 148/input + 34/output + OP_RETURN(memo)
  private estimateFee(numInputs: number, numOutputs: number, memoLen = 0): number {
    const size = 10 + numInputs * 148 + numOutputs * 34 + (memoLen > 0 ? 10 + memoLen : 0);
    return Math.ceil((size / 1000) * 50); // matches FEE_RATE
  }

  private async selectAndEnrich(amountSats: number, memoLen: number): Promise<UTXO[]> {
    const fetched = await this.getRawUtxos(true);

    // Expire stale reservations first, so a transaction that never reached the
    // network does not permanently strand the inputs it tried to use.
    const now = Date.now();
    for (const [key, at] of this.pendingSpends) {
      if (now - at > WalletService.PENDING_TTL_MS) this.pendingSpends.delete(key);
    }

    const rawList = fetched.filter(
      r => !this.pendingSpends.has(`${r.tx_hash}:${r.tx_pos}`),
    );

    if (!rawList.length && fetched.length) {
      throw new Error('Waiting for your previous transaction to confirm — try again shortly');
    }

    // Confirmed inputs first, then largest. Spending our own unconfirmed
    // change is valid and remains a fallback, but preferring settled coins
    // avoids the mempool entirely where possible.
    rawList.sort((a, b) => {
      const aConfirmed = (a.height ?? 0) > 0 ? 1 : 0;
      const bConfirmed = (b.height ?? 0) > 0 ? 1 : 0;
      if (aConfirmed !== bConfirmed) return bConfirmed - aConfirmed;
      return b.value - a.value;
    });

    const selected: UTXO[] = [];
    let total = 0;
    // recipient + change + optional memo
    const outputs = 2 + (memoLen > 0 ? 1 : 0);

    for (const raw of rawList) {
      const fee = Math.max(NETWORK_FEE_SATS, this.estimateFee(selected.length, outputs, memoLen));
      if (total >= amountSats + fee) break;
      const enriched = await this.enrichUtxo(raw);
      if (!enriched) continue;
      selected.push(enriched);
      total += enriched.satoshis;
    }

    const finalFee = Math.max(NETWORK_FEE_SATS, this.estimateFee(selected.length, outputs, memoLen));
    if (total < amountSats + finalFee) {
      throw new Error(`Insufficient funds: need ${amountSats + finalFee}, have ${total}`);
    }

    // Reserve here rather than in each caller, so no future signing path can
    // forget to. Selection is the point of commitment: everything downstream
    // either builds this transaction or throws, and the TTL above releases
    // the reservation if it never made it to the network.
    const reservedAt = Date.now();
    for (const utxo of selected) {
      this.pendingSpends.set(`${utxo.txid}:${utxo.vout}`, reservedAt);
    }

    return selected;
  }

  async signTransaction(toAddress: string, amountSats: number, memo?: string): Promise<PaymentResult> {
    if (!this.privateKey) return { success: false, error: 'Wallet not connected' };
    if (amountSats < DUST_LIMIT) return { success: false, error: `Amount ${amountSats} below dust limit` };

    try {
      const memoLen = memo ? new TextEncoder().encode(memo).length : 0;
      const selected = await this.selectAndEnrich(amountSats, memoLen);

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

      // SDK computes fee from tx size and deducts from the change output.
      // If change falls below dust, it is absorbed into the fee.
      tx.addOutput({ lockingScript: new P2PKH().lock(this.getAddress()), change: true });

      await tx.fee(FEE_RATE);
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
        this.cachedRawUtxos = [];
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
    // Cheap shape check first — rejects obvious junk without throwing.
    if (!/^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false;
    try {
      const decoded = Utils.fromBase58Check(address);
      // Mainnet P2PKH: version byte 0x00, 20-byte hash160
      const prefix = Array.isArray(decoded.prefix) ? decoded.prefix[0] : decoded.prefix;
      return prefix === 0 && decoded.data.length === 20;
    } catch {
      return false;
    }
  }
}

export const walletService = new WalletService();
