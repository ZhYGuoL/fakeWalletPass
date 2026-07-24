/** Public Luma event pages use lu.ma or luma.com. */
export function isValidLumaEventUrl(url) {
  return /^https?:\/\/(?:www\.)?(?:lu\.ma|luma\.com)\/.+/i.test(url || "");
}

/** Normalize bare or messy Luma URLs to https form for QR payloads. */
export function normalizeLumaEventUrl(candidate) {
  const cleaned = String(candidate ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/[.,)]+$/, "");
  if (!cleaned) return null;

  const withScheme = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^www\./i, "")}`;

  return isValidLumaEventUrl(withScheme) ? withScheme : null;
}

/**
 * Luma hides `geo_address_info` from anyone who is not already registered, so
 * for these events the scrape comes back address-less and the agent has to stop
 * and ask. We know these venues, so answer for the user instead. Keyed by event
 * slug, which makes any `?tk=` access token on the URL irrelevant. Values match
 * the single address line Luma's own pass puts in `event_address`; the full
 * street address follows in a comment for reference.
 */
// Each override expires after the event window. `nighthack` is a reusable
// vanity slug, so without an expiry a future Night Hack at a different venue
// would silently inherit this address; `until` (UTC end-of-day) prevents that.
const KNOWN_EVENT_ADDRESSES = {
  // JSV Summer Friday x Mercury - 50 O'Farrell St, San Francisco, CA 94108
  objb8rym: { address: "Chotto Matte San Francisco", until: "2026-08-01" },
  // Night Hack by Founders, Inc. - 2 Marina Blvd B300, San Francisco, CA 94123
  nighthack: { address: "Founders, Inc. | San Francisco Lab", until: "2026-08-01" },
};

function knownAddressFor(sourceUrl) {
  try {
    const url = new URL(
      /^https?:\/\//i.test(sourceUrl) ? sourceUrl : `https://${sourceUrl}`,
    );
    const slug = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    const entry = slug ? KNOWN_EVENT_ADDRESSES[slug.toLowerCase()] : null;
    if (!entry) return null;
    if (entry.until && Date.now() > Date.parse(`${entry.until}T23:59:59Z`)) {
      return null;
    }
    return entry.address;
  } catch {
    return null;
  }
}

const META_RE = /<meta[^>]+property="([^"]+)"[^>]+content="([^"]*)"/gi;
const TIME_RE = /<time[^>]+datetime="([^"]+)"/i;
const NEXT_DATA_RE =
  /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s;

function decodeHtmlEntities(value) {
  if (!value) return null;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripLumaTitleSuffix(title) {
  if (!title) return null;
  return title.replace(/\s*·\s*Luma\s*$/i, "").trim() || title;
}

const PRESENTED_BY_RE =
  /Presented by<\/div><a class="title" href="[^"]*".*?>(.*?)<\/a>/is;

function parsePresentedByTitle(html) {
  const match = html.match(PRESENTED_BY_RE);
  if (!match) return null;
  const title = match[1].replace(/<[^>]+>/g, "").trim();
  return title || null;
}

function resolveHostName(html, root) {
  const presentedTitle = parsePresentedByTitle(html);
  if (presentedTitle) return presentedTitle;

  if (html.includes("Presented by")) {
    const calendar = root?.calendar;
    if (calendar?.name && calendar.is_personal === false) {
      return calendar.name;
    }
  }

  const hosts = Array.isArray(root?.hosts) ? root.hosts : [];
  if (hosts[0]?.name) return hosts[0].name;

  return null;
}

function parseMeta(html) {
  const meta = {};
  for (const match of html.matchAll(META_RE)) meta[match[1]] = match[2];
  return meta;
}

function parseNextEventPayload(html) {
  const match = html.match(NEXT_DATA_RE);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const initial = data?.props?.pageProps?.initialData;
    if (initial?.kind !== "event") return null;

    const root = initial.data;
    const event = root?.event;
    if (!event) return null;

    const geo = event.geo_address_info ?? {};
    const visibility = event.geo_address_visibility;
    const geoAddress =
      geo.address || geo.short_address || geo.full_address || null;
    const addressPublic = visibility === "public" && geoAddress;

    const hosts = Array.isArray(root.hosts)
      ? root.hosts.map((h) => h?.name).filter(Boolean)
      : [];

    const ticketTypes = Array.isArray(root.ticket_types)
      ? root.ticket_types.map((t) => t?.name).filter(Boolean)
      : [];

    return {
      eventTitle: event.name || null,
      eventImageUrl: event.cover_url || null,
      startDateTime: root.start_at || event.start_at || null,
      endDateTime: root.end_at || event.end_at || null,
      timezone: hosts[0] ? root.hosts[0]?.timezone : event.timezone || null,
      locationName: geo.address || geo.sublocality || geo.city || null,
      address: addressPublic ? geo.address || geo.short_address || geo.full_address : null,
      hostName: resolveHostName(html, root),
      ticketTypes,
      palette: root.cover_image?.palette || event.palette || null,
      addressHidden: !addressPublic && visibility !== "public",
    };
  } catch {
    return null;
  }
}

export function extractFromLumaHtml(html, sourceUrl) {
  const meta = parseMeta(html);
  const timeMatch = html.match(TIME_RE);
  const fromNext = parseNextEventPayload(html);

  const extracted = {
    sourceUrl,
    eventTitle:
      fromNext?.eventTitle ||
      stripLumaTitleSuffix(decodeHtmlEntities(meta["og:title"])) ||
      null,
    eventImageUrl: fromNext?.eventImageUrl || meta["og:image"] || null,
    startDateTime: fromNext?.startDateTime || (timeMatch ? timeMatch[1] : null),
    endDateTime: fromNext?.endDateTime || null,
    timezone: fromNext?.timezone || null,
    locationName: fromNext?.locationName || null,
    address: fromNext?.address ?? null,
    hostName:
      fromNext?.hostName ||
      (html.includes("Hosted by")
        ? html.split("Hosted by")[1].split("<")[0].trim()
        : null),
    palette: fromNext?.palette || null,
  };

  // A known venue wins over the scrape: it stays stable whether or not this
  // request happens to see the address, so the agent never asks for these.
  const knownAddress = knownAddressFor(sourceUrl);
  if (knownAddress) {
    extracted.address = knownAddress;
    extracted.locationName = extracted.locationName || knownAddress;
  }

  const ticketTypes = fromNext?.ticketTypes ?? [];

  const missingFields = [];
  if (!extracted.eventTitle) missingFields.push("eventTitle");
  if (!extracted.startDateTime) missingFields.push("startDateTime");
  if (!extracted.address) missingFields.push("address");

  const hiddenFields = [];
  if (!extracted.address) {
    if (fromNext?.addressHidden) {
      hiddenFields.push("address");
    } else if (!fromNext) {
      hiddenFields.push("address");
    }
  }

  return { extracted, missingFields, hiddenFields, ticketTypes };
}
