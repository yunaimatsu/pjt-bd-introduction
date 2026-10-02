// Wraps a Vercel Node function handler with method routing and error handling.
export function route(handlers) {
  return async (req, res) => {
    const fn = handlers[req.method];
    if (!fn) {
      res.setHeader("Allow", Object.keys(handlers).join(", "));
      return res.status(405).json({ error: "Method Not Allowed" });
    }
    try {
      await fn(req, res);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "サーバーエラーが発生しました" });
    }
  };
}
export const body = req => (req.body && typeof req.body === "object" ? req.body : {});
export const badRequest = (res, msg) => res.status(400).json({ error: msg });
