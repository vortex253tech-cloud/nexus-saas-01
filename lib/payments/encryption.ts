// Server-side AES-256-GCM encryption for sensitive payment credentials.
// NEVER import this file in client components.

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_ENV   = 'PAYMENT_ENCRYPTION_KEY' // 32-byte hex string in env

function getKey(): Buffer {
  const raw = process.env[KEY_ENV]
  if (!raw) throw new Error(`${KEY_ENV} is not set — cannot encrypt payment credentials`)
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) throw new Error(`${KEY_ENV} must be a 64-char hex string (32 bytes)`)
  return buf
}

/** Encrypt a plaintext string → base64 payload (iv:authTag:ciphertext) */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag   = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/** Decrypt an encrypted payload produced by encrypt() */
export function decrypt(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Invalid encrypted payload format')

  const key       = getKey()
  const iv        = Buffer.from(ivB64, 'base64')
  const authTag   = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Return a masked version safe to send to the client (e.g. sk_live_****4321) */
export function mask(value: string, visibleSuffix = 4): string {
  if (value.length <= visibleSuffix) return '****'
  const prefix = value.slice(0, value.indexOf('_') + 1) || ''
  const suffix = value.slice(-visibleSuffix)
  return `${prefix}****${suffix}`
}
