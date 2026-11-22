import type { NextFunction, Request, Response } from "express";
import { findInboxDevice } from "../services/pairing.service.js";
import { sendFailure } from "../utils/response.js";

function readDeviceToken(request: Request): string | undefined {
  const headerToken = request.header("x-device-token");
  if (headerToken) return headerToken;

  const authorization = request.header("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
}

export async function requireInboxDevice(request: Request, response: Response, next: NextFunction) {
  const token = readDeviceToken(request);

  if (!token) {
    sendFailure(response, "Inbox pairing is required.", 401, "UNAUTHORIZED");
    return;
  }

  const device = await findInboxDevice(token);
  if (!device) {
    sendFailure(response, "The inbox device token is invalid.", 401, "UNAUTHORIZED");
    return;
  }

  response.locals.inboxDevice = device;
  next();
}
