import { route, body, badRequest } from "../../lib/http.js";
import { readAll, update } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";
import { validateProduct } from "./index.js";

export default route({
  async GET(req, res) {
    const product = (await readAll("products")).find(p => p.id === req.query.id && p.active);
    if (!product) return res.status(404).json({ error: "商品が見つかりません" });
    res.json({ product });
  },
  async PUT(req, res) {
    if (!(await requireAdmin(req, res))) return;
    const { error, value } = validateProduct(body(req), true);
    if (error) return badRequest(res, error);
    const product = await update("products", products => {
      const p = products.find(x => x.id === req.query.id);
      if (!p) return null;
      Object.assign(p, value, { updatedAt: new Date().toISOString() });
      return p;
    });
    if (!product) return res.status(404).json({ error: "商品が見つかりません" });
    res.json({ product });
  },
  async DELETE(req, res) {
    if (!(await requireAdmin(req, res))) return;
    // Soft delete so past orders keep referencing a valid product.
    const found = await update("products", products => {
      const p = products.find(x => x.id === req.query.id);
      if (p) p.active = false;
      return !!p;
    });
    if (!found) return res.status(404).json({ error: "商品が見つかりません" });
    res.json({ ok: true });
  },
});
