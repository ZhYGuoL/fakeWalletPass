import { normalizePassColor } from "./colorFormat"
import { DEFAULT_MODEL } from "./defaultPass"
import type { EditorModel, PassFieldRow } from "./types"

function trimField(f: PassFieldRow): Record<string, unknown> {
  return {
    key: f.key.trim(),
    label: f.label,
    value: f.value,
  }
}

function trimFields(rows: PassFieldRow[]): Record<string, unknown>[] {
  return rows
    .filter((r) => r.key.trim().length > 0)
    .map(trimField)
}

function styleBody(body: EditorModel["eventTicket"]) {
  const out: Record<string, unknown> = {
    headerFields: trimFields(body.headerFields),
    primaryFields: trimFields(body.primaryFields),
    secondaryFields: trimFields(body.secondaryFields),
    auxiliaryFields: trimFields(body.auxiliaryFields),
  }
  const back = trimFields(body.backFields ?? [])
  if (back.length > 0) {
    out.backFields = back
  }
  return out
}

export function modelToPassJson(m: EditorModel): Record<string, unknown> {
  const barcodes = m.barcodes
    .filter((b) => b.message.trim().length > 0)
    .map((b) => ({
      message: b.message,
      format: b.format,
      messageEncoding: b.messageEncoding,
    }))

  const first = barcodes[0]

  const base: Record<string, unknown> = {
    formatVersion: m.formatVersion,
    passTypeIdentifier: m.passTypeIdentifier.trim(),
    serialNumber: m.serialNumber.trim(),
    teamIdentifier: m.teamIdentifier.trim(),
    organizationName: m.organizationName.trim(),
    description: m.description.trim(),
    backgroundColor: m.backgroundColor,
    foregroundColor: m.foregroundColor,
    labelColor: m.labelColor,
  }

  if (m.suppressStripShine) {
    base.suppressStripShine = true
  }

  if (m.style === "eventTicket") {
    base.eventTicket = styleBody(m.eventTicket)
  } else {
    base.generic = styleBody(m.generic)
  }

  if (barcodes.length > 0) {
    base.barcodes = barcodes
  }
  if (m.mirrorLegacyBarcode && first) {
    base.barcode = { ...first }
  }

  return base
}

export function passJsonToModel(j: Record<string, unknown>): EditorModel {
  const style: EditorModel["style"] = j.eventTicket
    ? "eventTicket"
    : j.generic
      ? "generic"
      : "eventTicket"
  const body = (
    style === "eventTicket" ? j.eventTicket : j.generic
  ) as Record<string, unknown> | undefined

  const readRows = (key: string): PassFieldRow[] => {
    const arr = body?.[key]
    if (!Array.isArray(arr)) return []
    return arr.map((row) => {
      const r = row as Record<string, unknown>
      return {
        key: String(r.key ?? ""),
        label: String(r.label ?? ""),
        value: String(r.value ?? ""),
      }
    })
  }

  const barcodesRaw = j.barcodes
  const barcodes = Array.isArray(barcodesRaw)
    ? barcodesRaw.map((b) => {
        const x = b as Record<string, unknown>
        return {
          message: String(x.message ?? ""),
          format: String(x.format ?? "PKBarcodeFormatQR"),
          messageEncoding: String(x.messageEncoding ?? "iso-8859-1"),
        }
      })
    : DEFAULT_MODEL.barcodes

  return {
    style,
    formatVersion: 1,
    passTypeIdentifier: String(j.passTypeIdentifier ?? DEFAULT_MODEL.passTypeIdentifier),
    serialNumber: String(j.serialNumber ?? DEFAULT_MODEL.serialNumber),
    teamIdentifier: String(j.teamIdentifier ?? DEFAULT_MODEL.teamIdentifier),
    organizationName: String(j.organizationName ?? DEFAULT_MODEL.organizationName),
    description: String(j.description ?? DEFAULT_MODEL.description),
    backgroundColor: normalizePassColor(
      String(j.backgroundColor ?? DEFAULT_MODEL.backgroundColor),
      DEFAULT_MODEL.backgroundColor,
    ),
    foregroundColor: normalizePassColor(
      String(j.foregroundColor ?? DEFAULT_MODEL.foregroundColor),
      DEFAULT_MODEL.foregroundColor,
    ),
    labelColor: normalizePassColor(
      String(j.labelColor ?? DEFAULT_MODEL.labelColor),
      DEFAULT_MODEL.labelColor,
    ),
    suppressStripShine: Boolean(j.suppressStripShine),
    eventTicket:
      style === "eventTicket" && body
        ? {
            headerFields: readRows("headerFields"),
            primaryFields: readRows("primaryFields"),
            secondaryFields: readRows("secondaryFields"),
            auxiliaryFields: readRows("auxiliaryFields"),
            backFields: readRows("backFields"),
          }
        : { ...DEFAULT_MODEL.eventTicket },
    generic:
      style === "generic" && body
        ? {
            headerFields: readRows("headerFields"),
            primaryFields: readRows("primaryFields"),
            secondaryFields: readRows("secondaryFields"),
            auxiliaryFields: readRows("auxiliaryFields"),
            backFields: readRows("backFields"),
          }
        : { ...DEFAULT_MODEL.generic },
    barcodes: barcodes.length > 0 ? barcodes : [...DEFAULT_MODEL.barcodes],
    mirrorLegacyBarcode: "barcode" in j && j.barcode != null,
  }
}
