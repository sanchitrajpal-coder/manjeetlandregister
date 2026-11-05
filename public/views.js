/* Manjeet Land Register — shell and tab views */
function renderLogin(){
  $("root").innerHTML = '<div class="login"><form class="login-card" id="loginForm">'
    + '<img src="/logo.jpg" alt="Manjeet — roots to ethics">'
    + '<h1>Land Register</h1><p>Sign in to see the family holdings</p>'
    + fld("Username", '<input id="lu" autocomplete="username" autocapitalize="none">')
    + fld("Password", '<input id="lp" type="password" autocomplete="current-password">')
    + '<p class="prose small down" id="lerr" style="display:none;text-align:center"></p>'
    + '<button class="btn solid" type="submit">Sign in</button></form></div>';
  $("loginForm").addEventListener("submit", function(ev){
    ev.preventDefault();
    api("POST", "/api/login", {username:$("lu").value, password:$("lp").value}).then(boot).catch(function(e){ $("lerr").style.display = "block"; $("lerr").textContent = e.message; });
  });
}
function renderApp(){
  $("root").innerHTML = '<div class="app"><aside class="rail"><div class="brand"><img src="/logo-mark.png" alt=""><span class="brand-txt"><b>MANJEET</b><em>Land Register</em></span></div>'
    + '<nav id="rail-nav"></nav><div class="rail-foot"><em>Area held</em><strong id="railArea">—</strong><div class="who"><span id="whoami"></span><button data-act="logout">Sign out</button></div><div class="tagline">roots to ethics</div></div></aside>'
    + '<main class="main"><header class="top"><div><div class="eyebrow" id="topMeta"></div><h1 id="topTitle">Dashboard</h1></div><div class="top-a" id="topActions"></div></header><div id="banner"></div><div class="body" id="body"></div></main></div><nav class="tabbar" id="tabbar"></nav>';
}
function renderShell(){
  var H = held();
  $("rail-nav").innerHTML = TABS.map(function(t){
    var badge = "";
    if (t.k === "register") badge = '<b class="count">'+H.length+'</b>';
    if (t.k === "records"){ var iss = H.filter(function(p){ return recState(p)==="issue"; }).length; badge = iss ? '<b class="count warn">'+iss+' ⚠</b>' : '<b class="count">'+H.filter(function(p){return rec(p);}).length+'</b>'; }
    if (t.k === "documents"){ var att = H.filter(function(p){ return docState(p)==="high"; }).length; badge = att ? '<b class="count warn">'+att+' ⚠</b>' : '<b class="count">'+H.filter(function(p){return docsOf(p).length;}).length+'</b>'; }
    if (t.k === "valuation") badge = '<b class="count">'+S.parcels.filter(function(p){return !hasNum(p.price);}).length+'</b>';
    return '<button class="nav'+(S.tab===t.k?" on":"")+'" data-tab="'+t.k+'"><i>'+t.icon+'</i><span>'+t.label+'</span>'+badge+'</button>';
  }).join("");
  $("tabbar").innerHTML = TABS.map(function(t){ return '<button class="'+(S.tab===t.k?"on":"")+'" data-tab="'+t.k+'"><i>'+t.icon+'</i><span>'+t.label.replace("Title records","Records")+'</span></button>'; }).join("");
  $("railArea").textContent = fmtArea(areaIn(sumSqm(H), S.settings.areaUnit)) + " " + UNIT_SHORT[S.settings.areaUnit];
  $("whoami").textContent = (S.user.name || S.user.username) + " · " + S.user.role;
  $("topTitle").textContent = TABS.filter(function(t){return t.k===S.tab;})[0].label;
  $("topMeta").innerHTML = esc(S.parcels.length + " parcels · " + H.length + " in hand") + ' <span class="rolebadge '+(canEdit()?"ed":"ro")+'">'+(canEdit()?"Editing":"Read only")+'</span>';
  $("topActions").innerHTML = '<a class="btn ghost" href="/api/export.csv">Export CSV</a>' + (canEdit() ? '<button class="btn solid" data-act="add">+ Add parcel</button>' : '');
}
function render(){
  DRILLS = {}; DK = 0;
  if (!S.user){ renderLogin(); return; }
  if (!$("body")) renderApp();
  renderShell();
  var b = $("body");
  if (S.tab === "dashboard") b.innerHTML = viewDashboard();
  else if (S.tab === "register") { b.innerHTML = viewRegister(); paintRegister(); }
  else if (S.tab === "records") { b.innerHTML = viewRecords(); paintRecords(); }
  else if (S.tab === "documents") { b.innerHTML = viewDocuments(); paintDocuments(); }
  else if (S.tab === "map") { b.innerHTML = viewMap(); paintMap(); }
  else if (S.tab === "valuation") { b.innerHTML = viewValuation(); paintValuation(); }
  else if (S.tab === "analytics") b.innerHTML = viewAnalytics();
  else if (S.tab === "disposals") b.innerHTML = viewDisposals();
  else { b.innerHTML = viewSettings(); paintSettings(); }
  window.scrollTo(0,0);
}

/* ─── dashboard ─── */
function viewDashboard(){
  var H = held(), au = S.settings.areaUnit, total = sumSqm(H);
  var priced = S.parcels.filter(function(p){ return hasNum(p.price); }), valued = S.parcels.filter(function(p){ return hasNum(p.value); });
  var owners = uniq(H.map(function(p){return p.owner;})).length, locs = uniq(H.map(function(p){return p.location;})).length;
  var chargedList = H.filter(function(p){ return p.mortgage; }), chargedArea = sumSqm(chargedList);
  var withDocs = H.filter(function(p){ return docsOf(p).length; }), withRec = H.filter(function(p){ return rec(p); }), onMap = H.filter(function(p){ return geoOf(p); }), govt = H.filter(function(p){ return p.geo && p.geo.src === "govt"; });
  var attention = H.filter(function(p){ return docState(p) === "high" || recState(p) === "issue"; });
  var pct = function(n){ return Math.round(n / (H.length||1) * 100); };
  var gOwner = {}, gLoc = {}, gState = {}, gYear = {};
  H.forEach(function(p){ gOwner[p.owner] = (gOwner[p.owner]||0) + (sqm(p)||0); gLoc[p.location] = (gLoc[p.location]||0) + (sqm(p)||0); var sk = stateName(stateOf(p)); gState[sk] = (gState[sk]||0) + (sqm(p)||0); });
  S.parcels.forEach(function(p){ if (p.date){ var y=p.date.slice(0,4); gYear[y]=(gYear[y]||0)+1; } });
  function top(obj, n, keyFn, noun){
    return Object.keys(obj).map(function(k){ return {name:k, v:obj[k]}; }).sort(function(a,b){ return b.v - a.v; }).slice(0, n).map(function(r){
      var sub = H.filter(function(p){ return keyFn(p) === r.name; });
      return {name:r.name, value:r.v, label:fmtArea(areaIn(r.v, au))+" "+UNIT_SHORT[au], attr:dk(noun+" · "+r.name, "Parcels in hand", sub)};
    });
  }
  var years = Object.keys(gYear).sort().map(function(y){ var sub = S.parcels.filter(function(p){ return p.date && p.date.slice(0,4) === y; }); return {name:y, value:gYear[y], label:y+": "+gYear[y]+" parcels", attr:dk("Registered in "+y, gYear[y]+" parcels acquired that year", sub)}; });
  return '<div class="stack">'
  + '<section class="schedule"><div class="sched-head"><span class="eyebrow">Holding statement · parcels in hand</span><span class="sched-count">'+H.length+' of '+S.parcels.length+' parcels</span></div>'
    + '<div class="sched-rows">'
      + '<div class="sched-line"><span>Aggregate area <em>converted to one unit</em></span><b>'+fmtArea(areaIn(total,au))+' '+UNIT_SHORT[au]+'</b></div>'
      + '<div class="sched-line minus"><span>Held across</span><b>'+owners+' owners · '+locs+' locations · '+Object.keys(gState).length+' states</b></div>'
      + '<div class="sched-line minus drillable" '+dk("Land under charge","Every parcel with a mortgage, loan or lease noted",chargedList)+'><span>Of which under charge<i class="chev">›</i></span><b>'+fmtArea(areaIn(chargedArea,au))+' '+UNIT_SHORT[au]+' · '+chargedList.length+' parcels</b></div>'
      + '<div class="sched-line total drillable" '+dk("Needs attention","Title record disagrees with the sheet, or the documents raised a high-severity observation",attention)+'><span>Needs attention<i class="chev">›</i></span><b>'+attention.length+'</b></div>'
    + '</div>'
    + '<div class="cover">'
      + '<div class="cover-row"><span>Documents uploaded</span><div class="cover-bar"><i class="doc" style="width:'+pct(withDocs.length)+'%"></i></div><b>'+pct(withDocs.length)+'%</b></div>'
      + '<div class="cover-row"><span>Title record on file</span><div class="cover-bar"><i style="width:'+pct(withRec.length)+'%"></i></div><b>'+pct(withRec.length)+'%</b></div>'
      + '<div class="cover-row"><span>Located on map</span><div class="cover-bar"><i style="width:'+pct(onMap.length)+'%"></i></div><b>'+pct(onMap.length)+'%</b></div>'
      + '<div class="cover-row"><span>Purchase price</span><div class="cover-bar"><i class="alt" style="width:'+Math.round(priced.length/(S.parcels.length||1)*100)+'%"></i></div><b>'+Math.round(priced.length/(S.parcels.length||1)*100)+'%</b></div>'
    + '</div></section>'
  + '<section class="stats">'
    + stat("Area in hand ("+UNIT_LABEL[au]+")", fmtArea(areaIn(total,au)), fmtArea(areaIn(total,"HECTARE"))+" hectare equivalent", "", dk("All parcels in hand", "Everything on the books today", H))
    + stat("Documents", withDocs.length+" / "+H.length, (H.length-withDocs.length)+" properties still to upload", "", dk("Properties without documents", "Upload their document sets", H.filter(function(p){return !docsOf(p).length;})))
    + stat("Title records", withRec.length+" / "+H.length, H.filter(function(p){return recState(p)==="issue";}).length+" need checking", "", dk("Parcels without a title record", "7/12, khasra or equivalent still to pull", H.filter(function(p){return !rec(p);})))
    + stat("Govt boundaries", govt.length+" / "+H.length, onMap.length+" located in all", "", dk("Parcels with government boundary", "Plot outline from the state map portal", govt))
  + '</section>'
  + '<div class="grid2">' + panel("Holding by owner", "Top ten entities by area — tap any row to open its parcels", bars(top(gOwner,10,function(p){return p.owner;},"Owner"), "#2E8080")) + panel("Holding by state", "Where the land sits", bars(top(gState,9,function(p){return stateName(stateOf(p));},"State"), "#B07A2B")) + '</div>'
  + '<div class="grid2">' + panel("Holding by location", "Top ten sites by area", bars(top(gLoc,10,function(p){return p.location;},"Location"), "#2C6E9B")) + panel("Acquisitions by year", "Parcels registered per year", columns(years)) + '</div>'
  + '</div>';
}

