import { normalizeLumaEventUrl } from "./lumaExtract.js";

const REQUIRED = ["eventTitle", "startDateTime", "guestName"];

function qrMessageFor(input) {
  const normalized = normalizeLumaEventUrl(input?.sourceUrl);
  if (normalized) return normalized;
  return `https://example.invalid/test-pass/${Date.now()}`;
}

export function normalizePayload(input) {
  for (const key of REQUIRED) {
    if (!input?.[key]) throw new Error(`Missing required field: ${key}`);
  }
  const ticketTypes = Array.isArray(input.ticketTypes)
    ? input.ticketTypes.filter(Boolean)
    : [];
  if (ticketTypes.length > 1 && !input.selectedTicketType) {
    throw new Error(
      "selectedTicketType is required when multiple ticketTypes are present",
    );
  }
  const hostOrTicketLabel =
    ticketTypes.length > 1
      ? input.selectedTicketType
      : input.hostName || "Unknown host";

  return {
    ...input,
    hostOrTicketLabel,
    entryLabel: ticketTypes.length > 1 ? "TICKET" : "HOST",
    qrMessage: qrMessageFor(input),
  };
}
