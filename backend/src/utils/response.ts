import type { Response } from "express";

export function sendSuccess<T>(response: Response, message: string, data: T, status = 200) {
  return response.status(status).json({ success: true, message, data });
}

export function sendFailure<T>(
  response: Response,
  message: string,
  status = 400,
  code?: string,
  data?: T,
) {
  return response.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(data === undefined ? {} : { data }),
  });
}
