import { nextVisibilityChange, roundLabel, roundName, selectVisibleRounds } from "./_lib/fixtures.js";
import { normalizeTeam } from "./_lib/teams.js";

const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";

export default async function handler(request, response) {
  try {
    const apiResponse = await fetch(API_URL, {
      headers: { "User-Agent": "World-Picks/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!apiResponse.ok) throw new Error(`OpenLigaDB returned ${apiResponse.status}`);

    const fixtures = await apiResponse.json();
    const now = Date.now();
    const visibleRounds = selectVisibleRounds(fixtures, now);
    const rounds = visibleRounds.map((round) => ({
      number: round.round,
      name: roundName(round.round, round.games[0]?.group?.groupName),
      label: roundLabel(round.round),
      startsAt: new Date(round.startsAt).toISOString(),
      matches: round.games.map((fixture) => ({
        id: fixture.matchID,
        roundNumber: round.round,
        kickoff: fixture.matchDateTimeUTC,
        locked: new Date(fixture.matchDateTimeUTC).getTime() <= now,
        home: normalizeTeam(fixture, "team1"),
        away: normalizeTeam(fixture, "team2"),
      })),
    }));
    const matches = rounds.flatMap((round) => round.matches);
    const nextRefreshAt = nextVisibilityChange(fixtures, now);

    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({
      rounds,
      matches,
      serverTime: new Date(now).toISOString(),
      nextRefreshAt: Number.isFinite(nextRefreshAt) ? new Date(nextRefreshAt).toISOString() : null,
      cached: false,
    });
  } catch (error) {
    response.status(502).json({
      error: "Unable to load fixtures",
      detail: error.message,
    });
  }
}
