const yen = n => "¥" + Number(n).toLocaleString("ja-JP");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS_JA = { pending: "受注", paid: "入金済", shipped: "出荷済", completed: "完了", cancelled: "キャンセル" };
const STATUSES = Object.keys(STATUS_JA);
let user = null;
let orderFilter = "";

const api = async (path, opts = {}) => {
  const res = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, credentials: "same-origin", ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `エラー (${res.status})`);
  return data;
};
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2000);
}
const app = document.getElementById("app");

async function render() {
  if (!user) { app.innerHTML = loginView(); return; }
  const view = location.hash.slice(1) || "dashboard";
  const views = { dashboard, orders, products, customers };
  try { app.innerHTML = await (views[view] || dashboard)(); }
  catch (e) { app.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}
window.addEventListener("hashchange", render);

function loginView() {
  return `<div class="login-wrap"><h1>管理者ログイン</h1>
    <form class="form" id="login-form">
      <label>メールアドレス</label><input required type="email" name="email">
      <label>パスワード</label><input required type="password" name="password">
      <p class="error" id="form-error"></p>
      <button class="btn" type="submit">ログイン</button>
    </form></div>`;
}

async function dashboard() {
  const s = await api("/admin/stats");
  const max = Math.max(1, ...s.days.map(d => d.sales));
  return `
    <h1>ダッシュボード</h1>
    <div class="kpis">
      <div class="kpi"><div class="label">本日の売上</div><div class="value">${yen(s.sales.today)}</div></div>
      <div class="kpi"><div class="label">累計売上</div><div class="value">${yen(s.sales.total)}</div></div>
      <div class="kpi"><div class="label">注文数(未処理 / 全体)</div><div class="value">${s.orders.byStatus.pending} / ${s.orders.total}</div></div>
      <div class="kpi"><div class="label">顧客数</div><div class="value">${s.customers}</div></div>
    </div>
    <div class="two">
      <div class="panel"><h2>直近14日の売上</h2>
        <div class="bars">${s.days.map(d => `<div class="bar" style="height:${(d.sales / max * 100).toFixed(1)}%" title="${d.date}: ${yen(d.sales)}"><span>${d.date.slice(5)}</span></div>`).join("")}</div>
        <div style="height:20px"></div>
      </div>
      <div>
        <div class="panel"><h2>注文ステータス</h2>
          ${STATUSES.map(st => `<div class="row" style="display:flex;justify-content:space-between"><span class="status s-${st}">${STATUS_JA[st]}</span><strong>${s.orders.byStatus[st]}</strong></div>`).join("")}
        </div>
        <div class="panel"><h2>在庫僅少(5以下)</h2>
          ${s.lowStock.length ? `<ul style="margin:0;padding-left:18px">${s.lowStock.map(p => `<li class="${p.stock === 0 ? "error" : "warn"}">${esc(p.name)}: ${p.stock}</li>`).join("")}</ul>` : '<p class="muted">なし</p>'}
        </div>
      </div>
    </div>
    <div class="panel"><h2>売れ筋商品</h2>
      ${s.topProducts.length ? `<table class="table"><tr><th>商品</th><th class="num">販売数</th></tr>${s.topProducts.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${p.qty}</td></tr>`).join("")}</table>` : '<p class="muted">まだ注文がありません</p>'}
    </div>`;
}

async function orders() {
  let { orders } = await api("/orders?all=1");
  if (orderFilter) orders = orders.filter(o => o.status === orderFilter);
  return `
    <h1>受注管理</h1>
    <div class="toolbar">
      <select id="order-filter"><option value="">すべてのステータス</option>${STATUSES.map(st => `<option value="${st}" ${st === orderFilter ? "selected" : ""}>${STATUS_JA[st]}</option>`).join("")}</select>
      <span class="muted">${orders.length}件</span>
    </div>
    <div class="panel"><table class="table">
      <tr><th>注文番号</th><th>日時</th><th>顧客</th><th>内容</th><th class="num">合計</th><th>支払</th><th>ステータス</th></tr>
      ${orders.map(o => `<tr>
        <td><strong>${esc(o.id)}</strong></td>
        <td>${new Date(o.createdAt).toLocaleString("ja-JP")}</td>
        <td>${esc(o.customer.name)}<br><span class="muted">${esc(o.customer.email)}</span></td>
        <td>${o.items.map(l => `${esc(l.name)} × ${l.qty}`).join("<br>")}<details><summary>配送先</summary>〒${esc(o.shipping.zip)} ${esc(o.shipping.address)}<br>${esc(o.shipping.name)} 様</details></td>
        <td class="num">${yen(o.total)}</td>
        <td>${esc(o.payment)}</td>
        <td><select data-order="${esc(o.id)}" ${o.status === "cancelled" ? "disabled" : ""}>${STATUSES.map(st => `<option value="${st}" ${st === o.status ? "selected" : ""}>${STATUS_JA[st]}</option>`).join("")}</select></td>
      </tr>`).join("") || '<tr><td colspan="7" class="muted">注文はありません</td></tr>'}
    </table></div>`;
}

async function products() {
  const { products } = await api("/products?all=1");
  return `
    <h1>商品・在庫管理</h1>
    <div class="panel"><h2>商品を追加</h2>
      <form id="product-form" class="form-grid">
        <div><label>商品名</label><input required name="name"></div>
        <div><label>カテゴリ</label><input required name="cat"></div>
        <div><label>価格(円)</label><input required type="number" min="0" name="price"></div>
        <div><label>在庫</label><input required type="number" min="0" name="stock" value="0"></div>
        <div><label>絵文字</label><input name="emoji" value="📦"></div>
        <div><label>背景色</label><input name="color" value="#e5e7eb"></div>
        <div style="grid-column:1/-1"><label>説明</label><input name="desc"></div>
        <div><button class="btn" type="submit">追加</button></div>
      </form><p class="error" id="form-error"></p>
    </div>
    <div class="panel"><table class="table">
      <tr><th></th><th>商品名</th><th>カテゴリ</th><th class="num">価格</th><th class="num">在庫</th><th>公開</th><th></th></tr>
      ${products.map(p => `<tr class="${p.active ? "" : "inactive"}" data-row="${esc(p.id)}">
        <td style="font-size:1.4rem">${esc(p.emoji)}</td>
        <td><input name="name" value="${esc(p.name)}"></td>
        <td><input name="cat" value="${esc(p.cat)}" class="w-sm"></td>
        <td class="num"><input name="price" type="number" min="0" value="${p.price}" class="w-sm"></td>
        <td class="num"><input name="stock" type="number" min="0" value="${p.stock}" class="w-sm ${p.stock <= 5 ? "warn" : ""}"></td>
        <td><input name="active" type="checkbox" ${p.active ? "checked" : ""}></td>
        <td><button class="btn sm" data-save="${esc(p.id)}">保存</button> <button class="btn danger sm" data-remove="${esc(p.id)}">非公開</button></td>
      </tr>`).join("")}
    </table></div>`;
}

async function customers() {
  const { users } = await api("/admin/users");
  return `<h1>顧客管理</h1><div class="panel"><table class="table">
    <tr><th>名前</th><th>メール</th><th>権限</th><th>登録日</th><th class="num">注文数</th><th class="num">累計購入額</th></tr>
    ${users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role === "admin" ? "管理者" : "顧客"}</td><td>${new Date(u.createdAt).toLocaleDateString("ja-JP")}</td><td class="num">${u.orderCount}</td><td class="num">${yen(u.spent)}</td></tr>`).join("")}
  </table></div>`;
}

// --- events ---
document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, data = Object.fromEntries(new FormData(f)), err = f.querySelector("#form-error") || document.getElementById("form-error");
  try {
    if (f.id === "login-form") {
      const r = await api("/auth/login", { method: "POST", body: data });
      if (r.user.role !== "admin") { await api("/auth/logout", { method: "POST" }); throw new Error("管理者アカウントでログインしてください"); }
      user = r.user; render();
    } else if (f.id === "product-form") {
      await api("/products", { method: "POST", body: data }); toast("商品を追加しました"); render();
    }
  } catch (ex) { err.textContent = ex.message; }
});
document.addEventListener("change", async e => {
  const sel = e.target.closest("select[data-order]"); if (!sel) return;
  try { await api(`/orders/${sel.dataset.order}`, { method: "PATCH", body: { status: sel.value } }); toast("ステータスを更新しました"); }
  catch (ex) { toast(ex.message); }
  render();
});
document.addEventListener("change", e => { if (e.target.id === "order-filter") { orderFilter = e.target.value; render(); } });
document.addEventListener("click", async e => {
  if (e.target.id === "logout") { e.preventDefault(); await api("/auth/logout", { method: "POST" }); user = null; render(); return; }
  const btn = e.target.closest("[data-save],[data-remove]"); if (!btn) return;
  try {
    if (btn.dataset.save) {
      const row = document.querySelector(`[data-row="${btn.dataset.save}"]`);
      const body = {};
      for (const inp of row.querySelectorAll("input")) body[inp.name] = inp.type === "checkbox" ? inp.checked : inp.value;
      await api(`/products/${btn.dataset.save}`, { method: "PUT", body }); toast("保存しました");
    } else {
      if (!confirm("この商品を非公開にしますか?")) return;
      await api(`/products/${btn.dataset.remove}`, { method: "DELETE" }); toast("非公開にしました");
    }
    render();
  } catch (ex) { toast(ex.message); }
});

(async () => {
  const { user: me } = await api("/auth/me");
  user = me && me.role === "admin" ? me : null;
  render();
})();
