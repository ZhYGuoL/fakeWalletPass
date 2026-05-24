import { access } from "node:fs/promises";

const REQUIRED_PATHS = ["WWDR_PEM_PATH", "SIGNER_CERT_PATH", "SIGNER_KEY_PATH"];

export async function getSigningHealth(env = process.env) {
  const checks = await Promise.all(
    REQUIRED_PATHS.map(async (name) => {
      const p = env[name];
      if (!p) return { name, ok: false, reason: "unset" };
      try {
        await access(p);
        return { name, ok: true, path: p };
      } catch {
        return { name, ok: false, reason: "missing" };
      }
    }),
  );
  return { ready: checks.every((c) => c.ok), checks };
}