/* ─── register ─── */
function viewRegister(){
  var owners = uniq(S.parcels.map(function(p){return p.owner;})), locs = uniq(S.parcels.map(function(p){return p.location;}));
  function opts(list, sel){ return list.map(function(o){ return '<option'+(o===sel?" selected":"")+'>'+esc(o)+'</option>'; }).join(""); }
  function sopt(v, cur, lbl){ return '<option value="'+v+'"'+(cur===v?" selected":"")+'>'+lbl+'</option>'; }
  var f = S.reg;
  return '<div class="stack"><div class="filters">'
    + '<input class="search" id="regQ" placeholder="Search SR, file no, owner, seller, village, gut/khasra, khata…" value="'+esc(f.q)+'">'
    + '<select id="regStatus">'+sopt("held",f.status,"In hand")+sopt("sold",f.status,"Sold")+sopt("all",f.status,"Everything")+'</select>'
    + '<select id="regState"><option value="all">All states</option>'+S.stateOrder.map(function(k){ return sopt(k, f.state, esc(S.states[k].name)); }).join("")+'</select>'
    + '<select id="regOwner"><option value="all">All owners</option>'+opts(owners, f.owner)+'</select>'
    + '<select id="regLoc"><option value="all">All locations</option>'+opts(locs, f.loc)+'</select>'
    + '<select id="regCharge">'+sopt("all",f.charge,"Charged or clear")+sopt("charged",f.charge,"Under charge")+sopt("clear",f.charge,"Clear title")+sopt("marked",f.charge,"Marked yellow on sheet")+'</select>'
    + '<select id="regRec">'+sopt("all",f.rec,"Any title record")+sopt("none",f.rec,"No record yet")+sopt("ok",f.rec,"Record verified")+sopt("issue",f.rec,"Record needs checking")+sopt("stale",f.rec,"Record older than a year")+'</select>'
    + '<select id="regDocs">'+sopt("all",f.docs,"Any documents")+sopt("none",f.docs,"No documents")+sopt("has",f.docs,"Has documents")+sopt("high",f.docs,"Documents need attention")+'</select>'
    + '<select id="regSort">'+sopt("sr",f.sort,"Sort: SR no.")+sopt("area",f.sort,"Sort: largest area")+sopt("date",f.sort,"Sort: newest deed")+sopt("owner",f.sort,"Sort: owner")+sopt("location",f.sort,"Sort: location")+'</select>'
    + '</div><div id="regResults"></div></div>';
}
function regList(){
  var f = S.reg, q = f.q.trim().toLowerCase();
  var out = S.parcels.filter(function(p){
    if (f.status !== "all" && (f.status === "held" ? p.status !== "held" : p.status === "held")) return false;
    if (f.state !== "all" && stateOf(p) !== f.state) return false;
    if (f.owner !== "all" && p.owner !== f.owner) return false;
    if (f.loc !== "all" && p.location !== f.loc) return false;
    if (f.charge === "charged" && !p.mortgage) return false;
    if (f.charge === "clear" && p.mortgage) return false;
    if (f.charge === "marked" && !p.marked) return false;
    if (f.rec !== "all" && recState(p) !== f.rec) return false;
    if (f.docs === "none" && docsOf(p).length) return false;
    if (f.docs === "has" && !docsOf(p).length) return false;
    if (f.docs === "high" && docState(p) !== "high") return false;
    if (!q) return true;
    var r = rec(p) || {};
    return [p.sr,p.abd,p.snd,p.owner,p.seller,p.location,p.survey,p.mortgage,p.landStatus,p.district,p.taluka,stateName(stateOf(p)),r.no,r.khata,r.holders,r.encumbrance].some(function(v){ return String(v||"").toLowerCase().indexOf(q) > -1; });
  });
  out.sort(function(a,b){
    if (f.sort === "area") return (sqm(b)||0) - (sqm(a)||0);
    if (f.sort === "date") return String(b.date||"").localeCompare(String(a.date||""));
    if (f.sort === "sr") return (Number(a.sr)||0) - (Number(b.sr)||0);
    return String(a[f.sort]||"").localeCompare(String(b[f.sort]||""));
  });
  return out;
}
function paintRegister(){
  var list = regList(), PER = 50, pages = Math.max(1, Math.ceil(list.length / PER));
  if (S.reg.page > pages) S.reg.page = pages;
  var shown = list.slice((S.reg.page-1)*PER, S.reg.page*PER), total = sumSqm(list), ch = list.filter(function(p){ return p.mortgage; });
  var html = '<div class="resultbar"><span class="drillable" '+dk("Filtered parcels","The current register view",list)+'>'+list.length+' parcel'+(list.length===1?"":"s")+' · '+fmtArea(areaIn(total,"ACRE"))+' acre ('+fmtArea(areaIn(total,"HECTARE"))+' ha)'+(ch.length ? ' · <b class="down">'+fmtArea(areaIn(sumSqm(ch),"ACRE"))+' acre under charge</b>' : "")+'<i class="chev">›</i></span>'
    + (pages>1 ? '<span class="pager"><button class="btn tiny ghost" data-page="-1"'+(S.reg.page===1?" disabled":"")+'>Previous</button><b>'+S.reg.page+' / '+pages+'</b><button class="btn tiny ghost" data-page="1"'+(S.reg.page===pages?" disabled":"")+'>Next</button></span>' : "")+'</div>';
  if (!list.length){ $("regResults").innerHTML = html + '<p class="empty big">No parcels match this view.</p>'; return; }
  html += '<div class="tablewrap desk"><table class="tbl"><thead><tr><th>SR</th><th>Owner</th><th>Village / location</th><th>Gut / Khasra</th><th class="r">Area</th><th>Deed date</th><th>Charge</th><th>Title record</th><th>Documents</th><th class="r">Purchase price</th><th></th></tr></thead><tbody>'
    + shown.map(function(p){
      return '<tr class="click" data-view="'+p.id+'"><td><span class="tagchip">'+esc(p.sr)+'</span>'+(p.abd?'<em class="sub">ABD '+esc(p.abd)+'</em>':(p.snd?'<em class="sub">SND '+esc(p.snd)+'</em>':""))+'</td>'
        + '<td class="strong">'+esc(p.owner)+(p.status!=="held"?'<span class="pill sold">'+esc(p.saleType||"Sold")+'</span>':"")+'<em class="sub">from '+esc(p.seller||"—")+'</em></td>'
        + '<td>'+esc(p.location)+'<em class="sub">'+esc(stateName(stateOf(p)))+(p.taluka?" · "+esc(p.taluka):"")+'</em></td>'
        + '<td class="num" style="font-size:12px">'+esc(p.survey||"—")+'</td>'
        + '<td class="r num">'+(p.area===null?'<span class="flag">no area</span>':fmtArea(p.area)+" "+UNIT_SHORT[p.unit])+'</td>'
        + '<td class="num">'+(p.date?esc(p.date):'<span class="dim">not stated</span>')+'</td>'
        + '<td>'+(p.mortgage?'<span class="pill ret" title="'+esc(p.mortgage)+'">charged</span>':'<span class="dim">—</span>')+'</td>'
        + '<td>'+recChip(p,true)+(geoOf(p)?'<em class="sub">'+(p.geo&&p.geo.src==="govt"?"govt boundary":"located")+'</em>':"")+'</td>'
        + '<td>'+docChip(p,true)+'</td>'
        + '<td class="r num strong">'+(hasNum(p.price)?money(p.price):'<span class="blank">to be entered</span>')+'</td>'
        + '<td class="act">'+(p.status!=="held" ? '<span class="soldat">'+esc(p.saleDate)+'</span>' : canEdit() ? '<button class="btn tiny sell" data-sell="'+p.id+'">Sell</button>' : '')+(canEdit() ? '<button class="btn tiny ghost" data-edit="'+p.id+'">Edit</button>' : '<button class="btn tiny ghost" data-view="'+p.id+'">Open</button>')+'</td></tr>';
    }).join("") + '</tbody></table></div>';
  html += '<div class="cards">' + shown.map(function(p){
    return '<article class="acard" data-view="'+p.id+'"><div class="acard-t"><span class="tagchip">SR '+esc(p.sr)+'</span><span>'+recChip(p,true)+' '+docChip(p,true)+'</span></div>'
      + '<h4>'+esc(p.survey||"—")+' · '+esc(p.location)+'</h4>'
      + '<div class="acard-g"><span><em>Owner</em><b>'+esc(p.owner)+'</b></span><span><em>Area</em><b class="num">'+(p.area===null?"—":fmtArea(p.area)+" "+UNIT_SHORT[p.unit])+'</b></span></div>'
      + '<div class="acard-g"><span><em>State</em><b>'+esc(stateName(stateOf(p)))+'</b></span><span><em>Purchase price</em><b class="num">'+(hasNum(p.price)?money(p.price):'<span class="blank">to be entered</span>')+'</b></span></div>'
      + '</article>';
  }).join("") + '</div>';
  $("regResults").innerHTML = html;
}

