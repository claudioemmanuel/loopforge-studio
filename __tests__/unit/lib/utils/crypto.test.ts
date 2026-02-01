import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptApiKey, decryptApiKey, generateEncryptionKey } from "@/lib/crypto";

describe("Crypto Module", () => {
  const testKey = "0".repeat(64); // 32 bytes in hex for testing
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterAll(() => {
    if (originalKey !== undefined) {
      process.env.ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });
  describe("generateEncryptionKey", () => {
    it("should generate a 64-character hex string (32 bytes)", () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe("encryptApiKey / decryptApiKey", () => {
    it("should encrypt and decrypt an API key correctly", () => {
      const originalKey = "sk-ant-api03-test-key-12345";
      const encrypted = encryptApiKey(originalKey);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.encrypted).not.toBe(originalKey);

      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(originalKey);
    });

    it("should produce different ciphertext for the same input", () => {
      const apiKey = "sk-ant-api03-test-key";
      const encrypted1 = encryptApiKey(apiKey);
      const encrypted2 = encryptApiKey(apiKey);

      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // Ciphertext should be different (due to different IVs)
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);

      // But both should decrypt to the same value
      expect(decryptApiKey(encrypted1)).toBe(apiKey);
      expect(decryptApiKey(encrypted2)).toBe(apiKey);
    });

    it("should handle empty strings", () => {
      const encrypted = encryptApiKey("");
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe("");
    });

    it("should handle long API keys", () => {
      const longKey = "sk-ant-" + "x".repeat(1000);
      const encrypted = encryptApiKey(longKey);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(longKey);
    });

    it("should handle special characters", () => {
      const specialKey = "sk-ant-!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const encrypted = encryptApiKey(specialKey);
      const decrypted = decryptApiKey(encrypted);
      expect(decrypted).toBe(specialKey);
    });
  });
});
