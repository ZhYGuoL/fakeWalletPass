import QRCode from "qrcode"
import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { colorToHexForPicker, hexToPassRgb } from "./colorFormat"
import { DEFAULT_MODEL } from "./defaultPass"
import { modelToPassJson, passJsonToModel } from "./passJson"
import type { BarcodeRow, EditorModel, PassFieldRow, PassStyle } from "./types"

const THEME_STORAGE_KEY = "wallet-pass-editor-theme"
type UiTheme = "light" | "dark"

function readThemeFromDocument(): UiTheme {
  const t = document.documentElement.getAttribute("data-theme")
  return t === "dark" ? "dark" : "light"
}

/** Wallet-style header: time above date (matches common event passes). */
function orderHeaderForWalletPreview(rows: PassFieldRow[]): PassFieldRow[] {
  if (rows.length <= 1) return rows
  const isTimeish = (v: string) =>
    /\d{1,2}\s*:\s*\d{2}/.test(v) || /\b(am|pm)\b/i.test(v)
  const times = rows.filter((r) => isTimeish(r.value))
  const rest = rows.filter((r) => !isTimeish(r.value))
  return [...times, ...rest]
}

function PreviewWordmark({ name }: { name: string }) {
  const raw = name.trim() || "organization"
  const lower = raw.toLowerCase()
  const isLuma = lower === "luma"
  return (
    <div className="preview-wordmark">
      {isLuma ? (
        <>
          lum
          <span className="preview-wordmark-end">
            a
            <span className="preview-wordmark-spark" aria-hidden>
              {"\u2726"}
            </span>
          </span>
        </>
      ) : (
        lower
      )}
    </div>
  )
}

const BASE_IMAGE_SLOTS = ["icon.png", "logo.png"] as const

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",")
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

/** Upscaled PNGs for Wallet @2x / @3x from the 1× asset. */
async function scalePngBase64(b64: string, scale: 2 | 3): Promise<string> {
  const url = `data:image/png;base64,${b64}`
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Could not decode PNG"))
    img.src = url
  })
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, w, h)
  return dataUrlToBase64(canvas.toDataURL("image/png"))
}

async function buildExportImages(base: Record<string, string>): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...base }
  for (const filename of BASE_IMAGE_SLOTS) {
    const stem = filename === "icon.png" ? "icon" : "logo"
    const b64 = base[filename]
    if (!b64) continue
    out[`${stem}@2x.png`] = await scalePngBase64(b64, 2)
    out[`${stem}@3x.png`] = await scalePngBase64(b64, 3)
  }
  return out
}

