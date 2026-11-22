import type { Request, Response } from "express";
import { z } from "zod";
import { environment } from "../config/environment.js";
import { createInboxPairing } from "../services/pairing.service.js";
import {
  createVerificationSession,
  resendVerificationOtp,
  verifyVerificationSession,
} from "../services/session.service.js";
import { sendFailure, sendSuccess } from "../utils/response.js";

const requestSchema = z.object({ phoneNumber: z.string().min(1).max(30) });
const verifySchema = z.object({
  sessionId: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly six digits."),
});
const resendSchema = z.object({ sessionId: z.string().min(1) });

export async function requestOtp(request: Request, response: Response) {
  const { phoneNumber } = requestSchema.parse(request.body);
  const session = await createVerificationSession(phoneNumber);
  const pairing = await createInboxPairing(session.sessionId);

  return sendSuccess(
    response,
    "OTP generated successfully.",
    {
      sessionId: session.sessionId,
      inboxUrl: `${environment.FRONTEND_URL}/inbox`,
      pairingCode: pairing.pairingCode,
      pairingExpiresIn: pairing.expiresIn,
      expiresIn: session.expiresIn,
    },
    201,
  );
}

export async function verifyOtp(request: Request, response: Response) {
  const { sessionId, otp } = verifySchema.parse(request.body);
  const result = await verifyVerificationSession(sessionId, otp);

  if (result.status === "verified") {
    return sendSuccess(response, "Phone number verified successfully.", { verified: true });
  }

  if (result.status === "expired") {
    return sendFailure(response, "OTP expired. Please request a new OTP.", 410, "OTP_EXPIRED", {
      verified: false,
      status: "expired",
    });
  }

  if (result.status === "locked") {
    return sendFailure(response, "Maximum verification attempts reached.", 429, "MAX_ATTEMPTS", {
      verified: false,
      status: "locked",
    });
  }

  if (result.status === "already_verified") {
    return sendSuccess(response, "This phone number has already been verified.", { verified: true, status: "already_verified" });
  }

  return sendFailure(response, "Invalid OTP. Please try again.", 422, "INVALID_OTP", {
    verified: false,
    status: "invalid",
    attemptsRemaining: result.attemptsRemaining,
  });
}

export async function resendOtp(request: Request, response: Response) {
  const { sessionId } = resendSchema.parse(request.body);
  const result = await resendVerificationOtp(sessionId);

  return sendSuccess(response, "A new OTP was generated successfully.", {
    sessionId: result.sessionId,
    expiresIn: result.expiresIn,
  });
}
