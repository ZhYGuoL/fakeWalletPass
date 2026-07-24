import { buildPass, normalizePayload } from "./walletBridge.js";
import type { PassDraft } from "./conversation.js";

function cleanLocation(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  return v.length > 40 ? `${v.slice(0, 37)}…` : v;
}

export async function generatePkpass(draft: PassDraft) {
  const sourceUrl = draft.sourceUrl ?? draft.extracted.sourceUrl;
  const payload = normalizePayload({
    ...draft.extracted,
    sourceUrl,
    guestName: draft.guestName,
    selectedTicketType: draft.selectedTicketType,
    ticketTypes: draft.ticketTypes,
  });
  if (process.env.AGENT_DEBUG === "1") {
    console.log("[pass] sourceUrl:", sourceUrl, "qrMessage:", payload.qrMessage);
  }
  return buildPass(payload);
}

/**
 * Bump the public "tickets created" leaderboard for this event, passing the
 * event details so an untracked event is auto-created as a proper listing
 * (name/host/location), not "Untitled". Fire-and-forget: a tracking failure
 * must never affect pass delivery.
 */
export async function trackTicketCreated(draft: PassDraft): Promise<void> {
  const sourceUrl = draft.sourceUrl ?? draft.extracted.sourceUrl;
  if (!sourceUrl) return;
  const base = (process.env.KEYPASS_SITE_URL ?? "https://keypass.zygl.dev").replace(/\/$/, "");
  const token = process.env.ADMIN_TOKEN;
  try {
    const res = await fetch(`${base}/api/track-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "x-admin-token": token } : {}),
      },
      body: JSON.stringify({
        url: sourceUrl,
        name: draft.extracted.eventTitle ?? undefined,
        host: draft.extracted.hostName ?? undefined,
        location: cleanLocation(draft.extracted.locationName),
        status: "Open",
      }),
    });
    if (process.env.AGENT_DEBUG === "1") {
      console.log("[track-ticket]", sourceUrl, "->", res.status);
    }
  } catch (err) {
    console.error("TRACK_TICKET_FAILED", err instanceof Error ? err.message : err);
  }
}
