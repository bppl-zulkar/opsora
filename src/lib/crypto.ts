import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function key() {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("APP_ENCRYPTION_KEY must contain at least 32 characters");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string) {
  const [version, ivText, tagText, encryptedText] = payload.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText)
    throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
