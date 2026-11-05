// Manjeet Land Register — API + static app.
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");
const { pool, migrate, q } = require("./db");
const { STATES, ORDER, guessState, VILLAGES } = require("./states");
const bhunaksha = require("./bhunaksha");
const reader = require("./reader");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(path.join(DATA_DIR, "docs"), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "records"), { recursive: true });
// record images shipped with the repo (highlighted 7/12s) are copied into the volume once
try { const src = path.join(__dirname, "..", "seed", "records"); fs.readdirSync(src).forEach(f => { const dst = path.join(DATA_DIR, "records", f); if (!fs.existsSync(dst)) fs.copyFileSync(path.join(src, f), dst); }); } catch (e) {}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(cookieSession({ name: "mlr", keys: [process.env.SESSION_SECRET || "manjeet-land-register"], maxAge: 30 * 24 * 3600 * 1000, sameSite: "lax" }));

/* ─── auth ─── */
function user(req) { return req.session && req.session.user; }
function need(role) {
  return (req, res, next) => {
    const u = user(req);
    if (!u) return res.status(401).json({ error: "login" });
    if (role === "editor" && !["admin", "editor"].includes(u.role)) return res.status(403).json({ error: "read only" });
    if (role === "admin" && u.role !== "admin") return res.status(403).json({ error: "admin only" });
    next();
  };
}
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const r = await q("select * from users where username=$1", [String(username || "").trim().toLowerCase()]);
  const u = r.rows[0];
  if (!u || !bcrypt.compareSync(String(password || ""), u.password_hash)) return res.status(401).json({ error: "Wrong username or password" });
  req.session.user = { id: u.id, username: u.username, role: u.role, name: u.name };
  res.json(req.session.user);
});
app.post("/api/logout", (req, res) => { req.session = null; res.json({ ok: true }); });
app.get("/api/me", (req, res) => res.json(user(req) || null));

/* ─── bootstrap: everything the app needs on load ─── */
app.get("/api/bootstrap", need(), async (req, res) => {
  const [parcels, records, docs, geo, settings] = await Promise.all([
    q("select * from parcels order by sr"),
    q("select * from title_records"),
    q("select id,parcel_id,filename,mime,size,pages,uploaded_by,uploaded_at,ai_status,ai_error,ai_summary,ai_at from documents order by uploaded_at desc"),
    q("select * from geo_cache"),
    q("select value from settings where key='register'")
  ]);
  res.json({
    user: user(req), states: STATES, stateOrder: ORDER, villages: VILLAGES,
    settings: settings.rows[0] ? settings.rows[0].value : {},
    parcels: parcels.rows.map(rowToParcel),
    records: Object.fromEntries(records.rows.map(r => [r.parcel_id, rowToRecord(r)])),
    documents: docs.rows,
    geoCache: Object.fromEntries(geo.rows.map(g => [g.key, { lat: Number(g.lat), lng: Number(g.lng), label: g.label, precision: g.precision }])),
    ai: !!process.env.ANTHROPIC_API_KEY
  });
});
function rowToParcel(r) {
  return { id: r.id, sr: r.sr, abd: r.abd || "", snd: r.snd || "", date: r.deed_date ? iso(r.deed_date) : "", owner: r.owner, seller: r.seller || "",
    location: r.location, survey: r.survey || "", area: r.area === null ? null : Number(r.area), unit: r.unit || "", mortgage: r.mortgage || "",
    landStatus: r.land_status || "", note: r.note || "", marked: r.marked, price: r.price === null ? null : Number(r.price), value: r.value === null ? null : Number(r.value),
    status: r.status, saleType: r.sale_type, saleDate: r.sale_date ? iso(r.sale_date) : undefined, salePrice: r.sale_price === null ? undefined : Number(r.sale_price),
    buyer: r.buyer, saleNote: r.sale_note, state: r.state || guessState(r), stateGuessed: !r.state, district: r.district || "", taluka: r.taluka || "",
    villageCode: r.village_code || "", geo: r.geo || null };
}
function rowToRecord(r) {
  return { type: r.type, no: r.no, khata: r.khata, holders: r.holders, area: r.area === null ? null : Number(r.area), unit: r.unit,
    asOf: r.as_of ? iso(r.as_of) : "", checked: r.checked ? iso(r.checked) : "", encumbrance: r.encumbrance || "", link: r.link || "",
    image: r.image || "", remarks: r.remarks || "", govtOwners: r.govt_owners || null, govtChecked: r.govt_checked ? iso(r.govt_checked) : "" };
}
function iso(d) { return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10); }
const nul = v => (v === "" || v === undefined ? null : v);

