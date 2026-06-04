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

test("sets dummy QR message when sourceUrl is missing", () => {
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

test("uses Luma sourceUrl for QR when provided", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    hostName: "Luma Labs",
    ticketTypes: [],
    sourceUrl: "https://luma.com/4y89vpyu",
  });
  assert.equal(out.qrMessage, "https://luma.com/4y89vpyu");
});

test("normalizes bare Luma host for QR", () => {
  const out = normalizePayload({
    eventTitle: "Demo",
    startDateTime: "2026-06-01T18:00:00-07:00",
    guestName: "Jane",
    ticketTypes: [],
    sourceUrl: "lu.ma/4y89vpyu",
  });
  assert.equal(out.qrMessage, "https://lu.ma/4y89vpyu");
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
