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

/**
 * Checks if a feature flag is enabled by querying a DNS TXT record.
 * @param featureName The name of the feature flag (e.g., 'new-header').
 * @param baseDomain Your application's domain for flags (e.g., 'flags.yourdomain.com').
 * @returns {Promise<boolean>} A promise that resolves to true if the flag is 'on', otherwise false.
 */
export async function isFlagEnabled(featureName: string, baseDomain: string): Promise<boolean> {
  const domain = `${featureName}.${baseDomain}`;

  try {
    const records = await dns.resolveTxt(domain);
    const flagValue = records.flat().join('');
    return flagValue === 'on';
  } catch (error) {
    // Safely assume the feature is disabled if the record doesn't exist.
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
