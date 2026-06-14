import { allowMethod, hashPassword, normalizeUsername, setSessionCookie, validateCredentials } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { noStore, readJsonBody } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["POST"])) return;

  const { username, password } = readJsonBody(request);
  const validationError = validateCredentials(username, password);
  if (validationError) return response.status(400).json({ error: validationError });

  try {
    await ensureSchema();
    const sql = getSql();
    const usernameKey = normalizeUsername(username);
    const existing = await sql`SELECT id FROM users WHERE username_key = ${usernameKey}`;
    if (existing.length) {
      return response.status(409).json({ error: "اسم المستخدم مستخدم بالفعل." });
    }

    const role =
      usernameKey === normalizeUsername(process.env.ADMIN_USERNAME || "i5haledi")
        ? "admin"
        : "user";
    const passwordHash = await hashPassword(password);
    const users = await sql`
      INSERT INTO users (username, username_key, password_hash, role)
      VALUES (${String(username).trim()}, ${usernameKey}, ${passwordHash}, ${role})
      RETURNING id, username, role
    `;
    const user = users[0];
    setSessionCookie(response, user);
    return response.status(201).json({ user });
  } catch (error) {
    return response.status(500).json({ error: "تعذر إنشاء الحساب.", detail: error.message });
  }
}
