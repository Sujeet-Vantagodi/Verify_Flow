import { parsePhoneNumberFromString } from "libphonenumber-js";

export class InvalidPhoneNumberError extends Error {
  constructor() {
    super("Please enter a valid international phone number.");
    this.name = "InvalidPhoneNumberError";
  }
}

export function normalizePhoneNumber(phoneNumber: string): string {
  const parsed = parsePhoneNumberFromString(phoneNumber.trim(), "IN");

  if (!parsed || !parsed.isValid()) {
    throw new InvalidPhoneNumberError();
  }

  return parsed.number;
}

export function isValidPhoneNumber(phoneNumber: string): boolean {
  try {
    normalizePhoneNumber(phoneNumber);
    return true;
  } catch {
    return false;
  }
}
