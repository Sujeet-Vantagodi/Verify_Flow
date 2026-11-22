import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { maskPhoneNumber } from "./phone-display.js";

describe("phone display masking", () => {
  it("keeps only the final four digits visible", () => {
    assert.equal(maskPhoneNumber("+919876543210"), "********3210");
  });

  it("handles short values safely", () => {
    assert.equal(maskPhoneNumber("1234"), "****");
  });
});
