import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { environment } from "../config/environment.js";
import { findInboxDevice } from "../services/pairing.service.js";
import { serializeMessage } from "../services/inbox.service.js";

let activeSocketServer: Server | undefined;

export function createInboxSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: environment.FRONTEND_URL },
  });
  activeSocketServer = io;

  io.use(async (socket, next) => {
    try {
      const deviceToken = socket.handshake.auth.deviceToken as string | undefined;
      if (!deviceToken) {
        next(new Error("Inbox pairing is required."));
        return;
      }

      const device = await findInboxDevice(deviceToken);
      if (!device) {
        next(new Error("The inbox device token is invalid."));
        return;
      }

      socket.data.device = device;
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    const device = socket.data.device as { verificationSessionId: string };
    const room = inboxRoom(device.verificationSessionId);
    socket.join(room);
    socket.emit("inbox:ready", { verificationSessionId: device.verificationSessionId });
  });

  return io;
}

export function inboxRoom(verificationSessionId: string): string {
  return `inbox:${verificationSessionId}`;
}

export function emitInboxMessageCreated(
  verificationSessionId: string,
  message: Parameters<typeof serializeMessage>[0],
): void {
  if (!activeSocketServer) return;

  activeSocketServer
    .to(inboxRoom(verificationSessionId))
    .emit("inbox:message", serializeMessage(message));
}
