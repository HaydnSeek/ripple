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
