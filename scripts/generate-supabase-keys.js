#!/usr/bin/env node
/**
 * Generate JWT keys for self-hosted Supabase.
 *
 * Usage:
 *   node scripts/generate-supabase-keys.js
 *   node scripts/generate-supabase-keys.js --secret "your-custom-secret-min-40-chars"
 *
 * Outputs ANON_KEY and SERVICE_ROLE_KEY that you paste into .env.supabase
 */

import crypto from 'crypto';

// ── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const secretFlagIdx = args.indexOf('--secret');
const providedSecret = secretFlagIdx !== -1 ? args[secretFlagIdx + 1] : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hmacSha256(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const sig = hmacSha256(`${headerB64}.${payloadB64}`, secret);
  return `${headerB64}.${payloadB64}.${sig}`;
}

// ── Generate secret if not provided ──────────────────────────────────────────
const jwtSecret = providedSecret || crypto.randomBytes(40).toString('hex');

if (jwtSecret.length < 40) {
  console.error('ERROR: JWT_SECRET must be at least 40 characters.');
  process.exit(1);
}

// ── Supabase token payloads ───────────────────────────────────────────────────
// Expiry: year 2999 (effectively never — Supabase cloud uses the same approach)
const exp = Math.floor(new Date('2999-01-01').getTime() / 1000);
const iat = Math.floor(Date.now() / 1000);

const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat,
  exp,
};

const serviceRolePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat,
  exp,
};

const anonKey = createJWT(anonPayload, jwtSecret);
const serviceRoleKey = createJWT(serviceRolePayload, jwtSecret);
const secretKeyBase = crypto.randomBytes(48).toString('hex');

// ── Output ────────────────────────────────────────────────────────────────────
console.log('\n=== Self-Hosted Supabase JWT Keys ===\n');
console.log('Copy these into your .env.supabase file:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log(`SECRET_KEY_BASE=${secretKeyBase}`);
console.log('\n⚠️  IMPORTANT:');
console.log('  • Keep JWT_SECRET private — anyone with it can forge tokens.');
console.log('  • The SERVICE_ROLE_KEY bypasses RLS — never expose it client-side.');
console.log('  • After updating .env.supabase, restart all Supabase containers.');
console.log('\nAlso update your APP .env with:');
console.log(`  VITE_SUPABASE_ANON_KEY=${anonKey}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
