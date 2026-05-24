# Luma Test Pass Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local test-only web flow that extracts public Luma event fields, asks for missing data, and generates a downloadable signed `.pkpass` with dummy QR and forced `TEST / NOT VALID` markers.

**Architecture:** Extend `wallet-web` with three API handlers (`extract-luma`, `generate-pass`, `signing-health`) and a guided UI in `index.html`. Move extraction, payload validation, and signing orchestration into focused `_lib` modules. Reuse existing Python/bash pass scripts by adding one JSON-driven render step and preflight checks.

**Tech Stack:** Node.js Web Handlers (ESM), native `fetch`, native `node:test`, Python 3 + Pillow scripts, OpenSSL signing, existing pass bundle scripts.

---

## File Structure and Responsibilities

- `wallet-web/index.html` — guided 4-step UI (extract, review, resolve, generate) and download trigger.
- `wallet-web/api/extract-luma.js` — API route that validates URL and returns extracted + missing fields.
- `wallet-web/api/generate-pass.js` — API route that validates finalized payload, enforces test-only constraints, runs render/sign pipeline, returns `.pkpass`.
- `wallet-web/api/signing-health.js` — API route for cert/key/preflight readiness checks.
- `wallet-web/api/_lib/lumaExtract.js` — parsing logic for public Luma HTML and hidden/missing detection.
- `wallet-web/api/_lib/passPayload.js` — canonical schema validation + host/ticket slot selection + safety enforcement.
- `wallet-web/api/_lib/signingHealth.js` — filesystem checks and optional probe-sign wrapper.
- `wallet-web/api/_lib/passBuild.js` — temp dir management and subprocess calls to render/sign/package scripts.
- `scripts/render_pass_payload.py` — writes `pass/pass.json`, downloads/processes event image, computes average color, sets test text and dummy QR.
- `scripts/sign_pass.sh` — update to accept output filename and optional working payload path.
- `wallet-web/tests/*.test.js` — unit/integration tests for extractor, payload mapping, and API handlers.
- `wallet-web/package.json` — add `test` and `test:watch` scripts.
- `wallet-web/.env.example` — local env variables for cert paths, dummy QR, output location.

---

### Task 0: Prepare repository and execution prerequisites

**Files:**
- Modify: `wallet-web/package.json`
- Modify: `wallet-web/.env.example`

- [ ] **Step 1: Write a failing environment-precheck script**

```js
// package.json (scripts section)
{
  "scripts": {
    "preflight": "node -e \"for (const k of ['WWDR_PEM_PATH','SIGNER_CERT_PATH','SIGNER_KEY_PATH']) if(!process.env[k]) throw new Error('Missing '+k)\""
  }
}
```

- [ ] **Step 2: Run preflight to verify it fails without env**

Run: `cd wallet-web && npm run preflight`  
Expected: FAIL with `Missing WWDR_PEM_PATH` (or first missing key).

- [ ] **Step 3: Initialize git if this workspace is not yet a repository**

```bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || git init
git add -A
git commit -m "chore: initialize repository baseline for test-pass prototype"
```

- [ ] **Step 4: Add env template and rerun preflight with env loaded**

```dotenv
# wallet-web/.env.example
WWDR_PEM_PATH=../certs/wwdr.pem
SIGNER_CERT_PATH=../certs/signer.pem
SIGNER_KEY_PATH=../certs/signer.key
```

Run: `cd wallet-web && set -a && source .env.example && set +a && npm run preflight`  
Expected: PASS with exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/package.json wallet-web/.env.example
git commit -m "chore: add local preflight and signing env template"
```

---

### Task 1: Create test harness and baseline module skeleton

**Files:**
- Create: `wallet-web/api/_lib/lumaExtract.js`
- Create: `wallet-web/api/_lib/passPayload.js`
- Create: `wallet-web/api/_lib/signingHealth.js`
- Create: `wallet-web/api/_lib/passBuild.js`
- Create: `wallet-web/tests/smoke.test.js`
- Modify: `wallet-web/package.json`

- [ ] **Step 1: Write the failing test**

```js
// wallet-web/tests/smoke.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { extractFromLumaHtml } from "../api/_lib/lumaExtract.js";
import { normalizePayload } from "../api/_lib/passPayload.js";

