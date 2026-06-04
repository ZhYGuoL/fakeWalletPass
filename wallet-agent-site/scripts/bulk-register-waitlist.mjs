/**
 * Register recovered waitlist phones on the Business Photon project (dedicated line).
 *
 *   node --env-file=.env.local scripts/bulk-register-waitlist.mjs
 *   node --env-file=.env.local scripts/bulk-register-waitlist.mjs --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WAITLIST_PATH = join(ROOT, "data", "waitlist-recovered.json");
const REPORT_PATH = join(ROOT, "data", "waitlist-register-report.json");

const E164 = /^\+[1-9]\d{6,14}$/;
const BLOCKLIST = new Set(["+11234567890", "+11083348859", "+11382929292"]);

function loadEnv() {
  const projectId = process.env.PROJECT_ID?.trim();
  const projectSecret = process.env.PROJECT_SECRET?.trim();
  const agentLine = (process.env.AGENT_LINE_PHONE || "").trim();
  if (!projectId || !projectSecret) {
    throw new Error("Set PROJECT_ID and PROJECT_SECRET (e.g. --env-file=.env.local)");
  }
  if (!E164.test(agentLine)) {
    throw new Error("Set AGENT_LINE_PHONE to a valid E.164 dedicated line");
  }
  return { projectId, projectSecret, agentLine };
}

export function isPlausibleWaitlistPhone(phone) {
  if (!E164.test(phone)) return false;
  if (BLOCKLIST.has(phone)) return false;
  const digits = phone.slice(1);
  if (digits.length < 10 || digits.length > 15) return false;
  return true;
}

async function registerOne({ projectId, projectSecret, agentLine }, phoneNumber) {
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
  const res = await fetch(`https://spectrum.photon.codes/projects/${projectId}/users/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      type: "dedicated",
      phoneNumber,
      assignedPhoneNumber: agentLine,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok && body.succeed && body.data) {
    return { ok: true, userId: body.data.id, assignedPhoneNumber: body.data.assignedPhoneNumber };
  }

  const message = typeof body.message === "string" ? body.message : `HTTP ${res.status}`;
  const already =
    /already|exist|duplicate/i.test(message) ||
    (res.status === 409) ||
    (res.status === 400 && /exist/i.test(message));

  return { ok: false, already, message };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv();
  const raw = JSON.parse(readFileSync(WAITLIST_PATH, "utf8"));
  const phones = [...new Set((raw.phones || []).filter(isPlausibleWaitlistPhone))].sort();

  console.log(`Waitlist phones (filtered): ${phones.length}`);

  if (dryRun) {
    for (const p of phones) console.log(p);
    return;
  }

  const results = [];
  for (const phoneNumber of phones) {
    const result = await registerOne(env, phoneNumber);
    results.push({ phoneNumber, ...result });
    const tag = result.ok ? "ok" : result.already ? "exists" : "fail";
    console.log(`${tag}\t${phoneNumber}${result.message ? `\t${result.message}` : ""}`);
    await new Promise((r) => setTimeout(r, 200));
  }

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const summary = {
    at: new Date().toISOString(),
    agentLine: env.agentLine,
    total: phones.length,
    registered: results.filter((r) => r.ok).length,
    alreadyExisted: results.filter((r) => r.already).length,
    failed: results.filter((r) => !r.ok && !r.already).length,
    results,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
  console.log("\nWrote", REPORT_PATH);
  console.log(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
