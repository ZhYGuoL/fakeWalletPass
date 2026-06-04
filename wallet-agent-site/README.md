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

The dev server serves Vite HMR and `/api/register-agent` (Photon user registration).

Set these in `.env` locally and in Vercel project settings for production:

| Variable | Purpose |
| --- | --- |
| `PROJECT_ID` | Photon Spectrum project ID (**Business** project for new sign-ups) |
| `PROJECT_SECRET` | Photon Spectrum project secret |
| `AGENT_LINE_PHONE` | Dedicated iMessage line (E.164). New users register against this line. |

Legacy Pro users stay on the old Railway worker + old Spectrum project. Only point this site at the **new** project credentials.

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
