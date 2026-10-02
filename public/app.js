const PRODUCTS = [
  { id: 1, name: "ミニマルトートバッグ", cat: "バッグ", price: 4800, emoji: "👜", color: "#fde68a", desc: "キャンバス素材のシンプルなトート。A4がすっぽり入ります。" },
  { id: 2, name: "レザーキーケース", cat: "小物", price: 3200, emoji: "🔑", color: "#fca5a5", desc: "本革製。使うほどに味が出る、長く付き合えるキーケース。" },
  { id: 3, name: "セラミックマグ", cat: "キッチン", price: 1800, emoji: "☕", color: "#bfdbfe", desc: "手触りのいいマットな質感。電子レンジ・食洗機対応。" },
  { id: 4, name: "オーガニックコットンTシャツ", cat: "アパレル", price: 3900, emoji: "👕", color: "#bbf7d0", desc: "肌に優しいオーガニックコットン100%。ユニセックス。" },
  { id: 5, name: "ワイヤレスイヤホン", cat: "ガジェット", price: 9800, emoji: "🎧", color: "#ddd6fe", desc: "ノイズキャンセリング搭載。連続再生8時間。" },
  { id: 6, name: "リネンエプロン", cat: "キッチン", price: 4200, emoji: "🧑‍🍳", color: "#fed7aa", desc: "麻100%の軽やかなエプロン。洗うほど柔らかく。" },
  { id: 7, name: "ノートブック A5", cat: "文具", price: 980, emoji: "📓", color: "#e5e7eb", desc: "滑らかな書き心地の上質紙。方眼・192ページ。" },
  { id: 8, name: "アロマキャンドル", cat: "インテリア", price: 2600, emoji: "🕯️", color: "#fbcfe8", desc: "大豆ワックス使用。ラベンダーの香り。燃焼時間約40時間。" },
  { id: 9, name: "ステンレスボトル 500ml", cat: "キッチン", price: 3400, emoji: "🧴", color: "#a5f3fc", desc: "真空二重構造で保温・保冷。ワンタッチオープン。" },
  { id: 10, name: "キャンバススニーカー", cat: "アパレル", price: 6500, emoji: "👟", color: "#fef3c7", desc: "軽くて歩きやすい定番スニーカー。" },
  { id: 11, name: "スマートウォッチ", cat: "ガジェット", price: 18800, emoji: "⌚", color: "#c7d2fe", desc: "心拍・睡眠計測、通知対応。バッテリー7日間。" },
  { id: 12, name: "ウールブランケット", cat: "インテリア", price: 7800, emoji: "🧣", color: "#fecaca", desc: "ふんわり暖かいウール混ブランケット。140×200cm。" },
];
const SHIPPING_FREE_OVER = 5000;
const SHIPPING = 500;
const yen = n => "¥" + n.toLocaleString("ja-JP");

// --- state ---
let cart = JSON.parse(localStorage.getItem("cart") || "[]");
let filter = "すべて";
const saveCart = () => localStorage.setItem("cart", JSON.stringify(cart));
const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);
const subtotal = () => cart.reduce((s, i) => s + i.qty * PRODUCTS.find(p => p.id === i.id).price, 0);

function addToCart(id, qty = 1) {
  const item = cart.find(i => i.id === id);
  if (item) item.qty += qty; else cart.push({ id, qty });
  saveCart(); updateBadge(); toast("カートに追加しました");
}
function setQty(id, qty) {
  qty = Math.max(0, qty | 0);
  cart = qty === 0 ? cart.filter(i => i.id !== id) : cart.map(i => i.id === id ? { ...i, qty } : i);
  saveCart(); updateBadge(); render();
}
function updateBadge() { document.getElementById("cart-count").textContent = cartCount(); }
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
}

