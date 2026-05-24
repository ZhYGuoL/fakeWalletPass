import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const BUILD_DIR = resolve(REPO_ROOT, "build");

function safeSlug(value) {
  return String(value || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function compactTimestamp(isoStart) {
  const parsed = new Date(isoStart);
  if (Number.isNaN(parsed.getTime())) {
    return "19700101T000000";
  }
  return parsed.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export function rgbFromAverages({ r, g, b }) {
  return `rgb(${r},${g},${b})`;
}

export function buildPassFilename(eventTitle, isoStart) {
  return `test-${safeSlug(eventTitle)}-${compactTimestamp(isoStart)}.pkpass`;
}

async function getPythonExecutable() {
  const venvPython = resolve(REPO_ROOT, ".venv", "bin", "python3");
  try {
    await access(venvPython);
    return venvPython;
  } catch {
    return "python3";
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code}${
            stderr ? `: ${stderr.trim()}` : ""
          }`,
        ),
      );
    });
  });
}

/** @param {object} payload Normalized pass payload */
export async function buildPass(payload) {
  const filename = buildPassFilename(payload.eventTitle, payload.startDateTime);
  const tempDir = await mkdtemp(join(tmpdir(), "wallet-pass-payload-"));
  const payloadPath = join(tempDir, "payload.json");
  const python = await getPythonExecutable();

  await writeFile(payloadPath, JSON.stringify(payload), "utf8");

  try {
    await runCommand(
      python,
      [resolve(REPO_ROOT, "scripts", "render_pass_payload.py"), payloadPath],
      REPO_ROOT,
    );
    await runCommand("bash", [resolve(REPO_ROOT, "scripts", "sign_pass.sh"), filename], REPO_ROOT);

    const pkpassPath = resolve(BUILD_DIR, filename);
    const pkpassBuffer = await readFile(pkpassPath);
    return { buffer: new Uint8Array(pkpassBuffer), filename };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
