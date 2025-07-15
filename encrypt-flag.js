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
const valueArg = process.argv[3];
const secret = process.env.GHOSTFLAGS_SECRET;

if (!featureName || !secret) {
  console.error('Usage: node encrypt-flag.js <feature-name> [on|off|<percentage>]');
  console.error('Example (On): node encrypt-flag.js new-feature on');
  console.error('Example (Rollout): node encrypt-flag.js new-feature 50');
  console.error('\nEnsure RIPPLE_SECRET is set in .env.local');
  process.exit(1);
}

let featureState;

// If a value is provided and it's a valid number, treat it as a rollout percentage.
if (valueArg !== undefined && !isNaN(parseInt(valueArg, 10))) {
  const percentage = Math.max(0, Math.min(100, parseInt(valueArg, 10))); // Clamp between 0-100
  featureState = `rollout=${percentage}`;
} else {
  // Otherwise, default to 'on' if no value is given, or use the provided string ('on'/'off').
  featureState = valueArg || 'on';
}

const plaintext = `${featureName}=${featureState}`;
const encrypted = encrypt(plaintext, secret);

console.log(`✅ Feature: ${featureName}`);
console.log(`   Rule:    ${featureState}`);
console.log(`\nYour encrypted TXT record value is:\n${encrypted}`);
