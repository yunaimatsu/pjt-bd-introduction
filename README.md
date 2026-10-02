# BD Store

デモECサイト + 基幹システム(管理画面)。Vercel でホスティング。

- 本番: https://bd-store-kappa.vercel.app
- 管理画面: https://bd-store-kappa.vercel.app/admin.html
- GitHub連携により `main` へのpushで自動デプロイ

## 構成

```
public/            ストア(index.html, app.js)と管理画面(admin.html, admin.js)
api/               Vercel Functions(Node)
  auth/            register / login / logout / me
  products/        商品一覧・CRUD(管理者)
  orders/          注文作成(在庫引当)・一覧・ステータス更新(管理者)
  admin/           stats(ダッシュボード), users(顧客一覧)
lib/db.js          Vercel Blob(private)上のJSONコレクション。ETagで楽観ロック
lib/auth.js        scryptパスワードハッシュ + HMAC署名のセッションCookie
scripts/           ローカル開発サーバとAPIスモークテスト
```

## 機能

- 会員登録 / ログイン / ログアウト / マイページ(注文履歴)
- 商品一覧・詳細・カート・チェックアウト(ログイン必須、在庫チェックあり)
- 管理画面: ダッシュボード(売上KPI・14日推移・在庫僅少・売れ筋)、受注管理(ステータス変更、キャンセル時は在庫戻し)、商品・在庫管理(追加・編集・非公開)、顧客一覧

## 環境変数(Vercel)

| 変数 | 用途 |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Blobストア(自動設定) |
| `SESSION_SECRET` | セッションCookieの署名鍵 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 初回起動時に作成される管理者アカウント |

## ローカル開発

```
npm install
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=admin1234 npm run dev   # http://localhost:3000(データは .data/ に保存)
npm test                                                             # 別ターミナルでAPIスモークテスト
```

## 注意

- 決済は行いません(支払方法の選択のみ)。
- データはコレクション単位のJSONをBlobに保存する簡易構成です。小規模なデモ用途向けで、大量アクセスには向きません。
