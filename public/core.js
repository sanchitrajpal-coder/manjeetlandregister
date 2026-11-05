/* Manjeet Land Register — core: state, API, helpers, drill engine */
var SQM = {HECTARE:10000, ARE:100, ACRE:4046.8564, GUNTHA:101.1714, CENT:40.4686, SQM:1, SQFT:0.09290304, SQYD:0.83612736};
var UNIT_LABEL = {HECTARE:"hectare", ARE:"R", ACRE:"acre", GUNTHA:"guntha", CENT:"cent", SQM:"sq m", SQFT:"sq ft", SQYD:"sq yd", "":"unit not stated"};
var UNIT_SHORT = {HECTARE:"ha", ARE:"R", ACRE:"ac", GUNTHA:"gu", CENT:"ct", SQM:"m²", SQFT:"ft²", SQYD:"yd²", "":""};
var RECORD_UNITS = {HECTARE:"hectare", ARE:"R (are)", ACRE:"acre", GUNTHA:"guntha", CENT:"cent", SQM:"sq m", SQFT:"sq ft", SQYD:"sq yd"};
var CURRENCIES = [{code:"INR", locale:"en-IN", label:"₹  Indian Rupee"}, {code:"USD", locale:"en-US", label:"$  US Dollar"}];
var PALETTE = ["#2E8080","#B07A2B","#2C6E9B","#7A5A9B","#4E8C5A","#B03A2E","#8C5A3C","#5E7480","#9B7A16","#3F7A88"];
var TABS = [
  {k:"dashboard", label:"Dashboard", icon:"◧"},
  {k:"register",  label:"Register",  icon:"☰"},
  {k:"records",   label:"Title records", icon:"⚑"},
  {k:"documents", label:"Documents", icon:"❐"},
  {k:"map",       label:"Map",       icon:"◎"},
  {k:"valuation", label:"Valuation", icon:"₹"},
  {k:"analytics", label:"Analytics", icon:"◔"},
  {k:"disposals", label:"Disposals", icon:"⇥"},
  {k:"settings",  label:"Settings",  icon:"⚙"}
];
var STALE_DAYS = 365;

var S = {
  user:null, tab:"dashboard", parcels:[], records:{}, docs:[], geoCache:{}, settings:{}, states:{}, stateOrder:[], villages:{}, ai:false,
  reg:{q:"", owner:"all", loc:"all", state:"all", status:"held", charge:"all", rec:"all", docs:"all", sort:"sr", page:1},
  val:{q:"", only:"pending", owner:"all", page:1},
  recs:{q:"", state:"all", only:"all", page:1},
  dox:{q:"", only:"all", state:"all", page:1},
  map:{state:"all", only:"held", base:"sat"}
};

/* ─── API ─── */
function api(method, url, body, isForm){
  var opt = {method:method, headers:{}, credentials:"same-origin"};
  if (body !== undefined){ if (isForm){ opt.body = body; } else { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); } }
  return fetch(url, opt).then(function(r){
    if (r.status === 401){ S.user = null; renderLogin(); throw new Error("Please sign in"); }
    return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || r.status); return j; });
  });
}
function boot(){
  return api("GET", "/api/bootstrap").then(function(d){
    S.user = d.user; S.parcels = d.parcels; S.records = d.records; S.docs = d.documents; S.geoCache = d.geoCache;
    S.settings = Object.assign({company:"Manjeet Group", currency:"INR", areaUnit:"ACRE"}, d.settings);
    S.states = d.states; S.stateOrder = d.stateOrder; S.villages = d.villages; S.ai = d.ai;
    renderApp(); render();
  });
}
function canEdit(){ return S.user && (S.user.role === "admin" || S.user.role === "editor"); }
function isAdmin(){ return S.user && S.user.role === "admin"; }

function saveParcel(p){
  return api("PUT", "/api/parcels/"+p.id, p).then(function(np){
    var i = S.parcels.findIndex(function(x){ return x.id === np.id; });
    if (i < 0) S.parcels.push(np); else S.parcels[i] = np;
    return np;
  });
}
function patchParcel(id, fields){
  return api("PATCH", "/api/parcels/"+id, fields).then(function(np){
    var i = S.parcels.findIndex(function(x){ return x.id === np.id; });
    if (i >= 0) S.parcels[i] = np; return np;
  });
}

