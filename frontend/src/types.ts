export interface OtpRequestData {
  sessionId: string;
  inboxUrl: string;
  pairingCode: string;
  pairingExpiresIn: number;
  expiresIn: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
}

export interface VerificationData {
  verified: boolean;
  status?: string;
  attemptsRemaining?: number;
}

export interface InboxMessage {
  id: string;
  sender: string;
  recipient: string;
  messageContent: string;
  otp: string | null;
  createdAt: string;
  expiresAt: string;
  readAt: string | null;
  unread: boolean;
}
