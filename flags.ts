import { promises as dns } from 'dns';

/**
 * Checks if a feature flag is enabled by querying a DNS TXT record.
 * This function is designed for server-side use in Next.js.
 * @param featureName The name of the feature flag (e.g., 'new-header').
 * @param baseDomain Your application's domain for flags (e.g., 'flags.yourdomain.com').
 * @returns {Promise<boolean>} A promise that resolves to true if the flag is 'on', otherwise false.
 */
export async function isFlagEnabled(featureName: string, baseDomain: string): Promise<boolean> {
  // Construct the full domain name to query.
  // Example: 'new-header.flags.yourdomain.com'
  const domain = `${featureName}.${baseDomain}`;

  try {
    // Perform the DNS lookup for the TXT record.
    const records = await dns.resolveTxt(domain);
    
    // resolveTxt returns an array of arrays of strings. Flatten and join them.
    const flagValue = records.flat().join('');

    // The feature is enabled if the TXT record's value is exactly "on".
    return flagValue === 'on';
  } catch (error) {
    // If the DNS record doesn't exist or another error occurs,
    // safely assume the feature is disabled.
    console.error(`DNS flag check failed for ${domain}:`, error);
    return false;
  }
}
