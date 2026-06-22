import { allowMethod, requireSession } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { calculateRoundPoints, fetchFixtures, groupFixtures } from "../_lib/fixtures.js";
import { noStore } from "../_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  if (!requireSession(request, response, "admin")) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const [users, predictions, manualScores, fixtures] = await Promise.all([
      sql`
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
      `,
      sql`SELECT user_id, round_number, scores FROM predictions`,
      sql`
        SELECT user_id, round_number, points
        FROM round_scores
        WHERE round_number = 1
      `,
      fetchFixtures(),
    ]);
    const fixtureGroups = groupFixtures(fixtures);

    const enrichedUsers = users.map((user) => {
      const rounds = {};
      for (const prediction of predictions.filter(
        (item) => String(item.user_id) === String(user.id)
      )) {
        const round = Number(prediction.round_number);
        if (round === 1) continue;
        rounds[round] = calculateRoundPoints(
          prediction.scores,
          fixtureGroups.get(round) || []
        );
      }

      const roundOne = manualScores.find((item) => String(item.user_id) === String(user.id));
      rounds[1] = roundOne ? Number(roundOne.points) : Number(user.round_one_points || 0);

      return {
        ...user,
        rounds,
        total_points: Object.values(rounds).reduce((sum, value) => sum + value, 0),
      };
    });

    enrichedUsers.sort(
      (a, b) => b.total_points - a.total_points || a.username.localeCompare(b.username, "ar")
    );

    return response.status(200).json({ users: enrichedUsers });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل المستخدمين.", detail: error.message });
  }
}
