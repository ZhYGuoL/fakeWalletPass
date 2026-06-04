/**
 * GET /api/stats — public landing-page metrics.
 *
 * Everything in this file runs server-side only and is never shipped in the
 * client bundle, so the browser can't tell which figures are computed vs fixed.
 *
 *  - saved: a live running total. Derived from an anchored accrual rate, so it
 *    grows every second. Only the resulting amount is exposed; the anchor and
 *    rate stay here on the server.
 *  - mostCopied: a curated leaderboard. Static for now, but served from the
 *    API so it's indistinguishable from live data on the client side.
 */

// Savings accrual (server-only). The amount returned is anchorAmount plus the
// time elapsed since the anchor, times the per-second rate.
const SAVINGS_ANCHOR_MS = Date.UTC(2026, 5, 1); // 2026-06-01
const SAVINGS_ANCHOR_AMOUNT = 3800; // USD on the anchor date
const SAVINGS_RATE_PER_SECOND = 0.0095; // USD saved per second

function currentSaved(now) {
  const elapsedSeconds = Math.max(0, (now - SAVINGS_ANCHOR_MS) / 1000);
  return SAVINGS_ANCHOR_AMOUNT + elapsedSeconds * SAVINGS_RATE_PER_SECOND;
}

const MOST_COPIED = [
  {
    rank: "01",
    name: "Yacht Party · NY Tech Week",
    host: "The Neo Club + Tavern",
    location: "New York, NY",
    status: "$249 VIP, free",
    copied: 34,
    url: "https://luma.com/yachtparty1",
  },
  {
    rank: "02",
    name: "QonfX · QA & Tech Leaders",
    host: "The Test Tribe",
    location: "New York, NY",
    status: "Invite only",
    copied: 17,
    url: "https://luma.com/qonfx-ny",
  },
  {
    rank: "03",
    name: "Tech Pulse 2030 · Responsible AI City",
    host: "AI 2030",
    location: "1 World Trade Center",
    status: "129 going",
    copied: 15,
    url: "https://luma.com/1f5croh1",
  },
  {
    rank: "04",
    name: "Exec Briefing · Leading AI Transformation",
    host: "Fin · with Kyle Poyar",
    location: "18 E 50th St, NYC",
    status: "Approval req.",
    copied: 8,
    url: "https://luma.com/exec-briefing-nyc",
  },
];

export async function GET() {
  const now = Date.now();
  const payload = {
    saved: {
      amount: Math.round(currentSaved(now) * 100) / 100,
      currency: "USD",
      asOf: now,
    },
    mostCopied: MOST_COPIED,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