/* ─── title records ─── */
function viewRecords(){
  var H = held(), counts = {none:0, ok:0, issue:0, stale:0}; H.forEach(function(p){ counts[recState(p)]++; });
  var byState = {}; H.forEach(function(p){ var k = stateOf(p); byState[k] = byState[k] || {n:0, rec:0, geo:0, govt:0}; byState[k].n++; if (rec(p)) byState[k].rec++; if (geoOf(p)) byState[k].geo++; if (p.geo && p.geo.src==="govt") byState[k].govt++; });
  var withRec = counts.ok+counts.issue+counts.stale;
  return '<div class="stack">'
  + '<section class="stats">'
    + stat("Records on file", withRec+" / "+H.length, Math.round(withRec/(H.length||1)*100)+"% of parcels in hand", "", dk("Parcels with a title record", "7/12, khasra or equivalent recorded", H.filter(function(p){return rec(p);})))
    + stat("Need checking", String(counts.issue), "area, owner or charge differs from the sheet", counts.issue?"down":"", dk("Records that disagree with the sheet", "Open each one and see what differs", H.filter(function(p){return recState(p)==="issue";})))
    + stat("Older than a year", String(counts.stale), "re-download and re-check", "", dk("Records to re-check", "Checked more than "+STALE_DAYS+" days ago", H.filter(function(p){return recState(p)==="stale";})))
    + stat("No record yet", String(counts.none), "pull from the state portal", "", dk("Parcels without a title record", "", H.filter(function(p){return recState(p)==="none";})))
  + '</section>'
  + panel("By state", "Which portal holds the record, and how far each state has got. The state is guessed from the village name until confirmed on the parcel.",
      '<div class="covgrid">' + S.stateOrder.filter(function(k){ return byState[k]; }).map(function(k){ var st = S.states[k], c = byState[k];
        return '<div class="covcard"><b>'+esc(st.name)+'</b><span class="num">'+c.n+'</span><i>'+c.rec+' with '+esc(st.record.split(" (")[0])+' · '+c.govt+' govt boundaries · '+c.geo+' located</i>'+(st.view ? '<a href="'+st.view+'" target="_blank" rel="noopener">'+esc(st.record)+' ↗</a>' : "")+(st.bhunaksha ? '<i>Bhunaksha: boundary + owners without captcha</i>' : "")+'</div>'; }).join("") + '</div>',
      canEdit() ? '<div class="datarow"><button class="btn ghost tiny" data-act="merge">Merge records file</button><button class="btn ghost tiny" data-act="govtall"'+(GOVT_RUN?" disabled":"")+'>'+(GOVT_RUN?"Fetching…":"Fetch govt boundaries & owners")+'</button><input type="file" id="mergeIn" accept="application/json,.json" style="display:none"></div>' : "")
  + '<div class="filters"><input class="search" id="recQ" placeholder="Search village, gut/khasra, holder, khata…" value="'+esc(S.recs.q)+'">'
    + '<select id="recState"><option value="all">All states</option>'+S.stateOrder.filter(function(k){ return byState[k]; }).map(function(k){ return '<option value="'+k+'"'+(S.recs.state===k?" selected":"")+'>'+esc(S.states[k].name)+' ('+byState[k].n+')</option>'; }).join("")+'</select>'
    + '<select id="recOnly">'+["all:Every parcel in hand","none:No record yet","issue:Needs checking","stale:Older than a year","ok:Verified","nogeo:Not on the map","govt:Has govt boundary"].map(function(s){ var a = s.split(":"); return '<option value="'+a[0]+'"'+(S.recs.only===a[0]?" selected":"")+'>'+a[1]+'</option>'; }).join("")+'</select></div>'
  + '<div id="recResults"></div></div>';
}
function recList(){
  var f = S.recs, q = f.q.trim().toLowerCase();
  return held().filter(function(p){
    if (f.state !== "all" && stateOf(p) !== f.state) return false;
    if (f.only === "nogeo" && geoOf(p)) return false;
    if (f.only === "govt" && !(p.geo && p.geo.src === "govt")) return false;
    if (["nogeo","govt","all"].indexOf(f.only) < 0 && recState(p) !== f.only) return false;
    if (!q) return true;
    var r = rec(p) || {};
    return [p.sr,p.owner,p.location,p.survey,p.district,p.taluka,r.no,r.khata,r.holders,r.encumbrance,r.remarks].some(function(v){ return String(v||"").toLowerCase().indexOf(q) > -1; });
  }).sort(function(a,b){ return (Number(a.sr)||0) - (Number(b.sr)||0); });
}
function paintRecords(){
  var list = recList(), PER = 50, pages = Math.max(1, Math.ceil(list.length / PER)); if (S.recs.page > pages) S.recs.page = pages;
  var shown = list.slice((S.recs.page-1)*PER, S.recs.page*PER);
  var html = '<div class="resultbar"><span class="drillable" '+dk("Filtered parcels","The current records view",list)+'>'+list.length+' parcel'+(list.length===1?"":"s")+'<i class="chev">›</i></span>'+(pages>1 ? '<span class="pager"><button class="btn tiny ghost" data-rpage="-1"'+(S.recs.page===1?" disabled":"")+'>Previous</button><b>'+S.recs.page+' / '+pages+'</b><button class="btn tiny ghost" data-rpage="1"'+(S.recs.page===pages?" disabled":"")+'>Next</button></span>' : "")+'</div>';
  if (!list.length){ $("recResults").innerHTML = html + '<p class="empty big">Nothing matches this view.</p>'; return; }
  html += '<div class="tablewrap desk"><table class="tbl"><thead><tr><th>SR</th><th>Village / location</th><th>State</th><th>Gut / Khasra</th><th>Khata</th><th>Holders on record</th><th class="r">Sheet area</th><th class="r">Record area</th><th>Status</th><th>Map</th><th>Checked</th><th></th></tr></thead><tbody>'
    + shown.map(function(p){ var r = rec(p), m = sqm(p), rm = recSqm(r);
      return '<tr class="click" data-view="'+p.id+'"><td><span class="tagchip">'+esc(p.sr)+'</span></td><td class="strong">'+esc(p.location)+'<em class="sub">'+esc(p.owner)+'</em></td>'
        + '<td><span class="statechip'+(stateGuessed(p)?" guess":"")+'">'+esc(stateName(stateOf(p)))+(stateGuessed(p)?" ?":"")+'</span></td>'
        + '<td class="num" style="font-size:12px">'+esc(p.survey||"—")+'</td><td class="num" style="font-size:12px">'+esc(r&&r.khata?r.khata:"—")+'</td>'
        + '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(r&&r.holders||"")+'">'+esc(r&&r.holders?r.holders:"—")+'</td>'
        + '<td class="r num">'+(m===null?"—":fmtArea(m/SQM.ACRE)+" ac")+'</td><td class="r num">'+(rm===null?"—":fmtArea(rm/SQM.ACRE)+" ac")+'</td>'
        + '<td>'+recChip(p,true)+'</td><td><span class="dim" style="font-size:12px">'+(p.geo&&p.geo.src==="govt"?"govt":geoOf(p)?geoOf(p).src:"—")+'</span></td><td class="num">'+esc(r&&r.checked||"—")+'</td>'
        + '<td class="act">'+(canEdit() ? '<button class="btn tiny ghost" data-rec="'+p.id+'">'+(r&&r.no?"Edit":"Add")+'</button>' : '<button class="btn tiny ghost" data-view="'+p.id+'">Open</button>')+'</td></tr>';
    }).join("") + '</tbody></table></div>';
  html += '<div class="cards">' + shown.map(function(p){ var r = rec(p);
    return '<article class="acard" data-view="'+p.id+'"><div class="acard-t"><span class="tagchip">SR '+esc(p.sr)+'</span>'+recChip(p,true)+'</div><h4>'+esc(p.survey||"—")+' · '+esc(p.location)+'</h4>'
      + '<div class="acard-g"><span><em>State</em><b>'+esc(stateName(stateOf(p)))+'</b></span><span><em>Khata</em><b class="num">'+esc(r&&r.khata?r.khata:"—")+'</b></span></div>'
      + '<div class="acard-g"><span><em>Holders</em><b>'+esc(r&&r.holders?r.holders:"—")+'</b></span><span><em>Checked</em><b class="num">'+esc(r&&r.checked||"—")+'</b></span></div></article>';
  }).join("") + '</div>';
  $("recResults").innerHTML = html;
}

