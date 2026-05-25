# Luma iMessage Agent (Spectrum-ts)

Text a Luma link, answer a few prompts, get a **test-only** `.pkpass` back in iMessage.

Built on [Photon Spectrum-ts](https://github.com/photon-hq/spectrum-ts) — same agent logic runs locally in the terminal simulator or on real iMessage via Spectrum Cloud.

## Prerequisites

- Node 20+
- Python venv + signing certs at repo root (same as `wallet-web` pass generator)
- For iMessage: [Photon project](https://app.photon.codes/) with `PROJECT_ID` + `PROJECT_SECRET`

## Setup

```bash
cd imessage-agent
cp .env.example .env
npm install
```

## Testing without the website

The website and agent are **not connected yet**. You do not need `wallet-web` or `npm run dev` in `wallet-web/` to talk to the agent — only the agent process below.

### Option A — Terminal chat (fastest)

```bash
cd imessage-agent
# .env: USE_TERMINAL=true
npm run dev
```

Type a Luma URL in that terminal, answer prompts, get the pass file path in logs / attachment handling.

On **shared-pool** plans Photon does not let you message arbitrary numbers. You must **register your phone** first; Photon assigns a line to text.

**Terminal 1** — keep running:

```bash
cd imessage-agent
npm run dev
```

**Terminal 2** — register your phone (once):

```bash
npm run register -- +1YOURPHONE
```

It prints a line like `Text this line: +16282647704`. In Messages, **text that number** with a Luma URL. That is your inbound path — no website needed.

(`npm run ping` may still fail on shared plans; inbound to the assigned line is the reliable approach.)

### Option B — Real iMessage (your Photon project)

On **shared-pool** plans there is no fixed “text this number” line. Start the listener, then open a thread by pinging your phone:

**Terminal 1** — keep running:

```bash
cd imessage-agent
npm run dev
```

**Terminal 2** — one-time (use your phone in E.164 format, e.g. `+14155551234`):

```bash
cd imessage-agent
npm run ping -- +1YOURPHONE
```

Check Messages for the new thread, reply with a Luma link (e.g. `https://luma.com/4y89vpyu`).

### Local dev (terminal chat)

```bash
# .env
USE_TERMINAL=true
```

```bash
npm run dev
```

Type a Luma URL, answer prompts, receive the pass attachment in the terminal session.

### iMessage (Spectrum Cloud)

```bash
# .env
USE_TERMINAL=false
PROJECT_ID=your-project-id
PROJECT_SECRET=your-secret-key
```

Enable iMessage for the project in the Photon dashboard, then:

```bash
npm run dev
```

Messages to your Spectrum iMessage number are handled by this agent.

## Flow

1. User sends `https://luma.com/...` or `https://lu.ma/...`
2. Agent scrapes public page (reuses `wallet-web/api/_lib/lumaExtract.js`)
3. Prompts for hidden address, ticket type (if multiple), and guest name
4. Builds + signs pass (reuses `passBuild.js` + Python render/sign scripts)
5. Replies with `.pkpass` attachment + `TEST / NOT VALID` caption

Commands: `help`, `reset`

## Architecture

```
imessage-agent/src/
  index.ts        Spectrum app bootstrap
  agent.ts        inbound message handler
  conversation.ts per-thread session state (in-memory)
  luma.ts         URL detect + public page extract
  pass.ts         normalizePayload + buildPass wrapper
  config.ts       terminal vs iMessage providers
```

Reuses wallet-web libs — no duplicated extract/sign logic.

## Notes

- Session state is **in-memory** (resets when the process restarts).
- Passes are always test-only (`TEST / NOT VALID`, dummy QR) — enforced in `passPayload.js`.
- `USE_TERMINAL` defaults to on when Photon credentials are missing.

## Deploy to Railway

The agent is a **long-running worker** (not a web server). It connects outbound to Photon Spectrum Cloud and stays alive to handle iMessage threads.

### 1. Create the Railway service

From the **repo root** (`fakeWalletPass/`, not `imessage-agent/`):

```bash
npx @railway/cli login
npx @railway/cli init          # new project, or link an existing one
npx @railway/cli up            # build Dockerfile + deploy
```

Or connect the GitHub repo in the [Railway dashboard](https://railway.com/) — Railway picks up `railway.toml` and `Dockerfile` automatically.

In the service settings, set the type to **Worker** (no public HTTP port required).

### 2. Set environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROJECT_ID` | yes | Photon project ID |
| `PROJECT_SECRET` | yes | Photon project secret |
| `USE_TERMINAL` | auto | Set to `false` in Docker (default) |
| `WWDR_PEM` | yes | Full Apple WWDR intermediate PEM (`\n` for line breaks) |
| `SIGNER_CERT_PEM` | yes | Pass Type ID certificate PEM |
| `SIGNER_KEY_PEM` | yes | Pass Type ID private key PEM |

To copy local certs into Railway-friendly one-liners:

```bash
# from repo root, with certs/ populated locally
printf 'WWDR_PEM=%s\n' "$(awk '{printf "%s\\n", $0}' certs/wwdr.pem)"
printf 'SIGNER_CERT_PEM=%s\n' "$(awk '{printf "%s\\n", $0}' certs/signer.pem)"
printf 'SIGNER_KEY_PEM=%s\n' "$(awk '{printf "%s\\n", $0}' certs/signer.key)"
```

Paste each output line as a Railway variable.

### 3. Verify deployment

```bash
npx @railway/cli logs
```

You should see: `Starting Luma pass agent — iMessage (Photon Spectrum Cloud)`.

Then text your Photon line (or run `npm run ping -- +1YOURPHONE` locally against the same project) and send a Luma URL.

### Local Docker smoke test

```bash
docker build -t luma-imessage-agent .
docker run --rm -it \
  -e PROJECT_ID=... \
  -e PROJECT_SECRET=... \
  -e WWDR_PEM='-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----' \
  -e SIGNER_CERT_PEM='...' \
  -e SIGNER_KEY_PEM='...' \
  luma-imessage-agent
```

