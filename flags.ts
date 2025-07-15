import { promises as dns } from 'dns';
import { createDecipheriv } from 'crypto';

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
  const secret = process.env.RIPPLE_SECRET;

  if (!secret || secret.length !== 64) {
    console.error('RIPPLE_SECRET environment variable is not set or is not a 64-character hex string.');
    return false;
  }
  
  try {
    const records = await dns.resolveTxt(domain);
    const encryptedValue = records.flat().join('');
    
    const decryptedFlags = decrypt(encryptedValue, secret);
    
    // Simple parsing logic for "key=value"
    const flagValue = new URLSearchParams(decryptedFlags.replace(/;/g, '&')).get(featureName);

    return flagValue === 'on';
  } catch (error) {
    return false;
  }
}
