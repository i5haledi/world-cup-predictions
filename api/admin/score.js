import { allowMethod, requireSession } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { noStore, readJsonBody } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["POST"])) return;
  if (!requireSession(request, response, "admin")) return;

  const { userId, roundNumber, points } = readJsonBody(request);
  const cleanRound = Number(roundNumber);
  const cleanPoints = Number(points);
  if (
    !Number.isInteger(cleanRound) ||
    cleanRound < 1 ||
    !Number.isInteger(cleanPoints) ||
    cleanPoints < 0 ||
    cleanPoints > 1000
  ) {
    return response.status(400).json({ error: "قيمة النقاط غير صحيحة." });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO round_scores (user_id, round_number, points, source)
      VALUES (${String(userId)}, ${cleanRound}, ${cleanPoints}, 'manual')
      ON CONFLICT (user_id, round_number)
      DO UPDATE SET points = EXCLUDED.points, source = 'manual', updated_at = NOW()
    `;
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(500).json({ error: "تعذر حفظ النقاط.", detail: error.message });
  }
}