/* ─── documents ─── */
function viewDocuments(){
  var H = held(), withDocs = H.filter(function(p){ return docsOf(p).length; });
  var reading = S.docs.filter(function(d){ return d.ai_status === "pending" || d.ai_status === "running"; }).length;
  var high = H.filter(function(p){ return docState(p) === "high"; }), med = H.filter(function(p){ return docState(p) === "medium"; });
  var pages = S.docs.reduce(function(s,d){ return s + (d.pages||0); }, 0), bytes = S.docs.reduce(function(s,d){ return s + Number(d.size||0); }, 0);
  var byOwner = {}; H.forEach(function(p){ var o = byOwner[p.owner] = byOwner[p.owner] || {n:0, d:0}; o.n++; if (docsOf(p).length) o.d++; });
  var ownerRows = Object.keys(byOwner).sort(function(a,b){ return (byOwner[b].n-byOwner[b].d) - (byOwner[a].n-byOwner[a].d); }).slice(0,12).map(function(k){ var o = byOwner[k]; return {name:k, value:o.n-o.d, label:o.d+" of "+o.n+" uploaded", attr:dk("Owner · "+k+" · without documents", "", H.filter(function(p){ return p.owner===k && !docsOf(p).length; }))}; });
  return '<div class="stack">'
  + '<section class="stats">'
    + stat("Properties with documents", withDocs.length+" / "+H.length, S.docs.length+" files · "+pages+" pages · "+fmtBytes(bytes), "", dk("Properties with documents", "", withDocs))
    + stat("Still to upload", String(H.length-withDocs.length), "properties with no document set yet", "", dk("Properties without documents", "Upload their document sets", H.filter(function(p){return !docsOf(p).length;})))
    + stat("Need attention", String(high.length), med.length+" more with points to review", high.length?"down":"", dk("Documents with high-severity observations", "", high))
    + stat(S.ai ? "Being read" : "AI reading", S.ai ? String(reading) : "off", S.ai ? "documents queued or in progress" : "add ANTHROPIC_API_KEY on the server", "", "")
  + '</section>'
  + (S.ai ? "" : '<div class="banner" style="margin:0">AI reading is off: the server has no ANTHROPIC_API_KEY. Uploads still work; summaries and observations appear once the key is added.</div>')
  + '<div class="grid2">' + panel("Owners with the most gaps", "Properties still without a document set, by owner — tap to list them", bars(ownerRows, "#B07A2B"))
    + panel("Latest observations", "High and medium points from the most recently read document sets", latestObservations(8)) + '</div>'
  + '<div class="filters"><input class="search" id="docQ" placeholder="Search property, owner, village, file name, observation…" value="'+esc(S.dox.q)+'">'
    + '<select id="docState"><option value="all">All states</option>'+S.stateOrder.map(function(k){ return '<option value="'+k+'"'+(S.dox.state===k?" selected":"")+'>'+esc(S.states[k].name)+'</option>'; }).join("")+'</select>'
    + '<select id="docOnly">'+["all:Every property in hand","none:No documents yet","has:Has documents","high:Needs attention","medium:Points to review","reading:Being read","error:Reading failed"].map(function(s){ var a = s.split(":"); return '<option value="'+a[0]+'"'+(S.dox.only===a[0]?" selected":"")+'>'+a[1]+'</option>'; }).join("")+'</select></div>'
  + '<div id="docResults"></div></div>';
}
function latestObservations(n){
  var items = [];
  S.docs.filter(function(d){ return d.ai_status === "done" && d.ai_summary; }).forEach(function(d){
    var p = byId(d.parcel_id); if (!p) return;
    (d.ai_summary.observations||[]).filter(function(o){ return o.severity !== "low"; }).forEach(function(o){ items.push({d:d, p:p, o:o}); });
  });
  if (!items.length) return '<p class="empty">No observations yet — upload a document set and the reader fills this in.</p>';
  items.sort(function(a,b){ return new Date(b.d.ai_at) - new Date(a.d.ai_at); });
  return '<ul class="obs">' + items.slice(0,n).map(function(x){ return '<li class="'+x.o.severity+'"><span class="sev '+x.o.severity+'">'+x.o.severity+'</span>'+esc(x.o.text)+' <a href="#" data-view="'+x.p.id+'">SR '+esc(x.p.sr)+' · '+esc(x.p.location)+'</a></li>'; }).join("") + '</ul>';
}
function docList(){
  var f = S.dox, q = f.q.trim().toLowerCase();
  return held().filter(function(p){
    if (f.state !== "all" && stateOf(p) !== f.state) return false;
    var ds = docsOf(p), st = docState(p);
    if (f.only === "none" && ds.length) return false;
    if (f.only === "has" && !ds.length) return false;
    if (f.only === "high" && st !== "high") return false;
    if (f.only === "medium" && st !== "medium") return false;
    if (f.only === "reading" && !ds.some(function(d){ return d.ai_status==="pending"||d.ai_status==="running"; })) return false;
    if (f.only === "error" && !ds.some(function(d){ return d.ai_status==="error"; })) return false;
    if (!q) return true;
    var blob = [p.sr,p.owner,p.location,p.survey].concat(ds.map(function(d){ return d.filename + " " + JSON.stringify(d.ai_summary||""); })).join(" ").toLowerCase();
    return blob.indexOf(q) > -1;
  }).sort(function(a,b){ return (Number(a.sr)||0) - (Number(b.sr)||0); });
}
function paintDocuments(){
  var list = docList(), PER = 50, pages = Math.max(1, Math.ceil(list.length / PER)); if (S.dox.page > pages) S.dox.page = pages;
  var shown = list.slice((S.dox.page-1)*PER, S.dox.page*PER);
  var html = '<div class="resultbar"><span class="drillable" '+dk("Filtered properties","The current documents view",list)+'>'+list.length+' propert'+(list.length===1?"y":"ies")+'<i class="chev">›</i></span>'+(pages>1 ? '<span class="pager"><button class="btn tiny ghost" data-xpage="-1"'+(S.dox.page===1?" disabled":"")+'>Previous</button><b>'+S.dox.page+' / '+pages+'</b><button class="btn tiny ghost" data-xpage="1"'+(S.dox.page===pages?" disabled":"")+'>Next</button></span>' : "")+'</div>';
  if (!list.length){ $("docResults").innerHTML = html + '<p class="empty big">Nothing matches this view.</p>'; return; }
  html += '<div class="tablewrap desk"><table class="tbl"><thead><tr><th>SR</th><th>Property</th><th>Owner</th><th>Files</th><th class="r">Pages</th><th>Reading</th><th>Observations</th><th>Last upload</th><th></th></tr></thead><tbody>'
    + shown.map(function(p){ var ds = docsOf(p), obs = [].concat.apply([], ds.map(function(d){ return (d.ai_summary&&d.ai_summary.observations)||[]; }));
      var hi = obs.filter(function(o){return o.severity==="high";}).length, me = obs.filter(function(o){return o.severity==="medium";}).length;
      var st = ds.some(function(d){return d.ai_status==="running";}) ? "reading…" : ds.some(function(d){return d.ai_status==="pending";}) ? "queued" : ds.some(function(d){return d.ai_status==="error";}) ? "failed" : ds.some(function(d){return d.ai_status==="done";}) ? "read" : ds.length ? "off" : "—";
      return '<tr class="click" data-view="'+p.id+'"><td><span class="tagchip">'+esc(p.sr)+'</span></td><td class="strong">'+esc(p.survey||"—")+' · '+esc(p.location)+'<em class="sub">'+esc(stateName(stateOf(p)))+'</em></td><td>'+esc(p.owner)+'</td>'
        + '<td>'+docChip(p,true)+(ds.length?'<em class="sub">'+esc(ds[0].filename)+(ds.length>1?" +"+(ds.length-1):"")+'</em>':"")+'</td><td class="r num">'+(ds.reduce(function(s,d){return s+(d.pages||0);},0)||"—")+'</td>'
        + '<td class="dim" style="font-size:12.5px">'+st+'</td><td>'+(hi?'<span class="sev high">'+hi+' high</span>':"")+(me?'<span class="sev medium">'+me+' med</span>':"")+(!hi&&!me?'<span class="dim">—</span>':"")+'</td>'
        + '<td class="num">'+(ds.length?fmtDate(ds[0].uploaded_at):"—")+'</td><td class="act">'+(canEdit()?'<button class="btn tiny solid" data-upload="'+p.id+'">Upload</button>':'<button class="btn tiny ghost" data-view="'+p.id+'">Open</button>')+'</td></tr>';
    }).join("") + '</tbody></table></div>';
  html += '<div class="cards">' + shown.map(function(p){ var ds = docsOf(p);
    return '<article class="acard" data-view="'+p.id+'"><div class="acard-t"><span class="tagchip">SR '+esc(p.sr)+'</span>'+docChip(p,true)+'</div><h4>'+esc(p.survey||"—")+' · '+esc(p.location)+'</h4>'
      + '<div class="acard-g"><span><em>Owner</em><b>'+esc(p.owner)+'</b></span><span><em>Files</em><b class="num">'+ds.length+' · '+(ds.reduce(function(s,d){return s+(d.pages||0);},0))+' pages</b></span></div>'
      + '<div class="acard-a">'+(canEdit()?'<button class="btn tiny solid" data-upload="'+p.id+'">Upload</button>':"")+'</div></article>';
  }).join("") + '</div>';
  $("docResults").innerHTML = html;
}