/* ─── helpers ─── */
function esc(v){ if (v === null || v === undefined) return ""; return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function hasNum(v){ return v !== null && v !== undefined && v !== "" && !isNaN(Number(v)); }
function sqm(p){ return (p.area === null || p.area === undefined || !p.unit) ? null : p.area * SQM[p.unit]; }
function sumSqm(list){ var t=0; list.forEach(function(p){ t += sqm(p)||0; }); return t; }
function areaIn(total, unit){ return total ? total / SQM[unit] : 0; }
function fmtArea(n, d){ d = (d === undefined) ? 2 : d; return (n||0).toLocaleString("en-IN", {minimumFractionDigits:d, maximumFractionDigits:d}); }
function cur(){ return CURRENCIES.filter(function(c){return c.code === S.settings.currency;})[0] || CURRENCIES[0]; }
function money(n){ if (!hasNum(n)) return "—"; var c = cur(); return new Intl.NumberFormat(c.locale, {style:"currency", currency:c.code, maximumFractionDigits:0}).format(Math.round(Number(n))); }
function symbol(){ var c = cur(); try { return new Intl.NumberFormat(c.locale,{style:"currency",currency:c.code}).formatToParts(0).filter(function(p){return p.type==="currency";})[0].value; } catch(e){ return c.code; } }
function today(){ return new Date().toISOString().slice(0,10); }
function held(){ return S.parcels.filter(function(p){ return p.status === "held"; }); }
function soldList(){ return S.parcels.filter(function(p){ return p.status !== "held"; }); }
function byId(id){ return S.parcels.filter(function(p){ return p.id === id; })[0]; }
function uniq(arr){ var o={},out=[]; arr.forEach(function(v){ if(v && !o[v]){o[v]=1;out.push(v);} }); return out.sort(); }
function $(id){ return document.getElementById(id); }
function fmtBytes(n){ n = Number(n)||0; return n > 1048576 ? (n/1048576).toFixed(1)+" MB" : n > 1024 ? Math.round(n/1024)+" KB" : n+" B"; }
function fmtDate(iso){ if (!iso) return ""; var d = new Date(iso); return isNaN(d) ? String(iso).slice(0,10) : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); }

function toast(msg, kind){
  var t = $("toast"); t.textContent = msg; t.className = kind === "warn" ? "warn" : ""; t.style.display = "block";
  clearTimeout(toast._t); toast._t = setTimeout(function(){ t.style.display = "none"; }, kind === "warn" ? 4200 : 2600);
}
function download(text, name, type){
  var blob = new Blob([text], {type:type}); var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}

