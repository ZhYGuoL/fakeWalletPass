const REQUIRED = ["eventTitle", "startDateTime", "guestName"];

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
    ticketTypes.length > 0
      ? input.selectedTicketType || ticketTypes[0]
      : input.hostName || "Unknown host";

  return {
    ...input,
    hostOrTicketLabel,
    testMarker: "TEST / NOT VALID",
    qrMessage: `https://example.invalid/test-pass/${Date.now()}`,
  };
}
