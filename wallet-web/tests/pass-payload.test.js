import test from "node:test";
import assert from "node:assert/strict";
import { normalizePayload } from "../api/_lib/passPayload.js";

test("forces explicit ticket type choice when multiple exist", () => {
  assert.throws(() =>
    normalizePayload({
      eventTitle: "Demo",
      startDateTime: "2026-06-01T18:00:00-07:00",
      guestName: "Jane",
      ticketTypes: ["General", "VIP"],
      selectedTicketType: "",
    }),
  );
});

test("enforces test marker and dummy QR", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Luma Labs",
    ticketTypes: [],
  });
  assert.equal(out.testMarker, "TEST / NOT VALID");
  assert.match(out.qrMessage, /^https:\/\/example\.invalid\//);
  assert.equal(out.hostOrTicketLabel, "Luma Labs");
});