/* ─── map ─── */
var MAP = null, DRAW = null;
function mapList(){ return S.parcels.filter(function(p){ if (S.map.only === "held" && p.status !== "held") return false; if (S.map.state !== "all" && stateOf(p) !== S.map.state) return false; return true; }); }
function viewMap(){
  var list = mapList(), located = list.filter(function(p){ return geoOf(p); }), govt = list.filter(function(p){ return p.geo && p.geo.src === "govt"; }).length, drawn = list.filter(function(p){ return polyOf(p) && p.geo.src !== "govt"; }).length;
  var byState = {}; S.parcels.forEach(function(p){ var k = stateOf(p); byState[k] = (byState[k]||0)+1; });
  var drawTools = "";
  if (canEdit()){
    var opts = held().slice().sort(function(a,b){ return (Number(a.sr)||0)-(Number(b.sr)||0); }).map(function(p){ return '<option value="'+p.id+'"'+(DRAW&&DRAW.id===p.id?" selected":"")+'>SR '+esc(p.sr)+' · '+esc(p.survey||"")+' · '+esc(p.location)+(polyOf(p)?" ■":"")+'</option>'; }).join("");
    drawTools = '<div class="filters"><select id="drawSel" style="max-width:360px"><option value="">Demarcate by hand: choose the parcel…</option>'+opts+'</select>'
      + '<button class="btn ghost tiny" data-draw="start">Tap corners</button><button class="btn ghost tiny" data-draw="gps">Add my position</button><button class="btn ghost tiny" data-draw="import">Import KML / GeoJSON</button>'
      + '<input type="file" id="kmlIn" accept=".kml,.geojson,.json" style="display:none"><span id="drawState" class="prose small dim" style="margin:0"></span><span class="spacer"></span>'
      + '<button class="btn ghost tiny" data-draw="undo">Undo</button><button class="btn danger ghostd tiny" data-draw="clear">Clear</button><button class="btn solid tiny" data-draw="finish">Save boundary</button></div>';
  }
  return '<div class="stack"><div class="filters">'
    + '<input class="search" id="mapQ" placeholder="Find on map: SR, village, gut/khasra, owner…" value="'+esc(S.map.q||"")+'" autocomplete="off">'
    + '<select id="mapState"><option value="all">All states</option>'+S.stateOrder.filter(function(k){return byState[k];}).map(function(k){ return '<option value="'+k+'"'+(S.map.state===k?" selected":"")+'>'+esc(S.states[k].name)+'</option>'; }).join("")+'</select>'
    + '<select id="mapOnly"><option value="held"'+(S.map.only==="held"?" selected":"")+'>In hand</option><option value="all"'+(S.map.only==="all"?" selected":"")+'>Everything</option></select>'
    + '<select id="mapBase"><option value="sat"'+(S.map.base!=="street"?" selected":"")+'>Satellite</option><option value="street"'+(S.map.base==="street"?" selected":"")+'>Streets</option></select>'
    + '<span class="spacer"></span>'
    + (canEdit() ? '<button class="btn ghost" data-act="govtall"'+(GOVT_RUN?" disabled":"")+'>'+(GOVT_RUN?"Fetching govt boundaries…":"Fetch govt boundaries")+'</button><button class="btn ghost" data-act="geoall"'+(GEO_RUN?" disabled":"")+'>'+(GEO_RUN?"Locating…":"Locate villages")+'</button>' : "")
    + '</div><div id="mapHits"></div>' + drawTools + '<div id="mapbox"></div>'
    + '<p class="mapfoot" id="geoProg">'+located.length+' of '+list.length+' parcels on the map · '+govt+' with the government boundary (green) · '+drawn+' drawn by hand (teal) · '+(list.length-located.length)+' not located yet</p>'
    + '<p class="mapfoot">Government boundaries come from the state Bhunaksha portal by village and gat number and outline the whole gat, which may hold several khatas. Village pins (amber) come from OpenStreetMap. To mark a plot exactly, choose it above and tap its corners on the satellite view, walk it with GPS, or import a KML from Google Earth.</p></div>';
}
var MAPLAYERS = {};   // parcel id → leaflet layer, for the search
function mapSearch(){
  var q = (S.map.q||"").trim().toLowerCase(), box = $("mapHits"); if (!box) return;
  if (!q){ box.innerHTML = ""; return; }
  var hits = mapList().filter(function(p){ return [p.sr, p.location, p.survey, p.owner, p.district, p.taluka].some(function(v){ return String(v||"").toLowerCase().indexOf(q) > -1; }); });
  var located = hits.filter(function(p){ return geoOf(p); });
  if (!hits.length){ box.innerHTML = '<p class="prose small dim" style="margin:0">Nothing matches.</p>'; return; }
  box.innerHTML = '<div class="chips">' + located.slice(0,30).map(function(p){ return '<button class="chip" data-mapgo="'+p.id+'">SR '+esc(p.sr)+' · '+esc(p.survey||"")+' · '+esc(p.location)+(p.geo&&p.geo.src==="govt"?" ■":"")+'</button>'; }).join("")
    + (hits.length - located.length ? '<span class="prose small dim" style="align-self:center">'+(hits.length-located.length)+' match'+(hits.length-located.length===1?"":"es")+' not on the map</span>' : "")
    + (located.length > 30 ? '<span class="prose small dim" style="align-self:center">+'+(located.length-30)+' more</span>' : "") + '</div>';
  if (MAP && located.length){
    var pts = []; located.forEach(function(p){ var poly = polyOf(p); if (poly) poly.forEach(function(x){ pts.push(x); }); else { var g = geoOf(p); pts.push([g.lat, g.lng]); } });
    MAP.fitBounds(pts, {padding:[40,40], maxZoom:16});
    if (located.length === 1 && MAPLAYERS[located[0].id]) MAPLAYERS[located[0].id].openPopup();
  }
}
function mapGo(id){
  var p = byId(id), lay = MAPLAYERS[id]; if (!p || !MAP) return;
  var poly = polyOf(p); if (poly) MAP.fitBounds(poly, {padding:[40,40], maxZoom:17}); else { var g = geoOf(p); if (g) MAP.setView([g.lat, g.lng], 15); }
  if (lay) lay.openPopup();
}
function paintMap(){
  var box = $("mapbox"); if (!box || !window.L) return;
  MAPLAYERS = {};
  MAP = L.map("mapbox", {scrollWheelZoom:false});
  var street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, attribution:"&copy; OpenStreetMap contributors"});
  var sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:19, attribution:"Imagery &copy; Esri, Maxar, Earthstar Geographics"});
  var labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {maxZoom:19});
  if (S.map.base === "street") street.addTo(MAP); else { sat.addTo(MAP); labels.addTo(MAP); }
  MAP._bases = {street:street, sat:sat, labels:labels};
  var pts = [], groups = {};
  mapList().forEach(function(p){
    var poly = polyOf(p);
    if (poly){
      var a = polyArea(poly), m0 = sqm(p), isGovt = p.geo.src === "govt", col = isGovt ? "#2E8C3A" : "#2E8080";
      var lay = L.polygon(poly, {color:col, weight:2, fillColor:col, fillOpacity:.25}).addTo(MAP);
      lay.bindPopup('<b>SR '+esc(p.sr)+' · gat '+esc(p.survey||"")+'</b>'+esc(p.location)+' · '+esc(p.owner)+'<br>'+(isGovt?"Government boundary of the whole gat: ":"Drawn: ")+fmtArea(a/SQM.ACRE)+' acre'+(m0!==null?' · our parcel on sheet: '+fmtArea(m0/SQM.ACRE)+' acre':"")+'<br><a href="#" data-view="'+p.id+'">Open parcel</a>');
      MAPLAYERS[p.id] = lay;
      poly.forEach(function(q){ pts.push(q); }); return;
    }
    var g = geoOf(p); if (!g) return;
    var k = g.lat.toFixed(5)+","+g.lng.toFixed(5); groups[k] = groups[k] || {lat:g.lat, lng:g.lng, src:g.src, list:[]}; groups[k].list.push(p);
  });
  Object.keys(groups).forEach(function(k){
    var grp = groups[k], area = sumSqm(grp.list), col = grp.src === "pin" ? "#2E8080" : "#E0A44A";
    var m = L.circleMarker([grp.lat, grp.lng], {radius:Math.min(22, 6 + Math.sqrt(area/4046.86)*1.6), color:col, weight:2, fillColor:col, fillOpacity:.35}).addTo(MAP);
    m.bindPopup('<b>'+esc(grp.list[0].location)+'</b>'+grp.list.length+' parcel'+(grp.list.length===1?"":"s")+' · '+fmtArea(area/SQM.ACRE)+' acre'+(grp.src==="pin"?' · plot pin':' · village')+'<br>'+grp.list.slice(0,6).map(function(p){ return '<a href="#" data-view="'+p.id+'">SR '+esc(p.sr)+' '+esc(p.survey||"")+'</a>'; }).join(" · ")+(grp.list.length>6?' …':""));
    grp.list.forEach(function(p){ MAPLAYERS[p.id] = m; });
    pts.push([grp.lat, grp.lng]);
  });
  if (pts.length) MAP.fitBounds(pts, {padding:[30,30], maxZoom:12}); else MAP.setView([19.5, 76.0], 6);
  MAP.on("click", function(ev){ if (DRAW && DRAW.active) drawAdd([ev.latlng.lat, ev.latlng.lng]); });
  if (DRAW) drawPaint();
  if (S.map.q) mapSearch();
}
function drawTarget(){
  var sel = $("drawSel"), id = sel ? sel.value : "";
  if (!id){ toast("Choose the parcel to demarcate first", "warn"); return null; }
  if (!DRAW || DRAW.id !== id){ var p = byId(id), poly = polyOf(p); DRAW = {id:id, pts:(poly && p.geo.src !== "govt") ? poly.slice() : [], layer:null, marks:[], active:false}; }
  return DRAW;
}
function drawAdd(pt){ DRAW.pts.push(pt); drawPaint(); }
function drawPaint(){
  if (!MAP || !window.L || !DRAW) return;
  if (DRAW.layer){ MAP.removeLayer(DRAW.layer); DRAW.layer = null; }
  DRAW.marks.forEach(function(m){ MAP.removeLayer(m); }); DRAW.marks = [];
  DRAW.pts.forEach(function(q, i){ DRAW.marks.push(L.circleMarker(q, {radius:5, color:"#fff", weight:2, fillColor:"#B03A2E", fillOpacity:1}).bindTooltip(String(i+1), {permanent:true, direction:"top", offset:[0,-6]}).addTo(MAP)); });
  if (DRAW.pts.length >= 2) DRAW.layer = (DRAW.pts.length >= 3 ? L.polygon(DRAW.pts, {color:"#B03A2E", weight:2, dashArray:"6 4", fillOpacity:.2}) : L.polyline(DRAW.pts, {color:"#B03A2E", weight:2, dashArray:"6 4"})).addTo(MAP);
  var p = byId(DRAW.id), st = $("drawState");
  if (st){ var a = polyArea(DRAW.pts), m0 = sqm(p); st.textContent = (DRAW.active ? "Tap each corner in order · " : "") + DRAW.pts.length + " corner" + (DRAW.pts.length===1?"":"s") + (DRAW.pts.length >= 3 ? " · " + fmtArea(a/SQM.ACRE) + " acre drawn" + (m0!==null ? " vs " + fmtArea(m0/SQM.ACRE) + " on sheet" : "") : ""); }
}
function drawFinish(){
  if (!DRAW) return; var p = byId(DRAW.id);
  if (DRAW.pts.length < 3){ toast("A boundary needs at least three corners", "warn"); return; }
  var poly = DRAW.pts.map(function(q){ return [Number(q[0].toFixed(6)), Number(q[1].toFixed(6))]; }), c = centroid(poly);
  var geo = {lat:Number(c[0].toFixed(6)), lng:Number(c[1].toFixed(6)), poly:poly, src:"pin", at:today()};
  var a = polyArea(poly), m0 = sqm(p); DRAW = null;
  patchParcel(p.id, {geo:geo}).then(function(){ render(); toast("Boundary saved: "+fmtArea(a/SQM.ACRE)+" acre"+(m0!==null ? " ("+fmtArea(m0/SQM.ACRE)+" on sheet)" : "")); }).catch(function(e){ toast(e.message, "warn"); });
}
function parseBoundary(text){
  text = String(text||"");
  try { var j = JSON.parse(text), geom = null; var walk = function(o){ if (!o || geom) return; if (o.type==="Polygon") geom = o; else if (o.type==="Feature") walk(o.geometry); else if (o.features) o.features.forEach(walk); else if (o.geometries) o.geometries.forEach(walk); }; walk(j); if (geom) return geom.coordinates[0].map(function(c){ return [Number(c[1]), Number(c[0])]; }); } catch(e){}
  var m = text.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (m){ var pts = m[1].trim().split(/\s+/).map(function(s){ var c = s.split(","); return [Number(c[1]), Number(c[0])]; }).filter(function(c){ return !isNaN(c[0]) && !isNaN(c[1]); }); if (pts.length >= 3) return pts; }
  return null;
}

