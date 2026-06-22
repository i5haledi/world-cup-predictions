import { allowMethod, requireSession } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { fetchFixtures, groupFixtures, selectVisibleRounds } from "../_lib/fixtures.js";
import { noStore } from "../_lib/http.js";

function cleanScores(scores) {
  if (!scores) return {};
  if (typeof scores === "string") {
    try {
      return JSON.parse(scores);
    } catch {
      return {};
    }
  }
  return scores;
}

function teamName(team) {
  return team?.teamName || team?.shortName || "منتخب";
}

function roundName(round) {
  return round <= 3 ? `الجولة ${round}` : `الدور ${round}`;
}

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  if (!requireSession(request, response, "admin")) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const [users, predictions, fixtures] = await Promise.all([
      sql`
        SELECT id, username
        FROM users
        WHERE role = 'user'
        ORDER BY created_at
      `,
      sql`
        SELECT user_id, round_number, scores, submitted_at
        FROM predictions
        ORDER BY round_number, submitted_at
      `,
      fetchFixtures(),
    ]);

    const visibleRoundNumbers = new Set(
      selectVisibleRounds(fixtures, Date.now()).map((round) => Number(round.round))
    );
    const predictedRoundNumbers = new Set(
      predictions.map((prediction) => Number(prediction.round_number))
    );
    const includedRounds = new Set([...visibleRoundNumbers, ...predictedRoundNumbers]);
    const fixtureGroups = groupFixtures(fixtures);
    const rounds = [...fixtureGroups.entries()]
      .filter(([round]) => includedRounds.has(Number(round)))
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, games]) => ({
        number: Number(round),
        name: roundName(Number(round)),
        matches: [...games]
          .sort((a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC))
          .map((fixture) => ({
            id: String(fixture.matchID),
            kickoff: fixture.matchDateTimeUTC,
            home: teamName(fixture.team1),
            away: teamName(fixture.team2),
          })),
      }));

    const predictionsByUser = new Map();
    for (const prediction of predictions) {
      const userPredictions = predictionsByUser.get(String(prediction.user_id)) || {};
      const scores = cleanScores(prediction.scores);
      for (const [matchId, score] of Object.entries(scores)) {
        if (!score || score.home === undefined || score.away === undefined) continue;
        userPredictions[String(matchId)] = {
          home: String(score.home),
          away: String(score.away),
          roundNumber: Number(prediction.round_number),
          submittedAt: prediction.submitted_at,
        };
      }
      predictionsByUser.set(String(prediction.user_id), userPredictions);
    }

    return response.status(200).json({
      rounds,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        predictions: predictionsByUser.get(String(user.id)) || {},
      })),
    });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل توقعات المستخدمين.", detail: error.message });
  }
}