/* ─── states, records, geo ─── */
function stateOf(p){ return p.state && S.states[p.state] ? p.state : "MH"; }
function stateName(k){ return (S.states[k]||S.states.OT||{name:k}).name; }
function stateGuessed(p){ return !!p.stateGuessed; }
function rec(p){ return S.records[p.id] || null; }
function recSqm(r){ if (!r || !hasNum(r.area) || !r.unit) return null; var f = SQM[r.unit]; return f ? Number(r.area) * f : null; }
function daysSince(iso){ if (!iso) return null; var d = new Date(iso); if (isNaN(d)) return null; return Math.floor((Date.now() - d.getTime()) / 86400000); }
function nameTokens(s){ return String(s||"").toUpperCase().replace(/[^A-Zऀ-ॿ ]/g," ").split(/\s+/).filter(function(w){ return w.length > 3 && ["PVT","LTD","LLP","AND","THE"].indexOf(w) < 0; }); }
function docsOf(p){ return S.docs.filter(function(d){ return d.parcel_id === p.id; }); }
function recIssues(p){
  var r = rec(p), out = [];
  if (!r || (!r.no && !r.holders && !r.govtOwners)) return out;
  var a = sqm(p), b = recSqm(r);
  if (a !== null && b !== null){ var diff = Math.abs(a-b) / Math.max(a,b); if (diff > 0.02) out.push({k:"area", t:"Area differs: sheet "+fmtArea(a/SQM.ACRE)+" ac vs record "+fmtArea(b/SQM.ACRE)+" ac ("+Math.round(diff*100)+"%)"}); }
  if (r.holders){ var toks = nameTokens(p.owner), H = r.holders.toUpperCase(); if (toks.length && !toks.some(function(w){ return H.indexOf(w) > -1; })) out.push({k:"owner", t:"Owner not found in the record's holder names"}); }
  if (r.encumbrance && !p.mortgage) out.push({k:"charge", t:"Record shows an encumbrance but no charge is noted on the sheet"});
  var age = daysSince(r.checked || r.asOf); if (age !== null && age > STALE_DAYS) out.push({k:"stale", t:"Record last checked "+Math.round(age/30)+" months ago"});
  return out;
}
function recState(p){
  var r = rec(p); if (!r || (!r.no && !r.holders && !r.govtOwners)) return "none";
  var iss = recIssues(p);
  if (iss.some(function(i){ return i.k !== "stale"; })) return "issue";
  if (iss.length) return "stale";
  return "ok";
}
function recChip(p, sm){
  var s = recState(p), lbl = {none:"no record", ok:"verified", issue:"check", stale:"re-check"}[s];
  return '<span class="rchip '+s+(sm?" sm":"")+'" title="'+esc(recIssues(p).map(function(i){ return i.t; }).join(" · "))+'">'+lbl+'</span>';
}
function docState(p){
  var d = docsOf(p); if (!d.length) return "none";
  var sm = d.filter(function(x){ return x.ai_status === "done" && x.ai_summary; });
  if (sm.some(function(x){ return (x.ai_summary.observations||[]).some(function(o){ return o.severity === "high"; }); })) return "high";
  if (sm.some(function(x){ return (x.ai_summary.observations||[]).some(function(o){ return o.severity === "medium"; }); })) return "medium";
  if (d.some(function(x){ return x.ai_status === "pending" || x.ai_status === "running"; })) return "reading";
  return "ok";
}
function docChip(p, sm){
  var s = docState(p), n = docsOf(p).length;
  var map = {none:["none","no docs"], ok:["ok", n+" doc"+(n===1?"":"s")], reading:["stale","reading"], medium:["stale", n+" · review"], high:["issue", n+" · attention"]}[s];
  return '<span class="rchip '+map[0]+(sm?" sm":"")+'">'+map[1]+'</span>';
}
function geoKey(p){ return (p.location||"").toUpperCase().trim() + "|" + stateOf(p); }
function geoOf(p){
  if (p.geo && hasNum(p.geo.lat) && hasNum(p.geo.lng)) return {lat:Number(p.geo.lat), lng:Number(p.geo.lng), src:p.geo.src || (p.geo.poly ? "pin" : "pin")};
  var c = S.geoCache[geoKey(p)];
  if (c && hasNum(c.lat)) return {lat:Number(c.lat), lng:Number(c.lng), src:"village", label:c.label};
  return null;
}
function polyOf(p){ return (p.geo && p.geo.poly && p.geo.poly.length >= 3) ? p.geo.poly : null; }
function polyArea(pts){
  if (!pts || pts.length < 3) return 0;
  var R = 6378137, a = 0, n = pts.length;
  for (var i=0;i<n;i++){ var p1 = pts[i], p2 = pts[(i+1)%n]; var l1 = p1[1]*Math.PI/180, l2 = p2[1]*Math.PI/180, f1 = p1[0]*Math.PI/180, f2 = p2[0]*Math.PI/180; a += (l2 - l1) * (2 + Math.sin(f1) + Math.sin(f2)); }
  return Math.abs(a * R * R / 2);
}
function centroid(pts){ var la=0, ln=0; pts.forEach(function(q){ la += q[0]; ln += q[1]; }); return [la/pts.length, ln/pts.length]; }
function placeParts(p){
  var loc = String(p.location||"").replace(/\s+/g," ").trim();
  var m = loc.match(/^(.*?)\s*\((.*?)\)\s*(.*)$/);
  var place = m ? (m[1]+" "+m[3]).trim() : loc, hint = m ? m[2].trim() : "";
  place = place.replace(/\b(GUT|GAT|PLOT|NO\.?|NEAR|BEHIND|BACKSIDE OF)\b.*$/i,"").trim() || loc;
  return {place:place, hint:hint};
}
function mapsLink(g){ return "https://www.google.com/maps?q="+g.lat+","+g.lng; }
function villageInfo(p){ return S.villages[(p.location||"").toUpperCase()] || null; }
function portalBtns(p){
  var st = S.states[stateOf(p)], r = rec(p), out = "";
  if (st.view) out += '<a class="btn tiny ghost" href="'+st.view+'" target="_blank" rel="noopener">Open '+esc(st.record.split(" (")[0])+' ↗</a>';
  if (st.signed) out += '<a class="btn tiny ghost" href="'+st.signed+'" target="_blank" rel="noopener">Signed copy ↗</a>';
  if (st.map) out += '<a class="btn tiny ghost" href="'+st.map+'" target="_blank" rel="noopener">Cadastral map ↗</a>';
  if (p.geo && p.geo.report) out += '<a class="btn tiny ghost" href="'+esc(p.geo.report)+'" target="_blank" rel="noopener">Govt plot report ↗</a>';
  if (r && r.link) out += '<a class="btn tiny ghost" href="'+esc(r.link)+'" target="_blank" rel="noopener">Saved PDF ↗</a>';
  var g = geoOf(p); if (g) out += '<a class="btn tiny ghost" href="'+mapsLink(g)+'" target="_blank" rel="noopener">Google Maps ↗</a>';
  return out;
}

