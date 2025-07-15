import { promises as dns } from 'dns';
import { createDecipheriv, createHash } from 'crypto';

// --- Configuration ---
const CONFIG_RECORD_NAME = 'ripple'; // The name of the single TXT record.
const DEFAULT_CACHE_TTL_MS = 60 * 1000; // Cache the entire config for 60 seconds.
const FAILURE_CACHE_TTL_MS = 10 * 1000; // Cache failures for 10 seconds.

// The cache stores the entire parsed flag configuration object.
const configCache = new Map<string, { value: Record<string, string>; expires: number }>();

// --- Cryptography ---
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

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

async function getFlagConfig(baseDomain: string): Promise<Record<string, string>> {
    const cachedEntry = configCache.get(baseDomain);
    if (cachedEntry && Date.now() < cachedEntry.expires) {
        return cachedEntry.value;
    }

    const secret = process.env.RIPPLE_SECRET;
    if (!secret || secret.length !== 64) {
        console.error('RIPPLE_SECRET environment variable is not set or is not a 64-character hex string.');
        return {};
    }

    try {
        const domain = `${CONFIG_RECORD_NAME}.${baseDomain}`;
        const records = await dns.resolveTxt(domain);
        const encryptedValue = records.flat().join('');
        if (!encryptedValue) throw new Error("Empty TXT record");

        const decryptedJson = decrypt(encryptedValue, secret);
        const config = JSON.parse(decryptedJson);
        
        configCache.set(baseDomain, { value: config, expires: Date.now() + DEFAULT_CACHE_TTL_MS });
        return config;
    } catch (error) {
        configCache.set(baseDomain, { value: {}, expires: Date.now() + FAILURE_CACHE_TTL_MS });
        return {};
    }
}

export async function isFlagEnabled(featureName: string, baseDomain: string, userId?: string): Promise<boolean> {
    const config = await getFlagConfig(baseDomain);
    const flagRule = config[featureName] || 'off';

    if (flagRule === 'on') {
        return true;
    }

    if (flagRule.startsWith('rollout=')) {
        const percentage = parseInt(flagRule.split('=')[1], 10);
        if (isNaN(percentage)) return false;
        if (percentage >= 100) return true;
        if (!userId) return false;

        const userValue = _getUserRolloutValue(featureName, userId);
        return userValue <= percentage;
    }

    return false;
}
