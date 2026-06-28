import { allowMethod, requireSession } from "../_lib/auth.js";
import { ensureSchema, getSql } from "../_lib/db.js";
import { fetchFixtures, groupFixtures, roundName, selectVisibleRounds } from "../_lib/fixtures.js";
import { noStore } from "../_lib/http.js";
import { normalizeTeam } from "../_lib/teams.js";

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

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  if (!requireSession(request, response, "admin")) return;

  try {
    await ensureSchema();
    const sql = getSql();
    const [users, predictions, events, fixtures] = await Promise.all([
      sql`
        SELECT id, username
        FROM users
        WHERE role = 'user'
        ORDER BY created_at
      `,
      sql`
        SELECT user_id, round_number, scores, submitted_at, created_at, updated_at
        FROM predictions
        ORDER BY round_number, submitted_at
      `,
      sql`
        SELECT user_id, round_number, match_id, home, away, action, created_at
        FROM prediction_events
        ORDER BY created_at
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
        name: roundName(Number(round), games[0]?.group?.groupName),
        matches: [...games]
          .sort((a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC))
          .map((fixture) => ({
            id: String(fixture.matchID),
            kickoff: fixture.matchDateTimeUTC,
            home: normalizeTeam(fixture, "team1").name,
            away: normalizeTeam(fixture, "team2").name,
          })),
      }));

    const eventsByUserMatch = new Map();
    for (const event of events) {
      const key = `${event.user_id}:${event.match_id}`;
      const matchEvents = eventsByUserMatch.get(key) || [];
      matchEvents.push({
        action: event.action,
        home: String(event.home),
        away: String(event.away),
        createdAt: event.created_at,
      });
      eventsByUserMatch.set(key, matchEvents);
    }

    const predictionsByUser = new Map();
    for (const prediction of predictions) {
      const userPredictions = predictionsByUser.get(String(prediction.user_id)) || {};
      const scores = cleanScores(prediction.scores);
      for (const [matchId, score] of Object.entries(scores)) {
        if (!score || score.home === undefined || score.away === undefined) continue;
        const matchEvents = eventsByUserMatch.get(`${prediction.user_id}:${matchId}`) || [];
        userPredictions[String(matchId)] = {
          home: String(score.home),
          away: String(score.away),
          roundNumber: Number(prediction.round_number),
          createdAt: matchEvents[0]?.createdAt || prediction.created_at || prediction.submitted_at,
          updatedAt: matchEvents.at(-1)?.createdAt || prediction.updated_at || prediction.submitted_at,
          submittedAt: prediction.submitted_at,
          events: matchEvents,
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
