# wallet-web — Luma test pass generator

Local-only prototype UI and Vercel-style API handlers for extracting public Luma event fields and generating signed **test** Apple Wallet passes (dummy QR, forced `TEST / NOT VALID`).

## Run locally

```bash
cd wallet-web
cp .env.example .env  # configure cert paths
npm test
npx vercel dev
# open http://localhost:3000
```

Set `WWDR_PEM_PATH`, `SIGNER_CERT_PATH`, and `SIGNER_KEY_PATH` in `.env` to PEM files that exist on disk so `/api/signing-health` reports `ready: true` and `/api/generate-pass` can run the signing pipeline.
