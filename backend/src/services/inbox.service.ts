import { database } from "../config/database.js";
import { maskPhoneNumber } from "../utils/phone-display.js";

export function serializeMessage(message: {
  id: string;
  sender: string;
  recipient: string;
  messageContent: string;
  createdAt: Date;
  expiresAt: Date;
  readAt: Date | null;
}) {
  return {
    id: message.id,
    sender: message.sender,
    recipient: maskPhoneNumber(message.recipient),
    messageContent: message.messageContent,
    otp: message.messageContent.match(/\b\d{6}\b/)?.[0] ?? null,
    createdAt: message.createdAt,
    expiresAt: message.expiresAt,
    readAt: message.readAt,
    unread: message.readAt === null,
  };
}

export async function listInboxMessages(verificationSessionId: string) {
  const messages = await database.inboxMessage.findMany({
    where: { verificationSessionId },
    orderBy: { createdAt: "desc" },
  });

  return messages.map(serializeMessage);
}

export async function getInboxMessage(messageId: string, verificationSessionId: string) {
  const message = await database.inboxMessage.findFirst({
    where: { id: messageId, verificationSessionId },
  });

  if (!message) return null;

  const readMessage = message.readAt
    ? message
    : await database.inboxMessage.update({
        where: { id: message.id },
        data: { readAt: new Date() },
      });

  return serializeMessage(readMessage);
}
