import { allowMethod, requireSession } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { fetchFixtures, groupFixtures } from "./_lib/fixtures.js";
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
    const users = await sql`
      SELECT role, username_key
      FROM users
      WHERE id = ${session.id}
      LIMIT 1
    `;
    const user = users[0];
    const adminUsername = String(process.env.ADMIN_USERNAME || "i5haledi")
      .trim()
      .toLocaleLowerCase("ar");
    if (!user || user.role === "admin" || user.username_key === adminUsername) {
      return response.status(403).json({ error: "حساب الآدمن مخصص للوحة التحكم فقط." });
    }

    if (request.method === "GET") {
      const rows = await sql`
        SELECT round_number, scores, submitted_at
        FROM predictions
        WHERE user_id = ${session.id}
        ORDER BY round_number
      `;
      return response.status(200).json({ predictions: rows });
    }

    const body = readJsonBody(request);
    const submittedRounds = Array.isArray(body.rounds)
      ? body.rounds
      : [{ roundNumber: body.roundNumber, scores: body.scores }];
    const fixtures = await fetchFixtures();
    const fixtureGroups = groupFixtures(fixtures);
    const now = Date.now();
    const savedRounds = [];

    for (const submittedRound of submittedRounds) {
      const roundNumber = Number(submittedRound.roundNumber);
      if (!Number.isInteger(roundNumber) || roundNumber < 1) {
        return response.status(400).json({ error: "الجولة غير صحيحة." });
      }
      const scores = submittedRound.scores || {};
      const roundFixtures = fixtureGroups.get(roundNumber) || [];
      if (!roundFixtures.length) continue;
      const submittedMatchIds = Object.keys(scores);
      const roundFixtureIds = new Set(roundFixtures.map((fixture) => String(fixture.matchID)));
      const unknownMatchId = submittedMatchIds.find((id) => !roundFixtureIds.has(String(id)));
      if (unknownMatchId) {
        return response.status(400).json({ error: "المباراة لا تنتمي لهذه الجولة." });
      }

      const existing = await sql`
        SELECT scores
        FROM predictions
        WHERE user_id = ${session.id} AND round_number = ${roundNumber}
        LIMIT 1
      `;
      const mergedScores = existing[0]?.scores
        ? typeof existing[0].scores === "string"
          ? JSON.parse(existing[0].scores)
          : existing[0].scores
        : {};

      let touched = false;
      let changed = false;
      const events = [];
      for (const fixture of roundFixtures) {
        const id = String(fixture.matchID);
        const kickoff = new Date(fixture.matchDateTimeUTC).getTime();
        const score = scores[id];
        if (!score) continue;
        touched = true;
        if (!Number.isFinite(kickoff) || kickoff <= now || fixture.matchIsFinished) {
          return response.status(409).json({
            error: "لا يمكن تعديل توقع مباراة بدأت بالفعل.",
          });
        }
        const valid =
          score?.home !== "" &&
          score?.away !== "" &&
          score?.home !== undefined &&
          score?.away !== undefined &&
          Number.isInteger(Number(score?.home)) &&
          Number.isInteger(Number(score?.away)) &&
          Number(score.home) >= 0 &&
          Number(score.away) >= 0 &&
          Number(score.home) <= 20 &&
          Number(score.away) <= 20;
        if (!valid) {
          return response.status(400).json({ error: "يجب إدخال نتيجة صحيحة للمباريات المفتوحة." });
        }
        const nextScore = {
          home: String(Number(score.home)),
          away: String(Number(score.away)),
        };
        const previousScore = mergedScores[id];
        const isChanged =
          previousScore?.home !== nextScore.home ||
          previousScore?.away !== nextScore.away;
        if (!isChanged) continue;

        mergedScores[id] = nextScore;
        changed = true;
        events.push({
          matchId: id,
          home: nextScore.home,
          away: nextScore.away,
          action: previousScore ? "update" : "create",
        });
      }

      if (!touched) continue;

      if (changed) {
        await sql`
          INSERT INTO predictions (user_id, round_number, scores, created_at, updated_at, submitted_at)
          VALUES (${session.id}, ${roundNumber}, ${JSON.stringify(mergedScores)}, NOW(), NOW(), NOW())
          ON CONFLICT (user_id, round_number)
          DO UPDATE SET scores = EXCLUDED.scores, updated_at = NOW(), submitted_at = NOW()
        `;

        for (const event of events) {
          await sql`
            INSERT INTO prediction_events (user_id, round_number, match_id, home, away, action)
            VALUES (
              ${session.id},
              ${roundNumber},
              ${event.matchId},
              ${event.home},
              ${event.away},
              ${event.action}
            )
          `;
        }
      }
      savedRounds.push(roundNumber);
    }

    if (!savedRounds.length) {
      return response.status(400).json({ error: "لا توجد مباريات مفتوحة لحفظها." });
    }
    return response.status(200).json({ ok: true, savedRounds });
  } catch (error) {
    return response.status(500).json({ error: "تعذر حفظ التوقعات.", detail: error.message });
  }
}
