const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";

const countryData = {
  ARG: ["Argentina", "ar"], AUS: ["Australia", "au"], AUT: ["Austria", "at"],
  BEL: ["Belgium", "be"], BIH: ["Bosnia and Herzegovina", "ba"], BRA: ["Brazil", "br"],
  CAN: ["Canada", "ca"], CHE: ["Switzerland", "ch"], CIV: ["Cote d'Ivoire", "ci"],
  COD: ["DR Congo", "cd"], COL: ["Colombia", "co"], CPV: ["Cape Verde", "cv"],
  CUW: ["Curacao", "cw"], CZE: ["Czechia", "cz"], DEU: ["Germany", "de"],
  DZA: ["Algeria", "dz"], ECU: ["Ecuador", "ec"], EGY: ["Egypt", "eg"],
  ENG: ["England", "gb-eng"], ESP: ["Spain", "es"], FRA: ["France", "fr"],
  GHA: ["Ghana", "gh"], HRV: ["Croatia", "hr"], HTI: ["Haiti", "ht"],
  IRN: ["Iran", "ir"], IRQ: ["Iraq", "iq"], JOR: ["Jordan", "jo"],
  JPN: ["Japan", "jp"], KOR: ["South Korea", "kr"], MAR: ["Morocco", "ma"],
  MEX: ["Mexico", "mx"], NLD: ["Netherlands", "nl"], NOR: ["Norway", "no"],
  NZL: ["New Zealand", "nz"], PAN: ["Panama", "pa"], PAR: ["Paraguay", "py"],
  PRT: ["Portugal", "pt"], QAT: ["Qatar", "qa"], RSA: ["South Africa", "za"],
  SAU: ["Saudi Arabia", "sa"], SCT: ["Scotland", "gb-sct"], SEN: ["Senegal", "sn"],
  SWE: ["Sweden", "se"], TUN: ["Tunisia", "tn"], TUR: ["Turkey", "tr"],
  URY: ["Uruguay", "uy"], USA: ["United States", "us"], UZB: ["Uzbekistan", "uz"],
};

function normalizeTeam(team) {
  const [name, flagCode] = countryData[team.shortName] || [team.teamName, null];
  return {
    name,
    code: team.shortName,
    flag: flagCode
      ? `https://flagcdn.com/w160/${flagCode}.png`
      : team.teamIconUrl.replace(/^http:/, "https:"),
  };
}

function selectRound(fixtures) {
  const now = Date.now();
  const grouped = new Map();

  for (const fixture of fixtures) {
    const round = fixture.group?.groupOrderID || 1;
    if (!grouped.has(round)) grouped.set(round, []);
    grouped.get(round).push(fixture);
  }

  const orderedRounds = [...grouped.entries()].sort(([a], [b]) => a - b);
  return (
    orderedRounds.find(([, games]) =>
      games.some((game) => !game.matchIsFinished && new Date(game.matchDateTimeUTC).getTime() >= now)
    ) || orderedRounds.at(-1)
  );
}

export default async function handler(request, response) {
  try {
    const apiResponse = await fetch(API_URL, {
      headers: { "User-Agent": "World-Picks/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!apiResponse.ok) throw new Error(`OpenLigaDB returned ${apiResponse.status}`);

    const fixtures = await apiResponse.json();
    const [roundNumber, roundFixtures] = selectRound(fixtures);
    const matches = roundFixtures
      .sort((a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC))
      .map((fixture) => ({
        id: fixture.matchID,
        kickoff: fixture.matchDateTimeUTC,
        home: normalizeTeam(fixture.team1),
        away: normalizeTeam(fixture.team2),
      }));

    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    response.status(200).json({
      round: {
        number: roundNumber,
        name:
          roundNumber <= 3
            ? `Matchday ${roundNumber}`
            : roundFixtures[0]?.group?.groupName || "Current round",
        label: roundNumber <= 3 ? "Group stage" : "World Cup 2026",
      },
      matches,
      cached: false,
    });
  } catch (error) {
    response.status(502).json({
      error: "Unable to load fixtures",
      detail: error.message,
    });
  }
}
