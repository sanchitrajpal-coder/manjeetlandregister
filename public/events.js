/* Manjeet Land Register — events and boot */
document.addEventListener("click", function(ev){
  var t = ev.target.closest ? ev.target.closest("[data-tab],[data-act],[data-view],[data-edit],[data-sell],[data-del],[data-undo],[data-page],[data-vpage],[data-rpage],[data-xpage],[data-close],[data-save],[data-dosell],[data-confirm],[data-drill],[data-sub],[data-group],[data-back],[data-dpage],[data-dcsv],[data-rec],[data-saverec],[data-recdel],[data-locate],[data-govt],[data-draw],[data-upload],[data-dropzone],[data-deldoc],[data-reread],[data-deluser],[data-recimg],[data-mapgo]") : null;
  if (!t) return;
  var d = t.dataset;
  if (t.tagName === "A" && t.getAttribute("href") === "#") ev.preventDefault();
  if (d.close !== undefined && (t.classList.contains("scrim") ? ev.target === t : true)) { closeModal(); return; }
  if (d.back !== undefined) { popFrame(); return; }
  if (d.drill) { var spec = DRILLS[d.drill]; if (spec) pushFrame({type:"drill", title:spec.title, sub:spec.sub, ids:spec.ids.slice(), group:"parcels", page:1}); return; }
  if (d.sub !== undefined) { var parent = MSTACK[MSTACK.length-1], grp = (DRILLS._sub || [])[Number(d.sub)]; if (grp) pushFrame({type:"drill", title:grp.name, sub:(parent.title || "") + " › " + GROUPS[parent.group].label.replace(/^By /,""), ids:grp.list.map(function(x){ return x.id; }), group:"parcels", page:1}); return; }
  if (d.group) { var fr = MSTACK[MSTACK.length-1]; if (fr){ fr.group = d.group; fr.page = 1; paintFrame(); } return; }
  if (d.dpage) { var fp = MSTACK[MSTACK.length-1]; if (fp){ fp.page = (fp.page||1) + Number(d.dpage); paintFrame(); } return; }
  if (d.dcsv !== undefined) { var fc = MSTACK[MSTACK.length-1]; if (fc) exportCSV(fc.ids.map(byId).filter(Boolean), fc.title); return; }
  if (d.mapgo) { mapGo(d.mapgo); return; }
  if (d.tab) { S.tab = d.tab; render(); return; }
  if (d.view) { openDetail(d.view); return; }
  if (d.edit) { if (!canEdit()) return; closeModal(); openForm(d.edit); return; }
  if (d.sell) { if (!canEdit()) return; closeModal(); openSell(d.sell); return; }
  if (d.save) { if (!canEdit()) return; saveForm(d.save, d.new === "1"); return; }
  if (d.dosell) { if (!canEdit()) return; doSell(d.dosell); return; }
  if (d.rec) { if (!canEdit()) return; closeModal(); openRecordForm(d.rec); return; }
  if (d.saverec) { if (!canEdit()) return; saveRecord(d.saverec); return; }
  if (d.recimg !== undefined) { $("rImgIn").click(); return; }
  if (d.recdel) { if (!canEdit()) return; api("DELETE", "/api/parcels/"+d.recdel+"/record").then(function(){ delete S.records[d.recdel]; closeModal(); render(); openDetail(d.recdel); toast("Record removed"); }); return; }
  if (d.locate) { if (!canEdit()) return; locateParcel(d.locate, false); return; }
  if (d.govt) { if (!canEdit()) return; fetchGovt(d.govt, false); return; }
  if (d.upload) { if (!canEdit()) return; var top = MSTACK[MSTACK.length-1]; if (!top || top.type !== "detail" || top.id !== d.upload){ closeModal(); openDetail(d.upload); } setTimeout(function(){ var inp = document.querySelector('[data-dropinput="'+d.upload+'"]'); if (inp) inp.click(); }, 60); return; }
  if (d.dropzone) { if (ev.target.tagName !== "INPUT"){ var inp2 = t.querySelector("input[type=file]"); if (inp2) inp2.click(); } return; }
  if (d.deldoc) { if (!canEdit()) return; if (!confirm("Delete this document? This cannot be undone.")) return; api("DELETE", "/api/documents/"+d.deldoc).then(function(){ S.docs = S.docs.filter(function(x){ return String(x.id) !== String(d.deldoc); }); paintFrame(); renderShell(); toast("Document deleted"); }); return; }
  if (d.reread) { if (!canEdit()) return; api("POST", "/api/documents/"+d.reread+"/reread").then(function(){ var doc = S.docs.filter(function(x){ return String(x.id) === String(d.reread); })[0]; if (doc) doc.ai_status = "pending"; paintFrame(); pollDocs(); toast("Queued for reading"); }); return; }
  if (d.deluser) { api("DELETE", "/api/users/"+d.deluser).then(function(){ paintSettings(); }); return; }
  if (d.del) { if (!isAdmin()) return; var p = byId(d.del); confirmBox("Delete SR "+p.sr+"?", "The parcel, its record and its documents leave the register permanently. To keep the record but take it out of holdings, record a sale instead.", "Delete parcel", "del", d.del); return; }
  if (d.undo) { if (!canEdit()) return; patchParcel(d.undo, {status:"held", saleType:null, saleDate:null, salePrice:null, buyer:null, saleNote:null}).then(function(){ render(); toast("Returned to holdings"); }); return; }
  if (d.page) { S.reg.page += Number(d.page); paintRegister(); window.scrollTo(0,0); return; }
  if (d.vpage) { S.val.page += Number(d.vpage); paintValuation(); window.scrollTo(0,0); return; }
  if (d.rpage) { S.recs.page += Number(d.rpage); paintRecords(); window.scrollTo(0,0); return; }
  if (d.xpage) { S.dox.page += Number(d.xpage); paintDocuments(); window.scrollTo(0,0); return; }
  if (d.confirm === "del") { api("DELETE", "/api/parcels/"+d.cid).then(function(){ S.parcels = S.parcels.filter(function(x){ return x.id !== d.cid; }); closeModal(); render(); toast("Parcel deleted", "warn"); }); return; }
  if (d.draw) {
    if (!canEdit()) return;
    if (d.draw === "import") { if (drawTarget()) $("kmlIn").click(); return; }
    if (d.draw === "start") { var dt = drawTarget(); if (!dt) return; dt.active = !dt.active; drawPaint(); toast(dt.active ? "Tap the plot's corners on the map in order" : "Tapping paused"); return; }
    if (d.draw === "gps") { var dg = drawTarget(); if (!dg) return; if (!navigator.geolocation){ toast("This browser can't share your position", "warn"); return; }
      navigator.geolocation.getCurrentPosition(function(pos){ drawAdd([pos.coords.latitude, pos.coords.longitude]); toast("Corner "+DRAW.pts.length+" added (±"+Math.round(pos.coords.accuracy)+" m)"); if (MAP) MAP.setView([pos.coords.latitude, pos.coords.longitude], Math.max(MAP.getZoom(), 17)); }, function(){ toast("Position not available — allow location access", "warn"); }, {enableHighAccuracy:true, timeout:20000}); return; }
    if (d.draw === "undo") { if (DRAW && DRAW.pts.length){ DRAW.pts.pop(); drawPaint(); } return; }
    if (d.draw === "clear") { var dc = drawTarget(); if (!dc) return; var cp = byId(dc.id); DRAW = null; if (cp.geo && cp.geo.poly && cp.geo.src !== "govt"){ patchParcel(cp.id, {geo:null}).then(function(){ render(); toast("Boundary cleared"); }); } else { drawPaint(); render(); } return; }
    if (d.draw === "finish") { if (drawTarget()) drawFinish(); return; }
  }
  if (d.act === "logout") { api("POST", "/api/logout").then(function(){ S.user = null; renderLogin(); }); return; }
  if (d.act === "add") { if (!canEdit()) return; openForm(null); return; }
  if (d.act === "merge") { if (!canEdit()) return; $("mergeIn").click(); return; }
  if (d.act === "geoall") { if (!canEdit()) return; locateAll(); render(); return; }
  if (d.act === "govtall") { if (!canEdit()) return; fetchGovtAll(); render(); return; }
  if (d.act === "adduser") { api("POST", "/api/users", {username:$("nuU").value, password:$("nuP").value, role:$("nuR").value}).then(function(){ toast("User saved"); paintSettings(); }).catch(function(e){ toast(e.message, "warn"); }); return; }
});

