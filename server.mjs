import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { nextVisibilityChange, selectVisibleRounds } from "./api/_lib/fixtures.js";

const port = 8000;
const root = process.cwd();
const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";
const CACHE_TIME = 15 * 60 * 1000;

const countryData = {
  ARG: ["الأرجنتين", "ar"], AUS: ["أستراليا", "au"], AUT: ["النمسا", "at"],
  BEL: ["بلجيكا", "be"], BIH: ["البوسنة والهرسك", "ba"], BRA: ["البرازيل", "br"],
  CAN: ["كندا", "ca"], CHE: ["سويسرا", "ch"], CIV: ["ساحل العاج", "ci"],
  COD: ["الكونغو الديمقراطية", "cd"], COL: ["كولومبيا", "co"], CPV: ["الرأس الأخضر", "cv"],
  CUW: ["كوراساو", "cw"], CZE: ["التشيك", "cz"], DEU: ["ألمانيا", "de"],
  DZA: ["الجزائر", "dz"], ECU: ["الإكوادور", "ec"], EGY: ["مصر", "eg"],
  ENG: ["إنجلترا", "gb-eng"], ESP: ["إسبانيا", "es"], FRA: ["فرنسا", "fr"],
  GHA: ["غانا", "gh"], HRV: ["كرواتيا", "hr"], HTI: ["هايتي", "ht"],
  IRN: ["إيران", "ir"], IRQ: ["العراق", "iq"], JOR: ["الأردن", "jo"],
  JPN: ["اليابان", "jp"], KOR: ["كوريا الجنوبية", "kr"], MAR: ["المغرب", "ma"],
  MEX: ["المكسيك", "mx"], NLD: ["هولندا", "nl"], NOR: ["النرويج", "no"],
  NZL: ["نيوزيلندا", "nz"], PAN: ["بنما", "pa"], PAR: ["باراغواي", "py"],
  PRT: ["البرتغال", "pt"], QAT: ["قطر", "qa"], RSA: ["جنوب أفريقيا", "za"],
  SAU: ["السعودية", "sa"], SCT: ["اسكتلندا", "gb-sct"], SEN: ["السنغال", "sn"],
  SWE: ["السويد", "se"], TUN: ["تونس", "tn"], TUR: ["تركيا", "tr"],
  URY: ["الأوروغواي", "uy"], USA: ["الولايات المتحدة", "us"], UZB: ["أوزبكستان", "uz"],
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

async function getMatches() {
  const canUseCache = fixtureCache && Date.now() - fixtureCacheTime < CACHE_TIME;
  if (!canUseCache) {
    const response = await fetch(API_URL, {
      headers: { "User-Agent": "World-Picks/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`OpenLigaDB returned ${response.status}`);
    fixtureCache = await response.json();
    fixtureCacheTime = Date.now();
  }

  const now = Date.now();
  const visibleRounds = selectVisibleRounds(fixtureCache, now);
  const rounds = visibleRounds.map((round) => ({
    number: round.round,
    name: round.round <= 3 ? `الجولة ${round.round}` : `الدور ${round.round}`,
    label: round.round <= 3 ? "دور المجموعات" : "كأس العالم 2026",
    startsAt: new Date(round.startsAt).toISOString(),
    matches: round.games.map((fixture) => ({
      id: fixture.matchID,
      roundNumber: round.round,
      kickoff: fixture.matchDateTimeUTC,
      locked: new Date(fixture.matchDateTimeUTC).getTime() <= now,
      home: normalizeTeam(fixture.team1),
      away: normalizeTeam(fixture.team2),
    })),
  }));
  const matches = rounds.flatMap((round) => round.matches);
  const nextRefreshAt = nextVisibilityChange(fixtureCache, now);

  return {
    rounds,
    matches,
    serverTime: new Date(now).toISOString(),
    nextRefreshAt: Number.isFinite(nextRefreshAt) ? new Date(nextRefreshAt).toISOString() : null,
    cached: canUseCache,
  };
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
