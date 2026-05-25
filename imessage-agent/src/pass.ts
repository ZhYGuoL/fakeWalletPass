import { buildPass, normalizePayload } from "./walletBridge.js";
import type { PassDraft } from "./conversation.js";

export async function generatePkpass(draft: PassDraft) {
  const payload = normalizePayload({
    ...draft.extracted,
    sourceUrl: draft.sourceUrl,
    guestName: draft.guestName,
    selectedTicketType: draft.selectedTicketType,
    ticketTypes: draft.ticketTypes,
  });
  return buildPass(payload);
}
