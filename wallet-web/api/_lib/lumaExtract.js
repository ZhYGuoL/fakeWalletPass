const META_RE = /<meta[^>]+property="([^"]+)"[^>]+content="([^"]*)"/gi;
const TIME_RE = /<time[^>]+datetime="([^"]+)"/i;

export function extractFromLumaHtml(html, sourceUrl) {
  const meta = {};
  for (const match of html.matchAll(META_RE)) meta[match[1]] = match[2];
  const timeMatch = html.match(TIME_RE);

  const extracted = {
    sourceUrl,
    eventTitle: meta["og:title"] || null,
    eventImageUrl: meta["og:image"] || null,
    startDateTime: timeMatch ? timeMatch[1] : null,
    address: null,
    hostName: html.includes("Hosted by")
      ? html.split("Hosted by")[1].split("<")[0].trim()
      : null,
  };

  const missingFields = [];
  if (!extracted.eventTitle) missingFields.push("eventTitle");
  if (!extracted.startDateTime) missingFields.push("startDateTime");
  if (!extracted.address) missingFields.push("address");

  const hiddenFields = extracted.address ? [] : ["address"];
  return { extracted, missingFields, hiddenFields, ticketTypes: [] };
}
