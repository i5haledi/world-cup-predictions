import { allowMethod, requireSession } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { fetchFixtures, selectOpenRound } from "./_lib/fixtures.js";
import { noStore, readJsonBody } from "./_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET", "POST"])) return;
  const session = requireSession(request, response);
  if (!session) return;
  if (session.role === "admin") {
    return response.status(403).json({ error: "حساب الآدمن مخصص للوحة التحكم فقط." });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    if (request.method === "GET") {
      const rows = await sql`
        SELECT round_number, scores, submitted_at
        FROM predictions
        WHERE user_id = ${session.id}
        ORDER BY round_number
      `;
      return response.status(200).json({ predictions: rows });
    }

    const { roundNumber, scores } = readJsonBody(request);
    const fixtures = await fetchFixtures();
    const openRound = selectOpenRound(fixtures);
    if (openRound.locked || Number(roundNumber) !== Number(openRound.round)) {
      return response.status(409).json({ error: "أُغلق استقبال توقعات هذه الجولة." });
    }

    const expectedIds = new Set(openRound.games.map((game) => String(game.matchID)));
    const providedIds = Object.keys(scores || {});
    const valid =
      providedIds.length === expectedIds.size &&
      providedIds.every((id) => {
        const score = scores[id];
        return (
          expectedIds.has(id) &&
          Number.isInteger(Number(score?.home)) &&
          Number.isInteger(Number(score?.away)) &&
          Number(score.home) >= 0 &&
          Number(score.away) >= 0 &&
          Number(score.home) <= 20 &&
          Number(score.away) <= 20
        );
      });
    if (!valid) {
      return response.status(400).json({ error: "يجب إدخال نتيجة صحيحة لجميع مباريات الجولة." });
    }

    await sql`
      INSERT INTO predictions (user_id, round_number, scores)
      VALUES (${session.id}, ${Number(roundNumber)}, ${JSON.stringify(scores)})
      ON CONFLICT (user_id, round_number)
      DO UPDATE SET scores = EXCLUDED.scores, submitted_at = NOW()
    `;
    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(500).json({ error: "تعذر حفظ التوقعات.", detail: error.message });
  }
}
