/**
 * Private admin backend for the ticket tracker.
 *
 *   GET  /api/admin-events?ui=1   → the admin dashboard HTML (gated)
 *   GET  /api/admin-events        → JSON list of every tracked event
 *   POST /api/admin-events        → mutate the store
 *
 * Every response to an UNAUTHORIZED caller is a bare 404, so neither the
 * endpoint nor the admin concept is discoverable by probing. Auth is via a
 * one-time `?token=` secret link (which sets a session cookie) or the
 * `x-admin-token` header. Locked in production unless ADMIN_TOKEN is set.
 *
 * POST actions:
 *   { action: "upsert", event: {...} } | { action: "setCount", slug, ticketsCreated }
 *   { action: "delete", slug }         | { action: "reseed" }
 */

import { isAuthorized, notFound, sessionCookie } from "./_lib/admin-auth.js";
import { ADMIN_HTML } from "./_lib/admin-ui.js";
import {
  deleteEvent,
  loadEvents,
  reseed,
  setCount,
  upsertEvent,
} from "./_lib/events.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function GET(request) {
  const url = new URL(request.url);
  if (!isAuthorized(request, url)) return notFound();

  // Serve the dashboard UI.
  if (url.searchParams.has("ui")) {
    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    };
    // If unlocked via the secret link, drop a session cookie so the token
    // can leave the URL and reloads keep working.
    const tokenInUrl = url.searchParams.get("token");
    if (tokenInUrl && process.env.ADMIN_TOKEN?.trim()) {
      headers["Set-Cookie"] = sessionCookie(tokenInUrl);
    }
    return new Response(ADMIN_HTML, { status: 200, headers });
  }

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
    // Don't reveal shape to unauthenticated callers.
    if (!isAuthorized(request, url)) return notFound();
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!isAuthorized(request, url, payload?.token)) return notFound();

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
