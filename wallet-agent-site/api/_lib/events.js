/**
 * Event ticket tracker - persistent store of "tickets created" per event.
 *
 * Storage:
 *   - Production (Vercel Blob configured): a single JSON document at
 *     `events/events.json`, read-modify-written atomically.
 *   - Everywhere else: a local JSON file at `data/events.json`.
 *
 * The seed below is baked into code (data/ is git-ignored), so the YC
 * Startup School leaderboard appears on first read in any environment.
 * Counts are seeded with a popularity head-start and then grow for real
 * as passes are created via POST /api/track-ticket.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const LOCAL_PATH = join(process.cwd(), "data", "events.json");
const BLOB_KEY = "events/events.json";

export function hasBlobStorage() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim(),
  );
}

/**
 * YC Startup School 2026 after-parties, ranked by predicted popularity from
 * the hosting company's brand pull and demand (sold-out parties draw the most
 * Keypass usage). The yacht gala tops the list at 91 tickets; the rest step down.
 */
export const SEED_EVENTS = [
  {
    name: "Ship 2 Prod: Black-Tie Yacht Gala",
    host: "Resonance × GMI Cloud",
    location: "Pier 40, Mission Bay",
    status: "Open",
    url: "https://luma.com/ojidqyj8",
    ticketsCreated: 91,
  },
  {
    name: "Stripe Presents: Made in San Francisco",
    host: "Stripe · S09",
    location: "Embarcadero, SF",
    status: "Sold out",
    url: "https://luma.com/xggm2di5",
    ticketsCreated: 82,
  },
  {
    name: "Vercel, Warp, Reducto & Browserbase Afterparty",
    host: "Vercel, Warp & 2 more",
    location: "Reducto HQ, Union Square",
    status: "Open",
    url: "https://luma.com/browse-l2aj",
    ticketsCreated: 78,
  },
  {
    name: "Moss × Supabase × Modal Afterparty",
    host: "Moss × Supabase × Modal",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/m4ez9liu",
    ticketsCreated: 73,
  },
  {
    name: "PostHog After Party @ Startup School",
    host: "PostHog · W20",
    location: "Dogpatch, SF",
    status: "Open",
    url: "https://luma.com/posthog-sus26",
    ticketsCreated: 68,
  },
  {
    name: "After Hours: YC After After Party",
    host: "Gary Tan & friends",
    location: "Alchemist Bar, SoMa",
    status: "Open",
    url: "https://luma.com/ay19k90e",
    ticketsCreated: 63,
  },
  {
    name: "Mintlify After Party",
    host: "Mintlify · W22",
    location: "Union Square, SF",
    status: "Waitlist",
    url: "https://luma.com/mintlify-mpse",
    ticketsCreated: 59,
  },
  {
    name: "Tavus Startup School Afterparty",
    host: "Tavus · S21",
    location: "Tavus HQ, SoMa",
    status: "Open",
    url: "https://luma.com/tavus-jv2v",
    ticketsCreated: 55,
  },
  {
    name: "Afterhours @Sōhn with Greptile",
    host: "Greptile · W24",
    location: "Sōhn, Dogpatch",
    status: "Open",
    url: "https://luma.com/greptile-sltd",
    ticketsCreated: 51,
  },
  {
    name: "d_model @ Startup School 2026",
    host: "d_model · S24",
    location: "Spark Social, Mission Bay",
    status: "Sold out",
    url: "https://luma.com/jz0h1t7q",
    ticketsCreated: 47,
  },
  {
    name: "Emergence Capital Startup School Mixer",
    host: "Emergence Capital",
    location: "Pier 5, Embarcadero",
    status: "Open",
    url: "https://luma.com/2ev1tu8a",
    ticketsCreated: 43,
  },
  {
    name: "YC SUS Game Night @ EF",
    host: "Entrepreneurs First",
    location: "Rincon Hill, SF",
    status: "Open",
    url: "https://luma.com/0pl3rlxm",
    ticketsCreated: 40,
  },
  {
    name: "Respan × MongoDB × Composio Afterparty",
    host: "Respan × MongoDB",
    location: "Mission Rock, Mission Bay",
    status: "Open",
    url: "https://luma.com/2p9zbnzn",
    ticketsCreated: 37,
  },
  {
    name: "Night Hack by Founders, Inc.",
    host: "Founders, Inc.",
    location: "Fort Mason, SF",
    status: "Open",
    url: "https://luma.com/nighthack?tk=27cBTa",
    ticketsCreated: 34,
  },
  {
    name: "Anything But Names: Sonder × Lemma",
    host: "Sonder × Lemma",
    location: "SoMa, SF",
    status: "Open",
    url: "https://luma.com/wmw6rnmh",
    ticketsCreated: 31,
  },
  {
    name: "Sandboxes & Sushi: YC @ Archil",
    host: "Archil · F24",
    location: "Union Square, SF",
    status: "Waitlist",
    url: "https://luma.com/chqmxhyg",
    ticketsCreated: 29,
  },
  {
    name: "LegalOS Startup School After Party",
    host: "LegalOS · W26",
    location: "Thrive City, Mission Bay",
    status: "Waitlist",
    url: "https://luma.com/47w3zljn",
    ticketsCreated: 27,
  },
  {
    name: "AI Infra Layer After-party",
    host: "InsForge & 3 more",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/9qz4l69s",
    ticketsCreated: 25,
  },
  {
    name: "AI Infra Builders: dstack, Crusoe, SGLang",
    host: "dstack × Crusoe × SGLang",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/rxsn0u0h?tk=4MRVsS",
    ticketsCreated: 23,
  },
  {
    name: "YC Startup School Afterparty @ Fondo",
    host: "Fondo · W18",
    location: "Union Square, SF",
    status: "Open",
    url: "https://luma.com/fondo_yc_startup_school_afterparty",
    ticketsCreated: 21,
  },
  {
    name: "Founder Hot Pot",
    host: "Superset × Halluminate",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/mtwf2nth",
    ticketsCreated: 19,
  },
  {
    name: "Photon GoKart Rally @ Startup School",
    host: "Photon",
    location: "Fisherman's Wharf, SF",
    status: "Open",
    url: "https://luma.com/ueokvzdw",
    ticketsCreated: 17,
  },
  {
    name: "Party in the Presidio",
    host: "Adaptional · S25",
    location: "Presidio, SF",
    status: "Waitlist",
    url: "https://luma.com/ispbsl3o",
    ticketsCreated: 15,
  },
  {
    name: "YC Founder & Investor Mixer",
    host: "Beta Fund × Rednote",
    location: "Downtown SF",
    status: "Open",
    url: "https://luma.com/beta-ugt5",
    ticketsCreated: 14,
  },
  {
    name: "How to Break Into Startups",
    host: "Doss",
    location: "Doss HQ, SoMa",
    status: "Open",
    url: "https://luma.com/pxijn023",
    ticketsCreated: 13,
  },
  {
    name: "c0mpiled-11: Startup School Hackathon",
    host: "c0mpiled × Transpose",
    location: "South Park, SF",
    status: "Waitlist",
    url: "https://luma.com/compiled-cp9o",
    ticketsCreated: 12,
  },
  {
    name: "c0mpiled-13: Startup School Hackathon II",
    host: "c0mpiled × Transpose",
    location: "South Park, SF",
    status: "Open",
    url: "https://luma.com/olys436o",
    ticketsCreated: 11,
  },
  {
    name: "YC Startup School Hackathon",
    host: "Hackathon Co. of CA",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/dpp4ulna?tk=1e7Ozj",
    ticketsCreated: 10,
  },
  {
    name: "2nd Annual Startup School Picnic",
    host: "Unicorner & friends",
    location: "Golden Gate Park",
    status: "Open",
    url: "https://luma.com/6vko8q90",
    ticketsCreated: 9,
  },
  {
    name: "Canadian YC Founders Showcase",
    host: "Forward Deployed Canadian",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/8sf0hjs0",
    ticketsCreated: 8,
  },
  {
    name: "Founder Rooftop Gala",
    host: "Plain × Vivian Cai",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/z9teb942",
    ticketsCreated: 7,
  },
  {
    name: "Founders & Investors Cocktail Hours",
    host: "Alime × Bond AI",
    location: "San Francisco, CA",
    status: "Open",
    url: "https://luma.com/axd56nxv",
    ticketsCreated: 6,
  },
  {
    name: "The Batchelor × Ditto",
    host: "BATCHelor × Ditto",
    location: "Ditto SF, 604 Mission",
    status: "Open",
    url: "https://luma.com/umq1h9te",
    ticketsCreated: 5,
  },
  {
    name: "H x YC Summer School Afterparty",
    host: "Cerenovus",
    location: "Sunnyside, SF",
    status: "Open",
    url: "https://luma.com/ngoyztxr",
    ticketsCreated: 4,
  },
  {
    name: "prox works @ YC SUS",
    host: "Prox",
    location: "San Rafael, CA",
    status: "Open",
    url: "https://luma.com/zsgl2dqw",
    ticketsCreated: 3,
  },
];

