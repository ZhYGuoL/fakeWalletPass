import test from "node:test";
import assert from "node:assert/strict";
import { buildPassFilename, rgbFromAverages } from "../api/_lib/passBuild.js";

test("buildPassFilename returns short safe filename", () => {
  const out = buildPassFilename("Founder Dinner");
  assert.equal(out, "founder-dinner.pkpass");
});

test("buildPassFilename truncates long event titles", () => {
  const out = buildPassFilename("Gen Z Marketers & Creators in the Park");
  assert.equal(out, "gen-z-marketers.pkpass");
});

test("rgbFromAverages returns CSS rgb string", () => {
  assert.equal(rgbFromAverages({ r: 12, g: 34, b: 56 }), "rgb(12,34,56)");
});
