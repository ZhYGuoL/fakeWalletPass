import { getSigningHealth } from "./_lib/signingHealth.js";

export async function GET() {
  return Response.json(await getSigningHealth());
}
