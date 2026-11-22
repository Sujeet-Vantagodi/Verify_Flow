import { environment } from "../config/environment.js";
import { generateOtp, hashWithSecret, hashesMatch } from "../utils/crypto.js";

export function createOtp(): { otp: string; otpHash: string } {
  const otp = generateOtp();

  return {
    otp,
    otpHash: hashWithSecret(otp, environment.OTP_HASH_SECRET),
  };
}

export function verifyOtp(otp: string, otpHash: string): boolean {
  return hashesMatch(otp, otpHash, environment.OTP_HASH_SECRET);
}
