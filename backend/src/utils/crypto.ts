import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const OTP_LENGTH = 6;
const OTP_UPPER_BOUND = 10 ** OTP_LENGTH;

export function generateOtp(): string {
  return randomInt(0, OTP_UPPER_BOUND).toString().padStart(OTP_LENGTH, "0");
}

export function generatePairingCode(): string {
  return randomInt(0, OTP_UPPER_BOUND).toString().padStart(OTP_LENGTH, "0");
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashWithSecret(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

export function hashesMatch(value: string, expectedHash: string, secret: string): boolean {
  const actual = Buffer.from(hashWithSecret(value, secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
