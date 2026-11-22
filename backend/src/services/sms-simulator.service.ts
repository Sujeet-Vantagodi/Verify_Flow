import { database, type DatabaseClient } from "../config/database.js";
import { maskPhoneNumber } from "../utils/phone-display.js";

const SMS_SENDER = "VerifyFlow OTP Service";
const SMS_EXPIRATION_MINUTES = 5;

export interface SimulatedSmsInput {
  verificationSessionId: string;
  phoneNumber: string;
  otp: string;
  createdAt?: Date;
}

export async function deliverSimulatedSms(
  input: SimulatedSmsInput,
  client: DatabaseClient = database,
) {
  const {
  verificationSessionId,
  phoneNumber,
  otp,
  createdAt = new Date(),
  } = input;
  const expiresAt = new Date(
    createdAt.getTime() + SMS_EXPIRATION_MINUTES * 60 * 1000,
  );

  const messageContent = [
    `Your VerifyFlow verification OTP is ${otp}.`,
    `This OTP expires in ${SMS_EXPIRATION_MINUTES} minutes.`,
  ].join(" ");

  return client.inboxMessage.create({
    data: {
      verificationSessionId,
      sender: SMS_SENDER,
      recipient: phoneNumber,
      messageContent,
      createdAt,
      expiresAt,
    },
  });
}

export function createInboxPreview(phoneNumber: string, otp: string): string {
  return `OTP for ${maskPhoneNumber(phoneNumber)}: ${otp}`;
}
