# Wallet Agent Landing Site

Standalone marketing/landing page for the iMessage-to-Wallet agent.  
This app is intentionally separate from `wallet-web` (the local test tooling UI).

## Local development

```bash
cd wallet-agent-site
cp .env.example .env   # add PROJECT_ID + PROJECT_SECRET from app.photon.codes
npm install
npm run dev
```

The dev server serves Vite HMR and `/api/register-agent` (Photon shared-user registration).

Set these in `.env` locally and in Vercel project settings for production:

| Variable | Purpose |
| --- | --- |
| `PROJECT_ID` | Photon Spectrum project ID |
| `PROJECT_SECRET` | Photon Spectrum project secret |

## Build

```bash
npm run build
```

## Vercel deploy

From this directory:

```bash
npx vercel
```

For production:

```bash
npx vercel --prod
```
