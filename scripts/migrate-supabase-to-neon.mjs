#!/usr/bin/env node
/**
 * Supabase → Neon セッションデータ移行スクリプト
 *
 * Usage:
 *   node scripts/migrate-supabase-to-neon.mjs
 */

import { readFileSync } from 'fs';

const SUPABASE_PROJECT_REF = 'cjylcizaikyirdxkwpao';
const SUPABASE_TOKEN = readFileSync('C:/tmp/sb-token.txt', 'utf-8').trim();

const NEON_AUTH_URL = 'https://ep-royal-breeze-akf5w0cu.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth';
const NEON_DATA_API_URL = 'https://ep-royal-breeze-akf5w0cu.apirest.c-3.us-west-2.aws.neon.tech/neondb/rest/v1';

const ID_MAP = {
  '1f2b5d2e-9da7-47af-af4d-3c7e81dc5c4b': 'c7a60309-b0e9-4add-9913-b462b4c097a8',
  'c2c35cbb-0bf1-488b-a625-86d5e9993d65': '4eaf120e-121e-423c-9e07-4226780aef17',
  'f59223ff-3515-4d46-b267-3df287e1fccb': '1c71b47b-5d58-4f03-97c6-c83babea3898',
};

async function supabaseSQL(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase SQL failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function getNeonJWT() {
  // Sign in to get session cookie
  const signinRes = await fetch(`${NEON_AUTH_URL}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://app.pomocare.com' },
    body: JSON.stringify({ email: 'okuyama@fukurino.com', password: '12345678' }),
    redirect: 'manual',
  });

  // Extract session cookie
  const setCookies = signinRes.headers.getSetCookie?.() || [];
  const sessionCookie = setCookies.find(c => c.includes('session_token'));
  if (!sessionCookie) {
    // Fallback: use curl approach
    throw new Error('Could not get session cookie. setCookies: ' + setCookies.length);
  }
  const cookieValue = sessionCookie.split(';')[0];

  // Get JWT
  const tokenRes = await fetch(`${NEON_AUTH_URL}/token`, {
    headers: { Cookie: cookieValue, Origin: 'https://app.pomocare.com' },
  });
  if (!tokenRes.ok) {
    throw new Error('Token fetch failed: ' + tokenRes.status);
  }
  const tokenData = await tokenRes.json();
  return tokenData.token;
}

async function neonInsert(table, rows, jwt) {
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${NEON_DATA_API_URL}/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Neon INSERT ${table} batch ${i} failed (${res.status}): ${text}`);
    }
    inserted += batch.length;
    console.log(`  [${table}] ${inserted}/${rows.length}`);
  }
}

async function main() {
  console.log('=== PomoCare: Supabase → Neon Session Migration ===\n');

  // Step 1: Get Neon JWT
  console.log('Step 1: Getting Neon Auth JWT...');
  let jwt;
  try {
    jwt = await getNeonJWT();
    console.log('  JWT obtained (length: ' + jwt.length + ')');
  } catch (err) {
    console.log('  Direct JWT failed: ' + err.message);
    console.log('  Falling back to JWT from file...');
    jwt = readFileSync('C:/tmp/neon-jwt.txt', 'utf-8').trim();
    console.log('  JWT from file (length: ' + jwt.length + ')');
  }

  // Step 2: Fetch sessions from Supabase Management API
  console.log('\nStep 2: Fetching sessions from Supabase...');
  const result = await supabaseSQL(
    'SELECT user_id, date, duration, label, note, updated_at FROM user_sessions_v2 ORDER BY user_id, date'
  );
  console.log('  Raw result: ' + result.length + ' rows');

  // Step 3: Map user IDs
  const mapped = result
    .filter(s => ID_MAP[s.user_id])
    .map(s => ({
      user_id: ID_MAP[s.user_id],
      date: s.date,
      duration: s.duration,
      label: s.label || null,
      note: s.note || null,
      updated_at: s.updated_at || new Date().toISOString(),
    }));
  console.log('  Mapped: ' + mapped.length + ' sessions');

  // Step 4: Insert into Neon
  console.log('\nStep 3: Inserting into Neon...');
  await neonInsert('user_sessions_v2', mapped, jwt);

  // Verify
  console.log('\nStep 4: Verifying...');
  const verifyRes = await fetch(`${NEON_DATA_API_URL}/user_sessions_v2?select=user_id&limit=1`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const verifyData = await verifyRes.json();
  console.log('  Verification query returned: ' + verifyData.length + ' rows');

  console.log('\n=== Migration complete! Sessions: ' + mapped.length + ' ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
