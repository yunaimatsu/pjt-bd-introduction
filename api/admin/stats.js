import { route } from "../../lib/http.js";
import { readAll } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";

export default route({
  async GET(req, res) {
    if (!(await requireAdmin(req, res))) return;
    const [orders, products, users] = await Promise.all([readAll("orders"), readAll("products"), readAll("users")]);
    const live = orders.filter(o => o.status !== "cancelled");
    const today = new Date().toISOString().slice(0, 10);
    const byDay = {};
    for (const o of live) { const d = o.createdAt.slice(0, 10); byDay[d] = (byDay[d] || 0) + o.total; }
    const days = [...Array(14)].map((_, i) => { const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10); return { date: d, sales: byDay[d] || 0 }; });
    const qtyByProduct = {};
    for (const o of live) for (const l of o.items) qtyByProduct[l.productId] = (qtyByProduct[l.productId] || 0) + l.qty;
    const topProducts = Object.entries(qtyByProduct).map(([id, qty]) => ({ id, name: products.find(p => p.id === id)?.name || id, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
    res.json({
      sales: { total: live.reduce((s, o) => s + o.total, 0), today: live.filter(o => o.createdAt.startsWith(today)).reduce((s, o) => s + o.total, 0) },
      orders: { total: orders.length, byStatus: Object.fromEntries(["pending", "paid", "shipped", "completed", "cancelled"].map(s => [s, orders.filter(o => o.status === s).length])) },
      customers: users.filter(u => u.role === "customer").length,
      lowStock: products.filter(p => p.active && p.stock <= 5).map(p => ({ id: p.id, name: p.name, stock: p.stock })),
      days, topProducts,
    });
  },
});