function FieldTierEditor({
  title,
  rows,
  onChange,
}: {
  title: string
  rows: PassFieldRow[]
  onChange: (r: PassFieldRow[]) => void
}) {
  const update = (i: number, patch: Partial<PassFieldRow>) => {
    const next = rows.map((row, j) => (j === i ? { ...row, ...patch } : row))
    onChange(next)
  }

  return (
    <div className="field-tier">
      <h3 className="field-tier-title">{title}</h3>
      {rows.map((row, i) => (
        <div className="field-row" key={i}>
          <label className="field field--minor">
            Key
            <input
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="e.g. gate"
              title="Stable id in pass.json (ASCII, unique in this section)"
            />
          </label>
          <label className="field field--minor">
            Label
            <input
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Shown above value"
            />
          </label>
          <label className="field">
            Value
            <input
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="What Wallet displays"
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost danger small"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            Remove row
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost small"
        onClick={() =>
          onChange([...rows, { key: "", label: "", value: "" }])
        }
      >
        Add field
      </button>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState<UiTheme>(readThemeFromDocument)
  const [model, setModel] = useState<EditorModel>(DEFAULT_MODEL)
  const [imagesB64, setImagesB64] = useState<Record<string, string>>({})
  const [runSign, setRunSign] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    const msgText = model.barcodes[0]?.message?.trim() ?? ""
    if (!msgText) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(msgText, {
      margin: 0,
      width: 280,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [model.barcodes])

  const loadFromDisk = useCallback(async () => {
    setMsg(null)
    try {
      const r = await fetch("/api/load-pass")
      const data = await r.json()
      if (!data.ok) {
        setMsg({
          type: "err",
          text: data.error ?? "Could not read pass/pass.json. Check that the file exists.",
        })
        return
      }
      setModel(passJsonToModel(data.passJson as Record<string, unknown>))
      setMsg({ type: "ok", text: "Loaded the pass from your pass folder." })
    } catch (e) {
      setMsg({ type: "err", text: String((e as Error).message) })
    }
  }, [])

  useEffect(() => {
    void loadFromDisk()
  }, [loadFromDisk])

  const styleBody = model.style === "eventTicket" ? model.eventTicket : model.generic
  const previewHeaderRows = orderHeaderForWalletPreview(styleBody.headerFields)

  const setStyleBody = (patch: Partial<EditorModel["eventTicket"]>) => {
    if (model.style === "eventTicket") {
      setModel({ ...model, eventTicket: { ...model.eventTicket, ...patch } })
    } else {
      setModel({ ...model, generic: { ...model.generic, ...patch } })
    }
  }

  const exportPass = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const passJson = modelToPassJson(model)
      const imagePayload = await buildExportImages(imagesB64)
      const r = await fetch("/api/export-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passJson,
          images: imagePayload,
          runSign,
        }),
      })
      const data = await r.json()
      if (!data.ok) {
        setMsg({
          type: "err",
          text: data.error ?? `HTTP ${r.status}`,
        })
        return
      }
      const nImg = Object.keys(imagePayload).length
      setMsg({
        type: "ok",
        text:
          "Saved pass/pass.json" +
          (nImg > 0 ? ` and wrote ${nImg} image file(s) into pass/ (including scaled @2x / @3x).` : ".") +
          (data.signOutput ? `\n\n— Sign script output —\n${data.signOutput}` : ""),
      })
    } catch (e) {
      setMsg({ type: "err", text: String((e as Error).message) })
    } finally {
      setBusy(false)
    }
  }

  const onImagePick = async (name: string, file: File | null) => {
    if (!file) return
    const b64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => {
        const s = fr.result as string
        const i = s.indexOf(",")
        resolve(i >= 0 ? s.slice(i + 1) : s)
      }
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
    setImagesB64((prev) => ({ ...prev, [name]: b64 }))
  }

  const setBarcode = (i: number, patch: Partial<BarcodeRow>) => {
    setModel({
      ...model,
      barcodes: model.barcodes.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-header-text">
            <h1>Wallet pass builder</h1>
            <p
              className="sub"
              title="Edit locally, then save into your pass/ folder. The preview is a rough layout guide—not identical to Wallet."
            >
              Edit locally, save to <code>pass/</code>—preview is an approximate layout guide.
            </p>
          </div>
          <div className="theme-toggle" role="group" aria-label="Color theme">
            <span className="label">Theme</span>
            <div className="segment">
              <button
                type="button"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                Light
              </button>
              <button
                type="button"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="app-layout">
        <div className="app-editor">
      <section className="editor-section">
        <h2 className="section-heading">1 · Pass setup</h2>
        <p className="section-lede">
          Pass style, details, and colors Wallet uses behind your content. Field names match{" "}
          <code>pass.json</code> where noted.
        </p>
        <div className="panel panel--setup">
          <h3 className="panel-subtitle">Type &amp; appearance</h3>
          <div className="grid2">
            <label className="field">
              Pass style
              <select
                value={model.style}
                onChange={(e) =>
                  setModel({ ...model, style: e.target.value as PassStyle })
                }
              >
                <option value="eventTicket">Event ticket</option>
                <option value="generic">Generic</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label-with-help">
                Strip shine
                <span className="help-tooltip-wrap">
                  <button
                    type="button"
                    className="help-icon"
                    aria-describedby="strip-shine-help-tip"
                    aria-label="Explain strip shine"
                  >
                    <span aria-hidden="true">?</span>
                  </button>
                  <span id="strip-shine-help-tip" className="help-tooltip" role="tooltip">
                    Apple Wallet adds a soft glossy highlight across the strip—the wide image band at the top
                    of many passes. Choose &quot;Suppress&quot; for a flat look (for example if your artwork
                    already has strong lighting). This maps to{" "}
                    <code className="help-tooltip-code">suppressStripShine</code> in pass.json.
                  </span>
                </span>
              </span>
              <select
                value={model.suppressStripShine ? "yes" : "no"}
                onChange={(e) =>
                  setModel({
                    ...model,
                    suppressStripShine: e.target.value === "yes",
                  })
                }
              >
                <option value="no">Default (shine on)</option>
                <option value="yes">Suppress shine</option>
              </select>
            </label>
          </div>
          <h3 className="panel-subtitle">Pass details</h3>
          <div className="grid2">
            <label className="field">
              Serial number <span className="field-hint">serialNumber</span>
              <input
                value={model.serialNumber}
                onChange={(e) => setModel({ ...model, serialNumber: e.target.value })}
              />
            </label>
            <label className="field">
              Organization <span className="field-hint">organizationName</span>
              <input
                value={model.organizationName}
                onChange={(e) =>
                  setModel({ ...model, organizationName: e.target.value })
                }
              />
            </label>
            <label className="field grid2-full">
              Description <span className="field-hint">description</span>
              <input
                value={model.description}
                onChange={(e) => setModel({ ...model, description: e.target.value })}
              />
            </label>
          </div>
          <h3 className="panel-subtitle">Pass colors</h3>
          <div className="grid3-colors">
            <label className="field field--color">
              Background <span className="field-hint">backgroundColor</span>
              <input
                type="color"
                value={colorToHexForPicker(model.backgroundColor)}
                onChange={(e) =>
                  setModel({ ...model, backgroundColor: hexToPassRgb(e.target.value) })
                }
              />
            </label>
            <label className="field field--color">
              Main text <span className="field-hint">foregroundColor</span>
              <input
                type="color"
                value={colorToHexForPicker(model.foregroundColor)}
                onChange={(e) =>
                  setModel({ ...model, foregroundColor: hexToPassRgb(e.target.value) })
                }
              />
            </label>
            <label className="field field--color">
              Small labels <span className="field-hint">labelColor</span>
              <input
                type="color"
                value={colorToHexForPicker(model.labelColor)}
                onChange={(e) =>
                  setModel({ ...model, labelColor: hexToPassRgb(e.target.value) })
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="editor-section">
        <h2 className="section-heading">2 · Text on the pass</h2>
        <p className="section-lede">
          Rows map to Wallet regions. Start with <strong>Primary</strong> and <strong>Secondary</strong>;
          the rest are optional.
        </p>
        <div className="panel panel--fields">
          <FieldTierEditor
            title="Header"
            rows={styleBody.headerFields}
            onChange={(headerFields) => setStyleBody({ headerFields })}
          />
          <FieldTierEditor
            title="Primary"
            rows={styleBody.primaryFields}
            onChange={(primaryFields) => setStyleBody({ primaryFields })}
          />
          <FieldTierEditor
            title="Secondary"
            rows={styleBody.secondaryFields}
            onChange={(secondaryFields) => setStyleBody({ secondaryFields })}
          />
          <FieldTierEditor
            title="Auxiliary"
            rows={styleBody.auxiliaryFields}
            onChange={(auxiliaryFields) => setStyleBody({ auxiliaryFields })}
          />
          <FieldTierEditor
            title="Back of pass (optional)"
            rows={styleBody.backFields ?? []}
            onChange={(backFields) => setStyleBody({ backFields })}
          />
        </div>
      </section>

      <section className="editor-section editor-section--minor">
        <h2 className="section-heading section-heading--minor">3 · Barcodes</h2>
        <p className="section-lede section-lede--minor">
          Scanned value, format, and encoding. Add more than one if you need fallbacks.
        </p>
        <div className="panel panel--minor">
        {model.barcodes.map((b, i) => (
          <div className="field-row" key={i} style={{ marginBottom: "0.75rem" }}>
            <label className="field">
              Payload <span className="field-hint">message</span>
              <input
                value={b.message}
                onChange={(e) => setBarcode(i, { message: e.target.value })}
                placeholder="What gets encoded"
              />
            </label>
            <label className="field field--minor">
              Format
              <select
                value={b.format}
                onChange={(e) => setBarcode(i, { format: e.target.value })}
              >
                <option value="PKBarcodeFormatQR">QR</option>
                <option value="PKBarcodeFormatPDF417">PDF417</option>
                <option value="PKBarcodeFormatAztec">Aztec</option>
                <option value="PKBarcodeFormatCode128">Code 128</option>
              </select>
            </label>
            <label className="field field--minor">
              Encoding <span className="field-hint">messageEncoding</span>
              <input
                value={b.messageEncoding}
                onChange={(e) =>
                  setBarcode(i, { messageEncoding: e.target.value })
                }
                placeholder="e.g. iso-8859-1"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost danger small"
              onClick={() =>
                setModel({
                  ...model,
                  barcodes: model.barcodes.filter((_, j) => j !== i),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost small"
          onClick={() =>
            setModel({
              ...model,
              barcodes: [
                ...model.barcodes,
                {
                  message: "",
                  format: "PKBarcodeFormatQR",
                  messageEncoding: "iso-8859-1",
                },
              ],
            })
          }
        >
          Add barcode
        </button>
        <label className="field field--inline">
          <input
            type="checkbox"
            checked={model.mirrorLegacyBarcode}
            onChange={(e) =>
              setModel({ ...model, mirrorLegacyBarcode: e.target.checked })
            }
          />
          <span>
            Also write the older single <code>barcode</code> field (uses the first row)
          </span>
        </label>
      </div>
      </section>

      <section className="editor-section editor-section--minor">
        <h2 className="section-heading section-heading--minor">4 · Images</h2>
        <p className="section-lede section-lede--minor">
          Upload the 1× assets only. On save, <code>icon@2x.png</code> / <code>icon@3x.png</code> and{" "}
          <code>logo@2x.png</code> / <code>logo@3x.png</code> are generated by scaling the 1× PNGs. Other
          files in <code>pass/</code> are left unchanged if you don&apos;t upload here.
        </p>
        <div className="panel panel--minor">
          <div className="grid2">
            {BASE_IMAGE_SLOTS.map((slot) => (
              <label className="field field--minor" key={slot}>
                {slot} <span className="field-hint">1×</span>
                <input
                  type="file"
                  accept="image/png"
                  onChange={(e) => void onImagePick(slot, e.target.files?.[0] ?? null)}
                />
              </label>
            ))}
          </div>
        {Object.keys(imagesB64).length > 0 && (
          <p className="pending-files">
            Pending:{" "}
            {BASE_IMAGE_SLOTS.filter((s) => imagesB64[s])
              .map((s) => {
                const stem = s === "icon.png" ? "icon" : "logo"
                return `${s} → ${stem}@2x.png, ${stem}@3x.png`
              })
              .join(" · ")}
          </p>
        )}
      </div>
      </section>

      <section className="editor-section editor-section--export">
        <h2 className="section-heading">5 · Save</h2>
        <p className="section-lede">
          Writes <code>pass/pass.json</code> from the form. Turn on signing only if your certificates are
          set up.
        </p>
        <div className="panel panel--export">
        <label className="field field--inline field--comfortable">
          <input
            type="checkbox"
            checked={runSign}
            onChange={(e) => setRunSign(e.target.checked)}
          />
          <span>
            After saving, run <code>scripts/sign_pass.sh</code> (needs a <code>certs/</code> folder)
          </span>
        </label>
        <div className="actions actions--export">
          <button type="button" className="btn btn-secondary" onClick={() => void loadFromDisk()}>
            Discard edits &amp; reload
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void exportPass()}
          >
            {busy ? "Saving…" : "Save to pass folder"}
          </button>
        </div>
        {msg && (
          <div className={`msg ${msg.type === "ok" ? "ok" : "err"}`}>{msg.text}</div>
        )}
      </div>
      </section>
        </div>

        <aside className="app-preview" aria-label="Approximate pass preview">
          <div className="panel preview-panel">
            <h2 className="preview-panel-title">Live preview</h2>
            <div
              className={
                model.suppressStripShine ? "preview-mock" : "preview-mock preview-mock--shine"
              }
              style={
                {
                  backgroundColor: model.backgroundColor,
                  color: model.foregroundColor,
                  "--preview-pass-bg": model.backgroundColor,
                  "--preview-pass-fg": model.foregroundColor,
                  "--preview-pass-label": model.labelColor,
                } as CSSProperties
              }
            >
              <div className="preview-card-pad">
                <header className="preview-top">
                  <PreviewWordmark name={model.organizationName} />
                  <div className="preview-datetime">
                    {previewHeaderRows.length === 0 ? (
                      <span className="preview-datetime-line">—</span>
                    ) : (
                      previewHeaderRows.map((h, i, arr) => (
                        <div
                          key={h.key || `h-${i}`}
                          className={
                            arr.length > 1 && i === 0
                              ? "preview-datetime-line preview-datetime-line--small"
                              : "preview-datetime-line"
                          }
                        >
                          {h.value}
                        </div>
                      ))
                    )}
                  </div>
                </header>

                <div className="preview-title">
                  {styleBody.primaryFields.map((p) => p.value).join(" · ") || "Event title"}
                </div>

                {styleBody.secondaryFields.map((s) => (
                  <div key={s.key || s.label} className="preview-kv">
                    {s.label ? (
                      <div className="preview-kv-label" style={{ color: model.labelColor }}>
                        {s.label}
                      </div>
                    ) : null}
                    <div className="preview-kv-value">{s.value}</div>
                  </div>
                ))}

                {styleBody.auxiliaryFields.length > 0 ? (
                  styleBody.auxiliaryFields.length === 1 ? (
                    <div className="preview-aux-stack">
                      {styleBody.auxiliaryFields.map((a) => (
                        <div key={a.key} className="preview-kv">
                          {a.label ? (
                            <div className="preview-kv-label" style={{ color: model.labelColor }}>
                              {a.label}
                            </div>
                          ) : null}
                          <div className="preview-kv-value">{a.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="preview-aux-wallet">
                      <div className="preview-aux-wallet-col">
                        {styleBody.auxiliaryFields
                          .slice(0, Math.ceil(styleBody.auxiliaryFields.length / 2))
                          .map((a) => (
                            <div key={a.key} className="preview-kv">
                              {a.label ? (
                                <div className="preview-kv-label" style={{ color: model.labelColor }}>
                                  {a.label}
                                </div>
                              ) : null}
                              <div className="preview-kv-value">{a.value}</div>
                            </div>
                          ))}
                      </div>
                      <div className="preview-aux-wallet-col preview-aux-wallet-col--end">
                        {styleBody.auxiliaryFields
                          .slice(Math.ceil(styleBody.auxiliaryFields.length / 2))
                          .map((a) => (
                            <div key={a.key} className="preview-kv">
                              {a.label ? (
                                <div className="preview-kv-label" style={{ color: model.labelColor }}>
                                  {a.label}
                                </div>
                              ) : null}
                              <div className="preview-kv-value">{a.value}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                ) : null}
              </div>

              <div className="preview-mid-spacer" aria-hidden />

              <div className="preview-qr-wrap">
                <div className="preview-qr-card">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="" className="preview-qr-img" width={280} height={280} />
                  ) : (
                    <div className="preview-qr-empty">Barcode payload empty</div>
                  )}
                </div>
              </div>
            </div>
            <p className="preview-hint">
              Updates as you type. Only the card uses your pass colors; the rest of the page stays neutral.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
