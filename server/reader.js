// AI reading of a property document set. Pages are rasterised with pdftoppm
// (scanned Marathi/Hindi deeds included), sent to Claude in batches, and the
// batch findings are merged into one summary per document. Runs in-process,
// one document at a time, so a 70-page set does not block uploads.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { pool } = require("./db");

const MODEL = process.env.AI_MODEL || "claude-sonnet-4-5";
const PAGES_PER_CALL = Number(process.env.AI_PAGES_PER_CALL || 8);
const MAX_PAGES = Number(process.env.AI_MAX_PAGES || 120);

function run(cmd, args) {
  return new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 1 << 26 }, (e, out, err) => e ? rej(new Error(err || e.message)) : res(out)));
}
async function pageCount(file) {
  try { const out = await run("pdfinfo", [file]); const m = out.match(/Pages:\s+(\d+)/); return m ? Number(m[1]) : null; }
  catch (e) { return null; }
}
async function rasterise(file, first, last, dir) {
  await run("pdftoppm", ["-r", "110", "-jpeg", "-jpegopt", "quality=70", "-f", String(first), "-l", String(last), file, path.join(dir, "pg")]);
  return fs.readdirSync(dir).filter(f => f.startsWith("pg")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(f => path.join(dir, f));
}

const SYSTEM = `You are a conveyancing assistant reading an Indian land-property document set (sale deeds, agreements, 7/12 extracts, 8-A, ferfar/mutation entries, NA orders, property cards, search reports, tax receipts, maps, court papers). Pages may be in Marathi, Hindi, Gujarati, Telugu, Tamil, Kannada or English, often scanned.
For the pages given, return strict JSON only:
{"pages":[{"page":N,"kind":"<sale deed|agreement|7-12|8A|mutation|NA order|property card|search report|tax receipt|map|court|power of attorney|identity|other>","summary":"<one line>"}],
 "facts":{"parties":[{"role":"seller|buyer|witness|consenting|other","name":"…"}],"dates":["YYYY-MM-DD: what"],"survey_numbers":["…"],"village":"…","area":["… as written"],"consideration":["… as written"],"registration":["doc no / office / date"],"encumbrances":["…"],"title_chain":["… earlier owner → later owner"]},
 "observations":[{"page":N,"severity":"high|medium|low","text":"<specific, verifiable point: a missing signature, a name spelt differently across documents, an area that does not match, a pending mutation, a charge not released, a consent missing, an expired agreement, an NA condition, a daughter/heir not party, a boundary dispute>"}]}
Transliterate names into Latin script and keep the original script in brackets the first time. Never invent; if unreadable say so in an observation with severity low. Keep each observation under 40 words.`;

async function readBatch(client, images, pageOffset, context) {
  const content = [];
  images.forEach((f, i) => {
    content.push({ type: "text", text: "Page " + (pageOffset + i) });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f).toString("base64") } });
  });
  content.push({ type: "text", text: "Context from the register: " + context + "\nReturn the JSON for these pages." });
  const r = await client.messages.create({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content }] });
  const txt = r.content.map(c => c.text || "").join("");
  const m = txt.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : txt); } catch (e) { return { pages: [], facts: {}, observations: [{ page: pageOffset, severity: "low", text: "Reader returned unparseable output for this batch" }] }; }
}

function merge(parts) {
  const out = { pages: [], facts: { parties: [], dates: [], survey_numbers: [], village: "", area: [], consideration: [], registration: [], encumbrances: [], title_chain: [] }, observations: [] };
  const seen = new Set();
  const add = (arr, v) => { const k = JSON.stringify(v); if (!seen.has(k)) { seen.add(k); arr.push(v); } };
  parts.forEach(p => {
    (p.pages || []).forEach(x => out.pages.push(x));
    const f = p.facts || {};
    (f.parties || []).forEach(x => add(out.facts.parties, x));
    ["dates", "survey_numbers", "area", "consideration", "registration", "encumbrances", "title_chain"].forEach(k => (f[k] || []).forEach(x => add(out.facts[k], x)));
    if (f.village && !out.facts.village) out.facts.village = f.village;
    (p.observations || []).forEach(x => add(out.observations, x));
  });
  const rank = { high: 0, medium: 1, low: 2 };
  out.observations.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || (a.page || 0) - (b.page || 0));
  const kinds = {};
  out.pages.forEach(p => { kinds[p.kind] = (kinds[p.kind] || 0) + 1; });
  out.kinds = kinds;
  return out;
}