/* ─── valuation ─── */
function viewValuation(){
  var owners = uniq(S.parcels.map(function(p){return p.owner;}));
  return '<div class="stack"><div id="valStats"></div><div class="filters"><input class="search" id="valQ" placeholder="Search parcel…" value="'+esc(S.val.q)+'">'
    + '<select id="valOnly"><option value="pending"'+(S.val.only==="pending"?" selected":"")+'>Still to price</option><option value="priced"'+(S.val.only==="priced"?" selected":"")+'>Priced</option><option value="all"'+(S.val.only==="all"?" selected":"")+'>All parcels</option></select>'
    + '<select id="valOwner"><option value="all">All owners</option>'+owners.map(function(o){ return '<option'+(o===S.val.owner?" selected":"")+'>'+esc(o)+'</option>'; }).join("")+'</select></div>'
    + (canEdit() ? '<p class="prose small dim">Type a figure and click away — each one saves on its own.</p>' : '')+'<div id="valResults"></div></div>';
}
function valList(){
  var f = S.val, q = f.q.trim().toLowerCase();
  return S.parcels.filter(function(p){
    if (f.only === "pending" && hasNum(p.price)) return false;
    if (f.only === "priced" && !hasNum(p.price)) return false;
    if (f.owner !== "all" && p.owner !== f.owner) return false;
    if (!q) return true;
    return [p.sr,p.owner,p.location,p.survey].some(function(v){ return String(v||"").toLowerCase().indexOf(q) > -1; });
  }).sort(function(a,b){ return (Number(a.sr)||0) - (Number(b.sr)||0); });
}
function paintValStats(){
  var priced = S.parcels.filter(function(p){ return hasNum(p.price); }), valued = S.parcels.filter(function(p){ return hasNum(p.value); });
  var cost = priced.reduce(function(s,p){ return s+Number(p.price); }, 0), val = valued.reduce(function(s,p){ return s+Number(p.value); }, 0);
  var both = S.parcels.filter(function(p){ return hasNum(p.price) && hasNum(p.value); }), gain = both.reduce(function(s,p){ return s + Number(p.value) - Number(p.price); }, 0);
  $("valStats").innerHTML = '<section class="stats">'+stat("Purchase price entered", priced.length ? money(cost) : "—", priced.length+" of "+S.parcels.length+" parcels", "", dk("Priced parcels","",priced))+stat("Current value entered", valued.length ? money(val) : "—", valued.length+" parcels", "", dk("Valued parcels","",valued))+stat("Unrealised gain", both.length ? money(gain) : "—", "on "+both.length+" parcels with both figures", gain>=0?"up":"down", dk("Parcels with price and value","",both))+stat("Still to price", String(S.parcels.length-priced.length), "parcels without a purchase price", "", dk("Still to price","",S.parcels.filter(function(p){return !hasNum(p.price);})))+'</section>';
}
function paintValuation(){
  paintValStats();
  var list = valList(), PER = 50, pages = Math.max(1, Math.ceil(list.length/PER)); if (S.val.page > pages) S.val.page = pages;
  var shown = list.slice((S.val.page-1)*PER, S.val.page*PER), ed = canEdit();
  var html = '<div class="resultbar"><span>'+list.length+' parcels</span>'+(pages>1?'<span class="pager"><button class="btn tiny ghost" data-vpage="-1"'+(S.val.page===1?" disabled":"")+'>Previous</button><b>'+S.val.page+' / '+pages+'</b><button class="btn tiny ghost" data-vpage="1"'+(S.val.page===pages?" disabled":"")+'>Next</button></span>':"")+'</div>';
  html += '<div class="tablewrap desk"><table class="tbl compact"><thead><tr><th>SR</th><th>Parcel</th><th>Owner</th><th class="r">Area</th><th class="r">Purchase price '+symbol()+'</th><th class="r">Current value '+symbol()+'</th><th class="r">Gain</th></tr></thead><tbody>'
    + shown.map(function(p){ var g = (hasNum(p.price)&&hasNum(p.value)) ? Number(p.value)-Number(p.price) : null;
      return '<tr><td><span class="tagchip sm">'+esc(p.sr)+'</span></td><td><a href="#" data-view="'+p.id+'">'+esc(p.survey||"—")+' · '+esc(p.location)+'</a></td><td>'+esc(p.owner)+'</td><td class="r num">'+(p.area===null?"—":fmtArea(p.area)+" "+UNIT_SHORT[p.unit])+'</td>'
        + '<td class="r">'+(ed?'<input class="cell" type="number" inputmode="decimal" min="0" data-field="price" data-pid="'+p.id+'" value="'+(hasNum(p.price)?p.price:"")+'" placeholder="—">':'<span class="num">'+(hasNum(p.price)?money(p.price):"—")+'</span>')+'</td>'
        + '<td class="r">'+(ed?'<input class="cell" type="number" inputmode="decimal" min="0" data-field="value" data-pid="'+p.id+'" value="'+(hasNum(p.value)?p.value:"")+'" placeholder="—">':'<span class="num">'+(hasNum(p.value)?money(p.value):"—")+'</span>')+'</td>'
        + '<td class="r num strong '+(g===null?"dim":(g>=0?"up":"down"))+'">'+(g===null?"—":(g<0?"("+money(Math.abs(g))+")":money(g)))+'</td></tr>';
    }).join("") + '</tbody></table></div>';
  html += '<div class="cards">' + shown.map(function(p){ return '<article class="acard"><div class="acard-t"><span class="tagchip">SR '+esc(p.sr)+'</span></div><h4>'+esc(p.survey||"—")+' · '+esc(p.location)+'</h4><div class="acard-g"><span><em>Price</em>'+(ed?'<input class="cell" type="number" inputmode="decimal" data-field="price" data-pid="'+p.id+'" value="'+(hasNum(p.price)?p.price:"")+'">':'<b>'+money(p.price)+'</b>')+'</span><span><em>Value</em>'+(ed?'<input class="cell" type="number" inputmode="decimal" data-field="value" data-pid="'+p.id+'" value="'+(hasNum(p.value)?p.value:"")+'">':'<b>'+money(p.value)+'</b>')+'</span></div></article>'; }).join("") + '</div>';
  $("valResults").innerHTML = html;
}

