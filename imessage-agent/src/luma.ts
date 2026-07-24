import {
  extractFromLumaHtml,
  isValidLumaEventUrl,
} from "./walletBridge.js";

const LUMA_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:lu\.ma|luma\.com)\/[^\s<>"']+/gi;

// Events we won't generate passes for (hosted by friends). Matched by slug,
// so any ?tk= access token on the URL is ignored.
const BLACKLISTED_SLUGS = new Set(["4c67jnyj", "wmw6rnmh", "x9fo4o39"]);

export const BLACKLIST_MESSAGE =
  "These are events hosted by Zhiyuan's friends! Sorry but I won't generate a pass...";

function lumaSlug(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return seg ? seg.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function isBlacklistedLumaUrl(url: string): boolean {
  const slug = lumaSlug(url);
  return slug ? BLACKLISTED_SLUGS.has(slug) : false;
}

export function normalizeLumaUrl(candidate: string): string | null {
  const cleaned = candidate
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/[.,)]+$/, "");
  if (!cleaned) return null;

  const withScheme = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned.replace(/^www\./i, "")}`;

  return isValidLumaEventUrl(withScheme) ? withScheme : null;
}

export function findLumaUrl(text: string): string | null {
  const normalized = text.replace(/[\u200B-\u200D\uFEFF]/g, "");
  for (const match of normalized.matchAll(LUMA_URL_RE)) {
    const url = normalizeLumaUrl(match[0]);
    if (url) return url;
  }
  return null;
}

export async function extractLumaEvent(sourceUrl: string) {
  const res = await fetch(sourceUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch Luma page (${res.status})`);
  }
  const html = await res.text();
  return extractFromLumaHtml(html, sourceUrl);
}
