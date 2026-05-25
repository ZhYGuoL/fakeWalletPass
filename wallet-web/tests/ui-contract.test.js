import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("index includes hero CTA and remotion visualization section", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Send a Luma link, get your Wallet pass/i);
  assert.match(html, /id="add-agent-btn"/);
  assert.match(html, /How it works \(visualized with Remotion\)/);
  assert.match(html, /media\/agent-flow-extract\.png/);
  assert.match(html, /media\/agent-flow-pass\.png/);
});