export function deriveSlug(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.replace(/^\/+|\/+$/g, "");
    return (seg || u.hostname).toLowerCase();
  } catch {
    return String(url || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

function normalize(event) {
  const now = new Date().toISOString();
  const url = event.url || "";
  return {
    slug: event.slug || deriveSlug(url),
    name: event.name || "Untitled event",
    host: event.host || "",
    location: event.location || "",
    status: event.status || "",
    url,
    ticketsCreated: Math.max(0, Math.round(Number(event.ticketsCreated) || 0)),
    seededAt: event.seededAt || now,
    updatedAt: event.updatedAt || now,
  };
}

function buildSeed() {
  return SEED_EVENTS.map((e) => normalize(e));
}

/* ── local file store ── */
async function readLocal() {
  if (!existsSync(LOCAL_PATH)) return null;
  try {
    const parsed = JSON.parse(await readFile(LOCAL_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeLocal(events) {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(LOCAL_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf8");
}

/* ── blob store (single document) ── */
async function readBlob() {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
  const found = blobs.find((b) => b.pathname === BLOB_KEY);
  if (!found) return null;
  const res = await fetch(found.url, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeBlob(events) {
  const { put } = await import("@vercel/blob");
  await put(BLOB_KEY, JSON.stringify(events, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function readStore() {
  return hasBlobStorage() ? readBlob() : readLocal();
}

async function writeStore(events) {
  return hasBlobStorage() ? writeBlob(events) : writeLocal(events);
}

/** All events, self-seeding on first read. Unsorted (storage order). */
export async function loadEvents() {
  let events = await readStore();
  if (!events || events.length === 0) {
    events = buildSeed();
    await writeStore(events);
  }
  return events.map((e) => normalize(e));
}

/** Public leaderboard: sorted by tickets desc, then name. */
export async function listEventsRanked() {
  const events = await loadEvents();
  return events
    .slice()
    .sort((a, b) => b.ticketsCreated - a.ticketsCreated || a.name.localeCompare(b.name));
}

/** Create or update an event (matched by slug). */
export async function upsertEvent(input) {
  const events = await loadEvents();
  const incoming = normalize(input);
  const idx = events.findIndex((e) => e.slug === incoming.slug);
  if (idx === -1) {
    events.push(incoming);
  } else {
    events[idx] = {
      ...events[idx],
      ...incoming,
      seededAt: events[idx].seededAt,
      updatedAt: new Date().toISOString(),
    };
  }
  await writeStore(events);
  return events.find((e) => e.slug === incoming.slug);
}

/** Set an event's ticket count to an exact value. */
export async function setCount(slug, ticketsCreated) {
  const events = await loadEvents();
  const idx = events.findIndex((e) => e.slug === slug);
  if (idx === -1) return null;
  events[idx].ticketsCreated = Math.max(0, Math.round(Number(ticketsCreated) || 0));
  events[idx].updatedAt = new Date().toISOString();
  await writeStore(events);
  return events[idx];
}

/**
 * Increment an event's ticket count (the real tracker). Auto-creates the
 * event from `meta` when it isn't tracked yet, so every event is covered.
 */
export async function incrementCount(slug, delta = 1, meta = {}) {
  const events = await loadEvents();
  const idx = events.findIndex((e) => e.slug === slug);
  const step = Math.max(1, Math.round(Number(delta) || 1));

  if (idx === -1) {
    const created = normalize({ ...meta, slug, ticketsCreated: step });
    events.push(created);
    await writeStore(events);
    return created;
  }

  events[idx].ticketsCreated += step;
  events[idx].updatedAt = new Date().toISOString();
  await writeStore(events);
  return events[idx];
}

/** Remove an event. */
export async function deleteEvent(slug) {
  const events = await loadEvents();
  const next = events.filter((e) => e.slug !== slug);
  await writeStore(next);
  return next.length !== events.length;
}

/** Reset the whole store back to the seeded leaderboard. */
export async function reseed() {
  const seeded = buildSeed();
  await writeStore(seeded);
  return seeded;
}
