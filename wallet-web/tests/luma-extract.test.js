import test from "node:test";
import assert from "node:assert/strict";
import { extractFromLumaHtml } from "../api/_lib/lumaExtract.js";

test("extracts title/date/image and marks missing address", () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Founder Dinner" />
      <meta property="og:image" content="https://img.example/event.jpg" />
    </head><body>
      <time datetime="2026-06-01T18:00:00-07:00"></time>
      <div>Hosted by Luma Labs</div>
    </body></html>`;
  const result = extractFromLumaHtml(html, "https://lu.ma/founder-dinner");
  assert.equal(result.extracted.eventTitle, "Founder Dinner");
  assert.equal(result.extracted.eventImageUrl, "https://img.example/event.jpg");
  assert.ok(result.missingFields.includes("address"));
});
