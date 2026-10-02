// Tiny document store. Each collection is one JSON blob (db/<name>.json) in a
// private Vercel Blob store, written with optimistic concurrency (ETag).
// Without BLOB_READ_WRITE_TOKEN (local dev / tests) it falls back to JSON
// files under DB_LOCAL_DIR (default ./.data).
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { seedProducts } from "./seed.js";

const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
const localDir = process.env.DB_LOCAL_DIR || path.join(process.cwd(), ".data");

async function readRaw(name) {
  if (!useBlob) {
    try {
      const text = await fs.readFile(path.join(localDir, `${name}.json`), "utf8");
      return { data: JSON.parse(text), etag: null };
    } catch (e) {
      if (e.code === "ENOENT") return { data: null, etag: null };
      throw e;
    }
  }
  const { get } = await import("@vercel/blob");
  let res;
  try {
    res = await get(`db/${name}.json`, { access: "private", useCache: false });
  } catch (e) {
    if (e?.name === "BlobNotFoundError" || /not.?found/i.test(e?.message || "")) return { data: null, etag: null };
    throw e;
  }
  if (!res || res.statusCode !== 200) return { data: null, etag: null };
  const text = await new Response(res.stream).text();
  return { data: JSON.parse(text), etag: res.blob.etag };
}

async function writeRaw(name, data, etag) {
  const body = JSON.stringify(data);
  if (!useBlob) {
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(path.join(localDir, `${name}.json`), body);
    return;
  }
  const { put } = await import("@vercel/blob");
  const opts = { access: "private", addRandomSuffix: false, contentType: "application/json" };
  if (etag) opts.ifMatch = etag; else opts.allowOverwrite = false;
  await put(`db/${name}.json`, body, opts);
}

const isConflict = e => e?.name === "BlobPreconditionFailedError" || /already exists|precondition/i.test(e?.message || "");

export async function readAll(name) {
  const { data } = await readRaw(name);
  return data ?? (await seed(name));
}

// Read-modify-write with retry on concurrent modification.
export async function update(name, mutate) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let { data, etag } = await readRaw(name);
    if (data == null) data = await seed(name);
    const result = await mutate(data);
    try {
      await writeRaw(name, data, etag);
      return result;
    } catch (e) {
      if (!isConflict(e) || attempt === 4) throw e;
      await new Promise(r => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

async function seed(name) {
  let initial = [];
  if (name === "products") initial = seedProducts();
  if (name === "users") initial = await seedAdmin();
  try { await writeRaw(name, initial, null); } catch (e) { if (!isConflict(e)) throw e; }
  const { data } = await readRaw(name);
  return data ?? initial;
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return [];
  const { hashPassword } = await import("./auth.js");
  return [{ id: randomUUID(), email: email.toLowerCase(), name: "管理者", passwordHash: hashPassword(password), role: "admin", createdAt: new Date().toISOString() }];
}

export const newId = () => randomUUID();
