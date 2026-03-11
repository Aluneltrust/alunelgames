const STORAGE_KEY = 'alunel_master_wallet';
const PBKDF2_ITERATIONS = 100_000;

interface EncryptedWallet {
  salt: string;
  iv: string;
  ciphertext: string;
  addressHint?: string;
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(pin: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const pinBytes = new TextEncoder().encode(pin);
  const baseKey = await crypto.subtle.importKey('raw', pinBytes, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function validatePin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
}

export async function encryptAndStoreWif(wif: string, pin: string, addressHint?: string): Promise<void> {
  validatePin(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt.buffer);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(wif));
  const stored: EncryptedWallet = {
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    ciphertext: toBase64(ciphertext),
    addressHint,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function decryptStoredWif(pin: string): Promise<string> {
  validatePin(pin);
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) throw new Error('No wallet stored');
  const stored: EncryptedWallet = JSON.parse(raw);
  if (!stored.salt || !stored.iv || !stored.ciphertext) throw new Error('Invalid wallet format');
  const key = await deriveKey(pin, fromBase64(stored.salt));
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(fromBase64(stored.iv)) },
      key,
      fromBase64(stored.ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error('Wrong PIN');
  }
}

export function hasStoredWallet(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function getAddressHint(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).addressHint || null;
  } catch {
    return null;
  }
}

export function deleteStoredWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function changePin(oldPin: string, newPin: string): Promise<void> {
  const wif = await decryptStoredWif(oldPin);
  const hint = getAddressHint();
  await encryptAndStoreWif(wif, newPin, hint || undefined);
}
