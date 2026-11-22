import type { ApiResponse, OtpRequestData, VerificationData } from "../types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

async function request<T>(path: string, options: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
    if (!payload) throw new Error("The server returned an invalid response.");
    return payload;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Unable to reach VerifyFlow. Check your network connection.");
    }
    throw error;
  }
}

export function requestOtp(phoneNumber: string) {
  return request<OtpRequestData>("/otp/request", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export function verifyOtp(sessionId: string, otp: string) {
  return request<VerificationData>("/otp/verify", {
    method: "POST",
    body: JSON.stringify({ sessionId, otp }),
  });
}

export function resendOtp(sessionId: string) {
  return request<{ sessionId: string; expiresIn: number }>("/otp/resend", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}
