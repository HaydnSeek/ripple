<p align="center">
  <image width="100%" src="ripple-logo1.png"/>
</p>

> Ripple is a simple, open-source feature flagging tool that securely delivers a centralized JSON configuration via a single, encrypted DNS TXT record for ultra-fast, serverless evaluations.

It delivers feature flags with **sub-10ms latency** and **zero infrastructure** by reading a single, encrypted configuration from your existing DNS provider.

***

### Why Ripple?

Traditional feature flag systems require you to manage a separate service, which introduces another point of failure, added latency, and cost. Ripple avoids all of that.

- 🚀 **Blazing Fast**: Leverages the global DNS network, one of the fastest and most resilient distributed systems in the world.
- 0️⃣ **Zero Infrastructure**: No servers to manage, no databases to scale. Your DNS provider does all the work.
- 🔒 **Secure by Default**: Flag configurations are encrypted using AES-256, so your upcoming features and internal settings remain private.
- 🌐 **Globally Distributed**: Inherently global, providing low-latency responses to users anywhere.
- ✔️ **Simple & Efficient**: Manage all your flags in one JSON file. Fetch them all with a single DNS query.

***

### How It Works

Ripple turns a single DNS record into a secure, global source of truth for your application's configuration.
1. Your entire feature flag configuration is stored in a **single JSON file**.
2. This JSON file is **encrypted** into a single string using a shared secret key.
3. The resulting ciphertext is published to a single **TXT record** (e.g. `ripple.flags.yourdomain.com`)
4. Your server fetches this one record, decrypts it, and caches the resulting configuration object.
5. All subsequent flag checks are near-instant, reading from the in-memory cache.

This is especially powerful in server-side implementations like **Next.js Server Components**, where the check happens on the server with no impact on your client-side bundle size.

***

### Getting Started

#### 1. Set Your Secret Key

You need a 32-byte (64-character hexadecimal) secret key. This key must be available as an environment variable (`RIPPLE_SECRET`).

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

#### 2. Create Your Flag Configuration File

Create a JSON file in your project to define all your flags:

##### flags.json
```json
{
  "new-header": "on",
  "beta-checkout": "rollout=25",
  "promo-banner": "off",
  "experimental-api": "rollout=5"
}
```

#### 3. Generate & Set Your Encrypted DNS Record

Use the `encrypt.config.js` helper script to encrypt your `flags.json` file.
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
