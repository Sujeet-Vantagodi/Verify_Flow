import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { PairingError } from "../services/pairing.service.js";
import { SessionWorkflowError } from "../services/session.service.js";
import { InvalidPhoneNumberError } from "../utils/phone-validation.js";

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      message: "The request contains invalid data.",
      errors: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  if (error instanceof InvalidPhoneNumberError || error instanceof PairingError) {
    response.status(400).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof SessionWorkflowError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "COOLDOWN" ? 429 : 409;
    response.status(status).json({ success: false, message: error.message, code: error.code });
    return;
  }

  console.error(error);
  response.status(500).json({ success: false, message: "An unexpected server error occurred." });
};
