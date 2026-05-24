import { extractFromLumaHtml } from "./_lib/lumaExtract.js";

export async function POST(request) {
  const { url } = await request.json();
  if (!/^https?:\/\/(www\.)?lu\.ma\/.+/.test(url || "")) {
    return Response.json({ error: "Invalid Luma URL" }, { status: 400 });
  }
  const res = await fetch(url);
  if (!res.ok) {
    return Response.json({ error: "Failed to fetch public page" }, { status: 502 });
  }
  const html = await res.text();
  return Response.json(extractFromLumaHtml(html, url));
}
