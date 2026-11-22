import type { ApiResponse, InboxMessage } from "../types";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

async function inboxRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-device-token": token } : {}),
        ...options.headers,
      },
    });
    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;
    if (!payload) throw new Error("The server returned an invalid response.");
    return payload;
  } catch (error) {
    if (error instanceof TypeError) throw new Error("Unable to reach the virtual inbox.");
    throw error;
  }
}

export async function pairInbox(pairingCode: string) {
  return inboxRequest<{ deviceToken: string; verificationSessionId: string }>("/inbox/pair", {
    method: "POST",
    body: JSON.stringify({ pairingCode }),
  });
}

export async function fetchMessages(token: string) {
  return inboxRequest<{ messages: InboxMessage[] }>("/inbox/messages", {}, token);
}

export async function fetchMessage(messageId: string, token: string) {
  return inboxRequest<InboxMessage>(`/inbox/messages/${messageId}`, {}, token);
}
