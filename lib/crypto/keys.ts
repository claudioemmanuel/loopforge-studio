import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment or generate a default for development
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // In development, use a deterministic key (NOT for production!)
    console.warn("ENCRYPTION_KEY not set, using development key");
    return crypto.createHash("sha256").update("loopforge-dev-key").digest();
  }
  // Expect a hex-encoded 32-byte key
  return Buffer.from(key, "hex");
}

export interface EncryptedData {
  encrypted: string; // hex encoded
  iv: string; // hex encoded
}

export function encryptApiKey(apiKey: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  // Append auth tag to encrypted data
  encrypted += authTag.toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
  };
}

export function decryptApiKey(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, "hex");

  // Extract auth tag from end of encrypted data
  const encrypted = encryptedData.encrypted.slice(0, -AUTH_TAG_LENGTH * 2);
  const authTag = Buffer.from(
    encryptedData.encrypted.slice(-AUTH_TAG_LENGTH * 2),
    "hex"
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

// GitHub token encryption (uses same AES-256-GCM pattern)
export function encryptGithubToken(token: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  encrypted += authTag.toString("hex");

  return {
    encrypted,
    iv: iv.toString("hex"),
  };
}

export function decryptGithubToken(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, "hex");

  const encrypted = encryptedData.encrypted.slice(0, -AUTH_TAG_LENGTH * 2);
  const authTag = Buffer.from(
    encryptedData.encrypted.slice(-AUTH_TAG_LENGTH * 2),
    "hex"
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
