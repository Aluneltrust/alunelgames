import { useState, useCallback, useEffect } from 'react';
import { walletService } from '../services/WalletService';
import { yoursWalletService } from '../services/YoursWalletService';
import {
  encryptAndStoreWif,
  decryptStoredWif,
  hasStoredWallet,
  getAddressHint,
  deleteStoredWallet,
} from '../services/pinCrypto';

export type WalletSource = 'local' | 'yours';

export interface WalletHook {
  address: string;
  balance: number;
  connected: boolean;
  loading: boolean;
  hasStored: boolean;
  addressHint: string | null;
  walletSource: WalletSource | null;
  yoursAvailable: boolean;
  createWallet: (pin: string) => Promise<void>;
  importWallet: (wif: string, pin: string) => Promise<void>;
  unlockWallet: (pin: string) => Promise<void>;
  connectYoursWallet: () => Promise<void>;
  disconnectWallet: () => void;
  deleteWallet: () => void;
  refreshBalance: () => Promise<void>;
  exportWif: () => string;
}

export function useWallet(): WalletHook {
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasStored, setHasStored] = useState(hasStoredWallet());
  const [addressHint, setAddressHint] = useState<string | null>(getAddressHint());
  const [walletSource, setWalletSource] = useState<WalletSource | null>(null);
  const [yoursAvailable, setYoursAvailable] = useState(false);

  // Check for Yours Wallet extension on mount (may load after DOM)
  useEffect(() => {
    const check = () => setYoursAvailable(yoursWalletService.isExtensionAvailable());
    check();
    // Extension may inject after page load
    const timer = setTimeout(check, 1000);
    return () => clearTimeout(timer);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!connected || !walletSource) return;
    try {
      const bal = walletSource === 'yours'
        ? await yoursWalletService.getBalance()
        : await walletService.getBalance();
      setBalance(bal);
    } catch (e) {
      console.error('Balance refresh failed:', e);
    }
  }, [connected, walletSource]);

  const connectWithWif = useCallback(async (wif: string) => {
    const state = walletService.connect(wif);
    setAddress(state.address);
    setConnected(true);
    setWalletSource('local');
    setLoading(true);
    try {
      const bal = await walletService.getBalance();
      setBalance(bal);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWallet = useCallback(async (pin: string) => {
    const state = walletService.connect();
    const wif = walletService.exportWif();
    await encryptAndStoreWif(wif, pin, state.address);
    setAddress(state.address);
    setConnected(true);
    setWalletSource('local');
    setBalance(0);
    setHasStored(true);
    setAddressHint(state.address);
  }, []);

  const importWallet = useCallback(async (wif: string, pin: string) => {
    await connectWithWif(wif);
    const addr = walletService.getAddress();
    await encryptAndStoreWif(wif, pin, addr);
    setHasStored(true);
    setAddressHint(addr);
  }, [connectWithWif]);

  const unlockWallet = useCallback(async (pin: string) => {
    const wif = await decryptStoredWif(pin);
    await connectWithWif(wif);
  }, [connectWithWif]);

  const connectYoursWallet = useCallback(async () => {
    setLoading(true);
    try {
      const { address: addr } = await yoursWalletService.connect();
      setAddress(addr);
      setConnected(true);
      setWalletSource('yours');
      const bal = await yoursWalletService.getBalance();
      setBalance(bal);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    if (walletSource === 'yours') {
      yoursWalletService.disconnect();
    } else {
      walletService.disconnect();
    }
    setAddress('');
    setBalance(0);
    setConnected(false);
    setWalletSource(null);
  }, [walletSource]);

  const deleteWallet = useCallback(() => {
    walletService.disconnect();
    deleteStoredWallet();
    setAddress('');
    setBalance(0);
    setConnected(false);
    setWalletSource(null);
    setHasStored(false);
    setAddressHint(null);
  }, []);

  const exportWif = useCallback(() => {
    if (walletSource === 'yours') throw new Error('Cannot export key from browser wallet');
    return walletService.exportWif();
  }, [walletSource]);

  // Auto-refresh balance every 30s
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [connected, refreshBalance]);

  return {
    address, balance, connected, loading,
    hasStored, addressHint, walletSource, yoursAvailable,
    createWallet, importWallet, unlockWallet, connectYoursWallet,
    disconnectWallet, deleteWallet, refreshBalance, exportWif,
  };
}
