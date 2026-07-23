/**
 * POST /api/track-ticket - the real ticket tracker (private hook).
 *
 * Keypass's pass-generation calls this whenever it creates a pass. It bumps
 * that event's "tickets created" count, auto-registering the event the first
 * time it's seen so every event ends up tracked.
 *
 * Access is gated by the admin token (send `x-admin-token`), so the endpoint
 * can't be discovered or abused to inflate counts - unauthorized callers get
 * a bare 404. In local dev (no ADMIN_TOKEN) it's open for convenience.
 *
 * Body: { url, name?, host?, location?, status?, count? }
 *   - url   (required): the Luma event URL; its slug is the event key.
 *   - count (optional): how many tickets to add (default 1).
 *   - name/host/location/status: metadata used only when auto-creating.
 */

import { isProduction, notFound, passwordMatches } from "./_lib/admin-auth.js";
import { deriveSlug, incrementCount } from "./_lib/events.js";

// Server-to-server hook: the agent sends the admin secret as `x-admin-token`.
function agentAuthorized(request, bodyToken) {
  const token = request.headers.get("x-admin-token") || bodyToken || "";
  if (process.env.ADMIN_TOKEN?.trim()) return passwordMatches(token);
  return !isProduction();
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    if (!agentAuthorized(request)) return notFound();
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!agentAuthorized(request, payload?.token)) return notFound();

  const eventUrl = String(payload?.url || "").trim();
  const slug = payload?.slug ? String(payload.slug).trim() : deriveSlug(eventUrl);
  if (!slug) {
    return json({ error: "A `url` (or `slug`) is required." }, 400);
  }

  const count = payload?.count != null ? Number(payload.count) : 1;
  if (!Number.isFinite(count) || count < 1) {
    return json({ error: "`count` must be a positive number." }, 400);
  }

  const event = await incrementCount(slug, count, {
    url: eventUrl,
    name: payload?.name,
    host: payload?.host,
    location: payload?.location,
    status: payload?.status,
  });

  return json({ ok: true, slug: event.slug, ticketsCreated: event.ticketsCreated });
}