/* ─── geocoding (OpenStreetMap, cached server-side) ─── */
function geocode(p){
  var pp = placeParts(p), st = stateName(stateOf(p));
  var tries = [[pp.place, pp.hint, p.taluka, p.district, st].filter(Boolean).join(", "), [pp.place, p.district, st].filter(Boolean).join(", "), [pp.hint || pp.place, st].filter(Boolean).join(", ")];
  var i = 0;
  function next(){
    if (i >= tries.length) return Promise.resolve(null);
    var q = tries[i++];
    return fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q="+encodeURIComponent(q), {headers:{"Accept":"application/json"}})
      .then(function(r){ return r.json(); })
      .then(function(j){ if (j && j[0]) return {lat:Number(j[0].lat), lng:Number(j[0].lon), label:j[0].display_name, precision:i===1?"village":"area"}; return new Promise(function(res){ setTimeout(res, 1100); }).then(next); });
  }
  return next();
}
function locateParcel(id, silent){
  var p = byId(id); if (!p) return Promise.resolve(false);
  if (!silent) toast("Looking up "+p.location+"…");
  return geocode(p).then(function(g){
    if (!g){ if (!silent) toast("Could not find "+p.location+" on the map — add coordinates by hand", "warn"); return false; }
    S.geoCache[geoKey(p)] = {lat:g.lat, lng:g.lng, label:g.label, precision:g.precision};
    return api("POST", "/api/geocode", {key:geoKey(p), lat:g.lat, lng:g.lng, label:g.label, precision:g.precision}).then(function(){
      if (!silent){ toast("Located: "+g.label.split(",").slice(0,3).join(",")); render(); openDetail(id); }
      return true;
    });
  }).catch(function(){ if (!silent) toast("Map lookup failed — are you online?", "warn"); return false; });
}
var GEO_RUN = null;
function locateAll(){
  if (GEO_RUN) return;
  var seen = {}, todo = [];
  S.parcels.forEach(function(p){ if (p.status !== "held") return; var k = geoKey(p); if (S.geoCache[k] || seen[k] || !p.location || p.location === "Not stated" || geoOf(p)) return; seen[k] = 1; todo.push(p); });
  if (!todo.length){ toast("Every village already has a location"); return; }
  GEO_RUN = {done:0, total:todo.length, found:0};
  toast("Locating "+todo.length+" villages — about "+Math.ceil(todo.length*1.5/60)+" min");
  var i = 0;
  (function step(){
    if (i >= todo.length){ GEO_RUN = null; toast("Located villages"); render(); return; }
    locateParcel(todo[i++].id, true).then(function(ok){ GEO_RUN.done++; if (ok) GEO_RUN.found++; var el = $("geoProg"); if (el) el.textContent = GEO_RUN.done+" / "+GEO_RUN.total+" looked up · "+GEO_RUN.found+" found"; setTimeout(step, 1100); });
  })();
}
/* government boundary + owners via the server's Bhunaksha adapter */
function fetchGovt(id, silent){
  var p = byId(id); if (!p) return Promise.resolve(null);
  if (!silent) toast("Asking the government map for gat "+p.survey+"…");
  return api("POST", "/api/parcels/"+id+"/govt", {}).then(function(r){
    p.geo = r.geo; S.records[id] = Object.assign({}, S.records[id] || {}, {govtOwners:r.owners, govtChecked:today()});
    if (!silent){ toast("Boundary and "+r.owners.length+" owner entries fetched"); render(); openDetail(id); }
    return r;
  }).catch(function(e){ if (!silent) toast(e.message, "warn"); return null; });
}
var GOVT_RUN = null;
function fetchGovtAll(){
  if (GOVT_RUN) return;
  var todo = S.parcels.filter(function(p){ return p.status === "held" && S.states[stateOf(p)].bhunaksha && (p.villageCode || villageInfo(p)) && p.survey && !(p.geo && p.geo.src === "govt"); });
  if (!todo.length){ toast("No parcels with a known village code are waiting"); return; }
  GOVT_RUN = {done:0, total:todo.length, ok:0}; toast("Fetching "+todo.length+" boundaries from the government map");
  var i = 0;
  (function step(){
    if (i >= todo.length){ GOVT_RUN = null; toast("Government boundaries fetched"); render(); return; }
    fetchGovt(todo[i++].id, true).then(function(r){ GOVT_RUN.done++; if (r) GOVT_RUN.ok++; var el = $("geoProg"); if (el) el.textContent = GOVT_RUN.done+" / "+GOVT_RUN.total+" fetched · "+GOVT_RUN.ok+" found"; setTimeout(step, 800); });
  })();
}

