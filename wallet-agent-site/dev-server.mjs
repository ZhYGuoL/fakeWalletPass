#!/usr/bin/env node
/**
 * Local dev - Vite HMR + /api/* handlers (same as Vercel serverless).
 */
import { createServer as createHttpServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const API_ROUTES = {
  "POST /api/register-agent": () => import("./api/register-agent.js"),
  "GET /api/stats": () => import("./api/stats.js"),
  "POST /api/track-ticket": () => import("./api/track-ticket.js"),
  "GET /api/admin-events": () => import("./api/admin-events.js"),
  "POST /api/admin-events": () => import("./api/admin-events.js"),
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const vite = await createViteServer({
  root: ROOT,
  server: { middlewareMode: true },
  appType: "spa",
});

const server = createHttpServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const routeKey = `${req.method} ${url.pathname}`;
    const loadHandler = API_ROUTES[routeKey];

    if (loadHandler) {
      const mod = await loadHandler();
      const handler = mod[req.method];
      if (!handler) {
        res.writeHead(405);
        res.end("Method Not Allowed");
        return;
      }
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const request = new Request(`http://localhost${url.pathname}${url.search}`, {
        method: req.method,
        headers: req.headers,
        body: body?.length ? body : undefined,
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
      return;
    }

    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end("Not Found");
    });
  } catch (err) {
    console.error("DEV_SERVER_ERROR", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// Bind on the unspecified address so both `localhost` (IPv6 ::1) and
// 127.0.0.1 (IPv4) reach this server — macOS resolves localhost to ::1 first.
server.listen(PORT, () => {
  console.log(`Keypass landing: http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: PORT=${PORT + 1} npm run dev`);
    process.exit(1);
  }
  throw err;
});
