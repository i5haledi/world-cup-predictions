import { allowMethod } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { calculateRoundPoints, fetchFixtures, groupFixtures, roundName } from "./_lib/fixtures.js";
import { noStore } from "./_lib/http.js";

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const adminUsername = String(process.env.ADMIN_USERNAME || "i5haledi")
      .trim()
      .toLocaleLowerCase("ar");
    const [users, predictions, manualScores, fixtures] = await Promise.all([
      sql`
        SELECT id, username
        FROM users
        WHERE role = 'user' AND username_key <> ${adminUsername}
        ORDER BY created_at
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
    const roundNames = Object.fromEntries(
      [...fixtureGroups.entries()].map(([round, games]) => [
        String(round),
        roundName(Number(round), games[0]?.group?.groupName),
      ])
    );

    const leaderboard = users.map((user) => {
      const userPredictions = predictions.filter(
        (prediction) => String(prediction.user_id) === String(user.id)
      );
      const rounds = {};

      for (const prediction of userPredictions) {
        const round = Number(prediction.round_number);
        if (round === 1) continue;
        rounds[round] = calculateRoundPoints(
          prediction.scores,
          fixtureGroups.get(round) || []
        );
      }

      for (const score of manualScores.filter(
        (item) => String(item.user_id) === String(user.id)
      )) {
        rounds[1] = Number(score.points);
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
      roundNames,
      leaderboard: leaderboard.map((entry, index) => ({ ...entry, rank: index + 1 })),
    });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل الترتيب.", detail: error.message });
  }
}
