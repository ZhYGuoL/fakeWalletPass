import { prepareAgentProcess } from "./env.js";

export type SharedUser = {
  id: string;
  phoneNumber: string;
  assignedPhoneNumber: string;
};

export async function registerSharedUser(phoneNumber: string): Promise<SharedUser> {
  const projectId = process.env.PROJECT_ID;
  const projectSecret = process.env.PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    throw new Error("Missing PROJECT_ID or PROJECT_SECRET in .env");
  }

  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString("base64");
  const res = await fetch(`https://spectrum.photon.codes/projects/${projectId}/users/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ type: "shared", phoneNumber }),
  });

  const body = (await res.json()) as {
    succeed?: boolean;
    data?: SharedUser;
    message?: string;
  };

  if (!res.ok || !body.succeed || !body.data) {
    throw new Error(body.message ?? `Register user failed (${res.status})`);
  }

  return body.data;
}

export function smsDeepLink(assignedPhoneNumber: string, message: string): string {
  return `sms:${assignedPhoneNumber}&body=${encodeURIComponent(message)}`;
}

export async function redirectLinkForUser(userId: string, message: string): Promise<string | null> {
  const res = await fetch(
    `https://spectrum.photon.codes/users/${userId}/redirect?msg=${encodeURIComponent(message)}`,
    { redirect: "manual" },
  );
  return res.headers.get("location");
}

if (process.argv[1]?.endsWith("register.ts")) {
  prepareAgentProcess();
  const phone = process.argv[2]?.trim();
  if (!phone) {
    console.error("Usage: npm run register -- +14124754173");
    process.exit(1);
  }
  registerSharedUser(phone)
    .then(async (user) => {
      console.log("Registered shared user:");
      console.log(`  Your phone:     ${user.phoneNumber}`);
      console.log(`  Text this line: ${user.assignedPhoneNumber}`);
      console.log("");
      console.log("With `npm run dev` running, open Messages and text the line above.");
      const link = await redirectLinkForUser(user.id, "hello");
      if (link) console.log(`  Or open: ${link}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