test("extractor and payload modules export callable functions", () => {
  assert.equal(typeof extractFromLumaHtml, "function");
  assert.equal(typeof normalizePayload, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd wallet-web && node --test tests/smoke.test.js`  
Expected: FAIL with module-not-found or missing export errors.

- [ ] **Step 3: Write minimal implementation**

```js
// wallet-web/api/_lib/lumaExtract.js
export function extractFromLumaHtml() {
  return { extracted: {}, missingFields: [], hiddenFields: [], ticketTypes: [] };
}
```

```js
// wallet-web/api/_lib/passPayload.js
export function normalizePayload(payload) {
  return { ...payload, safety: { marker: "TEST / NOT VALID", qrMode: "dummy" } };
}
```

```json
// wallet-web/package.json
{
  "scripts": {
    "test": "node --test tests/*.test.js",
    "test:watch": "node --test --watch tests/*.test.js"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd wallet-web && npm test`  
Expected: PASS with `1 test` and exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/package.json wallet-web/api/_lib/*.js wallet-web/tests/smoke.test.js
git commit -m "test: bootstrap wallet-web test harness and core module stubs"
```

---

### Task 2: Implement Luma public-page extraction + missing/hidden classification

**Files:**
- Modify: `wallet-web/api/_lib/lumaExtract.js`
- Create: `wallet-web/api/extract-luma.js`
- Create: `wallet-web/tests/luma-extract.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// wallet-web/tests/luma-extract.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { extractFromLumaHtml } from "../api/_lib/lumaExtract.js";

test("extracts title/date/image and marks missing address", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Founder Dinner" />
      <meta property="og:image" content="https://img.example/event.jpg" />
    </head><body>
      <time datetime="2026-06-01T18:00:00-07:00"></time>
      <div>Hosted by Luma Labs</div>
    </body></html>`;
  const result = extractFromLumaHtml(html, "https://lu.ma/founder-dinner");
  assert.equal(result.extracted.eventTitle, "Founder Dinner");
  assert.equal(result.extracted.eventImageUrl, "https://img.example/event.jpg");
  assert.ok(result.missingFields.includes("address"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd wallet-web && node --test tests/luma-extract.test.js`  
Expected: FAIL because extractor returns empty object.

- [ ] **Step 3: Write minimal implementation**

```js
// wallet-web/api/_lib/lumaExtract.js
const META_RE = /<meta[^>]+property="([^"]+)"[^>]+content="([^"]*)"/gi;
const TIME_RE = /<time[^>]+datetime="([^"]+)"/i;

export function extractFromLumaHtml(html, sourceUrl) {
  const meta = {};
  for (const match of html.matchAll(META_RE)) meta[match[1]] = match[2];
  const timeMatch = html.match(TIME_RE);

  const extracted = {
    sourceUrl,
    eventTitle: meta["og:title"] || null,
    eventImageUrl: meta["og:image"] || null,
    startDateTime: timeMatch ? timeMatch[1] : null,
    address: null,
    hostName: html.includes("Hosted by") ? html.split("Hosted by")[1].split("<")[0].trim() : null,
  };

  const missingFields = [];
  if (!extracted.eventTitle) missingFields.push("eventTitle");
  if (!extracted.startDateTime) missingFields.push("startDateTime");
  if (!extracted.address) missingFields.push("address");

  const hiddenFields = extracted.address ? [] : ["address"];
  return { extracted, missingFields, hiddenFields, ticketTypes: [] };
}
```

```js
// wallet-web/api/extract-luma.js
import { extractFromLumaHtml } from "./_lib/lumaExtract.js";

export async function POST(request) {
  const { url } = await request.json();
  if (!/^https?:\/\/(www\.)?lu\.ma\/.+/.test(url || "")) {
    return Response.json({ error: "Invalid Luma URL" }, { status: 400 });
  }
  const res = await fetch(url);
  if (!res.ok) return Response.json({ error: "Failed to fetch public page" }, { status: 502 });
  const html = await res.text();
  return Response.json(extractFromLumaHtml(html, url));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd wallet-web && npm test`  
Expected: PASS for `smoke.test.js` and `luma-extract.test.js`.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/api/_lib/lumaExtract.js wallet-web/api/extract-luma.js wallet-web/tests/luma-extract.test.js
git commit -m "feat: add public Luma extraction endpoint with missing-field detection"
```

---

### Task 3: Implement payload normalization, safety enforcement, host/ticket mapping

**Files:**
- Modify: `wallet-web/api/_lib/passPayload.js`
- Create: `wallet-web/tests/pass-payload.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// wallet-web/tests/pass-payload.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePayload } from "../api/_lib/passPayload.js";

test("forces explicit ticket type choice when multiple exist", () => {
  assert.throws(() =>
    normalizePayload({
      eventTitle: "Demo",
      startDateTime: "2026-06-01T18:00:00-07:00",
      guestName: "Jane",
      ticketTypes: ["General", "VIP"],
      selectedTicketType: "",
    }),
  );
});

test("enforces test marker and dummy QR", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Luma Labs",
    ticketTypes: [],
  });
  assert.equal(out.testMarker, "TEST / NOT VALID");
  assert.match(out.qrMessage, /^https:\/\/example\.invalid\//);
  assert.equal(out.hostOrTicketLabel, "Luma Labs");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wallet-web && node --test tests/pass-payload.test.js`  
Expected: FAIL because current normalizer does not validate or map fields.

- [ ] **Step 3: Write minimal implementation**

```js
// wallet-web/api/_lib/passPayload.js
const REQUIRED = ["eventTitle", "startDateTime", "guestName"];

export function normalizePayload(input) {
  for (const key of REQUIRED) {
    if (!input?.[key]) throw new Error(`Missing required field: ${key}`);
  }
  const ticketTypes = Array.isArray(input.ticketTypes) ? input.ticketTypes.filter(Boolean) : [];
  if (ticketTypes.length > 1 && !input.selectedTicketType) {
    throw new Error("selectedTicketType is required when multiple ticketTypes are present");
  }
  const hostOrTicketLabel = ticketTypes.length > 0 ? (input.selectedTicketType || ticketTypes[0]) : (input.hostName || "Unknown host");

  return {
    ...input,
    hostOrTicketLabel,
    testMarker: "TEST / NOT VALID",
    qrMessage: `https://example.invalid/test-pass/${Date.now()}`,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd wallet-web && npm test`  
Expected: PASS for payload tests and existing tests.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/api/_lib/passPayload.js wallet-web/tests/pass-payload.test.js
git commit -m "feat: enforce test-only payload rules and host-ticket mapping"
```

---

### Task 4: Implement signing readiness and pass-build orchestration APIs

**Files:**
- Modify: `wallet-web/api/_lib/signingHealth.js`
- Modify: `wallet-web/api/_lib/passBuild.js`
- Create: `wallet-web/api/signing-health.js`
- Create: `wallet-web/api/generate-pass.js`
- Create: `wallet-web/tests/api-handlers.test.js`
- Modify: `wallet-web/.env.example`

- [ ] **Step 1: Write failing API tests**

```js
// wallet-web/tests/api-handlers.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { GET as signingHealthGET } from "../api/signing-health.js";

test("signing-health returns JSON with ready flag", async () => {
  const res = await signingHealthGET(new Request("http://localhost/api/signing-health"));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(typeof json.ready, "boolean");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd wallet-web && node --test tests/api-handlers.test.js`  
Expected: FAIL because handlers do not exist.

- [ ] **Step 3: Implement handlers and env contract**

```js
// wallet-web/api/_lib/signingHealth.js
import { access } from "node:fs/promises";

const REQUIRED_PATHS = ["WWDR_PEM_PATH", "SIGNER_CERT_PATH", "SIGNER_KEY_PATH"];

export async function getSigningHealth(env = process.env) {
  const checks = await Promise.all(REQUIRED_PATHS.map(async (name) => {
    const p = env[name];
    if (!p) return { name, ok: false, reason: "unset" };
    try { await access(p); return { name, ok: true, path: p }; }
    catch { return { name, ok: false, reason: "missing" }; }
  }));
  return { ready: checks.every((c) => c.ok), checks };
}
```

```js
// wallet-web/api/signing-health.js
import { getSigningHealth } from "./_lib/signingHealth.js";
export async function GET() {
  return Response.json(await getSigningHealth());
}
```

```js
// wallet-web/api/generate-pass.js
import { normalizePayload } from "./_lib/passPayload.js";
import { buildPass } from "./_lib/passBuild.js";
import { getSigningHealth } from "./_lib/signingHealth.js";

export async function POST(request) {
  const health = await getSigningHealth();
  if (!health.ready) return Response.json({ error: "Signing is not ready", health }, { status: 503 });
  const payload = normalizePayload(await request.json());
  const { buffer, filename } = await buildPass(payload);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

```dotenv
# wallet-web/.env.example
WWDR_PEM_PATH=../certs/wwdr.pem
SIGNER_CERT_PATH=../certs/signer.pem
SIGNER_KEY_PATH=../certs/signer.key
PASS_BUILD_OUTPUT_DIR=../build
DUMMY_QR_BASE_URL=https://example.invalid/test-pass
```

- [ ] **Step 4: Run full tests**

Run: `cd wallet-web && npm test`  
Expected: PASS for `api-handlers.test.js` and previous suites.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/api/signing-health.js wallet-web/api/generate-pass.js wallet-web/api/_lib/signingHealth.js wallet-web/api/_lib/passBuild.js wallet-web/tests/api-handlers.test.js wallet-web/.env.example
git commit -m "feat: add signing readiness and pkpass generation API handlers"
```

---

### Task 5: Add Python render script and integrate with existing signing pipeline

**Files:**
- Create: `scripts/render_pass_payload.py`
- Modify: `scripts/sign_pass.sh`
- Modify: `wallet-web/api/_lib/passBuild.js`
- Create: `wallet-web/tests/pass-build.test.js`

- [ ] **Step 1: Write failing build-orchestration test**

```js
// wallet-web/tests/pass-build.test.js
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
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd wallet-web && node --test tests/pass-build.test.js`  
Expected: FAIL because helper is not implemented/exported.

- [ ] **Step 3: Implement render script + passBuild integration**

```python
# scripts/render_pass_payload.py
#!/usr/bin/env python3
import json
from pathlib import Path
from PIL import Image
from urllib.request import urlopen
from io import BytesIO

ROOT = Path(__file__).resolve().parent.parent
PASS_JSON = ROOT / "pass" / "pass.json"
PASS_DIR = ROOT / "pass"

def average_rgb_from_url(url: str):
    data = urlopen(url, timeout=10).read()
    im = Image.open(BytesIO(data)).convert("RGB").resize((64, 64))
    px = list(im.getdata())
    r = sum(p[0] for p in px) // len(px)
    g = sum(p[1] for p in px) // len(px)
    b = sum(p[2] for p in px) // len(px)
    return r, g, b, im

def main():
    payload = json.loads(Path(__import__("sys").argv[1]).read_text())
    r, g, b, im = average_rgb_from_url(payload["eventImageUrl"])
    # Use the Luma event image as pass art for this test ticket.
    im.resize((1125, 432)).save(PASS_DIR / "strip@3x.png", format="PNG")
    im.resize((750, 288)).save(PASS_DIR / "strip@2x.png", format="PNG")
    im.resize((375, 144)).save(PASS_DIR / "strip.png", format="PNG")
    PASS_JSON.write_text(json.dumps({
        "description": payload["testMarker"],
        "organizationName": "TEST / NOT VALID",
        "formatVersion": 1,
        "eventTicket": {
            "primaryFields": [{"key": "event", "label": "EVENT", "value": payload["eventTitle"]}],
            "secondaryFields": [{"key": "hostOrTicket", "label": "ENTRY", "value": payload["hostOrTicketLabel"]}],
            "auxiliaryFields": [{"key": "guest", "label": "GUEST", "value": payload["guestName"]}],
        },
        "barcodes": [{"format": "PKBarcodeFormatQR", "message": payload["qrMessage"], "messageEncoding": "iso-8859-1"}],
        "backgroundColor": f"rgb({r},{g},{b})"
    }, indent=2) + "\n")

if __name__ == "__main__":
    main()
```

```js
// wallet-web/api/_lib/passBuild.js
export function rgbFromAverages({ r, g, b }) {
  return `rgb(${r},${g},${b})`;
}

export function buildPassFilename(eventTitle, isoStart) {
  const slug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const ts = new Date(isoStart).toISOString().replace(/[-:]/g, "").slice(0, 15);
  return `test-${slug}-${ts}.pkpass`;
}
```

```bash
# scripts/sign_pass.sh (delta)
PKPASS_NAME="${1:-event-ticket.pkpass}"
PKPASS="$BUILD/$PKPASS_NAME"
```

- [ ] **Step 4: Run tests and smoke signing dry-run**

Run:
- `cd wallet-web && npm test`
- `cd .. && bash scripts/sign_pass.sh test-smoke.pkpass`

Expected:
- tests PASS
- sign script prints `Signed pass: .../build/test-smoke.pkpass`

- [ ] **Step 5: Commit**

```bash
git add scripts/render_pass_payload.py scripts/sign_pass.sh wallet-web/api/_lib/passBuild.js wallet-web/tests/pass-build.test.js
git commit -m "feat: render dynamic test pass payload and support named pkpass output"
```

---

### Task 6: Build guided UI flow in `index.html` and wire extraction/generation

**Files:**
- Modify: `wallet-web/index.html`
- Create: `wallet-web/tests/ui-contract.test.js`

- [ ] **Step 1: Write failing UI contract test**

```js
// wallet-web/tests/ui-contract.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("index includes test-only marker and required sections", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /TEST \/ NOT VALID/);
  assert.match(html, /id="luma-url"/);
  assert.match(html, /id="extract-btn"/);
  assert.match(html, /id="generate-btn"/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd wallet-web && node --test tests/ui-contract.test.js`  
Expected: FAIL because current landing page has no guided form IDs.

- [ ] **Step 3: Implement minimal guided form and handlers**

```html
<!-- wallet-web/index.html (core additions) -->
<h1>Luma Test Pass Generator</h1>
<p><strong>TEST / NOT VALID</strong> — public-page extraction only, dummy QR only.</p>
<input id="luma-url" type="url" placeholder="https://lu.ma/..." />
<button id="extract-btn">Extract</button>
<div id="review-panel"></div>
<button id="generate-btn">Generate test .pkpass</button>
<script type="module">
  const urlInput = document.getElementById("luma-url");
  const review = document.getElementById("review-panel");
  let extracted = null;
  document.getElementById("extract-btn").onclick = async () => {
    const res = await fetch("/api/extract-luma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.value }) });
    extracted = await res.json();
    review.textContent = JSON.stringify(extracted, null, 2);
  };
  document.getElementById("generate-btn").onclick = async () => {
    const payload = { ...(extracted?.extracted || {}), guestName: "Test Guest", ticketTypes: extracted?.ticketTypes || [] };
    const res = await fetch("/api/generate-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "test-pass.pkpass";
    a.click();
  };
</script>
```

- [ ] **Step 4: Run test suite and manual browser verification**

Run:
- `cd wallet-web && npm test`
- `cd wallet-web && npx vercel dev`

Expected:
- test suite PASS
- local page loads with 4-step flow and downloadable `.pkpass` from `Generate`.

- [ ] **Step 5: Commit**

```bash
git add wallet-web/index.html wallet-web/tests/ui-contract.test.js
git commit -m "feat: add guided local UI for extract-review-resolve-generate flow"
```

---

### Task 7: Final verification and docs sync

**Files:**
- Modify: `docs/superpowers/specs/2026-05-24-luma-test-pass-generator-design.md`
- Create: `docs/superpowers/plans/verification/2026-05-24-luma-test-pass-generator.md`

- [ ] **Step 1: Write failing verification checklist test (command-level)**

```bash
# docs/superpowers/plans/verification/2026-05-24-luma-test-pass-generator.md
- [ ] npm test passes in wallet-web
- [ ] /api/signing-health reports ready=true
- [ ] Hidden address path prompts user input/placeholder choice
- [ ] Multiple ticket types force explicit selection
- [ ] Generated pass contains visible TEST / NOT VALID
- [ ] Generated pass QR payload uses example.invalid
```

- [ ] **Step 2: Run verification commands**

Run:
- `cd wallet-web && npm test`
- `cd wallet-web && node --test tests/*.test.js`
- `cd wallet-web && npx vercel dev`

Expected:
- all tests PASS
- local manual checks complete with all checklist boxes true.

- [ ] **Step 3: Update spec with implementation notes**

```md
<!-- append in spec -->
## Implementation Notes
- Added local APIs: `/api/extract-luma`, `/api/signing-health`, `/api/generate-pass`
- Enforced test-only marker and dummy QR at server normalization layer
- Confirmed local `.pkpass` download and signing preflight gating
```

- [ ] **Step 4: Commit final verification artifacts**

Run:

```bash
git add docs/superpowers/specs/2026-05-24-luma-test-pass-generator-design.md docs/superpowers/plans/verification/2026-05-24-luma-test-pass-generator.md
git commit -m "docs: record verification results for luma test pass generator"
```

- [ ] **Step 5: Create release tag for local milestone**

Run:

```bash
git tag -a v0.1.0-luma-test-pass -m "Local prototype ready: Luma test pass generator"
```

Expected: `git tag --list` shows `v0.1.0-luma-test-pass`.
