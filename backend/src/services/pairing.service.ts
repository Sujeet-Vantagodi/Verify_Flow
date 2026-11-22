import { database } from "../config/database.js";
import { environment } from "../config/environment.js";
import {
  generateDeviceToken,
  generatePairingCode,
  hashWithSecret,
} from "../utils/crypto.js";

export const PAIRING_EXPIRATION_MS = 10 * 60 * 1000;

export class PairingError extends Error {
  constructor(message = "The pairing code is invalid or expired.") {
    super(message);
    this.name = "PairingError";
  }
}

export async function createInboxPairing(sessionId: string) {
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_EXPIRATION_MS);

  const pairing = await database.$transaction(async (transaction) => {
    const session = await transaction.verificationSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new PairingError("The verification session does not exist.");
    }

    await transaction.inboxPairing.updateMany({
      where: {
        verificationSessionId: sessionId,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    return transaction.inboxPairing.create({
      data: {
        verificationSessionId: sessionId,
        pairingCodeHash: hashWithSecret(pairingCode, environment.PAIRING_HASH_SECRET),
        expiresAt,
      },
    });
  });

  return {
    pairingId: pairing.id,
    pairingCode,
    expiresAt: pairing.expiresAt,
    expiresIn: Math.floor(PAIRING_EXPIRATION_MS / 1000),
  };
}

export async function pairInboxDevice(pairingCode: string) {
  const pairingCodeHash = hashWithSecret(pairingCode, environment.PAIRING_HASH_SECRET);

  return database.$transaction(async (transaction) => {
    const pairing = await transaction.inboxPairing.findFirst({
      where: {
        pairingCodeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!pairing) {
      throw new PairingError();
    }

    const consumed = await transaction.inboxPairing.updateMany({
      where: { id: pairing.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new PairingError();
    }

    const deviceToken = generateDeviceToken();
    const device = await transaction.inboxDevice.create({
      data: {
        verificationSessionId: pairing.verificationSessionId,
        deviceTokenHash: hashWithSecret(deviceToken, environment.PAIRING_HASH_SECRET),
      },
    });

    return {
      deviceId: device.id,
      deviceToken,
      verificationSessionId: pairing.verificationSessionId,
    };
  });
}

export async function findInboxDevice(deviceToken: string) {
  const deviceTokenHash = hashWithSecret(deviceToken, environment.PAIRING_HASH_SECRET);

  return database.inboxDevice.findUnique({
    where: { deviceTokenHash },
  });
}
