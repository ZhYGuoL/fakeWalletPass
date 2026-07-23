/**
 * GET /api/export-waitlist - list waitlisted phone numbers (admin only).
 * Set WAITLIST_EXPORT_SECRET in Vercel env, then:
 *   curl -H "Authorization: Bearer $SECRET" https://keypass.zygl.dev/api/export-waitlist
 */
import { listWaitlist } from "./_lib/waitlist.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(request) {
  const secret = process.env.WAITLIST_EXPORT_SECRET?.trim();
  if (!secret) {
    return json({ error: "WAITLIST_EXPORT_SECRET is not configured." }, 503);
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== secret) {
    return json({ error: "Unauthorized." }, 401);
  }

  const entries = await listWaitlist();
  const uniquePhones = [...new Set(entries.map((e) => e.phoneNumber).filter(Boolean))];

  return json({
    totalEntries: entries.length,
    uniquePhones: uniquePhones.length,
    entries,
    phones: uniquePhones,
  });
}
