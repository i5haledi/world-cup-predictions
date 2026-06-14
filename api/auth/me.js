import {
  allowMethod,
  normalizeUsername,
  readSession,
  setSessionCookie,
} from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { noStore } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  const session = readSession(request);
  if (!session) return response.status(200).json({ user: null });

  try {
    await ensureSchema();
    const sql = getSql();
    const users = await sql`
      SELECT id, username, username_key, role
      FROM users
      WHERE id = ${session.id}
      LIMIT 1
    `;
    const user = users[0];
    if (!user) return response.status(200).json({ user: null });

    const adminUsername = normalizeUsername(
      process.env.ADMIN_USERNAME || "i5haledi"
    );
    const expectedRole =
      user.username_key === adminUsername ? "admin" : user.role;
    if (user.role !== expectedRole) {
      await sql`UPDATE users SET role = ${expectedRole} WHERE id = ${user.id}`;
      user.role = expectedRole;
    }

    const publicUser = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    if (
      String(session.id) !== String(user.id) ||
      session.username !== user.username ||
      session.role !== user.role
    ) {
      setSessionCookie(response, publicUser);
    }
    return response.status(200).json({ user: publicUser });
  } catch (error) {
    return response.status(500).json({
      error: "تعذر التحقق من الجلسة.",
      detail: error.message,
    });
  }
}
