export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= 4) {
    return "****";
  }

  return `${"*".repeat(Math.max(0, phoneNumber.length - 4))}${phoneNumber.slice(-4)}`;
}