document.addEventListener("input", function(ev){
  var el = ev.target, id = el.id;
  if (id === "regQ") { S.reg.q = el.value; S.reg.page = 1; paintRegister(); }
  else if (id === "recQ") { S.recs.q = el.value; S.recs.page = 1; paintRecords(); }
  else if (id === "docQ") { S.dox.q = el.value; S.dox.page = 1; paintDocuments(); }
  else if (id === "valQ") { S.val.q = el.value; S.val.page = 1; paintValuation(); }
  else if (id === "mapQ") { S.map.q = el.value; clearTimeout(window._mq); window._mq = setTimeout(mapSearch, 250); }
});
var SETTLE = null;
document.addEventListener("change", function(ev){
  var el = ev.target, id = el.id;
  var regMap = {regStatus:"status", regState:"state", regOwner:"owner", regLoc:"loc", regCharge:"charge", regRec:"rec", regDocs:"docs", regSort:"sort"};
  if (regMap[id]) { S.reg[regMap[id]] = el.value; S.reg.page = 1; paintRegister(); return; }
  if (id === "recState") { S.recs.state = el.value; S.recs.page = 1; paintRecords(); }
  else if (id === "recOnly") { S.recs.only = el.value; S.recs.page = 1; paintRecords(); }
  else if (id === "docState") { S.dox.state = el.value; S.dox.page = 1; paintDocuments(); }
  else if (id === "docOnly") { S.dox.only = el.value; S.dox.page = 1; paintDocuments(); }
  else if (id === "valOnly") { S.val.only = el.value; S.val.page = 1; paintValuation(); }
  else if (id === "valOwner") { S.val.owner = el.value; S.val.page = 1; paintValuation(); }
  else if (id === "mapState") { S.map.state = el.value; render(); }
  else if (id === "mapOnly") { S.map.only = el.value; render(); }
  else if (id === "mapBase") { S.map.base = el.value; if (MAP && MAP._bases){ var B = MAP._bases; if (el.value === "street"){ MAP.removeLayer(B.sat); MAP.removeLayer(B.labels); B.street.addTo(MAP); } else { MAP.removeLayer(B.street); B.sat.addTo(MAP); B.labels.addTo(MAP); } } }
  else if (id === "drawSel") { if (DRAW && DRAW.id !== el.value) DRAW = null; if (el.value) drawTarget(); if (DRAW && DRAW.pts.length && MAP) MAP.fitBounds(DRAW.pts, {padding:[30,30]}); drawPaint(); }
  else if (id === "setName" || id === "setCur" || id === "setArea") { if (!isAdmin()) return; S.settings.company = $("setName").value; S.settings.currency = $("setCur").value; S.settings.areaUnit = $("setArea").value; clearTimeout(SETTLE); SETTLE = setTimeout(function(){ api("PUT", "/api/settings", S.settings).then(function(){ render(); toast("Settings saved"); }); }, 500); }
  else if (id === "mergeIn") { if (el.files && el.files[0]){ var fr = new FileReader(); fr.onload = function(){ try { var j = JSON.parse(fr.result); api("POST", "/api/records/merge", j).then(function(r){ toast("Merged records into "+r.merged+" parcel"+(r.merged===1?"":"s")+(r.missing.length?" · no SR "+r.missing.join(", "):""), r.missing.length?"warn":""); return boot(); }).catch(function(e){ toast(e.message, "warn"); }); } catch(e){ toast("That file isn't a records file", "warn"); } }; fr.readAsText(el.files[0]); } el.value = ""; }
  else if (id === "rImgIn") { if (el.files && el.files[0]){ var fd = new FormData(); fd.append("file", el.files[0]); api("POST", "/api/records/image", fd, true).then(function(r){ $("rImage").value = r.path; toast("Image uploaded"); }).catch(function(e){ toast(e.message, "warn"); }); } el.value = ""; }
  else if (id === "kmlIn") { if (el.files && el.files[0]){ var kr = new FileReader(); kr.onload = function(){ var pts = parseBoundary(kr.result); if (!pts){ toast("No polygon found in that file", "warn"); return; } var dt = drawTarget(); if (!dt) return; dt.pts = pts; dt.active = false; drawPaint(); if (MAP) MAP.fitBounds(pts, {padding:[30,30]}); toast(pts.length+" corners imported — press Save boundary"); }; kr.readAsText(el.files[0]); } el.value = ""; }
  else if (el.dataset && el.dataset.dropinput) { uploadFiles(el.dataset.dropinput, el.files); el.value = ""; }
  else if (el.dataset && el.dataset.field) {
    if (!canEdit()) return; var p = byId(el.dataset.pid); if (!p) return;
    var v = el.value === "" ? null : Number(el.value); if (v !== null && isNaN(v)) return;
    var fields = {}; fields[el.dataset.field] = v;
    patchParcel(p.id, fields).then(function(){ paintValStats(); renderShell(); var row = el.closest("tr"); if (row){ var cell = row.lastElementChild, g = (hasNum(p.price) && hasNum(p.value)) ? Number(p.value) - Number(p.price) : null; cell.className = "r num strong " + (g===null?"dim":(g>=0?"up":"down")); cell.innerHTML = g===null ? "—" : (g<0 ? "("+money(Math.abs(g))+")" : money(g)); } }).catch(function(e){ toast(e.message, "warn"); });
  }
});
/* drag & drop on the property's drop zone */
document.addEventListener("dragover", function(ev){ var z = ev.target.closest && ev.target.closest("[data-dropzone]"); if (z){ ev.preventDefault(); z.classList.add("over"); } });
document.addEventListener("dragleave", function(ev){ var z = ev.target.closest && ev.target.closest("[data-dropzone]"); if (z) z.classList.remove("over"); });
document.addEventListener("drop", function(ev){ var z = ev.target.closest && ev.target.closest("[data-dropzone]"); if (z){ ev.preventDefault(); z.classList.remove("over"); if (!canEdit()) return; uploadFiles(z.dataset.dropzone, ev.dataTransfer.files); } });
document.addEventListener("keydown", function(ev){ if (ev.key !== "Escape") return; if (MSTACK.length > 1) popFrame(); else closeModal(); });

