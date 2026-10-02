import { route } from "../../lib/http.js";
import { currentUser, publicUser } from "../../lib/auth.js";
export default route({ async GET(req, res) { res.json({ user: publicUser(await currentUser(req)) }); } });
