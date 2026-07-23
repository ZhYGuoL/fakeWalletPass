/**
 * Admin auth: password login -> signed session cookie, with per-IP lockout.
 *
 *  - The password (ADMIN_TOKEN) is submitted in a POST form body, never in a
 *    URL, so it can't leak via history / referrer / logs.
 *  - A correct login mints an HMAC-signed, HttpOnly, SameSite=Strict session
 *    cookie (kp_admin). Data/UI requests are authorized by that cookie only;
 *    the password is accepted at the login endpoint alone.
 *  - Failed logins are rate-limited per IP with a lockout, so brute-force is
 *    impossible regardless of password strength.
 *  - Unauthorized data/UI requests get a bare 404 so nothing is discoverable.
 *  - Locked-by-default in production: no ADMIN_TOKEN -> access denied (dev only).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Best-effort per-instance lockout store (serverless instances are few and
// long-lived under load, so this meaningfully throttles brute-force; the strong
// password makes cross-instance gaps irrelevant).
const failures = new Map(); // ip -> { count, until }

export function isProduction() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function adminSecret() {
  return process.env.ADMIN_TOKEN?.trim() || "";
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/* ── rate limiting ── */
export function isLockedOut(ip) {
  const rec = failures.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.until) {
    failures.delete(ip);
    return false;
  }
  return rec.count >= MAX_FAILURES;
}

export function recordFailure(ip) {
  const rec = failures.get(ip) || { count: 0, until: 0 };
  rec.count += 1;
  rec.until = Date.now() + LOCKOUT_MS;
  failures.set(ip, rec);
}

export function clearFailures(ip) {
  failures.delete(ip);
}

/* ── password + session ── */
export function passwordMatches(provided) {
  const secret = adminSecret();
  if (!secret) return false;
  return safeEqual(String(provided || ""), secret);
}

function sign(payload) {
  return createHmac("sha256", adminSecret()).update(payload).digest("base64url");
}

export function mintSession() {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

function sessionCookieValue(request) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === "kp_admin") {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return "";
}

export function hasValidSession(request) {
  const secret = adminSecret();
  if (!secret) return !isProduction(); // dev convenience when unconfigured
  const value = sessionCookieValue(request);
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const exp = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export function sessionSetCookie() {
  const flags = ["HttpOnly", "Path=/api", "SameSite=Strict", `Max-Age=${SESSION_TTL_MS / 1000}`];
  if (isProduction()) flags.push("Secure");
  return `kp_admin=${encodeURIComponent(mintSession())}; ${flags.join("; ")}`;
}

export function sessionClearCookie() {
  const flags = ["HttpOnly", "Path=/api", "SameSite=Strict", "Max-Age=0"];
  if (isProduction()) flags.push("Secure");
  return `kp_admin=; ${flags.join("; ")}`;
}

/** Bare 404 — indistinguishable from a route that doesn't exist. */
export function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
