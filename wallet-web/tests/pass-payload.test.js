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

test("sets dummy QR message for generated test passes", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Luma Labs",
    ticketTypes: [],
  });
  assert.match(out.qrMessage, /^https:\/\/example\.invalid\//);
  assert.equal(out.hostOrTicketLabel, "Luma Labs");
});

test("sets entry label TICKET when multiple ticket types exist", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Photon",
    ticketTypes: ["General", "VIP"],
    selectedTicketType: "VIP",
  });
  assert.equal(out.entryLabel, "TICKET");
  assert.equal(out.hostOrTicketLabel, "VIP");
});

test("single ticket type does not replace host on pass", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Photon",
    ticketTypes: ["Standard"],
  });
  assert.equal(out.hostOrTicketLabel, "Photon");
});

test("multiple ticket types use selected type on pass", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Photon",
    ticketTypes: ["General", "VIP"],
    selectedTicketType: "VIP",
  });
  assert.equal(out.hostOrTicketLabel, "VIP");
});