// --- router ---
function navigate(view, param) {
  location.hash = param ? `${view}/${param}` : view;
}
function render() {
  const [view, param] = (location.hash.slice(1) || "home").split("/");
  const app = document.getElementById("app");
  const views = { home, product, cart: cartView, checkout, thanks };
  app.innerHTML = (views[view] || home)(param);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

// --- views ---
function home() {
  const cats = ["すべて", ...new Set(PRODUCTS.map(p => p.cat))];
  const list = filter === "すべて" ? PRODUCTS : PRODUCTS.filter(p => p.cat === filter);
  return `
    <section class="hero"><h1>暮らしを少し良くするもの。</h1><p>日常に馴染む、長く使えるアイテムを集めました。</p></section>
    <div class="filters">${cats.map(c => `<button class="${c === filter ? "active" : ""}" data-filter="${c}">${c}</button>`).join("")}</div>
    <div class="grid">${list.map(p => `
      <div class="card" data-product="${p.id}">
        <div class="img" style="background:${p.color}">${p.emoji}</div>
        <div class="body"><span class="cat">${p.cat}</span><span class="name">${p.name}</span><span class="price">${yen(p.price)}</span></div>
      </div>`).join("")}</div>`;
}
function product(id) {
  const p = PRODUCTS.find(x => x.id == id);
  if (!p) return home();
  return `
    <a href="#home" class="back">← 商品一覧へ戻る</a>
    <div class="detail">
      <div class="img" style="background:${p.color}">${p.emoji}</div>
      <div>
        <span class="cat">${p.cat}</span>
        <h1>${p.name}</h1>
        <p class="desc">${p.desc}</p>
        <div class="price">${yen(p.price)}<small style="font-size:.8rem;color:var(--muted)">(税込)</small></div>
        <div class="qty">数量 <input type="number" id="qty" value="1" min="1" max="99"></div><br>
        <button class="btn" data-add="${p.id}">カートに入れる</button>
      </div>
    </div>`;
}
function cartView() {
  if (!cart.length) return `<div class="empty"><p>カートは空です。</p><a href="#home" class="btn">買い物を続ける</a></div>`;
  const sub = subtotal(); const ship = sub >= SHIPPING_FREE_OVER ? 0 : SHIPPING;
  return `
    <h1>カート</h1>
    <table class="cart-table">
      <thead><tr><th>商品</th><th>単価</th><th>数量</th><th class="num">小計</th><th></th></tr></thead>
      <tbody>${cart.map(i => { const p = PRODUCTS.find(x => x.id === i.id); return `
        <tr>
          <td><a href="#product/${p.id}">${p.emoji} ${p.name}</a></td>
          <td>${yen(p.price)}</td>
          <td><button class="btn secondary sm" data-dec="${p.id}">−</button> ${i.qty} <button class="btn secondary sm" data-inc="${p.id}">＋</button></td>
          <td class="num">${yen(p.price * i.qty)}</td>
          <td><button class="btn danger" data-del="${p.id}">削除</button></td>
        </tr>`; }).join("")}</tbody>
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
  if (!cart.length) return cartView();
  const sub = subtotal(); const ship = sub >= SHIPPING_FREE_OVER ? 0 : SHIPPING;
  return `
    <a href="#cart" class="back">← カートへ戻る</a>
    <h1>お届け先・お支払い</h1>
    <form class="form" id="checkout-form">
      <label>お名前</label><input required name="name" placeholder="山田 太郎">
      <label>メールアドレス</label><input required type="email" name="email" placeholder="you@example.com">
      <label>郵便番号</label><input required name="zip" placeholder="100-0001">
      <label>住所</label><input required name="address" placeholder="東京都千代田区…">
      <label>お支払い方法</label>
      <select name="payment"><option>クレジットカード</option><option>コンビニ払い</option><option>代金引換</option></select>
      <p style="margin-top:16px">合計 <strong>${yen(sub + ship)}</strong>(送料 ${ship === 0 ? "無料" : yen(ship)})</p>
      <button class="btn" type="submit">注文を確定する</button>
    </form>`;
}
function thanks(orderId) {
  return `<div class="thanks"><div class="big">🎉</div><h1>ご注文ありがとうございます</h1><p>注文番号: <strong>${orderId}</strong></p><p style="color:var(--muted)">※デモサイトのため実際の注文・決済は行われません。</p><a href="#home" class="btn">買い物を続ける</a></div>`;
}

// --- events ---
document.addEventListener("click", e => {
  const el = e.target.closest("[data-view],[data-filter],[data-product],[data-add],[data-inc],[data-dec],[data-del]");
  if (!el) return;
  if (el.dataset.view) { e.preventDefault(); navigate(el.dataset.view); }
  else if (el.dataset.filter) { filter = el.dataset.filter; render(); }
  else if (el.dataset.product) navigate("product", el.dataset.product);
  else if (el.dataset.add) addToCart(+el.dataset.add, +document.getElementById("qty").value || 1);
  else if (el.dataset.inc) setQty(+el.dataset.inc, cart.find(i => i.id == el.dataset.inc).qty + 1);
  else if (el.dataset.dec) setQty(+el.dataset.dec, cart.find(i => i.id == el.dataset.dec).qty - 1);
  else if (el.dataset.del) setQty(+el.dataset.del, 0);
});
document.addEventListener("submit", e => {
  if (e.target.id !== "checkout-form") return;
  e.preventDefault();
  const orderId = "BD-" + Date.now().toString(36).toUpperCase();
  cart = []; saveCart(); updateBadge();
  navigate("thanks", orderId);
});

updateBadge(); render();
