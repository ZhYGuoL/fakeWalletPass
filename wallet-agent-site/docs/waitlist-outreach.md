# Waitlist outreach

## Can the agent message them first?

**Yes, on the Business (dedicated line) plan.** Photon supports **cold outreach** (about **50 new contacts per line per day**). After each user is registered on your Business project, the agent can open a DM and send the first iMessage — they do not need to text the line first.

On the old **Pro shared-pool** plan, outbound to arbitrary numbers was not allowed; users had to message the assigned line first.

## Outreach copy (default)

```
Hey — you're off the waitlist. Your Luma Wallet pass agent is live.

Send any public Luma event link (lu.ma or luma.com) and I'll build you an Apple Wallet pass.

Reply here anytime — I'm on this thread.
```

Edit `OUTREACH_MESSAGE` in `imessage-agent/scripts/bulk-outreach.mjs` if you want a different tone.

## Scripts

### 1. Register everyone on Business

```bash
cd wallet-agent-site
node --env-file=.env.production.local scripts/bulk-register-waitlist.mjs
```

Report: `data/waitlist-register-report.json`

### 2. Send proactive iMessages

Keep the **Business Railway worker** running (`luma-imessage-agent-business`) so replies are handled.

Photon limits to plan for:

- **~50 new cold contacts per line per day**
- **~20 identical messages per 15 minutes** — the bulk script personalizes each text (last 4 digits of their number) to avoid this

Run in small batches (e.g. 18–20), wait 15+ minutes, repeat. Finish the list over a few days.

```bash
cd imessage-agent
node --env-file=../wallet-agent-site/.env.production.local scripts/bulk-outreach.mjs --limit 18
```

Progress: `imessage-agent/data/outreach-sent.json`. Re-run until pending is zero.

Dry run: add `--dry-run`.

## SMS fallback for users who never open iMessage

Registration returns a `messagesUrl` redirect; the landing page also uses `sms:` deep links. For users without iMessage, RCS/SMS fallback is a Photon Business feature — same dedicated line.
