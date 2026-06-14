import { allowMethod, requireSession } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { noStore } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  if (!requireSession(request, response, "admin")) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const users = await sql`
      SELECT
        u.id,
        u.username,
        u.role,
        COALESCE(rs.points, 0) AS round_one_points
      FROM users u
      LEFT JOIN round_scores rs
        ON rs.user_id = u.id AND rs.round_number = 1
      WHERE u.role = 'user'
      ORDER BY u.created_at
    `;
    return response.status(200).json({ users });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل المستخدمين.", detail: error.message });
  }
}
