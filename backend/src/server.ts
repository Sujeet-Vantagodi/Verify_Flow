import { createServer } from "node:http";
import { createApp } from "./app.js";
import { disconnectDatabase } from "./config/database.js";
import { environment } from "./config/environment.js";
import { createInboxSocketServer } from "./sockets/inbox.socket.js";

const app = createApp();
const server = createServer(app);
createInboxSocketServer(server);

server.listen(environment.PORT, () => {
  console.log(`VerifyFlow backend listening on port ${environment.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down gracefully`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
