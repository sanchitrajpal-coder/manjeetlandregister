// State registry: record names, portals, and the Bhunaksha adapter settings
// where the state runs the NIC Bhunaksha software (plot polygons + owner list,
// no captcha). Village hints pre-fill the state from the sheet's village text.
const STATES = {
  MH: { name: "Maharashtra", record: "7/12 extract (Satbara)", nos: "Gat / Survey no.",
        view: "https://bhulekh.mahabhumi.gov.in/", signed: "https://digitalsatbara.mahabhumi.gov.in/",
        map: "https://mahabhunakasha.mahabhumi.gov.in/27/index.html",
        bhunaksha: { base: "https://mahabhunakasha.mahabhumi.gov.in", state: "27", epsg: 32643, gisPrefix: "RVM" },
        fee: "₹15 per signed copy" },
  MP: { name: "Madhya Pradesh", record: "Khasra / B-1 Khatauni", nos: "Khasra no.",
        view: "https://mpbhulekh.gov.in/", map: "https://mpbhunaksha.gov.in/",
        bhunaksha: { base: "https://mpbhunaksha.gov.in", state: "23", epsg: 32643, gisPrefix: "" },
        fee: "₹30 per certified copy" },
  TS: { name: "Telangana", record: "Pahani / 1-B (Dharani)", nos: "Survey no.", view: "https://dharani.telangana.gov.in/" },
  AP: { name: "Andhra Pradesh", record: "Adangal / 1-B (Meebhoomi)", nos: "Survey no.", view: "https://meebhoomi.ap.gov.in/" },
  KA: { name: "Karnataka", record: "RTC / Pahani (Bhoomi)", nos: "Survey no.", view: "https://landrecords.karnataka.gov.in/", map: "https://dishaank.karnataka.gov.in/" },
  TN: { name: "Tamil Nadu", record: "Chitta / Patta / A-Register", nos: "Survey no.", view: "https://eservices.tn.gov.in/" },
  RJ: { name: "Rajasthan", record: "Jamabandi nakal (Apna Khata)", nos: "Khasra no.", view: "https://apnakhata.rajasthan.gov.in/",
        map: "https://bhunaksha.rajasthan.gov.in/", bhunaksha: { base: "https://bhunaksha.rajasthan.gov.in", state: "08", epsg: 32643, gisPrefix: "" } },
  GJ: { name: "Gujarat", record: "7/12 & 8-A (AnyRoR)", nos: "Survey / Block no.", view: "https://anyror.gujarat.gov.in/" },
  OT: { name: "Other", record: "Land record", nos: "Survey no.", view: "" }
};
const ORDER = ["MH","MP","TS","AP","KA","TN","RJ","GJ","OT"];
const HINTS = [
  ["MP", /SENDHWA|BADNAWAR|PANSEMAL|MOONDI|PALSOOD|WARLA|PITHA|\bGOI\b|JAMLI|KALLDA|TEMLA|JAWAHARGANJ|DEWADIYA|BHAMAL|A\. ?B\. ?ROAD|GOSHALA|GURUDAWARA|JAMA MAJID|APNABAZAR|SATRATI|GUNJ/],
  ["TS", /SURYAPET|MADHIRA|SUJATANAGAR|BALEMLA|NAYAKULGUDEM|MATOORU|SADASHIVPETH|CHANDAPUR/],
  ["AP", /KURNOOL/],
  ["KA", /JEWARGI|GULBARGA/],
  ["TN", /TIRUNELVELI|SURANDAI|LEVINJIPURAM|ADANGARKULAM/],
  ["RJ", /JAISALMER|JODHA/],
  ["GJ", /AHEMDABAD|AHMEDABAD/]
];
/* Known village → district/taluka/village-code for Maharashtra, filled in as we go */
const VILLAGES = {
  "GEORAI": { state: "MH", district: "Chhatrapati Sambhajinagar", taluka: "Chhatrapati Sambhajinagar", code: "271900050237920000", dist: "19", tal: "05", marathi: "गेवराई" }
};
function guessState(p) {
  const s = ((p.location || "") + " " + (p.note || "")).toUpperCase();
  for (const [k, re] of HINTS) if (re.test(s)) return k;
  if (p.snd) return "MP";
  return "MH";
}
module.exports = { STATES, ORDER, HINTS, VILLAGES, guessState };
