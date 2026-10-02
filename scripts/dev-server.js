// Minimal local emulation of Vercel's Node runtime: serves ./public as static
// files and maps /api/** to the handler modules under ./api (incl. [id] routes).
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

async function resolveApi(urlPath) {
  const segs = urlPath.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const query = {};
  async function walk(dir, i) {
    if (i === segs.length) {
      for (const f of ["index.js"]) { try { await fs.access(path.join(dir, f)); return path.join(dir, f); } catch {} }
      return null;
    }
    const seg = segs[i];
    const file = path.join(dir, seg + ".js");
    try { await fs.access(file); if (i === segs.length - 1) return file; } catch {}
    const sub = path.join(dir, seg);
    try { if ((await fs.stat(sub)).isDirectory()) { const r = await walk(sub, i + 1); if (r) return r; } } catch {}
    for (const ent of await fs.readdir(dir)) {
      const m = ent.match(/^\[(\w+)\]\.js$/);
      if (m && i === segs.length - 1) { query[m[1]] = seg; return path.join(dir, ent); }
    }
    return null;
  }
  const file = await walk(path.join(root, "api"), 0);
  return { file, query };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
  res.send = s => res.end(s);
  if (url.pathname.startsWith("/api/")) {
    const { file, query } = await resolveApi(url.pathname);
    if (!file) return res.status(404).json({ error: "Not found" });
    req.query = { ...Object.fromEntries(url.searchParams), ...query };
    let raw = ""; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    const mod = await import(pathToFileURL(file).href);
    return mod.default(req, res);
  }
  let p = path.join(root, "public", url.pathname === "/" ? "index.html" : url.pathname);
  try { res.setHeader("Content-Type", MIME[path.extname(p)] || "application/octet-stream"); res.end(await fs.readFile(p)); }
  catch { res.status(404).end("Not found"); }
}).listen(port, () => console.log(`dev server http://localhost:${port}`));
