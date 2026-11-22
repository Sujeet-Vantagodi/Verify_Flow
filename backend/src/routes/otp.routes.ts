import { Router } from "express";
import { requestOtp, resendOtp, verifyOtp } from "../controllers/otp.controller.js";
import { otpRequestLimiter, otpVerifyLimiter } from "../middleware/security.middleware.js";

export const otpRouter = Router();
otpRouter.post("/request", otpRequestLimiter, requestOtp);
otpRouter.post("/verify", otpVerifyLimiter, verifyOtp);
otpRouter.post("/resend", otpRequestLimiter, resendOtp);
