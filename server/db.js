// Postgres pool + schema. Every table is created if missing on boot, so a
// fresh Railway Postgres needs nothing but DATABASE_URL.
const { Pool, types } = require("pg");
types.setTypeParser(1082, v => v); // DATE as plain "YYYY-MM-DD", no timezone shift

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "1" || /sslmode=require/.test(process.env.DATABASE_URL || "") ? { rejectUnauthorized: false } : false,
  max: 8
});

const SCHEMA = `
create table if not exists users (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  role text not null default 'viewer',      -- admin | editor | viewer
  name text,
  created_at timestamptz default now()
);

create table if not exists parcels (
  id text primary key,                      -- p1 … / n<timestamp>
  sr integer,
  abd text, snd text,
  deed_date date,
  owner text, seller text,
  location text, survey text,
  area numeric, unit text,
  mortgage text, land_status text, note text,
  marked boolean default false,
  price numeric, value numeric,
  status text default 'held',               -- held | sold
  sale_type text, sale_date date, sale_price numeric, buyer text, sale_note text,
  state text,                                -- MH, MP, …
  district text, taluka text,
  village_code text,                         -- government village code (Bhulekh / Bhunaksha)
  geo jsonb,                                 -- {lat,lng,poly:[[lat,lng]…],src:'pin'|'village'|'govt'}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists parcels_sr on parcels(sr);
create index if not exists parcels_location on parcels(location);

create table if not exists title_records (
  parcel_id text primary key references parcels(id) on delete cascade,
  type text, no text, khata text, holders text,
  area numeric, unit text,
  as_of date, checked date,
  encumbrance text, link text, image text, remarks text,
  govt_owners jsonb,                         -- from Bhunaksha: [{khata, owner, area}]
  govt_checked date,
  updated_at timestamptz default now()
);

create table if not exists documents (
  id serial primary key,
  parcel_id text references parcels(id) on delete cascade,
  filename text not null,
  stored text not null,                      -- path under DATA_DIR
  mime text, size bigint, pages integer,
  uploaded_by text,
  uploaded_at timestamptz default now(),
  ai_status text default 'pending',          -- pending | running | done | error | off
  ai_error text,
  ai_summary jsonb,                          -- {kind, parties, dates, consideration, encumbrances, observations:[{page,severity,text}], …}
  ai_at timestamptz
);
create index if not exists documents_parcel on documents(parcel_id);

create table if not exists geo_cache (
  key text primary key,                      -- upper(location)|state
  lat numeric, lng numeric, label text, precision text,
  at date
);

create table if not exists settings (
  key text primary key,
  value jsonb
);

create table if not exists audit (
  id serial primary key,
  at timestamptz default now(),
  who text, what text, parcel_id text, detail jsonb
);
`;

async function migrate() {
  await pool.query(SCHEMA);
  const r = await pool.query("select count(*)::int as n from users");
  if (r.rows[0].n === 0) {
    const bcrypt = require("bcryptjs");
    const pw = process.env.ADMIN_PASSWORD || "Cotton@163";
    await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)",
      ["admin", bcrypt.hashSync(pw, 10), "Sanchit Rajpal"]);
    await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'viewer',$3)",
      ["viewer", bcrypt.hashSync(process.env.VIEWER_PASSWORD || "manjeet", 10), "Viewer"]);
    console.log("users seeded: admin / viewer");
  }
}

module.exports = { pool, migrate, q: (text, params) => pool.query(text, params) };
