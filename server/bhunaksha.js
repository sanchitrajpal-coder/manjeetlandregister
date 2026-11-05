// NIC Bhunaksha adapter. Maharashtra (and the other Bhunaksha states) expose
// a REST layer the public map page itself uses: plot info (owners, khata,
// area) and the plot polygon in the state's projected CRS. No captcha.
const proj4 = require("proj4");
const { STATES } = require("./states");

proj4.defs("EPSG:32643", "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32644", "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs");
proj4.defs("EPSG:32642", "+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs");

async function post(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
    body: new URLSearchParams(data)
  });
  const t = await r.text();
  if (!r.ok) throw new Error("bhunaksha " + r.status);
  return t;
}

/* "MULTIPOLYGON(((x y, x y …)))" → [[lat,lng]…] of the outer ring, WGS84 */
function parseGeom(wkt, epsg) {
  const m = wkt && wkt.match(/\(\(\(([^()]+)\)/);
  if (!m) return null;
  const from = "EPSG:" + epsg;
  return m[1].split(",").map(s => s.trim().split(/\s+/).map(Number)).map(([x, y]) => {
    const [lng, lat] = proj4(from, "EPSG:4326", [x, y]);
    return [Number(lat.toFixed(7)), Number(lng.toFixed(7))];
  });
}
/* the info blob → [{khata, owner, area}] */
function parseOwners(info) {
  const out = [];
  String(info || "").split(/-{5,}/).forEach(block => {
    const area = (block.match(/Total Area\s*:\s*([\d.]+)/) || [])[1];
    const owner = (block.match(/Owner Name\s*:\s*(.+)/) || [])[1];
    const khata = (block.match(/Khata No\.?\s*:\s*(\S+)/) || [])[1];
    if (owner) out.push({ khata: khata || "", owner: owner.trim().replace(/\s+/g, " "), area: area ? Number(area) : null });
  });
  return out;
}

/* Maharashtra: giscode = "RVM" + district(2) + taluka(2) + village code(18) */
async function plot(stateKey, { dist, tal, villageCode, plotNo }) {
  const st = STATES[stateKey];
  if (!st || !st.bhunaksha) throw new Error("No Bhunaksha adapter for " + stateKey);
  const b = st.bhunaksha;
  const gis = (b.gisPrefix || "") + (dist || "") + (tal || "") + villageCode;
  const txt = await post(b.base + "/bhunaksha/rest/MapInfo/getPlotInfo", { state: b.state, giscode: gis, plotno: String(plotNo), srs: "3857" });
  if (!txt.trim()) return null;
  const j = JSON.parse(txt);
  if (!j || !j.plotid) return null;
  const poly = parseGeom(j.the_geom, b.epsg);
  const owners = parseOwners(j.info);
  let bbox = null;
  if (poly) {
    const lats = poly.map(p => p[0]), lngs = poly.map(p => p[1]);
    bbox = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  }
  return { gis, plotNo: j.plotno, areaSqm: j.map_area || j.area, owners, poly, centre: bbox, gisinfo: j.gisinfo,
    report: b.base + "/bhunaksha/signplotreport.jsp?state=" + b.state + "&giscode=" + gis + "&plotno=" + encodeURIComponent(plotNo) };
}

/* villages of a taluka (for lookups by name) */
async function villages(stateKey, dist, tal) {
  const b = STATES[stateKey].bhunaksha;
  const txt = await post(b.base + "/bhunaksha/rest/VillageMapService/ListsAfterLevelGeoref", { state: b.state, level: "3", codes: "R," + dist + "," + tal + ",", hasmap: true });
  const j = JSON.parse(txt);
  return (j[0] || []).map(x => ({ code: x.code, name: x.value }));
}
async function talukas(stateKey, dist) {
  const b = STATES[stateKey].bhunaksha;
  const txt = await post(b.base + "/bhunaksha/rest/VillageMapService/ListsAfterLevelGeoref", { state: b.state, level: "2", codes: "R," + dist + ",", hasmap: true });
  const j = JSON.parse(txt);
  return (j[0] || []).map(x => ({ code: x.code, name: x.value }));
}

module.exports = { plot, villages, talukas, parseGeom, parseOwners };
