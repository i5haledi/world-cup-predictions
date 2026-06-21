const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";
const NEXT_ROUND_VISIBILITY_MS = 24 * 60 * 60 * 1000;

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
  const rounds = getRounds(fixtures);
  return rounds.find(({ startsAt }) => startsAt > now) || { ...rounds.at(-1), locked: true };
}

export function getRounds(fixtures) {
  return [...groupFixtures(fixtures).entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, games]) => {
      const sortedGames = games.sort(
        (a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC)
      );
      return {
        round,
        games: sortedGames,
        startsAt: Math.min(...sortedGames.map((game) => new Date(game.matchDateTimeUTC).getTime())),
        hasUnstartedGames: sortedGames.some(
          (game) => new Date(game.matchDateTimeUTC).getTime() > Date.now()
        ),
      };
    });
}

export function selectVisibleRounds(fixtures, now = Date.now()) {
  const rounds = getRounds(fixtures).map((round) => ({
    ...round,
    hasUnstartedGames: round.games.some(
      (game) => new Date(game.matchDateTimeUTC).getTime() > now
    ),
  }));
  const visible = rounds.filter(
    (round) => round.startsAt <= now && round.hasUnstartedGames
  );
  const nextRound = rounds.find((round) => round.startsAt > now);
  if (nextRound && nextRound.startsAt - now <= NEXT_ROUND_VISIBILITY_MS) {
    visible.push(nextRound);
  }
  if (!visible.length && nextRound && nextRound.round === 1) visible.push(nextRound);
  return visible;
}

export function nextVisibilityChange(fixtures, now = Date.now()) {
  const futureKickoffs = fixtures
    .map((fixture) => new Date(fixture.matchDateTimeUTC).getTime())
    .filter((time) => time > now);
  const futureRoundRevealTimes = getRounds(fixtures)
    .map((round) => round.startsAt - NEXT_ROUND_VISIBILITY_MS)
    .filter((time) => time > now);
  return Math.min(...futureKickoffs, ...futureRoundRevealTimes);
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
    if (
      !actual ||
      !predicted ||
      predicted.home === "" ||
      predicted.away === "" ||
      predicted.home === undefined ||
      predicted.away === undefined
    ) {
      continue;
    }

    const predictedHome = Number(predicted.home);
    const predictedAway = Number(predicted.away);
    if (!Number.isFinite(predictedHome) || !Number.isFinite(predictedAway)) continue;

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
