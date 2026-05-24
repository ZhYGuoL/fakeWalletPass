/**
 * POST engagement events (Web Handler — Vercel Node).
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}

export async function POST(request) {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0].trim() : ""

  const engagement = {
    type: "wallet_badge_click",
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

  return new Response(null, { status: 204 })
}
