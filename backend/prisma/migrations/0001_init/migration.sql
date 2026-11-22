-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED');

-- CreateTable
CREATE TABLE "VerificationSession" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "lastResentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "verificationSessionId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxPairing" (
    "id" TEXT NOT NULL,
    "verificationSessionId" TEXT NOT NULL,
    "pairingCodeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxDevice" (
    "id" TEXT NOT NULL,
    "verificationSessionId" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationSession_phoneNumber_createdAt_idx" ON "VerificationSession"("phoneNumber", "createdAt");
CREATE INDEX "VerificationSession_status_expiresAt_idx" ON "VerificationSession"("status", "expiresAt");
CREATE INDEX "InboxMessage_verificationSessionId_createdAt_idx" ON "InboxMessage"("verificationSessionId", "createdAt");
CREATE INDEX "InboxPairing_verificationSessionId_expiresAt_idx" ON "InboxPairing"("verificationSessionId", "expiresAt");
CREATE INDEX "InboxPairing_pairingCodeHash_expiresAt_idx" ON "InboxPairing"("pairingCodeHash", "expiresAt");
CREATE UNIQUE INDEX "InboxDevice_deviceTokenHash_key" ON "InboxDevice"("deviceTokenHash");
CREATE INDEX "InboxDevice_verificationSessionId_lastActiveAt_idx" ON "InboxDevice"("verificationSessionId", "lastActiveAt");

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_verificationSessionId_fkey" FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxPairing" ADD CONSTRAINT "InboxPairing_verificationSessionId_fkey" FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxDevice" ADD CONSTRAINT "InboxDevice_verificationSessionId_fkey" FOREIGN KEY ("verificationSessionId") REFERENCES "VerificationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
