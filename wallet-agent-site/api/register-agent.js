/**
 * POST /api/register-agent — register a shared Spectrum user (Photon Cloud).
 * Proxies Photon credentials server-side; never expose PROJECT_SECRET to the client.
 */

const E164 = /^\+[1-9]\d{6,14}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function redirectLinkForUser(userId, message) {
  const res = await fetch(
    `https://spectrum.photon.codes/users/${userId}/redirect?msg=${encodeURIComponent(message)}`,
    { redirect: "manual" },
  );
  return res.headers.get("location");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber.trim() : "";
  if (!E164.test(phoneNumber)) {
    return json(
      { error: "Enter a valid phone number in international format (e.g. +14155551234)." },
      400,
    );
  }

  const projectId = process.env.PROJECT_ID;
  const projectSecret = process.env.PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    return json({ error: "Agent registration is not configured yet." }, 503);
  }

  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
  let photonRes;
  try {
    photonRes = await fetch(`https://spectrum.photon.codes/projects/${projectId}/users/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ type: "shared", phoneNumber }),
    });
  } catch (err) {
    console.error("PHOTON_REGISTER_FETCH_FAILED", err?.message ?? err);
    return json({ error: "Could not reach the messaging service. Try again." }, 502);
  }

  let photonBody;
  try {
    photonBody = await photonRes.json();
  } catch {
    return json({ error: "Unexpected response from the messaging service." }, 502);
  }

  if (!photonRes.ok || !photonBody.succeed || !photonBody.data) {
    const message =
      typeof photonBody.message === "string"
        ? photonBody.message
        : `Registration failed (${photonRes.status}).`;
    return json({ error: message }, photonRes.ok ? 502 : photonRes.status);
  }

  const { id, assignedPhoneNumber } = photonBody.data;
  let messagesUrl = null;
  try {
    messagesUrl = await redirectLinkForUser(id, "hello");
  } catch {
    // Redirect link is optional; client can fall back to sms: deep link.
  }

  return json({
    userId: id,
    phoneNumber,
    assignedPhoneNumber,
    messagesUrl,
  });
}
