// One-time seed from the old register's data.json (the published copy).
// Safe to re-run: parcels already present are left untouched.
const path = require("path");
const { pool, migrate } = require("./db");
const { guessState, VILLAGES } = require("./states");

async function seed(file) {
  await migrate();
  const d = require(file || path.join(__dirname, "..", "seed", "data.json"));
  let n = 0;
  for (const p of d.parcels) {
    const ex = await pool.query("select 1 from parcels where id=$1", [p.id]);
    if (ex.rowCount) continue;
    const v = VILLAGES[(p.location || "").toUpperCase()];
    const state = p.state || (v ? v.state : guessState(p));
    await pool.query(`insert into parcels(id,sr,abd,snd,deed_date,owner,seller,location,survey,area,unit,mortgage,land_status,note,marked,price,value,status,
        sale_type,sale_date,sale_price,buyer,sale_note,state,district,taluka,village_code,geo)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
      [p.id, Number(p.sr) || null, p.abd || null, p.snd || null, p.date || null, p.owner, p.seller || null, p.location || "Not stated",
       p.survey || null, p.area === null || p.area === undefined || p.area === "" ? null : p.area, p.unit || null,
       p.mortgage || null, p.landStatus || null, p.note || null, !!p.marked,
       p.price ?? null, p.value ?? null, p.status || "held",
       p.saleType || null, p.saleDate || null, p.salePrice ?? null, p.buyer || null, p.saleNote || null,
       state, p.district || (v ? v.district : null), p.taluka || (v ? v.taluka : null), v ? v.code : null, p.geo ? JSON.stringify(p.geo) : null]);
    if (p.record) {
      const r = p.record;
      await pool.query(`insert into title_records(parcel_id,type,no,khata,holders,area,unit,as_of,checked,encumbrance,link,image,remarks)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (parcel_id) do nothing`,
        [p.id, r.type, r.no, r.khata, r.holders, r.area ?? null, r.unit, r.asOf || null, r.checked || null, r.encumbrance, r.link, r.image, r.remarks]);
    }
    n++;
  }
  const s = d.settings || {};
  await pool.query("insert into settings(key,value) values('register',$1) on conflict (key) do nothing",
    [JSON.stringify({ company: "Manjeet Group", currency: s.currency || "INR", areaUnit: s.areaUnit || "ACRE", sheet: s.sheet, asOf: s.asOf })]);
  console.log("seeded", n, "parcels");
}

if (require.main === module) {
  seed(process.argv[2]).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { seed };
