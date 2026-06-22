import { allowMethod, requireSession } from "./_lib/auth.js";
import { ensureSchema, getSql } from "./_lib/db.js";
import { fetchFixtures, finalScore, groupFixtures, selectVisibleRounds } from "./_lib/fixtures.js";
import { noStore } from "./_lib/http.js";

const countryData = {
  ARG: "الأرجنتين", AUS: "أستراليا", AUT: "النمسا",
  BEL: "بلجيكا", BIH: "البوسنة والهرسك", BRA: "البرازيل",
  CAN: "كندا", CHE: "سويسرا", CIV: "ساحل العاج",
  COD: "الكونغو الديمقراطية", COL: "كولومبيا", CPV: "الرأس الأخضر",
  CUW: "كوراساو", CZE: "التشيك", DEU: "ألمانيا", GER: "ألمانيا",
  DZA: "الجزائر", ECU: "الإكوادور", EGY: "مصر",
  ENG: "إنجلترا", ESP: "إسبانيا", FRA: "فرنسا",
  GHA: "غانا", HRV: "كرواتيا", HTI: "هايتي",
  IRN: "إيران", IRQ: "العراق", JOR: "الأردن",
  JPN: "اليابان", KOR: "كوريا الجنوبية", MAR: "المغرب",
  MEX: "المكسيك", NLD: "هولندا", NOR: "النرويج",
  NZL: "نيوزيلندا", PAN: "بنما", PAR: "باراغواي",
  PRT: "البرتغال", QAT: "قطر", RSA: "جنوب أفريقيا",
  SAU: "السعودية", SCT: "اسكتلندا", SEN: "السنغال",
  SWE: "السويد", TUN: "تونس", TUR: "تركيا",
  URY: "الأوروغواي", USA: "الولايات المتحدة", UZB: "أوزبكستان",
};

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
  return countryData[team?.shortName] || team?.teamName || team?.shortName || "منتخب";
}

function roundName(round) {
  return round <= 3 ? `الجولة ${round}` : `الدور ${round}`;
}

function matchPoints(predicted, actual) {
  if (!predicted || !actual) return 0;
  const predictedHome = Number(predicted.home);
  const predictedAway = Number(predicted.away);
  if (!Number.isFinite(predictedHome) || !Number.isFinite(predictedAway)) return 0;
  if (predictedHome === actual.home && predictedAway === actual.away) return 3;
  if (Math.sign(predictedHome - predictedAway) === Math.sign(actual.home - actual.away)) return 1;
  return 0;
}

function matchStatus(fixture, actual, predicted) {
  const kickoff = new Date(fixture.matchDateTimeUTC).getTime();
  if (actual) return predicted ? "scored" : "missed";
  if (kickoff <= Date.now()) return "pending_result";
  return predicted ? "saved" : "not_predicted";
}

export default async function handler(request, response) {
  noStore(response);
  if (!allowMethod(request, response, ["GET"])) return;
  const session = requireSession(request, response);
  if (!session) return;
  if (session.role === "admin") {
    return response.status(403).json({ error: "صفحة النقاط مخصصة للمستخدمين فقط." });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const [predictionRows, manualRows, fixtures] = await Promise.all([
      sql`
        SELECT round_number, scores
        FROM predictions
        WHERE user_id = ${session.id}
        ORDER BY round_number
      `,
      sql`
        SELECT round_number, points
        FROM round_scores
        WHERE user_id = ${session.id}
        ORDER BY round_number
      `,
      fetchFixtures(),
    ]);

    const predictions = new Map(
      predictionRows.map((row) => [Number(row.round_number), cleanScores(row.scores)])
    );
    const manualScores = new Map(
      manualRows.map((row) => [Number(row.round_number), Number(row.points)])
    );
    const visibleRoundNumbers = new Set(
      selectVisibleRounds(fixtures, Date.now()).map((round) => Number(round.round))
    );
    const includedRoundNumbers = new Set([
      ...visibleRoundNumbers,
      ...predictions.keys(),
      ...manualScores.keys(),
    ]);
    const fixtureGroups = groupFixtures(fixtures);

    const rounds = [...fixtureGroups.entries()]
      .filter(([round]) => includedRoundNumbers.has(Number(round)))
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, games]) => {
        const roundNumber = Number(round);
        const scores = predictions.get(roundNumber) || {};
        const manualPoints = manualScores.get(roundNumber);
        const matches = [...games]
          .sort((a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC))
          .map((fixture) => {
            const predicted = scores[String(fixture.matchID)] || null;
            const actual = finalScore(fixture);
            const points = roundNumber === 1 ? 0 : matchPoints(predicted, actual);
            return {
              id: String(fixture.matchID),
              kickoff: fixture.matchDateTimeUTC,
              home: teamName(fixture.team1),
              away: teamName(fixture.team2),
              predicted,
              actual,
              points,
              status: matchStatus(fixture, actual, predicted),
            };
          });
        const automaticPoints = matches.reduce((sum, match) => sum + match.points, 0);
        const totalPoints = roundNumber === 1 && manualPoints !== undefined
          ? manualPoints
          : automaticPoints;

        return {
          number: roundNumber,
          name: roundName(roundNumber),
          manualPoints: manualPoints ?? null,
          totalPoints,
          matches,
        };
      });

    return response.status(200).json({
      user: { id: session.id, username: session.username },
      totalPoints: rounds.reduce((sum, round) => sum + round.totalPoints, 0),
      rounds,
    });
  } catch (error) {
    return response.status(500).json({ error: "تعذر تحميل تفاصيل النقاط.", detail: error.message });
  }
}
