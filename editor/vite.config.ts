import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import type { Connect } from "vite"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, "..")
const PASS_DIR = path.join(REPO_ROOT, "pass")
const SIGN_SCRIPT = path.join(REPO_ROOT, "scripts", "sign_pass.sh")

/** Filenames safe to write from the editor (matches common PassKit assets). */
const ALLOWED_IMAGES = new Set([
  "icon.png",
  "icon@2x.png",
  "icon@3x.png",
  "logo.png",
  "logo@2x.png",
  "logo@3x.png",
  "strip.png",
  "strip@2x.png",
  "strip@3x.png",
  "background.png",
  "background@2x.png",
  "background@3x.png",
  "thumbnail.png",
  "thumbnail@2x.png",
  "thumbnail@3x.png",
  "footer.png",
  "footer@2x.png",
  "footer@3x.png",
])

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function exportPassPlugin() {
  return {
    name: "wallet-pass-export-api",
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] ?? ""

        if (req.method === "GET" && url === "/api/load-pass") {
          try {
            const p = path.join(PASS_DIR, "pass.json")
            const raw = await fs.readFile(p, "utf8")
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ ok: true, passJson: JSON.parse(raw) }))
          } catch {
            res.statusCode = 404
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ ok: false, error: "pass/pass.json not found" }))
          }
          return
        }

        if (req.method !== "POST" || url !== "/api/export-pass") {
          return next()
        }

        try {
          const raw = await readBody(req)
          const payload = JSON.parse(raw) as {
            passJson: unknown
            images?: Record<string, string>
            runSign?: boolean
          }

          if (!payload.passJson || typeof payload.passJson !== "object") {
            res.statusCode = 400
            res.setHeader("Content-Type", "application/json")
            res.end(JSON.stringify({ ok: false, error: "passJson required" }))
            return
          }

          await fs.mkdir(PASS_DIR, { recursive: true })
          const text = JSON.stringify(payload.passJson, null, 2) + "\n"
          await fs.writeFile(path.join(PASS_DIR, "pass.json"), text, "utf8")

          if (payload.images && typeof payload.images === "object") {
            for (const [name, b64] of Object.entries(payload.images)) {
              if (!ALLOWED_IMAGES.has(name) || typeof b64 !== "string" || !b64.length) {
                continue
              }
              const buf = Buffer.from(b64, "base64")
              await fs.writeFile(path.join(PASS_DIR, name), buf)
            }
          }

          let signOutput = ""
          if (payload.runSign) {
            const { execFile } = await import("node:child_process")
            const { promisify } = await import("node:util")
            const execFileAsync = promisify(execFile)
            try {
              const { stdout, stderr } = await execFileAsync(
                "bash",
                [SIGN_SCRIPT],
                {
                  cwd: REPO_ROOT,
                  maxBuffer: 10 * 1024 * 1024,
                },
              )
              signOutput = (stdout?.toString() ?? "") + (stderr?.toString() ?? "")
            } catch (e) {
              const err = e as { stderr?: Buffer; message?: string }
              const msg = err.stderr?.toString() ?? err.message ?? String(e)
              res.statusCode = 500
              res.setHeader("Content-Type", "application/json")
              res.end(
                JSON.stringify({
                  ok: false,
                  error: `sign_pass.sh failed: ${msg}`,
                  wrotePass: true,
                }),
              )
              return
            }
          }

          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ ok: true, signOutput }))
        } catch (e) {
          res.statusCode = 500
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ ok: false, error: String((e as Error).message) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), exportPassPlugin()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
