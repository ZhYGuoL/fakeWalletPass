# wallet-web — Luma test pass generator

Local-only prototype UI and API handlers for extracting public Luma event fields and generating signed **test** Apple Wallet passes (dummy QR, forced `TEST / NOT VALID`).

## Run locally

Run these commands **one at a time** (do not paste as a single line):

```bash
cd wallet-web
cp .env.example .env
npm test
npm run dev
```

Then open **http://127.0.0.1:3000** in your browser.

Set `WWDR_PEM_PATH`, `SIGNER_CERT_PATH`, and `SIGNER_KEY_PATH` in `.env` to PEM files that exist on disk so `/api/signing-health` reports `ready: true` and `/api/generate-pass` can run the signing pipeline.

### Why not `vercel dev`?

`npx vercel dev` requires a valid Vercel login token. For local testing, use `npm run dev` instead — it runs the same API handlers without Vercel.

Optional (if you are logged into Vercel): `npx vercel dev`
