import { normalizePayload } from "./_lib/passPayload.js";
import { buildPass } from "./_lib/passBuild.js";
import { getSigningHealth } from "./_lib/signingHealth.js";

export async function POST(request) {
  const health = await getSigningHealth();
  if (!health.ready) {
    return Response.json(
      { error: "Signing is not ready", health },
      { status: 503 },
    );
  }
  const payload = normalizePayload(await request.json());
  const { buffer, filename } = await buildPass(payload);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
