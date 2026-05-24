import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("index includes test-only marker and required sections", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /TEST \/ NOT VALID/);
  assert.match(html, /id="luma-url"/);
  assert.match(html, /id="extract-btn"/);
  assert.match(html, /id="generate-btn"/);
  assert.match(html, /id="review-panel"/);
  assert.match(html, /id="signing-status"/);
  assert.match(html, /id="ticket-type-select"/);
});