/* ─── analytics ─── */
function viewAnalytics(){
  var H = held(), au = S.settings.areaUnit;
  var byUnit = {}, byCharge = {}, bySize = {"under 1 acre":[], "1 – 5 acre":[], "5 – 10 acre":[], "over 10 acre":[], "no area":[]};
  H.forEach(function(p){ byUnit[UNIT_LABEL[p.unit]] = (byUnit[UNIT_LABEL[p.unit]]||0)+1; var m = sqm(p); if (m===null) bySize["no area"].push(p); else { var ac = m/SQM.ACRE; (ac<1?bySize["under 1 acre"]:ac<5?bySize["1 – 5 acre"]:ac<10?bySize["5 – 10 acre"]:bySize["over 10 acre"]).push(p); } if (p.mortgage){ var l = p.mortgage.replace(/\s*(BR|BRANCH|BR\.)\b.*$/i,"").trim(); (byCharge[l] = byCharge[l]||[]).push(p); } });
  var chargeRows = Object.keys(byCharge).map(function(k){ return {name:k, value:sumSqm(byCharge[k]), label:byCharge[k].length+" parcels · "+fmtArea(areaIn(sumSqm(byCharge[k]),au))+" "+UNIT_SHORT[au], attr:dk("Charge · "+k, "", byCharge[k])}; }).sort(function(a,b){ return b.value-a.value; });
  var sizeRows = Object.keys(bySize).map(function(k){ return {name:k, value:bySize[k].length, legend:bySize[k].length+" parcels", attr:dk("Size · "+k, "", bySize[k])}; });
  var unitRows = Object.keys(byUnit).map(function(k){ return {name:k, value:byUnit[k], legend:byUnit[k]+"", attr:dk("Unit · "+k, "", H.filter(function(p){ return UNIT_LABEL[p.unit]===k; }))}; });
  var stateRows = {}; H.forEach(function(p){ var k = stateName(stateOf(p)); (stateRows[k] = stateRows[k]||[]).push(p); });
  return '<div class="stack"><div class="grid2">'+panel("Charges by lender", "Area under each charge — tap to see the parcels", bars(chargeRows, "#B03A2E"))+panel("Parcels by size", "", donut(sizeRows))+'</div>'
    + '<div class="grid2">'+panel("Units on the sheet", "How areas were recorded", donut(unitRows))+panel("Parcels by state", "", donut(Object.keys(stateRows).map(function(k){ return {name:k, value:stateRows[k].length, legend:stateRows[k].length+"", attr:dk("State · "+k, "", stateRows[k])}; })))+'</div></div>';
}

