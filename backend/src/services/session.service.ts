import { VerificationStatus } from "@prisma/client";
import { database } from "../config/database.js";
import { createOtp, verifyOtp } from "./otp.service.js";
import { deliverSimulatedSms } from "./sms-simulator.service.js";
import { normalizePhoneNumber } from "../utils/phone-validation.js";
import { emitInboxMessageCreated } from "../sockets/inbox.socket.js";

export const OTP_EXPIRATION_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 30 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export class SessionWorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "COOLDOWN" | "UNAVAILABLE",
  ) {
    super(message);
    this.name = "SessionWorkflowError";
  }
}

export type VerificationResult =
  | { status: "verified" }
  | { status: "invalid"; attemptsRemaining: number }
  | { status: "expired" }
  | { status: "locked" }
  | { status: "already_verified" };

export async function createVerificationSession(phoneNumber: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const { otp, otpHash } = createOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MS);

  const { session, message } = await database.$transaction(async (transaction) => {
    const session = await transaction.verificationSession.create({
      data: {
        phoneNumber: normalizedPhoneNumber,
        otpHash,
        expiresAt,
      },
    });

    const message = await deliverSimulatedSms(
      {
        verificationSessionId: session.id,
        phoneNumber: normalizedPhoneNumber,
        otp,
        createdAt: session.createdAt,
      },
      transaction,
    );

    return { session, message };
  });

  emitInboxMessageCreated(session.id, message);

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    expiresIn: Math.floor(OTP_EXPIRATION_MS / 1000),
  };
}

export async function verifyVerificationSession(
  sessionId: string,
  submittedOtp: string,
): Promise<VerificationResult> {
  return database.$transaction(async (transaction) => {
    const session = await transaction.verificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { status: "invalid", attemptsRemaining: 0 };
    }

    if (session.status === VerificationStatus.VERIFIED) {
      return { status: "already_verified" };
    }

    if (session.status === VerificationStatus.LOCKED || session.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      return { status: "locked" };
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await transaction.verificationSession.update({
        where: { id: session.id },
        data: { status: VerificationStatus.EXPIRED },
      });
      return { status: "expired" };
    }

    if (verifyOtp(submittedOtp, session.otpHash)) {
      await transaction.verificationSession.update({
        where: { id: session.id },
        data: {
          status: VerificationStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });
      return { status: "verified" };
    }

    const attempts = session.attempts + 1;
    await transaction.verificationSession.update({
      where: { id: session.id },
      data: {
        attempts,
        status: attempts >= MAX_VERIFICATION_ATTEMPTS ? VerificationStatus.LOCKED : VerificationStatus.PENDING,
      },
    });

    return {
      status: attempts >= MAX_VERIFICATION_ATTEMPTS ? "locked" : "invalid",
      attemptsRemaining: Math.max(0, MAX_VERIFICATION_ATTEMPTS - attempts),
    };
  });
}

export async function resendVerificationOtp(sessionId: string) {
  const { otp, otpHash } = createOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRATION_MS);

  const result = await database.$transaction(async (transaction) => {
    const session = await transaction.verificationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new SessionWorkflowError(
        "The verification session does not exist.",
        "NOT_FOUND",
      );
    }

    if (
      session.lastResentAt &&
      session.lastResentAt.getTime() + RESEND_COOLDOWN_MS > now.getTime()
    ) {
      const retryAfterSeconds = Math.ceil(
        (session.lastResentAt.getTime() + RESEND_COOLDOWN_MS - now.getTime()) / 1000,
      );
      throw new SessionWorkflowError(
        `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        "COOLDOWN",
      );
    }

    if (session.status === VerificationStatus.VERIFIED) {
      throw new SessionWorkflowError(
        "This phone number has already been verified.",
        "UNAVAILABLE",
      );
    }

    if (session.status === VerificationStatus.LOCKED) {
      throw new SessionWorkflowError(
        "This verification session is locked. Please start a new verification.",
        "UNAVAILABLE",
      );
    }

    const updatedSession = await transaction.verificationSession.update({
      where: { id: session.id },
      data: {
        otpHash,
        expiresAt,
        attempts: 0,
        status: VerificationStatus.PENDING,
        lastResentAt: now,
      },
    });

    const message = await deliverSimulatedSms(
      {
        verificationSessionId: updatedSession.id,
        phoneNumber: updatedSession.phoneNumber,
        otp,
        createdAt: now,
      },
      transaction,
    );

    return { session: updatedSession, message };
  });

  emitInboxMessageCreated(result.session.id, result.message);

  return {
    sessionId: result.session.id,
    expiresAt: result.session.expiresAt,
    expiresIn: Math.floor(OTP_EXPIRATION_MS / 1000),
  };
}
