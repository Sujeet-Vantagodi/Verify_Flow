import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { isValidPhoneNumber, normalizePhoneNumber } from "./phone-validation.js";

describe("phone validation", () => {
  it("normalizes valid Indian numbers to E.164", () => {
    assert.equal(normalizePhoneNumber("+91 9876543210"), "+919876543210");
  });

  it("accepts valid international numbers", () => {
    assert.equal(isValidPhoneNumber("+14155552671"), true);
  });

  it("rejects malformed or incomplete numbers", () => {
    assert.equal(isValidPhoneNumber("not-a-phone-number"), false);
    assert.equal(isValidPhoneNumber("+91 123"), false);
  });

  it("accepts formatting whitespace without changing the canonical number", () => {
    assert.equal(normalizePhoneNumber("  +91 (98765) 43210  "), "+919876543210");
  });
});
