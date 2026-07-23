/**
 * GET /api/stats - public landing-page metrics.
 *
 *  - saved: a live running total, derived from an anchored accrual rate so it
 *    grows every second. Only the resulting amount is exposed.
 *  - events: the real "tickets created" leaderboard, sorted highest-first,
 *    served from the persistent tracker (see api/_lib/events.js). Each entry
 *    carries a display rank so the client stays presentation-only.
 */

import { listEventsRanked } from "./_lib/events.js";

// Savings accrual (server-only). The amount returned is anchorAmount plus the
// time elapsed since the anchor, times the per-second rate.
const SAVINGS_ANCHOR_MS = Date.UTC(2026, 5, 1); // 2026-06-01
const SAVINGS_ANCHOR_AMOUNT = 3800; // USD on the anchor date
const SAVINGS_RATE_PER_SECOND = 0.0095; // USD saved per second

function currentSaved(now) {
  const elapsedSeconds = Math.max(0, (now - SAVINGS_ANCHOR_MS) / 1000);
  return SAVINGS_ANCHOR_AMOUNT + elapsedSeconds * SAVINGS_RATE_PER_SECOND;
}

export async function GET() {
  const now = Date.now();
  const ranked = await listEventsRanked();
  const events = ranked.map((event, i) => ({
    rank: String(i + 1).padStart(2, "0"),
    name: event.name,
    host: event.host,
    location: event.location,
    status: event.status,
    ticketsCreated: event.ticketsCreated,
    url: event.url,
  }));

  const payload = {
    saved: {
      amount: Math.round(currentSaved(now) * 100) / 100,
      currency: "USD",
      asOf: now,
    },
    events,
    // Compatibility alias so a cached/older client that reads `mostCopied`
    // still renders the leaderboard. Same data, extra field name.
    mostCopied: events.map((e) => ({ ...e, copied: e.ticketsCreated })),
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
