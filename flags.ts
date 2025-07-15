import { promises as dns } from 'dns';
import { createDecipheriv, createHash } from 'crypto';

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

function _getUserRolloutValue(featureName: string, userId: string): number {
    const hash = createHash('sha256');
    hash.update(featureName + userId);
    const digest = hash.digest();
    const value = digest.readUInt32BE(0);
    return (value % 100) + 1;
}

/**
 * Checks if a feature flag is enabled by querying and decrypting a DNS TXT record.
 * @param featureName The name of the feature flag.
 * @param baseDomain Your application's base domain for flags.
 * @param userId The user to evaluate
 * @returns {Promise<boolean>} A promise that resolves to true if the flag is 'on', otherwise false.
 */
export async function isFlagEnabled(featureName: string, baseDomain: string, userId?: string): Promise<boolean> {
    const domain = `${featureName}.${baseDomain}`;
    let flagRule = '';

    const cachedEntry = flagCache.get(domain);
    if (cachedEntry && Date.now() < cachedEntry.expires) {
        flagRule = cachedEntry.value;
    } else {
        const secret = process.env.GHOSTFLAGS_SECRET;
        if (!secret) { return false; }
        try {
            const records = await dns.resolveTxt(domain);
            const encryptedValue = records.flat().join('');
            if (!encryptedValue) throw new Error("Empty TXT record");

            const decryptedFlags = decrypt(encryptedValue, secret);
            flagRule = new URLSearchParams(decryptedFlags.replace(/;/g, '&')).get(featureName) || 'off';

            flagCache.set(domain, { value: flagRule, expires: Date.now() + DEFAULT_CACHE_TTL_MS });
        } catch (error) {
            flagCache.set(domain, { value: 'off', expires: Date.now() + FAILURE_CACHE_TTL_MS });
            return false;
        }
    }

    if (flagRule === 'on') {
        return true;
    }

    if (flagRule.startsWith('rollout=')) {
        const percentage = parseInt(flagRule.split('=')[1], 10);
        if (isNaN(percentage)) return false;

        // A 100% rollout is effectively the same as "on"
        if (percentage >= 100) return true;
        
        // For partial rollouts, a userId is required
        if (!userId) return false;

        const userValue = _getUserRolloutValue(featureName, userId);
        return userValue <= percentage;
    }

    return false; // Default to 'off' for any other value
}