/* ─── disposals ─── */
function viewDisposals(){
  var L2 = soldList().sort(function(a,b){ return String(b.saleDate||"").localeCompare(String(a.saleDate||"")); });
  if (!L2.length) return '<p class="empty big">No parcels have been recorded as sold or transferred.</p>';
  var got = L2.reduce(function(s,p){ return s+(Number(p.salePrice)||0); }, 0), both = L2.filter(function(p){ return hasNum(p.price); }), gain = both.reduce(function(s,p){ return s+(Number(p.salePrice)||0)-Number(p.price); }, 0);
  return '<div class="stack"><section class="stats">'+stat("Parcels disposed", String(L2.length), fmtArea(areaIn(sumSqm(L2),"ACRE"))+" acre released", "", dk("Disposed parcels","",L2))+stat("Amount received", money(got), "", "")+stat("Gain booked", both.length?money(gain):"—", "on "+both.length+" with a purchase price", gain>=0?"up":"down")+'</section>'
    + panel("Disposals", "", '<div class="tablewrap"><table class="tbl"><thead><tr><th>SR</th><th>Parcel</th><th>Owner</th><th>What</th><th>Date</th><th>To</th><th class="r">Received</th><th class="r">Gain</th><th></th></tr></thead><tbody>'
      + L2.map(function(p){ var g = hasNum(p.price) ? (Number(p.salePrice)||0)-Number(p.price) : null; return '<tr class="click" data-view="'+p.id+'"><td><span class="tagchip sm">'+esc(p.sr)+'</span></td><td>'+esc(p.survey||"—")+' · '+esc(p.location)+'</td><td>'+esc(p.owner)+'</td><td>'+esc(p.saleType)+'</td><td class="num">'+esc(p.saleDate)+'</td><td>'+esc(p.buyer||"—")+'</td><td class="r num">'+money(p.salePrice)+'</td><td class="r num '+(g===null?"dim":g>=0?"up":"down")+'">'+(g===null?"—":money(g))+'</td><td class="act">'+(canEdit()?'<button class="btn tiny ghost" data-undo="'+p.id+'">Return to holdings</button>':"")+'</td></tr>'; }).join("")
      + '</tbody></table></div>')+'</div>';
}

/* ─── settings ─── */
function viewSettings(){
  var s = S.settings;
  return '<div class="stack narrow">'
  + panel("Register details", "Shown across the app and on exports", '<div class="form"><div class="f3">'+fld("Name on the register", '<input id="setName" value="'+esc(s.company||"")+'"'+(isAdmin()?"":" disabled")+'>')+fld("Currency", '<select id="setCur"'+(isAdmin()?"":" disabled")+'>'+CURRENCIES.map(function(c){ return '<option value="'+c.code+'"'+(c.code===s.currency?" selected":"")+'>'+esc(c.label)+'</option>'; }).join("")+'</select>')+fld("Report area in", '<select id="setArea"'+(isAdmin()?"":" disabled")+'>'+["ACRE","HECTARE","ARE","GUNTHA","SQM"].map(function(u){ return '<option value="'+u+'"'+(u===s.areaUnit?" selected":"")+'>'+esc(UNIT_LABEL[u])+'</option>'; }).join("")+'</select>')+'</div></div>')
  + (isAdmin() ? panel("Users", "Admins edit everything and manage users; editors change parcels, records and documents; viewers only look.", '<div id="userBox"><p class="prose small dim">Loading…</p></div>') : "")
  + panel("Data", "", '<div class="datarow"><a class="btn ghost" href="/api/export.csv">Export register (CSV)</a>'+(canEdit()?'<button class="btn ghost" data-act="merge">Merge records file</button><input type="file" id="mergeIn" accept="application/json,.json" style="display:none">':"")+'</div><p class="prose small" style="margin-top:12px">Everything lives on the server now — no browser storage, no publish step. Changes are visible to everyone on their next load. <b>Merge records file</b> takes the JSON made from a 7/12 pull and adds those records to the matching SR numbers.</p>')
  + panel("How title records and the map work", "", '<ul class="prose bullets">'
      + '<li>Each parcel carries its state’s title record — 7/12 in Maharashtra, khasra/B-1 in Madhya Pradesh, pahani or adangal in the south, jamabandi in Rajasthan. The state is guessed from the village until confirmed on the parcel.</li>'
      + '<li>Maharashtra, MP and Rajasthan publish the plot boundary and the owner list on their Bhunaksha map portals without a captcha. <b>Fetch govt boundaries</b> pulls both for every parcel whose village code is known, and the owner list is compared with the sheet.</li>'
      + '<li>The 7/12 image itself sits behind a captcha (free, watermarked) or costs ₹15 as a signed copy. Those are pulled with you present and filed against the parcel with our entries highlighted.</li>'
      + '<li>Documents uploaded to a property are read page by page; parties, dates, survey numbers, consideration, encumbrances and observations are shown on the property. Observations are the reader’s; verify against the page it cites.</li>'
      + '</ul>')
  + panel("Activity", "Last 200 changes", '<div id="auditBox"><p class="prose small dim">Loading…</p></div>')
  + '</div>';
}
function paintSettings(){
  if (isAdmin()) api("GET", "/api/users").then(function(users){
    $("userBox").innerHTML = '<div class="tablewrap"><table class="tbl compact"><thead><tr><th>User</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody>'+users.map(function(u){ return '<tr><td class="num">'+esc(u.username)+'</td><td>'+esc(u.name||"")+'</td><td>'+esc(u.role)+'</td><td class="act">'+(u.username!=="admin"?'<button class="btn tiny ghost" data-deluser="'+u.id+'">Remove</button>':"")+'</td></tr>'; }).join("")+'</tbody></table></div>'
      + '<div class="rule" style="margin-top:14px"><span>Add or reset a user</span></div><div class="f3" style="margin-top:10px">'+fld("Username", '<input id="nuU" autocapitalize="none">')+fld("Password", '<input id="nuP" type="password">')+fld("Role", '<select id="nuR"><option value="viewer">viewer</option><option value="editor">editor</option><option value="admin">admin</option></select>')+'</div><div class="row-end"><button class="btn solid tiny" data-act="adduser">Save user</button></div>';
  });
  api("GET", "/api/audit").then(function(rows){
    $("auditBox").innerHTML = rows.length ? '<ul class="lifelist">'+rows.slice(0,60).map(function(a){ return '<li><button '+(a.parcel_id?'data-view="'+a.parcel_id+'"':"")+'><span class="tagchip sm">'+esc(a.what)+'</span><span class="ll-name">'+esc(a.who)+(a.detail?' · '+esc(JSON.stringify(a.detail).slice(0,80)):"")+'</span><span class="ll-left">'+fmtDate(a.at)+'</span><span></span></button></li>'; }).join("")+'</ul>' : '<p class="empty">Nothing yet.</p>';
  });
}
