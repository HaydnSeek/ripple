# Ripple

> Ripple is a simple, open-source feature flagging tool that leverages global DNS infrastructure to deliver configurations via TXT records for ultra-fast, serverless evaluations.

It delivers feature flags with **sub-10ms latency** and **zero infrastructure** by reading simple configurations from your existing DNS provider.

***

### Why Ripple?

Traditional feature flag systems require you to manage a separate service, which introduces another point of failure, added latency, and cost. Ripple avoids all of that.

- 🚀 **Blazing Fast**: Leverages the global DNS network, one of the fastest and most resilient distributed systems in the world.
- 0️⃣ **Zero Infrastructure**: No servers to manage, no databases to scale. Your DNS provider does all the work.
- 💀 **Dead Simple**: The core idea is a single function that checks a DNS record. That's it.
- 🌐 **Globally Distributed**: inherently global, providing low-latency responses to users anywhere.

***

### How It Works

The magic is in its simplicty.
1. You create a **TXT record** on a domain you control (e.g., `new-feature.flags.yourdomain.com`).
2. You set the value of that record to "on".
3. In your app, Ripple performs a DNS lookup for that specific record.
4. If the record exists and its value is "on", the feature is enabled. Otherwise, it's off.

This is especially powerful in server-side implementations like **Next.js Server Components**, where the check happens on the server with no impact on your client-side bundle size.

***

### Getting Started

Ripple is designed to be dropped directly into your project.

#### 1. Create the Utility File

Create a new file at `lib/flags.ts` in your Next.js project and add the following code:

```typescript
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
```
#### Set Up Your DNS Record

In your DNS provider (Cloudflare, Vercel, GoDaddy, etc.), create a **TXT record**
- **Type**: `TXT`
- **Name/Host**: `new-header.flags.yourdomain.com`
- **Value**: `"on"`
- **TTL**: `60` (a low TTL like 60 seconds is recommended for faster updates)

#### Use It in Your App

Now you can use the function in any Server Component to conditionally render UI.
```typescript
// app/page.tsx
import { isFlagEnabled } from '@/lib/flags';

export default async function HomePage() {
  const flagDomain = 'flags.yourdomain.com';
  const showNewHeader = await isFlagEnabled('new-header', flagDomain);

  return (
    <main>
      {showNewHeader ? (
        <header><h1>✨ The New Header! ✨</h1></header>
      ) : (
        <header><h1>The Old Header</h1></header>
      )}
      <p>Welcome to the site.</p>
    </main>
  );
}
```
***
### Important Considerations

Ripple is powerful but has trade-offs you should understand.
- **DNS Propogation Delay**: Changes to DNS records are **not instant**. They are subject to the record's TTL (Time-To-Live). A 60-second TTL means it can take at least a minute for changes to be reflected globally. This makes Ripple unsuitable for flags that need to be disabled instantly in an emergency.
- **Public Visibility**: DNS records are public. Anyone can look them up. **Do not** store sensitive information in your flag names or values.
- **No Advanced Targeting**: Ripple is for simple, global, boolean on/off switches. It does not support percentage-based rollouts, user attribute targeting, or complex rules.

***

### Contributing
Contributions are welcome! Please feel free to open an issue or submit a pull request.

### License

This project is licensed under the MIT License.
