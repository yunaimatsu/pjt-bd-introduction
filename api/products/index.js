import { route, body, badRequest } from "../../lib/http.js";
import { readAll, update, newId } from "../../lib/db.js";
import { currentUser, requireAdmin } from "../../lib/auth.js";

export function validateProduct(p, partial = false) {
  const out = {};
  const str = (k, max = 200) => { if (p[k] !== undefined) { const v = String(p[k]).trim(); if (!v && !partial) return `${k} is required`; out[k] = v.slice(0, max); } else if (!partial && ["name", "cat"].includes(k)) return `${k} is required`; };
  for (const k of ["name", "cat", "emoji", "color", "desc"]) { const err = str(k, k === "desc" ? 1000 : 200); if (err) return { error: err }; }
  if (p.price !== undefined || !partial) { const n = Number(p.price); if (!Number.isInteger(n) || n < 0) return { error: "価格は0以上の整数で入力してください" }; out.price = n; }
  if (p.stock !== undefined || !partial) { const n = Number(p.stock ?? 0); if (!Number.isInteger(n) || n < 0) return { error: "在庫は0以上の整数で入力してください" }; out.stock = n; }
  if (p.active !== undefined) out.active = !!p.active;
  return { value: out };
}

export default route({
  async GET(req, res) {
    const user = await currentUser(req);
    const products = await readAll("products");
    const all = user?.role === "admin" && req.query.all === "1";
    res.json({ products: all ? products : products.filter(p => p.active) });
  },
  async POST(req, res) {
    if (!(await requireAdmin(req, res))) return;
    const { error, value } = validateProduct(body(req));
    if (error) return badRequest(res, error);
    const product = { id: newId(), emoji: "📦", color: "#e5e7eb", desc: "", active: true, ...value, createdAt: new Date().toISOString() };
    await update("products", products => { products.push(product); });
    res.status(201).json({ product });
  },
});
