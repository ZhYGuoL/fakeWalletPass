import test from "node:test";
import assert from "node:assert/strict";
import { buildPassFilename, rgbFromAverages } from "../api/_lib/passBuild.js";

test("buildPassFilename returns deterministic safe filename", () => {
  const out = buildPassFilename("Founder Dinner", "2026-06-01T18:00:00-07:00");
  assert.match(out, /^test-founder-dinner-\d{8}T\d{6}\.pkpass$/);
});

test("rgbFromAverages returns CSS rgb string", () => {
  assert.equal(rgbFromAverages({ r: 12, g: 34, b: 56 }), "rgb(12,34,56)");
});
