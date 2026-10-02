const SHIPPING_FREE_OVER = 5000, SHIPPING = 500;
const yen = n => "¥" + Number(n).toLocaleString("ja-JP");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS_JA = { pending: "受注", paid: "入金済", shipped: "出荷済", completed: "完了", cancelled: "キャンセル" };

// --- state ---
let products = [];
let user = null;
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let filter = "すべて";
let redirectAfterLogin = null;

const api = async (path, opts = {}) => {
  const res = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, credentials: "same-origin", ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
};
const saveCart = () => localStorage.setItem("cart", JSON.stringify(cart));
const findProduct = id => products.find(p => p.id === id);
const cartLines = () => cart.map(i => ({ ...i, p: findProduct(i.id) })).filter(i => i.p);
const cartCount = () => cartLines().reduce((s, i) => s + i.qty, 0);
const subtotal = () => cartLines().reduce((s, i) => s + i.qty * i.p.price, 0);

function addToCart(id, qty = 1) {
  const p = findProduct(id); if (!p) return;
  const item = cart.find(i => i.id === id);
  const next = (item?.qty || 0) + qty;
  if (next > p.stock) return toast(`在庫が足りません(残り${p.stock})`);
  if (item) item.qty = next; else cart.push({ id, qty });
  saveCart(); updateBadge(); toast("カートに追加しました");
}
function setQty(id, qty) {
  const p = findProduct(id);
  qty = Math.max(0, Math.min(qty | 0, p ? p.stock : 99));
  cart = qty === 0 ? cart.filter(i => i.id !== id) : cart.map(i => i.id === id ? { ...i, qty } : i);
  saveCart(); updateBadge(); render();
}
function updateBadge() { document.getElementById("cart-count").textContent = cartCount(); }
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2000);
}
function renderNav() {
  const el = document.getElementById("nav-user");
  el.innerHTML = user
    ? `<a href="#mypage">${esc(user.name)} さん</a>${user.role === "admin" ? ' <a href="/admin.html" class="admin-link">管理画面</a>' : ""} <a href="#" data-logout>ログアウト</a>`
    : `<a href="#login">ログイン</a>`;
}

