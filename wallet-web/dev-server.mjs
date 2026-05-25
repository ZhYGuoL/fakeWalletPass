#!/usr/bin/env node
/**
 * Local dev server — no Vercel login required.
 * Serves static files and wires /api/* to the same handlers used on Vercel.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".pkpass": "application/vnd.apple.pkpass",
};

const API_ROUTES = {
  "POST /api/extract-luma": () => import("./api/extract-luma.js"),
  "GET /api/signing-health": () => import("./api/signing-health.js"),
  "POST /api/generate-pass": () => import("./api/generate-pass.js"),
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function serveStatic(pathname) {
  let filePath = join(ROOT, pathname === "/" ? "index.html" : pathname.replace(/^\//, ""));
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  const ext = extname(filePath);
  return {
    body: readFileSync(filePath),
    type: MIME[ext] || "application/octet-stream",
  };
}

const server = createServer(async (req, res) => {
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

    const file = await serveStatic(url.pathname);
    if (!file) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": file.type });
    res.end(file.body);
  } catch (err) {
    console.error("DEV_SERVER_ERROR", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Luma test pass generator: http://127.0.0.1:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Either stop the other process:`);
    console.error(`  lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
    console.error(`  kill <PID>`);
    console.error(`Or use another port: PORT=${PORT + 1} npm run dev`);
    process.exit(1);
  }
  throw err;
});