/* ─── chart builders ─── */
function bars(rows, color){
  if (!rows.length) return '<p class="empty">Nothing to show yet.</p>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.value; })) || 1;
  return '<div class="bars">' + rows.map(function(r){
    return '<div class="bar-row'+(r.attr?" drillable":"")+'" '+(r.attr||"")+'><span class="bar-name" title="'+esc(r.name)+'">'+esc(r.name)+(r.attr?'<i class="chev">›</i>':"")+'</span>'
      + '<span class="bar-track"><i style="width:'+Math.max(1,(r.value/max)*100)+'%;background:'+(color||"#2E8080")+'"></i></span><span class="bar-val">'+esc(r.label)+'</span></div>';
  }).join("") + '</div>';
}
function columns(rows){
  if (!rows.length) return '<p class="empty">Nothing to show yet.</p>';
  var max = Math.max.apply(null, rows.map(function(r){ return r.value; })) || 1;
  return '<div class="cols">' + rows.map(function(r){ return '<div class="col'+(r.attr?" drillable":"")+'" '+(r.attr||"")+' title="'+esc(r.label)+'"><i style="height:'+Math.max(2,(r.value/max)*100)+'%"></i><span>'+esc(r.name)+'</span></div>'; }).join("") + '</div>';
}
function donut(rows){
  var total = rows.reduce(function(s,r){ return s + r.value; }, 0) || 1, C = 2 * Math.PI * 52, off = 0;
  var segs = rows.map(function(r,i){ var len = (r.value/total) * C; var s = '<circle cx="70" cy="70" r="52" fill="none" stroke="'+PALETTE[i%PALETTE.length]+'" stroke-width="24" stroke-dasharray="'+len+' '+(C-len)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 70 70)"></circle>'; off += len; return s; }).join("");
  var legend = rows.map(function(r,i){ return '<div class="'+(r.attr?"drillable":"")+'" '+(r.attr||"")+'><i style="background:'+PALETTE[i%PALETTE.length]+'"></i>'+esc(r.name)+'<b>'+(r.legend||r.value)+'</b></div>'; }).join("");
  return '<div class="donut"><svg width="140" height="140" viewBox="0 0 140 140">'+segs+'</svg><div class="legend">'+legend+'</div></div>';
}
function stat(l, v, s, tone, attr){ return '<div class="stat'+(attr?" drillable":"")+'" '+(attr||"")+'><span class="stat-l">'+esc(l)+(attr?'<i class="chev">›</i>':"")+'</span><b class="stat-v '+(tone||"")+'">'+v+'</b><em class="stat-s">'+esc(s)+'</em></div>'; }
function panel(title, note, inner, right){ return '<section class="panel"><header class="panel-h"><div><h3>'+esc(title)+'</h3>'+(note?'<p>'+esc(note)+'</p>':"")+'</div>'+(right||"")+'</header>'+inner+'</section>'; }
function fld(label, input, hint){ return '<label class="fld"><span class="fld-l">'+label+(hint?'<em>'+esc(hint)+'</em>':"")+'</span>'+input+'</label>'; }

/* ─── drill engine ─── */
var DRILLS = {}, DK = 0, MSTACK = [];
function dk(title, sub, list){ if (!list || !list.length) return ""; var k = "d" + (++DK); DRILLS[k] = {title:title, sub:sub, ids:list.map(function(p){ return p.id; })}; return 'data-drill="'+k+'"'; }
function agg(list){
  var t = sumSqm(list), ch = list.filter(function(p){ return p.mortgage; }), priced = list.filter(function(p){ return hasNum(p.price); }), valued = list.filter(function(p){ return hasNum(p.value); });
  return {n:list.length, sqm:t, charged:ch.length, chargedSqm:sumSqm(ch), price:priced.reduce(function(s,p){return s+Number(p.price);},0), priced:priced.length, value:valued.reduce(function(s,p){return s+Number(p.value);},0), valued:valued.length, noArea:list.filter(function(p){return sqm(p)===null;}).length, sold:list.filter(function(p){return p.status!=="held";}).length};
}
var GROUPS = {
  parcels:{label:"Parcels"}, owner:{label:"By owner", key:function(p){return p.owner;}}, location:{label:"By location", key:function(p){return p.location;}},
  state:{label:"By state", key:function(p){return stateName(stateOf(p));}}, year:{label:"By year", key:function(p){return p.date ? p.date.slice(0,4) : "no date";}},
  charge:{label:"By charge", key:function(p){return p.mortgage || "clear";}}, unit:{label:"By unit", key:function(p){return UNIT_LABEL[p.unit];}},
  record:{label:"By title record", key:function(p){return {none:"no record", ok:"verified", issue:"check", stale:"re-check"}[recState(p)];}},
  docs:{label:"By documents", key:function(p){return docsOf(p).length ? "has documents" : "no documents";}}
};
function groupRows(list, gk){
  var g = GROUPS[gk], m = {};
  list.forEach(function(p){ var k = g.key(p); (m[k] = m[k] || []).push(p); });
  return Object.keys(m).map(function(k){ return {name:k, list:m[k], sqm:sumSqm(m[k])}; }).sort(function(a,b){ return b.sqm - a.sqm || b.list.length - a.list.length; });
}
function pushFrame(f){ MSTACK.push(f); paintFrame(); }
function popFrame(){ MSTACK.pop(); if (!MSTACK.length) closeModal(); else paintFrame(); }
function paintFrame(){
  var f = MSTACK[MSTACK.length-1]; if (!f) return;
  var html = f.type === "detail" ? detailHTML(f.id) : drillHTML(f);
  if (!$("modal").firstChild) openModal(html, true); else { $("modal").querySelector(".sheet").innerHTML = html; $("modal").querySelector(".scrim").scrollTop = 0; }
}
function openDrill(title, sub, list){ pushFrame({type:"drill", title:title, sub:sub, ids:list.map(function(p){return p.id;}), group:"parcels", page:1}); }
function backBtn(){ return MSTACK.length > 1 ? '<button class="icon-btn back" data-back="1">‹ Back</button>' : ""; }
function drillHTML(f){
  var list = f.ids.map(byId).filter(Boolean), a = agg(list), au = S.settings.areaUnit;
  var chips = Object.keys(GROUPS).map(function(k){ return '<button class="chip'+(f.group===k?" on":"")+'" data-group="'+k+'">'+esc(GROUPS[k].label)+'</button>'; }).join("");
  var body;
  if (f.group === "parcels"){
    var PER = 40, pages = Math.max(1, Math.ceil(list.length/PER)); if (f.page > pages) f.page = pages;
    var shown = list.slice((f.page-1)*PER, f.page*PER);
    body = '<ul class="lifelist">' + shown.map(function(p){
      return '<li><button data-view="'+p.id+'"><span class="tagchip sm">SR '+esc(p.sr)+'</span><span class="ll-name">'+esc(p.survey||"—")+' · '+esc(p.location)+' · '+esc(p.owner)+'</span><span class="ll-left">'+esc(p.date||"")+'</span><span class="ll-nbv">'+(sqm(p)===null?"—":fmtArea(areaIn(sqm(p),au))+" "+UNIT_SHORT[au])+'</span></button></li>';
    }).join("") + '</ul>' + (pages > 1 ? '<div class="pager wide"><button class="btn tiny ghost" data-dpage="-1"'+(f.page===1?" disabled":"")+'>Previous</button><b>'+f.page+' / '+pages+'</b><button class="btn tiny ghost" data-dpage="1"'+(f.page===pages?" disabled":"")+'>Next</button></div>' : "");
  } else {
    var rows = groupRows(list, f.group); DRILLS._sub = rows;
    body = '<div class="bars">' + rows.map(function(r, i){
      var pct = a.sqm ? Math.round(r.sqm/a.sqm*100) : 0;
      return '<div class="bar-row deep drillable" data-sub="'+i+'"><span class="bar-name">'+esc(r.name)+'<em class="sub">'+r.list.length+' parcel'+(r.list.length===1?"":"s")+' · '+pct+'%</em></span><span class="bar-track"><i style="width:'+Math.max(1,pct)+'%;background:'+PALETTE[i%PALETTE.length]+'"></i></span><span class="bar-val">'+fmtArea(areaIn(r.sqm,au))+' '+UNIT_SHORT[au]+'<i class="chev">›</i></span></div>';
    }).join("") + '</div>';
  }
  return '<header class="sheet-h"><div><div class="eyebrow">'+backBtn()+esc(f.sub||"")+'</div><h2>'+esc(f.title)+'</h2></div><button class="icon-btn" data-close="1">✕</button></header>'
    + '<div class="sheet-b"><div class="detail">'
    + '<div class="dstats"><div><em>Parcels</em><b>'+a.n+'</b><i>'+(a.sold?a.sold+" sold":"all in hand")+'</i></div><div><em>Area</em><b>'+fmtArea(areaIn(a.sqm,au))+'</b><i>'+UNIT_LABEL[au]+(a.noArea?" · "+a.noArea+" without area":"")+'</i></div><div><em>Under charge</em><b>'+a.charged+'</b><i>'+fmtArea(areaIn(a.chargedSqm,au))+' '+UNIT_SHORT[au]+'</i></div><div><em>Purchase price</em><b>'+(a.priced?money(a.price):"—")+'</b><i>'+a.priced+' of '+a.n+' entered</i></div></div>'
    + '<div class="chips">'+chips+'</div>' + body
    + '<div class="row-end"><button class="btn ghost tiny" data-dcsv="1">Export these '+a.n+' as CSV</button></div>'
    + '</div></div>';
}
function openModal(html, wide){ $("modal").innerHTML = '<div class="scrim" data-close="1"><div class="sheet'+(wide?"":" narrow")+'">'+html+'</div></div>'; document.body.style.overflow = "hidden"; }
function closeModal(){ MSTACK = []; $("modal").innerHTML = ""; document.body.style.overflow = ""; }
function sheetHead(eyebrow, title){ return '<header class="sheet-h"><div>'+(eyebrow?'<div class="eyebrow">'+esc(eyebrow)+'</div>':"")+'<h2>'+esc(title)+'</h2></div><button class="icon-btn" data-close="1">✕</button></header>'; }
function openDetail(id){ pushFrame({type:"detail", id:id}); }
function confirmBox(title, body, label, act, id){ openModal(sheetHead("", title) + '<div class="sheet-b"><p class="prose">'+esc(body)+'</p><div class="row-end"><button class="btn ghost" data-close="1">Keep it</button><button class="btn danger" data-confirm="'+act+'" data-cid="'+(id||"")+'">'+esc(label)+'</button></div></div>'); }
