# Ripple

> Ripple is a simple, open-source feature flagging tool that leverages global DNS infrastructure to deliver configurations via TXT records for ultra-fast, serverless evaluations.

It delivers feature flags with **sub-10ms latency** and **zero infrastructure** by reading encrypted configurations from your existing DNS provider.

***

### Why Ripple?

Traditional feature flag systems require you to manage a separate service, which introduces another point of failure, added latency, and cost. Ripple avoids all of that.

- 🚀 **Blazing Fast**: Leverages the global DNS network, one of the fastest and most resilient distributed systems in the world.
- 0️⃣ **Zero Infrastructure**: No servers to manage, no databases to scale. Your DNS provider does all the work.
- 🔒 **Secure by Default**: Flag configurations are encrypted using AES-256, so your upcoming features and internal settings remain private.
- 🌐 **Globally Distributed**: inherently global, providing low-latency responses to users anywhere.

***

### How It Works

Ripple turns your public DNS records into a secure messaging channel for your application's configuration.
1. A feature flag configuration (e.g., `new-header=on`) is **encrypted** using a shared secret key.
2. The resulting ciphertext is published as a **TXT record** in your DNS. Observers can only see the encrypted value.
3. Your server fetches the encrypted record and **decrypts** it using the same shared secret.
4. Your application can then securely read the flag status.

This is especially powerful in server-side implementations like **Next.js Server Components**, where the check happens on the server with no impact on your client-side bundle size.

***

### Getting Started

#### 1. Set Your Secret Key

You need a 32-byte (64-character hexadecimal) secret key. This key must be available as an environment variable (`RIPPLE_SECRET`) to your application and wherever you generate the encrypted flag values.

##### Generate a key:
```bash
openssl rand -hex 32
# Example output: 9a7d3a7e4e3b1d7d2a6c8b0e0f8c2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
```
Add this key to your project's `.env.local` file. **Never commit this file to version control**.

##### .env.local
```bash
RIPPLE_SECRET=9a7d3a7e4e3b1d7d2a6c8b0e0f8c2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
```

#### 2. Create the Utility File

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
#### 3. Generate & Set Your Encrypted DNS Record

Because the value is encrypted, you can't just type "on" into your DNS provider's dashboard. Use a helper script to generate the correct value.

Create a script `encrypt-flag.js` in your project's root:
```javascript
// encrypt-flag.js
const { createCipheriv, randomBytes } = require('crypto');
require('dotenv').config({ path: '.env.local' }); // Load .env.local

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(plaintext, secret) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(secret, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

const featureName = process.argv[2];
const featureState = process.argv[3] || 'on';
const secret = process.env.RIPPLE_SECRET;

if (!featureName || !secret) {
  console.error('Usage: node encrypt-flag.js <feature-name> [on|off]');
  console.error('Ensure RIPPLE_SECRET is set in .env.local');
  process.exit(1);
}

const plaintext = `${featureName}=${featureState}`;
const encrypted = encrypt(plaintext, secret);

console.log(`Your encrypted TXT record value is:\n${encrypted}`);
```
##### Run the script to get your value:
To turn a feature **fully on**
```bash
# These are equivalent
node encrypt-flag.js new-header
node encrypt-flag.js new-header on
# Example output:
# Your encrypted TXT record value is:
# zxR...<some long base64 string>...3D
```
To set a **percentage-based rollout**:
```bash
node encrypt-flag.js new-checkout 25
# This creates a rule for a 25% rollout
# Example output:
# Your encrypted TXT record value is:
# zxR...<some long base64 string>...3D
```
To turn a feature **fully off**:
```bash
node encrypt-flag.js new-header off
```
Now, go to your DNS provider and create the record:

- **Type**: `TXT`
- **Name/Host**: `new-header.flags.yourdomain.com`
- **Value**: Paste the full encrypted string from the script output
- **TTL**: `60` (a low TTL like 60 seconds is recommended for faster updates)

#### Use It in Your App

Now you can use the function in any Server Component to conditionally render UI.
```typescript
// app/page.tsx
import { isFlagEnabled } from '@/lib/flags';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const flagDomain = 'flags.yourdomain.com';
  const sessionId = cookies().get('session-id')?.value;

  // Example 1: Simple on/off flag (userId not needed)
  const showNewHeader = await isFlagEnabled('new-header', flagDomain);

  // Example 2: Percentage-based rollout (userId is required)
  const useNewCheckout = await isFlagEnabled(
    'new-checkout',
    flagDomain,
    sessionId
  );

  return (
    <main>
      {showNewHeader && <header><h1>✨ The New Header! ✨</h1></header>}
      {useNewCheckout ? <p>Using new checkout!</p> : <p>Using old checkout.</p>}
    </main>
  );
}

```
***
### Important Considerations

Ripple is powerful but has trade-offs you should understand.
- **DNS Propogation Delay**: Changes to DNS records are **not instant**. They are subject to the record's TTL (Time-To-Live). A 60-second TTL means it can take at least a minute for changes to be reflected globally. This makes Ripple unsuitable for flags that need to be disabled instantly in an emergency.
- **No Advanced Targeting**: Ripple is for simple, global, boolean/rollout switches. It does not support complex user attribute targeting.

***

### Contributing
Contributions are welcome! Please feel free to open an issue or submit a pull request.

### License

This project is licensed under the MIT License.
