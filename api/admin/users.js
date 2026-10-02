import { route } from "../../lib/http.js";
import { readAll } from "../../lib/db.js";
import { requireAdmin, publicUser } from "../../lib/auth.js";

export default route({
  async GET(req, res) {
    if (!(await requireAdmin(req, res))) return;
    const [users, orders] = await Promise.all([readAll("users"), readAll("orders")]);
    res.json({ users: users.map(u => ({ ...publicUser(u), orderCount: orders.filter(o => o.userId === u.id).length, spent: orders.filter(o => o.userId === u.id && o.status !== "cancelled").reduce((s, o) => s + o.total, 0) })) });
  },
});
