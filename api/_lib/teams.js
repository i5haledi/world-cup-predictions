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

const teamOverrides = {
  "82109:team2": "AUT",
  "82111:team2": "DZA",
};

function teamFromCode(code) {
  const [name, flagCode] = countryData[code] || [];
  if (!name) return null;
  return {
    name,
    code,
    flag: `https://flagcdn.com/w160/${flagCode}.png`,
  };
}

export function normalizeTeam(fixture, side) {
  const team = fixture?.[side] || {};
  const overrideCode = teamOverrides[`${fixture?.matchID}:${side}`];
  const override = overrideCode ? teamFromCode(overrideCode) : null;
  if (override) return override;

  const known = teamFromCode(team.shortName);
  if (known) return known;

  const fallbackName = team.teamName || team.shortName || "لم يتحدد";
  return {
    name: fallbackName,
    code: team.shortName || "",
    flag: team.teamIconUrl?.replace(/^http:/, "https:") || "",
  };
}
