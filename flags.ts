import { promises as dns } from 'dns';
import { createDecipheriv } from 'crypto';

// --- Caching Configuration
const DEFAULT_CACHE_TTL_MS = 60 * 1000; // Cache results for 60 seconds by default.
const FAILURE_CACHE_TTL_MS = 60 * 1000; // Cache failures for 10 seconds.
const flagCache = new Map<string, { value: boolean; expires: number }>();

// --- Cryptography Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for AES-GCM

/**
 * Decrypts the flag configuration using a shared secret.
 * @param encryptedText The base64 encrypted text from the TXT record.
 * @param secret The 32-byte secret key from environment variables.
 * @returns {string} The decrypted plaintext string.
 */
function decrypt(encryptedText: string, secret: string): string {
  const buffer = Buffer.from(encryptedText, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(secret, 'hex'), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

/**
 * Checks if a feature flag is enabled by querying and decrypting a DNS TXT record.
 * @param featureName The name of the feature flag.
 * @param baseDomain Your application's base domain for flags.
 * @returns {Promise<boolean>} A promise that resolves to true if the flag is 'on', otherwise false.
 */
export async function isFlagEnabled(featureName: string, baseDomain: string): Promise<boolean> {
  const domain = `${featureName}.${baseDomain}`;
  // 1. Check the cache first
  const cachedEntry = flagCache.get(domain);
  if (cachedEntry && Date.now() < cachedEntry.expires) {
    return cachedEntry.value
  }
  
  const secret = process.env.RIPPLE_SECRET;

  if (!secret || secret.length !== 64) {
    console.error('RIPPLE_SECRET environment variable is not set or is not a 64-character hex string.');
    return false;
  }
  
  try {
    const records = await dns.resolveTxt(domain);
    const encryptedValue = records.flat().join('');

    if (!encryptedValue) {
      throw new Error('Empty TXT record');
    }
    
    const decryptedFlags = decrypt(encryptedValue, secret);
  
    const flagValue = new URLSearchParams(decryptedFlags.replace(/;/g, '&')).get(featureName);

    const isEnabled = flagValue === 'on';
    // 2. On success, cache the result
    flagCache.set(domain, { value: isEnabled, expires: Date.now() + DEFAULT_CACHE_TTL_MS });
    return isEnabled;
  } catch (error) {
    // 3. On failure, cache a 'false' result for a shorter duration
    flagCache.set(domain, { value: false, expires: Date.now() + FAILURE_CACHE_TTL_MS });
    return false;
  }
}