/* ─── parcels ─── */
app.put("/api/parcels/:id", need("editor"), async (req, res) => {
  const p = req.body, id = req.params.id;
  const ex = await q("select 1 from parcels where id=$1", [id]);
  const vals = [id, nul(p.sr) === null ? null : Number(p.sr), nul(p.abd), nul(p.snd), nul(p.date), p.owner, nul(p.seller), p.location || "Not stated", nul(p.survey),
    nul(p.area), nul(p.unit), nul(p.mortgage), nul(p.landStatus), nul(p.note), !!p.marked, nul(p.price), nul(p.value), p.status || "held",
    nul(p.saleType), nul(p.saleDate), nul(p.salePrice), nul(p.buyer), nul(p.saleNote), nul(p.state), nul(p.district), nul(p.taluka), nul(p.villageCode), p.geo ? JSON.stringify(p.geo) : null];
  if (ex.rowCount) {
    await q(`update parcels set sr=$2,abd=$3,snd=$4,deed_date=$5,owner=$6,seller=$7,location=$8,survey=$9,area=$10,unit=$11,mortgage=$12,land_status=$13,note=$14,marked=$15,
      price=$16,value=$17,status=$18,sale_type=$19,sale_date=$20,sale_price=$21,buyer=$22,sale_note=$23,state=$24,district=$25,taluka=$26,village_code=$27,geo=$28,updated_at=now() where id=$1`, vals);
  } else {
    await q(`insert into parcels(id,sr,abd,snd,deed_date,owner,seller,location,survey,area,unit,mortgage,land_status,note,marked,price,value,status,sale_type,sale_date,sale_price,buyer,sale_note,state,district,taluka,village_code,geo)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`, vals);
  }
  await q("insert into audit(who,what,parcel_id,detail) values($1,$2,$3,$4)", [user(req).username, ex.rowCount ? "parcel.update" : "parcel.add", id, JSON.stringify({ sr: p.sr })]);
  const r = await q("select * from parcels where id=$1", [id]);
  res.json(rowToParcel(r.rows[0]));
});
app.patch("/api/parcels/:id", need("editor"), async (req, res) => {
  // partial: price/value/geo/status fields
  const allowed = { price: "price", value: "value", geo: "geo", status: "status", saleType: "sale_type", saleDate: "sale_date", salePrice: "sale_price", buyer: "buyer", saleNote: "sale_note", state: "state", district: "district", taluka: "taluka", villageCode: "village_code" };
  const sets = [], vals = [req.params.id];
  for (const k of Object.keys(req.body || {})) {
    if (!allowed[k]) continue;
    vals.push(k === "geo" ? (req.body[k] ? JSON.stringify(req.body[k]) : null) : nul(req.body[k]));
    sets.push(allowed[k] + "=$" + vals.length);
  }
  if (!sets.length) return res.status(400).json({ error: "nothing to change" });
  await q("update parcels set " + sets.join(",") + ",updated_at=now() where id=$1", vals);
  const r = await q("select * from parcels where id=$1", [req.params.id]);
  res.json(rowToParcel(r.rows[0]));
});
app.delete("/api/parcels/:id", need("admin"), async (req, res) => {
  await q("delete from parcels where id=$1", [req.params.id]);
  await q("insert into audit(who,what,parcel_id) values($1,'parcel.delete',$2)", [user(req).username, req.params.id]);
  res.json({ ok: true });
});

