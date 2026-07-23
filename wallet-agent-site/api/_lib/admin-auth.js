/**
 * Shared gate for the private tracker endpoints (admin UI + track-ticket).
 *
 * Design goals:
 *   - Undiscoverable: unauthorized requests get a bare 404, identical to any
 *     unknown path, so probing never confirms the endpoint (or the admin
 *     concept) exists.
 *   - Secret-link + cookie: the admin opens a one-time `?token=...` link; the
 *     server sets a session cookie so the token disappears from the URL and
 *     reloads keep working.
 *   - Locked by default in production: without ADMIN_TOKEN set, access is
 *     denied in prod (allowed in local dev only for convenience).
 */

export function isProduction() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

// Constant-time string comparison (avoids leaking the token via timing).
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function cookieToken(request) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === "kp_admin") {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return "";
}

function providedToken(request, url, bodyToken) {
  return (
    request.headers.get("x-admin-token") ||
    (url && url.searchParams.get("token")) ||
    cookieToken(request) ||
    bodyToken ||
    ""
  );
}

export function isAuthorized(request, url, bodyToken) {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (expected) return safeEqual(providedToken(request, url, bodyToken), expected);
  // No token configured → allow in local dev only, never in production.
  return !isProduction();
}

/** Bare 404 - indistinguishable from a route that doesn't exist. */
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

/** Session cookie so the token leaves the URL after the first link. */
export function sessionCookie(token) {
  const flags = ["HttpOnly", "Path=/api", "SameSite=Strict"];
  if (isProduction()) flags.push("Secure");
  return `kp_admin=${encodeURIComponent(token)}; ${flags.join("; ")}`;
}
