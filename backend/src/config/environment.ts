import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  OTP_HASH_SECRET: z.string().min(32),
  PAIRING_HASH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url(),
  BACKEND_PUBLIC_URL: z.string().url(),
});

export const environment = environmentSchema.parse(process.env);
