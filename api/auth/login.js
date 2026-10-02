import { route, body, badRequest } from "../../lib/http.js";
import { readAll } from "../../lib/db.js";
import { verifyPassword, createSession, setSessionCookie, publicUser } from "../../lib/auth.js";

export default route({
  async POST(req, res) {
    const { email, password } = body(req);
    if (!email || !password) return badRequest(res, "メールアドレスとパスワードを入力してください");
    const users = await readAll("users");
    const user = users.find(u => u.email === String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) return res.status(401).json({ error: "メールアドレスまたはパスワードが違います" });
    setSessionCookie(res, createSession(user.id));
    res.json({ user: publicUser(user) });
  },
});
