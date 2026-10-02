import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { readAll } from "./db.js";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const COOKIE = "bd_session";
const TTL_SEC = 60 * 60 * 24 * 14;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex"), b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const b64 = s => Buffer.from(s).toString("base64url");
const sign = payload => createHmac("sha256", SECRET).update(payload).digest("base64url");

export function createSession(userId) {
  const payload = b64(JSON.stringify({ uid: userId, exp: Date.now() + TTL_SEC * 1000 }));
  return `${payload}.${sign(payload)}`;
}
export function parseSession(token) {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(c => c.trim().split("=")).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
}
export function setSessionCookie(res, token) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${TTL_SEC}${secure}`);
}
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

export async function currentUser(req) {
  const session = parseSession(parseCookies(req)[COOKIE]);
  if (!session) return null;
  const users = await readAll("users");
  return users.find(u => u.id === session.uid) || null;
}
export const publicUser = u => u && { id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt };

export async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: "ログインが必要です" }); return null; }
  return user;
}
export async function requireAdmin(req, res) {
  const user = await currentUser(req);
  if (!user) { res.status(401).json({ error: "ログインが必要です" }); return null; }
  if (user.role !== "admin") { res.status(403).json({ error: "管理者権限が必要です" }); return null; }
  return user;
}
