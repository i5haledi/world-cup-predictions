const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";

export async function fetchFixtures() {
  const response = await fetch(API_URL, {
    headers: { "User-Agent": "World-Picks/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`OpenLigaDB returned ${response.status}`);
  return response.json();
}

export function groupFixtures(fixtures) {
  const groups = new Map();
  for (const fixture of fixtures) {
    const round = fixture.group?.groupOrderID || 1;
    if (!groups.has(round)) groups.set(round, []);
    groups.get(round).push(fixture);
  }
  return groups;
}

export function selectOpenRound(fixtures, now = Date.now()) {
  const rounds = [...groupFixtures(fixtures).entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, games]) => ({
      round,
      games,
      startsAt: Math.min(...games.map((game) => new Date(game.matchDateTimeUTC).getTime())),
    }));
  return rounds.find(({ startsAt }) => startsAt > now) || { ...rounds.at(-1), locked: true };
}

export function finalScore(fixture) {
  if (!fixture.matchIsFinished) return null;
  const finalResult =
    fixture.matchResults?.find((result) => result.resultTypeID === 2) ||
    fixture.matchResults?.at(-1);
  if (!finalResult) return null;
  return {
    home: Number(finalResult.pointsTeam1),
    away: Number(finalResult.pointsTeam2),
  };
}

export function calculateRoundPoints(predictionScores, fixtures) {
  let points = 0;
  for (const fixture of fixtures) {
    const actual = finalScore(fixture);
    const predicted = predictionScores?.[String(fixture.matchID)];
    if (!actual || predicted?.home === "" || predicted?.away === "") continue;

    const predictedHome = Number(predicted.home);
    const predictedAway = Number(predicted.away);
    if (predictedHome === actual.home && predictedAway === actual.away) {
      points += 3;
      continue;
    }

    const actualOutcome = Math.sign(actual.home - actual.away);
    const predictedOutcome = Math.sign(predictedHome - predictedAway);
    if (actualOutcome === predictedOutcome) points += 1;
  }
  return points;
}