// --- router ---
const navigate = (view, param) => { location.hash = param ? `${view}/${param}` : view; };
async function render() {
  const [view, param] = (location.hash.slice(1) || "home").split("/");
  const app = document.getElementById("app");
  const views = { home, product, cart: cartView, checkout, thanks, login, register, mypage };
  app.innerHTML = await (views[view] || home)(param);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

// --- views ---
function home() {
  const cats = ["すべて", ...new Set(products.map(p => p.cat))];
  const list = filter === "すべて" ? products : products.filter(p => p.cat === filter);
  return `
    <section class="hero"><h1>暮らしを少し良くするもの。</h1><p>日常に馴染む、長く使えるアイテムを集めました。</p></section>
    <div class="filters">${cats.map(c => `<button class="${c === filter ? "active" : ""}" data-filter="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="grid">${list.map(p => `
      <div class="card" data-product="${esc(p.id)}">
        <div class="img" style="background:${esc(p.color)}">${esc(p.emoji)}</div>
        <div class="body"><span class="cat">${esc(p.cat)}</span><span class="name">${esc(p.name)}</span>
        <span class="price">${yen(p.price)}</span>${p.stock === 0 ? '<span class="soldout">在庫切れ</span>' : p.stock <= 5 ? `<span class="low">残り${p.stock}点</span>` : ""}</div>
      </div>`).join("")}</div>`;
}
function product(id) {
  const p = findProduct(id);
  if (!p) return home();
  return `
    <a href="#home" class="back">← 商品一覧へ戻る</a>
    <div class="detail">
      <div class="img" style="background:${esc(p.color)}">${esc(p.emoji)}</div>
      <div>
        <span class="cat">${esc(p.cat)}</span>
        <h1>${esc(p.name)}</h1>
        <p class="desc">${esc(p.desc)}</p>
        <div class="price">${yen(p.price)}<small style="font-size:.8rem;color:var(--muted)">(税込)</small></div>
        <p class="stock">${p.stock === 0 ? "在庫切れ" : `在庫: ${p.stock}点`}</p>
        <div class="qty">数量 <input type="number" id="qty" value="1" min="1" max="${p.stock}"></div><br>
        <button class="btn" data-add="${esc(p.id)}" ${p.stock === 0 ? "disabled" : ""}>カートに入れる</button>
      </div>
    </div>`;
}
function cartView() {
  const lines = cartLines();
  if (!lines.length) return `<div class="empty"><p>カートは空です。</p><a href="#home" class="btn">買い物を続ける</a></div>`;
  const sub = subtotal(); const ship = sub >= SHIPPING_FREE_OVER ? 0 : SHIPPING;
  return `
    <h1>カート</h1>
    <table class="cart-table">
      <thead><tr><th>商品</th><th>単価</th><th>数量</th><th class="num">小計</th><th></th></tr></thead>
      <tbody>${lines.map(({ p, qty }) => `
        <tr>
          <td><a href="#product/${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</a></td>
          <td>${yen(p.price)}</td>
          <td><button class="btn secondary sm" data-dec="${esc(p.id)}">−</button> ${qty} <button class="btn secondary sm" data-inc="${esc(p.id)}">＋</button></td>
          <td class="num">${yen(p.price * qty)}</td>
          <td><button class="btn danger" data-del="${esc(p.id)}">削除</button></td>
        </tr>`).join("")}</tbody>
    </table>
    <div class="summary"><div class="summary-box">
      <div class="row"><span>商品合計</span><span>${yen(sub)}</span></div>
      <div class="row"><span>送料</span><span>${ship === 0 ? "無料" : yen(ship)}</span></div>
      ${ship ? `<div class="row" style="font-size:.8rem;color:var(--muted)"><span>あと${yen(SHIPPING_FREE_OVER - sub)}で送料無料</span></div>` : ""}
      <div class="row total"><span>合計</span><span>${yen(sub + ship)}</span></div>
      <a href="#checkout" class="btn">レジに進む</a>
    </div></div>`;
}
function checkout() {
  if (!cartLines().length) return cartView();
  if (!user) { redirectAfterLogin = "checkout"; return login("ご注文にはログインが必要です"); }
  const sub = subtotal(); const ship = sub >= SHIPPING_FREE_OVER ? 0 : SHIPPING;
  return `
    <a href="#cart" class="back">← カートへ戻る</a>
    <h1>お届け先・お支払い</h1>
    <form class="form" id="checkout-form">
      <label>お名前</label><input required name="name" value="${esc(user.name)}">
      <label>郵便番号</label><input required name="zip" placeholder="100-0001">
      <label>住所</label><input required name="address" placeholder="東京都千代田区…">
      <label>お支払い方法</label>
      <select name="payment"><option>クレジットカード</option><option>コンビニ払い</option><option>代金引換</option></select>
      <p style="margin-top:16px">合計 <strong>${yen(sub + ship)}</strong>(送料 ${ship === 0 ? "無料" : yen(ship)})</p>
      <p class="error" id="form-error"></p>
      <button class="btn" type="submit">注文を確定する</button>
    </form>`;
}
function thanks(orderId) {
  return `<div class="thanks"><div class="big">🎉</div><h1>ご注文ありがとうございます</h1><p>注文番号: <strong>${esc(orderId)}</strong></p><p style="color:var(--muted)">※デモサイトのため実際の決済は行われません。</p><a href="#mypage" class="btn secondary">注文履歴を見る</a> <a href="#home" class="btn">買い物を続ける</a></div>`;
}
function login(message) {
  if (user) return mypage();
  return `
    <h1>ログイン</h1>
    ${message ? `<p class="notice">${esc(message)}</p>` : ""}
    <form class="form" id="login-form">
      <label>メールアドレス</label><input required type="email" name="email" autocomplete="email">
      <label>パスワード</label><input required type="password" name="password" autocomplete="current-password">
      <p class="error" id="form-error"></p>
      <button class="btn" type="submit">ログイン</button>
      <p class="muted">アカウントをお持ちでない方は <a href="#register" class="link">新規登録</a></p>
    </form>`;
}
function register() {
  if (user) return mypage();
  return `
    <h1>新規登録</h1>
    <form class="form" id="register-form">
      <label>お名前</label><input required name="name" autocomplete="name">
      <label>メールアドレス</label><input required type="email" name="email" autocomplete="email">
      <label>パスワード(8文字以上)</label><input required type="password" name="password" minlength="8" autocomplete="new-password">
      <p class="error" id="form-error"></p>
      <button class="btn" type="submit">登録する</button>
      <p class="muted">既にアカウントをお持ちの方は <a href="#login" class="link">ログイン</a></p>
    </form>`;
}
async function mypage() {
  if (!user) { redirectAfterLogin = "mypage"; return login(); }
  let orders = [];
  try { ({ orders } = await api("/orders")); } catch (e) { return `<p class="error">${esc(e.message)}</p>`; }
  return `
    <h1>マイページ</h1>
    <div class="form" style="margin-bottom:24px"><strong>${esc(user.name)}</strong><br><span class="muted">${esc(user.email)}</span></div>
    <h2>注文履歴</h2>
    ${orders.length ? orders.map(o => `
      <div class="order">
        <div class="order-head"><span><strong>${esc(o.id)}</strong> <span class="muted">${new Date(o.createdAt).toLocaleString("ja-JP")}</span></span><span class="status s-${esc(o.status)}">${STATUS_JA[o.status] || esc(o.status)}</span></div>
        <ul>${o.items.map(l => `<li>${esc(l.emoji)} ${esc(l.name)} × ${l.qty} <span class="muted">${yen(l.price * l.qty)}</span></li>`).join("")}</ul>
        <div class="order-foot">合計 <strong>${yen(o.total)}</strong>(送料 ${o.shippingFee ? yen(o.shippingFee) : "無料"}) ・ ${esc(o.payment)} ・ ${esc(o.shipping.address)}</div>
      </div>`).join("") : `<p class="muted">まだ注文はありません。</p>`}`;
}

// --- events ---
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-filter],[data-product],[data-add],[data-inc],[data-dec],[data-del],[data-logout]");
  if (!el) return;
  const d = el.dataset;
  if (d.filter) { filter = d.filter; render(); }
  else if (d.product) navigate("product", d.product);
  else if (d.add) addToCart(d.add, +document.getElementById("qty").value || 1);
  else if (d.inc) setQty(d.inc, cart.find(i => i.id === d.inc).qty + 1);
  else if (d.dec) setQty(d.dec, cart.find(i => i.id === d.dec).qty - 1);
  else if (d.del) setQty(d.del, 0);
  else if ("logout" in d) { e.preventDefault(); await api("/auth/logout", { method: "POST" }); user = null; renderNav(); toast("ログアウトしました"); navigate("home"); }
});
document.addEventListener("submit", async e => {
  const f = e.target; e.preventDefault();
  const data = Object.fromEntries(new FormData(f));
  const err = f.querySelector("#form-error"); err.textContent = "";
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    if (f.id === "login-form" || f.id === "register-form") {
      ({ user } = await api(f.id === "login-form" ? "/auth/login" : "/auth/register", { method: "POST", body: data }));
      renderNav(); toast(f.id === "login-form" ? "ログインしました" : "登録が完了しました");
      const next = redirectAfterLogin || "home"; redirectAfterLogin = null;
      if (location.hash.slice(1) === next) render(); else navigate(next);
    } else if (f.id === "checkout-form") {
      const { order } = await api("/orders", { method: "POST", body: { items: cart, shipping: { name: data.name, zip: data.zip, address: data.address }, payment: data.payment } });
      cart = []; saveCart(); updateBadge();
      await loadProducts();
      navigate("thanks", order.id);
    }
  } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
});

async function loadProducts() { ({ products } = await api("/products")); }
(async () => {
  try {
    const [, me] = await Promise.all([loadProducts(), api("/auth/me")]);
    user = me.user;
  } catch (e) { document.getElementById("app").innerHTML = `<p class="error">読み込みに失敗しました: ${esc(e.message)}</p>`; return; }
  // Drop cart lines whose product disappeared, clamp to stock.
  cart = cartLines().map(({ id, qty, p }) => ({ id, qty: Math.min(qty, p.stock) })).filter(i => i.qty > 0); saveCart();
  renderNav(); updateBadge(); render();
})();
