import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const LOCAL_WAITLIST_PATH = join(process.cwd(), "data", "waitlist.json");

function normalizeEntry(phoneNumber) {
  return {
    phoneNumber,
    createdAt: new Date().toISOString(),
  };
}

export function hasBlobStorage() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim(),
  );
}

async function readLocalWaitlist() {
  if (!existsSync(LOCAL_WAITLIST_PATH)) {
    return [];
  }

  try {
    const raw = await readFile(LOCAL_WAITLIST_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalWaitlist(entries) {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(LOCAL_WAITLIST_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

async function addToLocalWaitlist(phoneNumber) {
  const entry = normalizeEntry(phoneNumber);
  const entries = await readLocalWaitlist();
  const alreadyListed = entries.some((item) => item.phoneNumber === phoneNumber);

  if (!alreadyListed) {
    entries.push(entry);
    await writeLocalWaitlist(entries);
  }

  return { entry, alreadyListed };
}

async function addToBlobWaitlist(phoneNumber) {
  const entry = normalizeEntry(phoneNumber);
  const safePhone = phoneNumber.replace(/\D/g, "");
  const { put } = await import("@vercel/blob");

  await put(`waitlist/${Date.now()}-${safePhone}.json`, JSON.stringify(entry), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });

  return { entry, alreadyListed: false };
}

export async function listWaitlist() {
  if (!hasBlobStorage()) {
    return readLocalWaitlist();
  }

  const { list, get } = await import("@vercel/blob");
  const entries = [];
  let cursor;

  do {
    const page = await list({ prefix: "waitlist/", cursor, limit: 1000 });
    for (const blob of page.blobs) {
      let phoneNumber = null;
      let createdAt = null;

      try {
        const result = await get(blob.pathname, { access: "private" });
        if (result?.statusCode === 200 && result.stream) {
          const text = await new Response(result.stream).text();
          const data = JSON.parse(text);
          phoneNumber = data.phoneNumber;
          createdAt = data.createdAt;
        }
      } catch {
        // fall back to pathname parsing below
      }

      if (!phoneNumber) {
        const match = blob.pathname.match(/waitlist\/\d+-(\d+)\.json$/);
        if (match) {
          phoneNumber = `+${match[1]}`;
        }
      }

      if (phoneNumber) {
        entries.push({
          phoneNumber,
          createdAt: createdAt || blob.uploadedAt || null,
          pathname: blob.pathname,
        });
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  entries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return entries;
}

export async function addToWaitlist(phoneNumber) {
  if (hasBlobStorage()) {
    return addToBlobWaitlist(phoneNumber);
  }

  if (process.env.VERCEL !== "1") {
    return addToLocalWaitlist(phoneNumber);
  }

  throw new Error("Waitlist storage is not configured (link a Blob store to this project).");
}
