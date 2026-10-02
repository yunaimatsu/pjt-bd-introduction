// End-to-end API test against a running dev server (uses local JSON storage).
const base = process.env.BASE || "http://localhost:3000";
let jar = {};
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
async function call(method, path, body, who) {
  const res = await fetch(base + "/api" + path, { method, headers: { "Content-Type": "application/json", cookie: jar[who] || "" }, body: body ? JSON.stringify(body) : undefined });
  const sc = res.headers.get("set-cookie"); if (sc) jar[who] = sc.split(";")[0];
  return { status: res.status, data: await res.json() };
}
(async () => {
  let r = await call("GET", "/products"); assert(r.status === 200 && r.data.products.length === 12, "seeded products");
  const p = r.data.products.find(x => x.name === "ウールブランケット"); assert(p.stock === 3, "blanket stock 3");

  r = await call("POST", "/auth/login", { email: "admin@example.com", password: "admin1234" }, "admin"); assert(r.status === 200 && r.data.user.role === "admin", "admin login");
  r = await call("POST", "/auth/login", { email: "admin@example.com", password: "wrong" }); assert(r.status === 401, "wrong password rejected");
  r = await call("POST", "/auth/register", { email: "taro@example.com", password: "password1", name: "太郎" }, "taro"); assert(r.status === 201 && r.data.user.role === "customer", "register");
  r = await call("POST", "/auth/register", { email: "taro@example.com", password: "password1", name: "太郎" }); assert(r.status === 409, "duplicate email");
  r = await call("GET", "/auth/me", null, "taro"); assert(r.data.user.email === "taro@example.com", "me");

  r = await call("POST", "/orders", { items: [{ id: p.id, qty: 1 }], shipping: { name: "太郎", zip: "1", address: "東京" } }); assert(r.status === 401, "order requires login");
  r = await call("POST", "/orders", { items: [{ id: p.id, qty: 5 }], shipping: { name: "太郎", zip: "1", address: "東京" } }, "taro"); assert(r.status === 409, "insufficient stock");
  r = await call("POST", "/orders", { items: [{ id: p.id, qty: 2 }], shipping: { name: "太郎", zip: "1", address: "東京" }, payment: "代金引換" }, "taro");
  assert(r.status === 201 && r.data.order.total === 7800 * 2, "order created, free shipping"); const orderId = r.data.order.id;
  r = await call("GET", "/products"); assert(r.data.products.find(x => x.id === p.id).stock === 1, "stock decremented");
  r = await call("GET", "/orders", null, "taro"); assert(r.data.orders.length === 1, "own orders");

  r = await call("GET", "/admin/stats", null, "taro"); assert(r.status === 403, "customer cannot see admin stats");
  r = await call("GET", "/admin/stats", null, "admin"); assert(r.data.sales.total === 15600 && r.data.orders.byStatus.pending === 1, "stats");
  r = await call("PATCH", `/orders/${orderId}`, { status: "shipped" }, "admin"); assert(r.data.order.status === "shipped", "status update");
  r = await call("PATCH", `/orders/${orderId}`, { status: "cancelled" }, "admin"); assert(r.data.order.status === "cancelled", "cancel");
  r = await call("GET", "/products"); assert(r.data.products.find(x => x.id === p.id).stock === 3, "stock restored on cancel");

  r = await call("POST", "/products", { name: "新商品", cat: "テスト", price: 1000, stock: 7 }, "admin"); assert(r.status === 201, "create product"); const np = r.data.product.id;
  r = await call("PUT", `/products/${np}`, { stock: 9, price: 1200 }, "admin"); assert(r.data.product.stock === 9 && r.data.product.price === 1200, "update product");
  r = await call("DELETE", `/products/${np}`, null, "admin"); assert(r.status === 200, "soft delete");
  r = await call("GET", "/products"); assert(!r.data.products.some(x => x.id === np), "hidden from store");
  r = await call("GET", "/products?all=1", null, "admin"); assert(r.data.products.some(x => x.id === np), "visible to admin");
  r = await call("GET", "/admin/users", null, "admin"); assert(r.data.users.length === 2, "users list");
  r = await call("POST", "/auth/logout", null, "taro"); r = await call("GET", "/auth/me", null, "taro"); assert(r.data.user === null, "logout");
  console.log("ALL SMOKE TESTS PASSED");
})().catch(e => { console.error(e); process.exit(1); });