async function crossCheck(summary, parcel, record) {
  // simple deterministic checks against the register, added as observations
  const obs = [];
  const own = (parcel.owner || "").toUpperCase().split(/[^A-Z]+/).filter(w => w.length > 3);
  const names = (summary.facts.parties || []).map(p => (p.name || "").toUpperCase()).join(" ");
  if (own.length && names && !own.some(w => names.includes(w))) obs.push({ page: null, severity: "medium", text: "Owner on the register (" + parcel.owner + ") does not appear among the parties read from the documents" });
  if (parcel.survey) {
    const s = String(parcel.survey).replace(/[^0-9\/]/g, "");
    const nums = (summary.facts.survey_numbers || []).join(" ");
    if (s && nums && !nums.includes(s.split("/")[0])) obs.push({ page: null, severity: "medium", text: "Gut/survey no. on the register (" + parcel.survey + ") not found in the documents (" + nums.slice(0, 60) + ")" });
  }
  if (parcel.mortgage && !(summary.facts.encumbrances || []).length) obs.push({ page: null, severity: "low", text: "Register notes a charge (" + parcel.mortgage + ") but the documents show no encumbrance entry — the bank's charge document may be missing from the set" });
  if (record && record.holders && names) {
    const h = record.holders.toUpperCase().split(/[^A-Z]+/).filter(w => w.length > 3);
    if (h.length && !h.some(w => names.includes(w))) obs.push({ page: null, severity: "low", text: "Holder on the title record (" + record.holders + ") not found among document parties" });
  }
  return summary.observations.concat(obs);
}

let busy = false;
async function processNext() {
  if (busy) return;
  if (!process.env.ANTHROPIC_API_KEY) return;
  busy = true;
  try {
    const { rows } = await pool.query("select d.*, p.owner, p.survey, p.location, p.mortgage, p.area, p.unit from documents d join parcels p on p.id=d.parcel_id where d.ai_status='pending' and d.mime='application/pdf' order by d.id limit 1");
    if (!rows.length) return;
    const d = rows[0];
    await pool.query("update documents set ai_status='running', ai_error=null where id=$1", [d.id]);
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic();
    const file = path.join(process.env.DATA_DIR || "data", d.stored);
    const n = Math.min(d.pages || await pageCount(file) || 1, MAX_PAGES);
    const rec = (await pool.query("select * from title_records where parcel_id=$1", [d.parcel_id])).rows[0];
    const ctx = "SR " + d.sr + ", owner " + d.owner + ", village " + d.location + ", survey " + d.survey + ", area " + d.area + " " + d.unit + (d.mortgage ? ", charge " + d.mortgage : "") + (rec ? ", title record holders " + rec.holders : "");
    const parts = [];
    for (let first = 1; first <= n; first += PAGES_PER_CALL) {
      const last = Math.min(n, first + PAGES_PER_CALL - 1);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mlr-"));
      try {
        const imgs = await rasterise(file, first, last, dir);
        parts.push(await readBatch(client, imgs, first, ctx));
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
      await pool.query("update documents set ai_summary=$2 where id=$1", [d.id, JSON.stringify({ progress: last + "/" + n })]);
    }
    const summary = merge(parts);
    summary.observations = await crossCheck(summary, d, rec);
    summary.pagesRead = n; summary.model = MODEL;
    await pool.query("update documents set ai_status='done', ai_summary=$2, ai_at=now() where id=$1", [d.id, JSON.stringify(summary)]);
  } catch (e) {
    console.error("reader", e.message);
    await pool.query("update documents set ai_status='error', ai_error=$1 where ai_status='running'", [e.message.slice(0, 500)]).catch(() => {});
  } finally {
    busy = false;
    setTimeout(processNext, 1500);
  }
}

module.exports = { processNext, pageCount };
