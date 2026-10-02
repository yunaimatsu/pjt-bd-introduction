# BD Store

静的なデモECサイト(商品一覧・商品詳細・カート・チェックアウト)。
依存なしの HTML / CSS / JavaScript で、カートは localStorage に保存されます。

- `public/` — サイト本体
- Vercel でホスティング(`vercel.json` で `public` を出力ディレクトリに指定)

ローカルで見る: `npx serve public`

本番: https://bd-store-kappa.vercel.app (GitHub連携により `main` へのpushで自動デプロイ)
