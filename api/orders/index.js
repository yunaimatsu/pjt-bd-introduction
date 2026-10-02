import { route, body, badRequest } from "../../lib/http.js";
import { readAll, update, newId } from "../../lib/db.js";
import { requireUser } from "../../lib/auth.js";

export const SHIPPING_FREE_OVER = 5000;
export const SHIPPING = 500;
export const STATUSES = ["pending", "paid", "shipped", "completed", "cancelled"];

export default route({
  async GET(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    let orders = await readAll("orders");
    if (!(user.role === "admin" && req.query.all === "1")) orders = orders.filter(o => o.userId === user.id);
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ orders });
  },
  async POST(req, res) {
    const user = await requireUser(req, res);
    if (!user) return;
    const { items, shipping = {}, payment } = body(req);
    if (!Array.isArray(items) || !items.length) return badRequest(res, "カートが空です");
    for (const k of ["name", "zip", "address"]) if (!shipping[k] || !String(shipping[k]).trim()) return badRequest(res, "お届け先を入力してください");
    const wanted = new Map();
    for (const it of items) {
      const qty = Number(it.qty);
      if (!it.id || !Number.isInteger(qty) || qty < 1 || qty > 99) return badRequest(res, "数量が不正です");
      wanted.set(String(it.id), (wanted.get(String(it.id)) || 0) + qty);
    }
    // Reserve stock atomically (single read-modify-write on the products collection).
    const reserved = await update("products", products => {
      const lines = [];
      for (const [id, qty] of wanted) {
        const p = products.find(x => x.id === id && x.active);
        if (!p) return { error: `商品が見つかりません (${id})` };
        if (p.stock < qty) return { error: `「${p.name}」の在庫が不足しています(残り${p.stock})` };
        lines.push({ productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty });
      }
      for (const l of lines) products.find(x => x.id === l.productId).stock -= l.qty;
      return { lines };
    });
    if (reserved.error) return res.status(409).json({ error: reserved.error });
    const subtotal = reserved.lines.reduce((s, l) => s + l.price * l.qty, 0);
    const shippingFee = subtotal >= SHIPPING_FREE_OVER ? 0 : SHIPPING;
    const order = {
      id: "BD-" + Date.now().toString(36).toUpperCase() + "-" + newId().slice(0, 4).toUpperCase(),
      userId: user.id, customer: { name: user.name, email: user.email },
      items: reserved.lines, subtotal, shippingFee, total: subtotal + shippingFee,
      shipping: { name: String(shipping.name).trim(), zip: String(shipping.zip).trim(), address: String(shipping.address).trim() },
      payment: String(payment || "クレジットカード"), status: "pending",
      history: [{ status: "pending", at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    await update("orders", orders => { orders.push(order); });
    res.status(201).json({ order });
  },
});
