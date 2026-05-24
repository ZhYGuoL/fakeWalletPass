export function normalizePayload(payload) {
  return {
    ...payload,
    safety: { marker: "TEST / NOT VALID", qrMode: "dummy" },
  };
}
