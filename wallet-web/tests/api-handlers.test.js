import test from "node:test";
import assert from "node:assert/strict";
import { GET as signingHealthGET } from "../api/signing-health.js";

test("signing-health returns JSON with ready flag", async () => {
  const res = await signingHealthGET(new Request("http://localhost/api/signing-health"));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(typeof json.ready, "boolean");
});
