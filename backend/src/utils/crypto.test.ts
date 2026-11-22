import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { generateOtp, hashWithSecret, hashesMatch } from "./crypto.js";

describe("OTP cryptography", () => {
  it("generates a six-digit OTP", () => {
    assert.match(generateOtp(), /^\d{6}$/);
  });

  it("creates deterministic keyed hashes without storing the original OTP", () => {
    const hash = hashWithSecret("483921", "test-secret");

    assert.equal(hash, hashWithSecret("483921", "test-secret"));
    assert.notEqual(hash, "483921");
    assert.equal(hash.length, 64);
  });

  it("matches the correct OTP and rejects an incorrect OTP", () => {
    const hash = hashWithSecret("483921", "test-secret");

    assert.equal(hashesMatch("483921", hash, "test-secret"), true);
    assert.equal(hashesMatch("483922", hash, "test-secret"), false);
  });

  it("rejects a valid OTP when the secret is different", () => {
    const hash = hashWithSecret("483921", "test-secret");

    assert.equal(hashesMatch("483921", hash, "another-secret"), false);
  });

  it("rejects malformed or differently sized hashes safely", () => {
    assert.equal(hashesMatch("483921", "not-a-hash", "test-secret"), false);
    assert.equal(hashesMatch("483921", "00", "test-secret"), false);
  });
});
