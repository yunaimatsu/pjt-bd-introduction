import { route, body, badRequest } from "../../lib/http.js";
import { update, newId } from "../../lib/db.js";
import { hashPassword, createSession, setSessionCookie, publicUser } from "../../lib/auth.js";

export default route({
  async POST(req, res) {
    const { email, password, name } = body(req);
    const em = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return badRequest(res, "メールアドレスの形式が正しくありません");
    if (!password || String(password).length < 8) return badRequest(res, "パスワードは8文字以上にしてください");
    if (!name || !String(name).trim()) return badRequest(res, "お名前を入力してください");
    const result = await update("users", users => {
      if (users.some(u => u.email === em)) return { error: "このメールアドレスは既に登録されています" };
      const user = { id: newId(), email: em, name: String(name).trim(), passwordHash: hashPassword(String(password)), role: "customer", createdAt: new Date().toISOString() };
      users.push(user);
      return { user };
    });
    if (result.error) return res.status(409).json({ error: result.error });
    setSessionCookie(res, createSession(result.user.id));
    res.status(201).json({ user: publicUser(result.user) });
  },
});
