import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { environment } from "./config/environment.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { inboxRouter } from "./routes/inbox.routes.js";
import { otpRouter } from "./routes/otp.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: environment.FRONTEND_URL }));
  app.use(express.json({ limit: "16kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  app.get("/api/health", (_request, response) => {
    response.json({
      success: true,
      message: "VerifyFlow backend is healthy",
      data: { environment: environment.NODE_ENV },
    });
  });

  app.use("/api/otp", otpRouter);
  app.use("/api/inbox", inboxRouter);
  app.use((_request, response) => {
    response.status(404).json({ success: false, message: "Route not found." });
  });
  app.use(errorMiddleware);

  return app;
}
