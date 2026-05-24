/**
 * Log engagement, then 302 to the .pkpass (Web Handler — Vercel Node).
 * https://pkpassdownload.vercel.app/api/get-pass
 */
async function handle(request) {
  try {
    const method = request.method
    if (method !== "GET" && method !== "HEAD") {
      return new Response(null, { status: 405 })
    }

    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded ? forwarded.split(",")[0].trim() : ""
    const engagement = {
      type: "wallet_pass_download_click",
      at: new Date().toISOString(),
      ua: request.headers.get("user-agent") || "",
      referer: request.headers.get("referer") || "",
      ip: ip || undefined,
    }
    console.log("ENGAGEMENT " + JSON.stringify(engagement))

    const webhook = process.env.ENGAGEMENT_WEBHOOK_URL
    if (webhook) {
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 5000)
        try {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(engagement),
            signal: ctrl.signal,
          })
        } finally {
          clearTimeout(t)
        }
      } catch (err) {
        console.error(
          "ENGAGEMENT_WEBHOOK_FAILED",
          err && err.message ? err.message : String(err),
        )
      }
    }

    const passPath = process.env.PASS_FILE_PATH || "/event-ticket.pkpass"
    const path = passPath.startsWith("/") ? passPath : "/" + passPath
    const base = new URL(request.url)
    const target = new URL(path, base.origin).toString()

    return Response.redirect(target, 302)
  } catch (err) {
    console.error("GET_PASS_FATAL", err && err.stack ? err.stack : String(err))
    return new Response("Internal error", { status: 500 })
  }
}

export async function GET(request) {
  return handle(request)
}

export async function HEAD(request) {
  return handle(request)
}
