import test from "node:test";
import assert from "node:assert/strict";
import { extractFromLumaHtml } from "../api/_lib/lumaExtract.js";
import { normalizePayload } from "../api/_lib/passPayload.js";

test("extractor and payload modules export callable functions", () => {
  assert.equal(typeof extractFromLumaHtml, "function");
  assert.equal(typeof normalizePayload, "function");
});
