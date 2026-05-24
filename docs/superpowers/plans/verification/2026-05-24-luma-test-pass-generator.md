# Verification: Luma test pass generator (local prototype)

**Date:** 2026-05-24  
**Project:** `fakeWalletPass` / `wallet-web`

## Automated and manual checklist

- [x] **npm test passes in `wallet-web`** — Verified: `cd wallet-web && npm test` → 8 tests, all pass (~59ms).
- [ ] **`/api/signing-health` reports `ready=true` (when certs configured)** — Automated shape check: handler returns 200 JSON with boolean `ready` (`api-handlers.test.js`). Programmatic `getSigningHealth()` with current shell env returned `ready: false` (cert env vars unset). **Manual:** configure `.env`, ensure paths exist → expect `GET /api/signing-health` shows `ready: true`.
- [x] **Hidden address path prompts user input / placeholder choice** — Verified: `luma-extract.test.js` marks `address` in `missingFields` when absent from HTML; `index.html` includes `#address`, resolve-step copy (“provide your own value or use a test placeholder”), and per-field radios for value vs placeholder.
- [x] **Multiple ticket types force explicit selection** — Verified: `pass-payload.test.js` throws when `ticketTypes.length > 1` and empty `selectedTicketType`.
- [x] **Generated pass contains visible `TEST / NOT VALID`** — Verified: `normalizePayload` forces `testMarker`; `scripts/render_pass_payload.py` maps `organizationName`, `description`, and primary auxiliary-style field to marker; aligns with enforced server normalization.
- [x] **Generated pass QR payload uses `example.invalid`** — Verified: `normalizePayload` produces `qrMessage` matching `^https://example\.invalid/`; renderer uses `payload["qrMessage"]` with fallback base `https://example.invalid/test-pass`.

## Commands run this session

```bash
cd wallet-web && npm test
```

```bash
cd wallet-web && node --input-type=module -e "import { getSigningHealth } from './api/_lib/signingHealth.js'; console.log(JSON.stringify(await getSigningHealth(), null, 2));"
```

## Follow-up manual smoke (recommended)

After copying `.env.example` → `.env` and pointing at real PEM/key files:

1. `npx vercel dev` and open http://localhost:3000  
2. Confirm signing panel shows readiness and `.pkpass` downloads from Generate.
