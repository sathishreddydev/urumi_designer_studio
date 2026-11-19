import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.ENCRYPTION_KEY;
  if (!configuredKey) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const key =
    /^[0-9a-f]{64}$/i.test(configuredKey)
      ? Buffer.from(configuredKey, "hex")
      : Buffer.from(configuredKey, "base64");

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 32-byte hex or base64 value");
  }

  return key;
}

export function encryptTenantSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptTenantSecret(value: string): string {
  const [encodedIv, encodedAuthTag, encodedEncrypted, ...extra] = value.split(".");
  if (!encodedIv || !encodedAuthTag || !encodedEncrypted || extra.length > 0) {
    throw new Error("Stored tenant secret has an invalid encrypted format");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encodedAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedEncrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
