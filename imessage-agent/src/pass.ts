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
