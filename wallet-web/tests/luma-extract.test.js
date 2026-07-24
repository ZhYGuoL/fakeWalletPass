import test from "node:test";
import assert from "node:assert/strict";
import { extractFromLumaHtml, isValidLumaEventUrl } from "../api/_lib/lumaExtract.js";

test("accepts lu.ma and luma.com event URLs", () => {
  assert.ok(isValidLumaEventUrl("https://lu.ma/founder-dinner"));
  assert.ok(isValidLumaEventUrl("https://luma.com/byobhyun"));
  assert.ok(isValidLumaEventUrl("https://www.luma.com/byobhyun"));
  assert.equal(isValidLumaEventUrl("https://example.com/event"), false);
});

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
  assert.equal(result.extracted.startDateTime, "2026-06-01T18:00:00-07:00");
  assert.ok(result.missingFields.includes("address"));
});

test("extracts time and public address from luma.com __NEXT_DATA__", () => {
  const html = `
    <html><head><meta property="og:title" content="Park Event · Luma" /></head><body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-05-24T19:00:00.000Z","end_at":"2026-05-24T22:00:00.000Z","hosts":[{"name":"H Dhillon","timezone":"America/Los_Angeles"}],"ticket_types":[{"name":"Standard"}],"event":{"name":"Park Event","cover_url":"https://images.lumacdn.com/cover.png","start_at":"2026-05-24T19:00:00.000Z","end_at":"2026-05-24T22:00:00.000Z","geo_address_visibility":"public","geo_address_info":{"address":"Mission Dolores Park","full_address":"Mission Dolores Park, SF, CA"}}}}}}}</script>
    </body></html>`;
  const result = extractFromLumaHtml(html, "https://luma.com/byobhyun");
  assert.equal(result.extracted.eventTitle, "Park Event");
  assert.equal(result.extracted.startDateTime, "2026-05-24T19:00:00.000Z");
  assert.equal(
    result.extracted.address,
    "Mission Dolores Park",
  );
  assert.equal(result.extracted.hostName, "H Dhillon");
  assert.deepEqual(result.ticketTypes, ["Standard"]);
  assert.equal(result.missingFields.includes("address"), false);
});

test("uses Presented by institution instead of first hosted-by person", () => {
  const html = `
    <html><body>
    <div>Presented by</div><a class="title" href="/photonhq?k=c"><div>Photon</div></a>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-05-24T19:00:00.000Z","hosts":[{"name":"Julie Chen"},{"name":"Daniel Tian"}],"ticket_types":[{"name":"Standard"}],"calendar":{"name":"Photon","is_personal":false},"event":{"name":"Wrap Party","start_at":"2026-05-24T19:00:00.000Z","geo_address_visibility":"public","geo_address_info":{"full_address":"123 Main St"}}}}}}}</script>
    </body></html>`;
  const result = extractFromLumaHtml(html, "https://luma.com/qifsyhwo");
  assert.equal(result.extracted.hostName, "Photon");
});

test("uses first hosted-by person when no Presented by section", () => {
  const html = `
    <html><body>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-05-24T19:00:00.000Z","hosts":[{"name":"Alice Host"},{"name":"Bob Co-host"}],"ticket_types":[],"calendar":{"name":"Alice Calendar","is_personal":true},"event":{"name":"House Party","start_at":"2026-05-24T19:00:00.000Z","geo_address_visibility":"public","geo_address_info":{"full_address":"123 Main St"}}}}}}}</script>
    </body></html>`;
  const result = extractFromLumaHtml(html, "https://luma.com/house-party");
  assert.equal(result.extracted.hostName, "Alice Host");
});

test("extracts Luma image palette for pass colors", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"event":{"name":"Canopy Festival","start_at":"2026-05-22T00:00:00.000Z"},"cover_image":{"colors":["#002400","#00ff00"],"palette":{"neutral":[{"color":"#002400","percentage":69.48}],"vibrant":[{"color":"#00ff00","percentage":16.59}]}}}}}}}</script>`;
  const result = extractFromLumaHtml(html, "https://luma.com/festival");
  assert.deepEqual(result.extracted.palette?.neutral?.[0]?.color, "#002400");
});

test("prefers short street address over full_address for public events", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-06-15T01:00:00.000Z","hosts":[{"name":"Vivian Cai"}],"ticket_types":[],"event":{"name":"GTM Fireside","start_at":"2026-06-15T01:00:00.000Z","geo_address_visibility":"public","geo_address_info":{"address":"9 Claude Ln","short_address":"9 Claude Ln, San Francisco","full_address":"9 Claude Ln, San Francisco, CA 94108, USA"}}}}}}}</script>`;
  const result = extractFromLumaHtml(html, "https://luma.com/4y89vpyu");
  assert.equal(result.extracted.address, "9 Claude Ln");
  assert.equal(result.extracted.locationName, "9 Claude Ln");
});

test("extracts fireside palette from cover_image", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"event":{"name":"GTM Fireside","start_at":"2026-06-14T00:00:00.000Z"},"cover_image":{"colors":["#1d3657","#fefefe","#f15308"],"palette":{"neutral":[{"color":"#fefefe","percentage":15.46}],"vibrant":[{"color":"#1d3657","percentage":36.51},{"color":"#f15308","percentage":0.17}]}}}}}}}</script>`;
  const result = extractFromLumaHtml(html, "https://luma.com/4y89vpyu");
  assert.deepEqual(result.extracted.palette?.vibrant?.[0]?.color, "#1d3657");
});

test("fills in known venues so hidden addresses are never asked for", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-07-25T01:30:00.000Z","hosts":[{"name":"Founders, Inc. Events"}],"ticket_types":[{"name":"Builder"}],"event":{"name":"Night Hack by Founders, Inc.","start_at":"2026-07-25T01:30:00.000Z","geo_address_visibility":"members","geo_address_info":{"sublocality":"Fort Mason"}}}}}}}</script>`;
  const result = extractFromLumaHtml(html, "https://luma.com/nighthack?tk=abc123");
  assert.equal(result.extracted.address, "Founders, Inc. | San Francisco Lab");
  assert.equal(result.missingFields.includes("address"), false);
  assert.equal(result.hiddenFields.includes("address"), false);
});

test("known venue overrides a scraped address so it stays stable", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"initialData":{"kind":"event","data":{"start_at":"2026-07-25T01:00:00.000Z","hosts":[{"name":"Cosmo Guion"}],"ticket_types":[{"name":"Standard"}],"event":{"name":"JSV Summer Friday x Mercury","start_at":"2026-07-25T01:00:00.000Z","geo_address_visibility":"members","geo_address_info":{}}}}}}}</script>`;
  const result = extractFromLumaHtml(html, "https://luma.com/objb8rym");
  assert.equal(result.extracted.address, "Chotto Matte San Francisco");
  assert.equal(result.extracted.locationName, "Chotto Matte San Francisco");
  assert.equal(result.missingFields.includes("address"), false);
});