/* ─── title records ─── */
app.put("/api/parcels/:id/record", need("editor"), async (req, res) => {
  const r = req.body || {};
  await q(`insert into title_records(parcel_id,type,no,khata,holders,area,unit,as_of,checked,encumbrance,link,image,remarks,updated_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
    on conflict (parcel_id) do update set type=$2,no=$3,khata=$4,holders=$5,area=$6,unit=$7,as_of=$8,checked=$9,encumbrance=$10,link=$11,image=$12,remarks=$13,updated_at=now()`,
    [req.params.id, nul(r.type), nul(r.no), nul(r.khata), nul(r.holders), nul(r.area), nul(r.unit), nul(r.asOf), nul(r.checked), nul(r.encumbrance), nul(r.link), nul(r.image), nul(r.remarks)]);
  if (r.state || r.district || r.taluka) await q("update parcels set state=coalesce($2,state),district=coalesce($3,district),taluka=coalesce($4,taluka) where id=$1", [req.params.id, nul(r.state), nul(r.district), nul(r.taluka)]);
  const out = await q("select * from title_records where parcel_id=$1", [req.params.id]);
  res.json(rowToRecord(out.rows[0]));
});
app.delete("/api/parcels/:id/record", need("editor"), async (req, res) => { await q("delete from title_records where parcel_id=$1", [req.params.id]); res.json({ ok: true }); });
/* bulk merge from a records file (the 7/12 pull output) */
app.post("/api/records/merge", need("editor"), async (req, res) => {
  const list = (req.body && (req.body.records || req.body)) || [];
  let n = 0; const miss = [];
  for (const x of list) {
    const p = (await q("select id from parcels where sr=$1", [Number(x.sr)])).rows[0];
    if (!p) { miss.push(x.sr); continue; }
    if (x.record) {
      const r = x.record;
      await q(`insert into title_records(parcel_id,type,no,khata,holders,area,unit,as_of,checked,encumbrance,link,image,remarks)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        on conflict (parcel_id) do update set type=coalesce($2,title_records.type),no=coalesce($3,title_records.no),khata=coalesce($4,title_records.khata),holders=coalesce($5,title_records.holders),
        area=coalesce($6,title_records.area),unit=coalesce($7,title_records.unit),as_of=coalesce($8,title_records.as_of),checked=coalesce($9,title_records.checked),encumbrance=coalesce($10,title_records.encumbrance),
        link=coalesce($11,title_records.link),image=coalesce($12,title_records.image),remarks=coalesce($13,title_records.remarks),updated_at=now()`,
        [p.id, nul(r.type), nul(r.no), nul(r.khata), nul(r.holders), nul(r.area), nul(r.unit), nul(r.asOf), nul(r.checked), nul(r.encumbrance), nul(r.link), nul(r.image), nul(r.remarks)]);
    }
    await q("update parcels set state=coalesce($2,state),district=coalesce($3,district),taluka=coalesce($4,taluka),village_code=coalesce($5,village_code),geo=coalesce($6,geo) where id=$1",
      [p.id, nul(x.state), nul(x.district), nul(x.taluka), nul(x.villageCode), x.geo ? JSON.stringify(x.geo) : null]);
    n++;
  }
  res.json({ merged: n, missing: miss });
});