function exportCSV(subset, label){
  var head = ["SR No","ABD file","Sendhwa file","Deed date","Owner","Seller","Village / location","Gut / Khasra","Area","Unit","Area (acre)","Mortgage / charge","Land status","Note","Purchase price","Current value","Status","State","District","Taluka","Record no","Khata","Holders","Record area","Record unit","Record checked","Documents","Lat","Lng"];
  var qq = function(v){ return '"' + String(v === null || v === undefined ? "" : v).replace(/"/g,'""') + '"'; };
  var lines = [head.map(qq).join(",")];
  subset.forEach(function(p){ var m = sqm(p), r = rec(p)||{}, g = geoOf(p);
    lines.push([p.sr,p.abd,p.snd,p.date,p.owner,p.seller,p.location,p.survey,p.area,UNIT_LABEL[p.unit],m===null?"":(m/SQM.ACRE).toFixed(3),p.mortgage,p.landStatus,p.note,p.price,p.value,p.status,stateName(stateOf(p)),p.district,p.taluka,r.no,r.khata,r.holders,r.area,r.unit?RECORD_UNITS[r.unit]:"",r.checked,docsOf(p).length,g?g.lat:"",g?g.lng:""].map(qq).join(",")); });
  var slug = label ? String(label).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) : "";
  download(lines.join("\n"), "land-register"+(slug?"-"+slug:"")+"-"+today()+".csv", "text/csv"); toast(subset.length+" parcels saved as CSV");
}

/* boot */
api("GET", "/api/me").then(function(u){ if (u) return boot(); renderLogin(); }).catch(function(){ renderLogin(); });
document.addEventListener("visibilitychange", function(){ if (!document.hidden && S.user && !POLL) api("GET", "/api/bootstrap").then(function(d){ S.parcels = d.parcels; S.records = d.records; S.docs = d.documents; S.geoCache = d.geoCache; if (!$("modal").firstChild) render(); }).catch(function(){}); });
