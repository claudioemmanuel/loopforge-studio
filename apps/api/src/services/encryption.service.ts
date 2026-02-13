import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag

function getKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY
  if (!keyBase64) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte base64-encoded string')
  }
  return key
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:tag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a string produced by encrypt().
 * Input format: iv:tag:ciphertext (all base64-encoded)
 */
export function decrypt(encryptedString: string): string {
  const key = getKey()
  const parts = encryptedString.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format')
  }

  const [ivBase64, tagBase64, dataBase64] = parts
  const iv = Buffer.from(ivBase64, 'base64')
  const tag = Buffer.from(tagBase64, 'base64')
  const encryptedData = Buffer.from(dataBase64, 'base64')

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length')
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error('Invalid auth tag length')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()])
  return decrypted.toString('utf8')
}

export const EncryptionService = { encrypt, decrypt }
