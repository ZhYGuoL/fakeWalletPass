import type { EditorModel } from "./types"

export const DEFAULT_MODEL: EditorModel = {
  style: "eventTicket",
  formatVersion: 1,
  passTypeIdentifier: "pass.pass.com.example.event",
  serialNumber: "SERIAL-001",
  teamIdentifier: "YOURTEAMID",
  organizationName: "Organization",
  description: "Event ticket",
  backgroundColor: "rgb(74, 91, 142)",
  foregroundColor: "rgb(255, 255, 255)",
  labelColor: "rgb(173, 184, 210)",
  suppressStripShine: true,
  eventTicket: {
    headerFields: [],
    primaryFields: [{ key: "event", label: "EVENT", value: "My event" }],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [],
  },
  generic: {
    headerFields: [],
    primaryFields: [{ key: "title", label: "Title", value: "Membership" }],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [],
  },
  barcodes: [
    {
      message: "https://example.com/ticket",
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
    },
  ],
  mirrorLegacyBarcode: true,
}
