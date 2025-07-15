const { createCipheriv, randomBytes } = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(plaintext, secret) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(secret, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

const filePath = process.argv[2];
const secret = process.env.GHOSTFLAGS_SECRET;

if (!filePath || !secret) {
  console.error('Usage: node encrypt-config.js <path/to/your/flags.json>');
  console.error('\nEnsure RIPPLE_SECRET is set in .env.local');
  process.exit(1);
}

try {
  const absolutePath = path.resolve(filePath);
  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
  
  // Validate that it's valid JSON before encrypting
  JSON.parse(fileContent);

  const encrypted = encrypt(fileContent, secret);

  console.log(`✅ Successfully encrypted configuration from ${filePath}`);
  console.log(`\nYour encrypted TXT record value is:\n${encrypted}`);
} catch (error) {
  console.error(`\nError: Could not process file at ${filePath}.`);
  if (error instanceof SyntaxError) {
    console.error('The file does not contain valid JSON.');
  } else {
    console.error(error.message);
  }
  process.exit(1);
}
