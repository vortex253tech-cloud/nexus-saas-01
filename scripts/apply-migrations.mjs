#!/usr/bin/env node
/**
 * apply-migrations.mjs
 *
 * Applies pending Supabase migrations via the Management API.
 * No DB password needed — only a Supabase Personal Access Token (PAT).
 *
 * Usage:
 *   node scripts/apply-migrations.mjs <PAT_TOKEN>
 *
 * Get your PAT at: https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF = 'gkjyxdlbddygwdyxmgvn'
const API_BASE    = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
const SQL_EDITOR  = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`

const PAT = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN

if (!PAT) {
  console.error(`
❌  No access token provided.

Usage:
  node scripts/apply-migrations.mjs <YOUR_PAT>

Or set the env var:
  $env:SUPABASE_ACCESS_TOKEN="sbp_xxxxx"
  node scripts/apply-migrations.mjs

Get your PAT at: https://supabase.com/dashboard/account/tokens

─────────────────────────────────────────────────
ALTERNATIVE: Apply manually in the SQL Editor:
  ${SQL_EDITOR}

Copy the contents of:
  supabase/migrations/20240005_apply_all.sql
─────────────────────────────────────────────────
`)
  process.exit(1)
}

const migrationFile = resolve(__dir, '../supabase/migrations/20240005_apply_all.sql')
const sql = readFileSync(migrationFile, 'utf8')

// Split on statement boundaries so large batches don't time out
// (Management API accepts a single query at a time)
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))
  .map(s => s.endsWith(';') ? s : s + ';')

console.log(`\n🚀  Applying ${statements.length} SQL statements to project ${PROJECT_REF}...\n`)

let ok = 0
let failed = 0

for (const [i, stmt] of statements.entries()) {
  const label = stmt.slice(0, 60).replace(/\n/g, ' ')
  process.stdout.write(`  [${i + 1}/${statements.length}] ${label}... `)

  try {
    const res = await fetch(API_BASE, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ query: stmt }),
    })

    const text = await res.text()

    if (!res.ok) {
      // Ignore "already exists" errors — idempotent migration
      if (text.includes('already exists') || text.includes('IF NOT EXISTS')) {
        console.log('⚠️  already exists (skipped)')
        ok++
      } else {
        console.log(`❌  FAILED\n     ${text.slice(0, 200)}`)
        failed++
      }
    } else {
      console.log('✓')
      ok++
    }
  } catch (err) {
    console.log(`❌  Network error: ${err.message}`)
    failed++
  }
}

console.log(`
────────────────────────────────────
✅  ${ok} succeeded   ❌  ${failed} failed
────────────────────────────────────
`)

if (failed > 0) {
  console.log(`
Some statements failed. Apply manually in the Supabase SQL Editor:
  ${SQL_EDITOR}

Copy the contents of:
  supabase/migrations/20240005_apply_all.sql
`)
  process.exit(1)
}

console.log('✅  All migrations applied. Your NEXUS database is up to date.')
