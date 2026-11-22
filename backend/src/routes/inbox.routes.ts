import { Router } from "express";
import { getMessage, getMessages, pairInbox } from "../controllers/inbox.controller.js";
import { requireInboxDevice } from "../middleware/inbox-auth.middleware.js";
import { inboxPairLimiter } from "../middleware/security.middleware.js";

export const inboxRouter = Router();
inboxRouter.post("/pair", inboxPairLimiter, pairInbox);
inboxRouter.use(requireInboxDevice);
inboxRouter.get("/messages", getMessages);
inboxRouter.get("/messages/:id", getMessage);