/* ─── government map: boundary + owners from Bhunaksha ─── */
app.post("/api/parcels/:id/govt", need("editor"), async (req, res) => {
  const p = (await q("select * from parcels where id=$1", [req.params.id])).rows[0];
  if (!p) return res.status(404).json({ error: "no parcel" });
  const st = p.state || guessState(p);
  const v = VILLAGES[(p.location || "").toUpperCase()] || {};
  const code = req.body.villageCode || p.village_code || v.code;
  const plotNo = req.body.plotNo || String(p.survey || "").replace(/[^0-9\/]/g, "").replace(/^\/+|\/+$/g, "");
  if (!code) return res.status(400).json({ error: "Village code not known for " + p.location + " — set it on the parcel (from Mahabhulekh / Bhunaksha) first" });
  if (!plotNo) return res.status(400).json({ error: "No gat / survey number on this parcel" });
  try {
    const r = await bhunaksha.plot(st, { dist: req.body.dist || v.dist || code.slice(2, 4), tal: req.body.tal || v.tal || code.slice(6, 8), villageCode: code, plotNo });
    if (!r) return res.status(404).json({ error: "Gat " + plotNo + " not found on the map for this village" });
    const geo = Object.assign({}, p.geo || {}, { lat: r.centre.lat, lng: r.centre.lng, poly: r.poly, src: "govt", govtArea: r.areaSqm, gis: r.gis, report: r.report, at: new Date().toISOString().slice(0, 10) });
    await q("update parcels set geo=$2, village_code=coalesce(village_code,$3), updated_at=now() where id=$1", [p.id, JSON.stringify(geo), code]);
    await q(`insert into title_records(parcel_id, govt_owners, govt_checked) values($1,$2,current_date)
      on conflict (parcel_id) do update set govt_owners=$2, govt_checked=current_date, updated_at=now()`, [p.id, JSON.stringify(r.owners)]);
    res.json({ geo, owners: r.owners, areaSqm: r.areaSqm, report: r.report });
  } catch (e) { res.status(502).json({ error: "Map portal: " + e.message }); }
});
app.get("/api/govt/villages", need(), async (req, res) => {
  try { res.json(await bhunaksha.villages(req.query.state || "MH", req.query.dist, req.query.tal)); } catch (e) { res.status(502).json({ error: e.message }); }
});
app.get("/api/govt/talukas", need(), async (req, res) => {
  try { res.json(await bhunaksha.talukas(req.query.state || "MH", req.query.dist)); } catch (e) { res.status(502).json({ error: e.message }); }
});

/* ─── village geocoding cache (OpenStreetMap) ─── */
app.post("/api/geocode", need("editor"), async (req, res) => {
  const { key, lat, lng, label, precision } = req.body || {};
  if (!key || lat === undefined) return res.status(400).json({ error: "bad" });
  await q("insert into geo_cache(key,lat,lng,label,precision,at) values($1,$2,$3,$4,$5,current_date) on conflict (key) do update set lat=$2,lng=$3,label=$4,precision=$5,at=current_date", [key, lat, lng, label || "", precision || ""]);
  res.json({ ok: true });
});

/* ─── documents ─── */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => { const d = path.join(DATA_DIR, "docs", req.params.id); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, f, cb) => cb(null, Date.now() + "-" + f.originalname.replace(/[^\w.\-()ऀ-ॿ ]+/g, "_"))
  }),
  limits: { fileSize: 500 * 1024 * 1024 }
});
app.post("/api/parcels/:id/documents", need("editor"), upload.array("files", 20), async (req, res) => {
  const out = [];
  for (const f of req.files || []) {
    const stored = path.relative(DATA_DIR, f.path);
    const pages = f.mimetype === "application/pdf" ? await reader.pageCount(f.path) : null;
    const r = await q("insert into documents(parcel_id,filename,stored,mime,size,pages,uploaded_by,ai_status) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,parcel_id,filename,mime,size,pages,uploaded_by,uploaded_at,ai_status",
      [req.params.id, f.originalname, stored, f.mimetype, f.size, pages, user(req).username, process.env.ANTHROPIC_API_KEY && f.mimetype === "application/pdf" ? "pending" : "off"]);
    out.push(r.rows[0]);
  }
  await q("insert into audit(who,what,parcel_id,detail) values($1,'document.upload',$2,$3)", [user(req).username, req.params.id, JSON.stringify(out.map(x => x.filename))]);
  reader.processNext();
  res.json(out);
});
app.get("/api/documents/:docId/file", need(), async (req, res) => {
  const d = (await q("select * from documents where id=$1", [req.params.docId])).rows[0];
  if (!d) return res.status(404).end();
  res.setHeader("Content-Disposition", (req.query.dl ? "attachment" : "inline") + "; filename*=UTF-8''" + encodeURIComponent(d.filename));
  res.type(d.mime || "application/octet-stream").sendFile(path.join(DATA_DIR, d.stored));
});
app.delete("/api/documents/:docId", need("editor"), async (req, res) => {
  const d = (await q("delete from documents where id=$1 returning *", [req.params.docId])).rows[0];
  if (d) fs.rm(path.join(DATA_DIR, d.stored), () => {});
  res.json({ ok: true });
});
app.post("/api/documents/:docId/reread", need("editor"), async (req, res) => {
  await q("update documents set ai_status='pending', ai_error=null where id=$1", [req.params.docId]);
  reader.processNext(); res.json({ ok: true });
});
/* record images (highlighted 7/12s) — uploaded by the editor, served next to the app */
const recUpload = multer({ storage: multer.diskStorage({ destination: path.join(DATA_DIR, "records"), filename: (req, f, cb) => cb(null, f.originalname.replace(/[^\w.\-]+/g, "_")) }), limits: { fileSize: 30 * 1024 * 1024 } });
app.post("/api/records/image", need("editor"), recUpload.single("file"), (req, res) => res.json({ path: "/records/" + req.file.filename }));
app.use("/records", express.static(path.join(DATA_DIR, "records")));

