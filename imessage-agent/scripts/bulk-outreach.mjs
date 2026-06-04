/**
 * Proactive iMessage outreach to registered users (Business / dedicated line).
 * Photon Business allows cold outreach — up to ~50 new contacts per line per day.
 *
 *   node --env-file=../wallet-agent-site/.env.production.local scripts/bulk-outreach.mjs
 *   node --env-file=../wallet-agent-site/.env.production.local scripts/bulk-outreach.mjs --limit 50
 *   node --env-file=../wallet-agent-site/.env.production.local scripts/bulk-outreach.mjs --dry-run
 *
 * Reads phones from wallet-agent-site/data/waitlist-register-report.json (ok + exists)
 * or waitlist-recovered.json. Tracks progress in data/outreach-sent.json.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = join(__dirname, "..");
const SITE_ROOT = join(AGENT_ROOT, "..", "wallet-agent-site");
const REPORT_PATH = join(SITE_ROOT, "data", "waitlist-register-report.json");
const WAITLIST_PATH = join(SITE_ROOT, "data", "waitlist-recovered.json");
const SENT_PATH = join(AGENT_ROOT, "data", "outreach-sent.json");

const E164 = /^\+[1-9]\d{6,14}$/;

/** Base copy — each send adds the last 4 digits so Photon does not treat them as duplicate spam. */
export function outreachMessageFor(phone) {
  const tail = phone.replace(/\D/g, "").slice(-4) || "0000";
  return [
    "Hey — you're off the waitlist. Your Luma Wallet pass agent is live.",
    "",
    "Send any public Luma event link (lu.ma or luma.com) and I'll build you an Apple Wallet pass.",
    "",
    `Reply here anytime — I'm on this thread (your signup ended in ${tail}).`,
  ].join("\n");
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : 50;
  return { dryRun, limit: Number.isFinite(limit) && limit > 0 ? limit : 50 };
}

function loadPhones() {
  if (existsSync(REPORT_PATH)) {
    const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
    return report.results
      .filter((r) => r.ok || r.already)
      .map((r) => r.phoneNumber)
      .filter((p) => E164.test(p));
  }
  const raw = JSON.parse(readFileSync(WAITLIST_PATH, "utf8"));
  return (raw.phones || []).filter((p) => E164.test(p));
}

function loadSent() {
  if (!existsSync(SENT_PATH)) return new Set();
  const data = JSON.parse(readFileSync(SENT_PATH, "utf8"));
  return new Set(data.sent || []);
}

function saveSent(sentSet) {
  mkdirSync(join(AGENT_ROOT, "data"), { recursive: true });
  writeFileSync(
    SENT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), sent: [...sentSet].sort() }, null, 2),
  );
}

async function main() {
  process.env.USE_TERMINAL = "false";
  const { dryRun, limit } = parseArgs();

  const projectId = process.env.PROJECT_ID?.trim();
  const projectSecret = process.env.PROJECT_SECRET?.trim();
  if (!projectId || !projectSecret) {
    throw new Error("Set PROJECT_ID and PROJECT_SECRET");
  }

  const sent = loadSent();
  const pending = loadPhones().filter((p) => !sent.has(p));
  const batch = pending.slice(0, limit);

  console.log(`Pending outreach: ${pending.length}, this run: ${batch.length} (limit ${limit})`);

  if (dryRun) {
    for (const p of batch) console.log("would send:", p);
    return;
  }

  if (batch.length === 0) {
    console.log("Nothing to send.");
    return;
  }

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });
  const im = imessage(app);

  for (const phone of batch) {
    try {
      const recipient = await im.user(phone);
      const dm = await im.space(recipient);
      await dm.send(outreachMessageFor(phone));
      sent.add(phone);
      saveSent(sent);
      console.log(`sent\t${phone}`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`fail\t${phone}\t${msg}`);
    }
  }

  await app.stop();
  console.log(`Done. Total sent (all time): ${sent.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
