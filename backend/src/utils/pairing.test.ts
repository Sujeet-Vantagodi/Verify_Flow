import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { generateDeviceToken, generatePairingCode } from "./crypto.js";

describe("inbox pairing credentials", () => {
  it("generates a six-digit pairing code", () => {
    assert.match(generatePairingCode(), /^\d{6}$/);
  });

  it("generates a high-entropy device token", () => {
    const first = generateDeviceToken();
    const second = generateDeviceToken();

    assert.ok(first.length >= 40);
    assert.notEqual(first, second);
  });
});
