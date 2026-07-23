/**
 * POST /api/register-agent - register a Spectrum user (Photon Cloud).
 * Proxies Photon credentials server-side; never expose PROJECT_SECRET to the client.
 *
 * When AGENT_LINE_PHONE is set (Business dedicated line), new users are registered
 * as type "dedicated" against that line. Otherwise uses shared-pool registration.
 */

import { isUserCapacityError, WAITLIST_USER_MESSAGE } from "./_lib/photon-errors.js";
import { addToWaitlist } from "./_lib/waitlist.js";

const E164 = /^\+[1-9]\d{6,14}$/;

function buildRegistrationBody(phoneNumber) {
  const agentLine = (process.env.AGENT_LINE_PHONE || "").trim();
  if (agentLine) {
    if (!E164.test(agentLine)) {
      return { error: "Agent line is not configured correctly." };
    }
    return {
      body: { type: "dedicated", phoneNumber, assignedPhoneNumber: agentLine },
      mode: "dedicated",
    };
  }
  return { body: { type: "shared", phoneNumber }, mode: "shared" };
}

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

  const registration = buildRegistrationBody(phoneNumber);
  if (registration.error) {
    return json({ error: registration.error }, 503);
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
      body: JSON.stringify(registration.body),
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

    if (isUserCapacityError(message, photonRes.status)) {
      try {
        await addToWaitlist(phoneNumber);
      } catch (err) {
        console.error("WAITLIST_WRITE_FAILED", err?.message ?? err);
        return json(
          {
            error: "We're at capacity and couldn't save your spot. Please try again in a moment.",
          },
          503,
        );
      }

      return json({
        waitlisted: true,
        phoneNumber,
        message: WAITLIST_USER_MESSAGE,
      });
    }

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
    registrationMode: registration.mode,
    messagesUrl,
  });
}