/* ─── settings, users, audit ─── */
app.put("/api/settings", need("admin"), async (req, res) => {
  await q("insert into settings(key,value) values('register',$1) on conflict (key) do update set value=$1", [JSON.stringify(req.body || {})]);
  res.json(req.body);
});
app.get("/api/users", need("admin"), async (req, res) => res.json((await q("select id,username,role,name,created_at from users order by id")).rows));
app.post("/api/users", need("admin"), async (req, res) => {
  const { username, password, role, name } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username and password" });
  await q("insert into users(username,password_hash,role,name) values($1,$2,$3,$4) on conflict (username) do update set password_hash=$2, role=$3, name=$4",
    [String(username).trim().toLowerCase(), bcrypt.hashSync(password, 10), ["admin", "editor", "viewer"].includes(role) ? role : "viewer", name || null]);
  res.json({ ok: true });
});
app.delete("/api/users/:id", need("admin"), async (req, res) => { await q("delete from users where id=$1 and username<>'admin'", [req.params.id]); res.json({ ok: true }); });
app.get("/api/audit", need(), async (req, res) => res.json((await q("select * from audit order by id desc limit 200")).rows));
app.get("/api/export.csv", need(), async (req, res) => {
  const rows = (await q("select p.*, r.type rtype, r.no rno, r.khata, r.holders, r.area rarea, r.unit runit, r.as_of, r.checked, r.encumbrance from parcels p left join title_records r on r.parcel_id=p.id order by sr")).rows;
  const head = ["SR","ABD","Sendhwa","Deed date","Owner","Seller","Village","Gut/Khasra","Area","Unit","Charge","Land status","Note","Price","Value","Status","State","District","Taluka","Record type","Record no","Khata","Holders","Record area","Record unit","Record dated","Checked","Encumbrance","Lat","Lng","Boundary"];
  const qq = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const lines = [head.map(qq).join(",")].concat(rows.map(r => [r.sr, r.abd, r.snd, r.deed_date && iso(r.deed_date), r.owner, r.seller, r.location, r.survey, r.area, r.unit, r.mortgage, r.land_status, r.note, r.price, r.value, r.status, r.state, r.district, r.taluka, r.rtype, r.rno, r.khata, r.holders, r.rarea, r.runit, r.as_of && iso(r.as_of), r.checked && iso(r.checked), r.encumbrance, r.geo && r.geo.lat, r.geo && r.geo.lng, r.geo && r.geo.poly ? r.geo.src : ""].map(qq).join(",")));
  res.setHeader("Content-Disposition", "attachment; filename=land-register-" + new Date().toISOString().slice(0, 10) + ".csv");
  res.type("text/csv").send(lines.join("\n"));
});

/* ─── static app ─── */
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h" }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "..", "public", "index.html")));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: err.message }); });

const PORT = process.env.PORT || 3000;
migrate().then(async () => {
  if (process.env.SEED_ON_BOOT !== "false") {
    const n = (await q("select count(*)::int n from parcels")).rows[0].n;
    if (n === 0) { try { await require("./seed").seed(); } catch (e) { console.error("seed", e.message); } }
  }
  app.listen(PORT, () => console.log("Manjeet Land Register on :" + PORT));
  setTimeout(reader.processNext, 5000);
}).catch(e => { console.error("db", e.message); setTimeout(() => process.exit(1), 5000); });
