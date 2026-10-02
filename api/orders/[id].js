import { route, body, badRequest } from "../../lib/http.js";
import { readAll, update } from "../../lib/db.js";
import { requireUser, requireAdmin } from "../../lib/auth.js";
import { STATUSES } from "./index.js";

export default route({
  async GET(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const order = (await readAll("orders")).find(o => o.id === req.query.id);
    if (!order || (order.userId !== user.id && user.role !== "admin")) return res.status(404).json({ error: "注文が見つかりません" });
    res.json({ order });
  },
  async PATCH(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { status } = body(req);
    if (!STATUSES.includes(status)) return badRequest(res, "不正なステータスです");
    const result = await update("orders", orders => {
      const o = orders.find(x => x.id === req.query.id);
      if (!o) return { notFound: true };
      if (o.status === "cancelled" && status !== "cancelled") return { error: "キャンセル済みの注文は変更できません" };
      const restock = status === "cancelled" && o.status !== "cancelled";
      o.status = status;
      o.history.push({ status, at: new Date().toISOString(), by: admin.email });
      return { order: o, restock };
    });
    if (result.notFound) return res.status(404).json({ error: "注文が見つかりません" });
    if (result.error) return res.status(409).json({ error: result.error });
    if (result.restock) {
      await update("products", products => {
        for (const l of result.order.items) { const p = products.find(x => x.id === l.productId); if (p) p.stock += l.qty; }
      });
    }
    res.json({ order: result.order });
  },
});
