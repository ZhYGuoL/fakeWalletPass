export type PassStyle = "eventTicket" | "generic"

export interface PassFieldRow {
  key: string
  label: string
  value: string
}

export interface BarcodeRow {
  message: string
  format: string
  messageEncoding: string
}

export interface PassStyleBody {
  headerFields: PassFieldRow[]
  primaryFields: PassFieldRow[]
  secondaryFields: PassFieldRow[]
  auxiliaryFields: PassFieldRow[]
  backFields?: PassFieldRow[]
}

export interface EditorModel {
  style: PassStyle
  formatVersion: 1
  passTypeIdentifier: string
  serialNumber: string
  teamIdentifier: string
  organizationName: string
  description: string
  backgroundColor: string
  foregroundColor: string
  labelColor: string
  suppressStripShine: boolean
  eventTicket: PassStyleBody
  generic: PassStyleBody
  barcodes: BarcodeRow[]
  mirrorLegacyBarcode: boolean
}
