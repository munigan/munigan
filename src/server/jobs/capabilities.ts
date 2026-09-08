import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const capability = () => randomBytes(32).toString("base64url");
function key() {
  const configured = process.env.CAPABILITY_KEY;
  if (!configured || !/^[a-f0-9]{64}$/i.test(configured))
    throw new Error("Set CAPABILITY_KEY to 32 random bytes in hexadecimal");
  return Buffer.from(configured, "hex");
}
export function encrypt(text: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString(
    "base64url",
  );
}
export function decrypt(text: string) {
  const b = Buffer.from(text, "base64url"),
    cipher = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  cipher.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([
    cipher.update(b.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
