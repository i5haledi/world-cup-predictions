import { allowMethod, normalizeUsername, setSessionCookie, verifyPassword } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { noStore, readJsonBody } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["POST"])) return;
  const { username, password } = readJsonBody(request);

  try {
    await ensureSchema();
    const sql = getSql();
    const users = await sql`
      SELECT id, username, password_hash, role
      FROM users
      WHERE username_key = ${normalizeUsername(username)}
      LIMIT 1
    `;
    const user = users[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return response.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    }

    setSessionCookie(response, user);
    return response.status(200).json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تسجيل الدخول.", detail: error.message });
  }
}
