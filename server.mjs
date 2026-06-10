import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = 8000;
const root = process.cwd();
const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";
const CACHE_TIME = 15 * 60 * 1000;

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

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

let fixtureCache = null;
let fixtureCacheTime = 0;

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
  const active =
    orderedRounds.find(([, games]) =>
      games.some((game) => !game.matchIsFinished && new Date(game.matchDateTimeUTC).getTime() >= now)
    ) || orderedRounds.at(-1);

  return active;
}

async function getMatches() {
  const canUseCache = fixtureCache && Date.now() - fixtureCacheTime < CACHE_TIME;
  if (canUseCache) return { ...fixtureCache, cached: true };

  const response = await fetch(API_URL, {
    headers: { "User-Agent": "World-Picks/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`OpenLigaDB returned ${response.status}`);

  const fixtures = await response.json();
  const [roundNumber, roundFixtures] = selectRound(fixtures);
  const matches = roundFixtures
    .sort((a, b) => new Date(a.matchDateTimeUTC) - new Date(b.matchDateTimeUTC))
    .map((fixture) => ({
      id: fixture.matchID,
      kickoff: fixture.matchDateTimeUTC,
      home: normalizeTeam(fixture.team1),
      away: normalizeTeam(fixture.team2),
    }));

  fixtureCache = {
    round: {
      number: roundNumber,
      name:
        roundNumber <= 3
          ? `Matchday ${roundNumber}`
          : roundFixtures[0]?.group?.groupName || "Current round",
      label: roundNumber <= 3 ? "Group stage" : "World Cup 2026",
    },
    matches,
  };
  fixtureCacheTime = Date.now();
  return { ...fixtureCache, cached: false };
}

createServer(async (request, response) => {
  if (request.url === "/api/matches") {
    try {
      const data = await getMatches();
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Unable to load fixtures", detail: error.message }));
    }
    return;
  }

  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const filePath = normalize(join(root, decodeURIComponent(requestPath.split("?")[0])));
  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`World Picks is running at http://localhost:${port}`);
});
