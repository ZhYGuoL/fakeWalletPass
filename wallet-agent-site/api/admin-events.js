/**
 * Private admin backend for the ticket tracker.
 *
 *   GET  /api/admin-events?ui=1   -> dashboard (if logged in) or login page
 *   GET  /api/admin-events        -> JSON list of events (session required)
 *   POST /api/admin-events        -> { action } mutations (session required),
 *                                    plus { action: "login", password }
 *
 * Auth is a password login that mints an HMAC-signed HttpOnly session cookie
 * (see ./_lib/admin-auth.js). The password never appears in a URL, failed
 * logins are rate-limited per IP with lockout, and unauthorized data/UI
 * requests return a bare 404 so nothing is discoverable.
 */

import {
  clearFailures,
  clientIp,
  hasValidSession,
  isLockedOut,
  notFound,
  passwordMatches,
  recordFailure,
  sessionSetCookie,
} from "./_lib/admin-auth.js";
import { ADMIN_HTML, LOGIN_HTML } from "./_lib/admin-ui.js";
import {
  deleteEvent,
  loadEvents,
  reseed,
  setCount,
  upsertEvent,
} from "./_lib/events.js";

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}

function html(body, extraHeaders = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...extraHeaders,
    },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  const loggedIn = hasValidSession(request);

  // The UI is the only surface an anonymous visitor may see, and only as a
  // bare login prompt — never revealing data.
  if (url.searchParams.has("ui")) {
    return loggedIn ? html(ADMIN_HTML) : html(LOGIN_HTML);
  }

  if (!loggedIn) return notFound();

  const events = await loadEvents();
  events.sort((a, b) => b.ticketsCreated - a.ticketsCreated || a.name.localeCompare(b.name));
  return json({ events, count: events.length });
}

export async function POST(request) {
  const url = new URL(request.url);

  let payload;
  try {
    payload = await request.json();
  } catch {
    if (!hasValidSession(request)) return notFound();
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Login is the one action allowed without a session.
  if (payload?.action === "login") {
    const ip = clientIp(request);
    if (isLockedOut(ip)) {
      return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    }
    if (!passwordMatches(payload.password)) {
      recordFailure(ip);
      return json({ error: "Incorrect password." }, 401);
    }
    clearFailures(ip);
    return json({ ok: true }, 200, { "Set-Cookie": sessionSetCookie() });
  }

  if (!hasValidSession(request)) return notFound();

  const action = String(payload?.action || "").trim();
  try {
    if (action === "upsert") {
      return json({ ok: true, event: await upsertEvent(payload.event || {}) });
    }
    if (action === "setCount") {
      const event = await setCount(payload.slug, payload.ticketsCreated);
      if (!event) return json({ error: `No event with slug "${payload.slug}".` }, 404);
      return json({ ok: true, event });
    }
    if (action === "delete") {
      return json({ ok: await deleteEvent(payload.slug) });
    }
    if (action === "reseed") {
      const events = await reseed();
      return json({ ok: true, count: events.length });
    }
    return json({ error: `Unknown action "${action}".` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Server error." }, 500);
  }
}
