import { buildPass, normalizePayload } from "./walletBridge.js";
import type { PassDraft } from "./conversation.js";

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
 * Bump the public "tickets created" leaderboard for this event. Fire-and-forget:
 * a tracking failure must never affect pass delivery.
 */
export async function trackTicketCreated(sourceUrl: string | undefined): Promise<void> {
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
      body: JSON.stringify({ url: sourceUrl }),
    });
    if (process.env.AGENT_DEBUG === "1") {
      console.log("[track-ticket]", sourceUrl, "->", res.status);
    }
  } catch (err) {
    console.error("TRACK_TICKET_FAILED", err instanceof Error ? err.message : err);
  }
}
