// app/page.tsx
import { isFlagEnabled } from '@/lib/flags';

export default async function HomePage() {
  const flagDomain = 'flags.yourdomain.com';
  const showNewHeader = await isFlagEnabled('new-header', flagDomain);

  return (
    <main>
      {showNewHeader ? (
        <header><h1>✨ The New Encrypted Header! ✨</h1></header>
      ) : (
        <header><h1>The Old Header</h1></header>
      )}
      <p>Welcome to the site.</p>
    </main>
  );
}
