import type { Request, Response } from "express";
import { z } from "zod";
import { pairInboxDevice } from "../services/pairing.service.js";
import { getInboxMessage, listInboxMessages } from "../services/inbox.service.js";
import { sendFailure, sendSuccess } from "../utils/response.js";

const pairingSchema = z.object({ pairingCode: z.string().regex(/^\d{6}$/, "Pairing code must contain exactly six digits.") });

export async function pairInbox(request: Request, response: Response) {
  const { pairingCode } = pairingSchema.parse(request.body);
  const result = await pairInboxDevice(pairingCode);

  return sendSuccess(response, "Inbox paired successfully.", result, 201);
}

export async function getMessages(_request: Request, response: Response) {
  const device = response.locals.inboxDevice as { verificationSessionId: string };
  const messages = await listInboxMessages(device.verificationSessionId);

  return sendSuccess(response, "Inbox messages retrieved successfully.", { messages });
}

export async function getMessage(request: Request<{ id: string }>, response: Response) {
  const device = response.locals.inboxDevice as { verificationSessionId: string };
  const message = await getInboxMessage(request.params.id, device.verificationSessionId);

  if (!message) {
    return sendFailure(response, "Message not found.", 404, "NOT_FOUND");
  }

  return sendSuccess(response, "Message retrieved successfully.", message);
}
