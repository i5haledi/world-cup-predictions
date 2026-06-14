import { allowMethod } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { calculateRoundPoints, fetchFixtures, groupFixtures } from "./_lib/fixtures.js";
import { noStore } from "./_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const [users, predictions, manualScores, fixtures] = await Promise.all([
      sql`SELECT id, username FROM users WHERE role = 'user' ORDER BY created_at`,
      sql`SELECT user_id, round_number, scores FROM predictions`,
      sql`SELECT user_id, round_number, points FROM round_scores`,
      fetchFixtures(),
    ]);
    const fixtureGroups = groupFixtures(fixtures);
    const manualMap = new Map(
      manualScores.map((score) => [`${score.user_id}:${score.round_number}`, Number(score.points)])
    );

    const leaderboard = users.map((user) => {
      const userPredictions = predictions.filter(
        (prediction) => String(prediction.user_id) === String(user.id)
      );
      const rounds = {};

      for (const prediction of userPredictions) {
        const round = Number(prediction.round_number);
        const manualKey = `${user.id}:${round}`;
        rounds[round] = manualMap.has(manualKey)
          ? manualMap.get(manualKey)
          : calculateRoundPoints(prediction.scores, fixtureGroups.get(round) || []);
      }

      for (const score of manualScores.filter(
        (item) => String(item.user_id) === String(user.id)
      )) {
        rounds[Number(score.round_number)] = Number(score.points);
      }

      return {
        id: user.id,
        username: user.username,
        rounds,
        points: Object.values(rounds).reduce((sum, value) => sum + value, 0),
      };
    });

    leaderboard.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username, "ar"));
    return response.status(200).json({
      leaderboard: leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 })),
    });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل الترتيب.", detail: error.message });
  }
}
