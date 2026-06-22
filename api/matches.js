import { nextVisibilityChange, selectVisibleRounds } from "./_lib/fixtures.js";

const API_URL = "https://api.openligadb.de/getmatchdata/wm26/2026";

const countryData = {
  ARG: ["الأرجنتين", "ar"], AUS: ["أستراليا", "au"], AUT: ["النمسا", "at"],
  BEL: ["بلجيكا", "be"], BIH: ["البوسنة والهرسك", "ba"], BRA: ["البرازيل", "br"],
  CAN: ["كندا", "ca"], CHE: ["سويسرا", "ch"], CIV: ["ساحل العاج", "ci"],
  COD: ["الكونغو الديمقراطية", "cd"], COL: ["كولومبيا", "co"], CPV: ["الرأس الأخضر", "cv"],
  CUW: ["كوراساو", "cw"], CZE: ["التشيك", "cz"], DEU: ["ألمانيا", "de"], GER: ["ألمانيا", "de"],
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
