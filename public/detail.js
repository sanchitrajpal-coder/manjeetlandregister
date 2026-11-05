/* Manjeet Land Register — parcel detail, record panel, documents panel, forms */
function detailHTML(id){
  var p = byId(id); if (!p) return "";
  var m = sqm(p);
  var meta = [["Owner / purchaser", p.owner], ["Seller", p.seller||"—"], ["Village / location", p.location], ["Gut / Khasra / plot", p.survey||"—"],
    ["State", stateName(stateOf(p))+(stateGuessed(p)?" (guessed)":"")], ["District / taluka", [p.district, p.taluka].filter(Boolean).join(" / ")||"—"],
    ["ABD file no.", p.abd||"—"], ["Sendhwa file no.", p.snd||"—"], ["Deed date", p.date||"not stated on the sheet"],
    ["Area as recorded", p.area===null ? "not stated" : fmtArea(p.area)+" "+UNIT_LABEL[p.unit]],
    ["Converted", m===null ? "—" : fmtArea(m/SQM.ACRE)+" acre · "+fmtArea(m/SQM.HECTARE)+" ha · "+fmtArea(m,0)+" m²"],
    ["Mortgage / charge", p.mortgage||"none noted"], ["Land status", p.landStatus||"—"], ["Marked on sheet", p.marked ? "yellow highlight" : "—"]];
  var saleBlock = "";
  if (p.status !== "held"){ var g = hasNum(p.price) ? (Number(p.salePrice)||0) - Number(p.price) : null;
    saleBlock = '<div class="settle"><div class="settle-line"><span>'+esc(p.saleType)+' on '+esc(p.saleDate)+(p.buyer?' · '+esc(p.buyer):"")+'</span><b>'+money(p.salePrice)+'</b></div>'+(g===null ? "" : '<div class="settle-line result"><span>'+(g>=0?"Gain booked":"Loss booked")+'</span><b class="'+(g>=0?"up":"down")+'">'+money(Math.abs(g))+'</b></div>')+'</div>'; }
  return '<header class="sheet-h"><div><div class="eyebrow">'+backBtn()+'SR '+esc(p.sr)+' · '+esc(stateName(stateOf(p)))+'</div><h2>'+esc((p.survey||"Parcel")+" · "+p.location)+'</h2></div><button class="icon-btn" data-close="1">✕</button></header>'
    + '<div class="sheet-b"><div class="detail">'
    + '<div class="detail-top"><div class="dnum"><em>Area</em><b>'+(p.area===null?"—":fmtArea(p.area)+" "+UNIT_SHORT[p.unit])+'</b></div><div class="dnum"><em>Purchase price</em><b>'+(hasNum(p.price)?money(p.price):'<span class="blank">to be entered</span>')+'</b></div><div class="dnum"><em>Current value</em><b>'+(hasNum(p.value)?money(p.value):'<span class="blank">to be entered</span>')+'</b></div><div class="dnum"><em>Status</em><b>'+(p.status==="held"?"In hand":esc(p.saleType)+" "+esc(p.saleDate))+'</b></div></div>'
    + saleBlock + recordBlock(p) + documentsBlock(p)
    + '<dl class="meta">'+meta.map(function(r){ return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'; }).join("")+'</dl>'
    + (p.note ? '<p class="note">'+esc(p.note)+'</p>' : "") + (p.saleNote ? '<p class="note">'+esc(p.saleNote)+'</p>' : "")
    + '<div class="drillrow"><button class="btn tiny ghost" '+dk("Owner · "+p.owner, "All parcels held by this entity", S.parcels.filter(function(x){return x.owner===p.owner;}))+'>All of '+esc(p.owner)+'</button><button class="btn tiny ghost" '+dk("Location · "+p.location, "Everything at this village or site", S.parcels.filter(function(x){return x.location===p.location;}))+'>All at '+esc(p.location)+'</button>'+(p.mortgage ? '<button class="btn tiny ghost" '+dk("Charge · "+p.mortgage, "", S.parcels.filter(function(x){return x.mortgage===p.mortgage;}))+'>Same charge</button>' : "")+'</div>'
    + (canEdit() ? '<div class="row-end"><button class="btn ghost" data-edit="'+p.id+'">Edit parcel</button>'+(p.status==="held" ? '<button class="btn solid" data-sell="'+p.id+'">Sell parcel</button>' : "")+(isAdmin()?'<button class="btn danger ghostd" data-del="'+p.id+'">Delete</button>':"")+'</div>' : "")
    + '</div></div>';
}

function recordBlock(p){
  var st = S.states[stateOf(p)], r = rec(p), g = geoOf(p), iss = recIssues(p);
  var where = [p.location, p.taluka, p.district, st.name].filter(Boolean).map(esc).join(" · ");
  var body;
  if (!r || (!r.no && !r.holders)){
    body = '<p class="prose small" style="margin:0">No '+esc(st.record)+' on file yet. '+(st.view ? 'Open the portal, enter the '+esc(st.nos.toLowerCase())+' and the captcha, then add the extract here.' : 'Add the record details once you have the extract.')+'</p>';
  } else {
    var rows = [[st.nos, r.no||"—"], ["Khata / account no.", r.khata||"—"], ["Holders on record", r.holders||"—"], ["Area on record", hasNum(r.area) ? fmtArea(r.area)+" "+(RECORD_UNITS[r.unit]||"") : "—"], ["Encumbrance / other rights", r.encumbrance||"none noted"], ["Record dated", r.asOf||"—"], ["Last checked", r.checked||"—"]];
    body = '<dl class="meta">'+rows.map(function(x){ return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>'; }).join("")+'</dl>'+(r.remarks ? '<p class="note">'+esc(r.remarks)+'</p>' : "")
      + (r.image ? '<a class="recimg" href="'+esc(r.image)+'" target="_blank" rel="noopener"><img src="'+esc(r.image)+'" alt="" loading="lazy"><span>'+esc(r.type||"Record")+' as pulled on '+esc(r.checked||"")+' — our entries highlighted · tap to open full size</span></a>' : "");
  }
  var govt = "";
  if (r && r.govtOwners && r.govtOwners.length){
    var toks = nameTokens(p.owner).concat(nameTokens(r.holders||""));
    var ours = function(o){ var n = o.owner.toUpperCase(); return toks.some(function(w){ return n.indexOf(w) > -1; }) || /RAJPAL|राजपाल|MANJEET|मंजीत|SIMAR|सिमर|FRISK|SANKALP|संकल्प/i.test(o.owner); };
    govt = '<div><div class="eyebrow" style="margin:4px 0 6px">Owners on the government map record · '+esc(r.govtChecked||"")+(p.geo&&p.geo.govtArea?' · gat area '+fmtArea(p.geo.govtArea/SQM.HECTARE)+' ha':"")+'</div><div class="govt-owners"><div><span>Khata</span><span>Owner</span><span>Area (ha)</span></div>'
      + r.govtOwners.map(function(o){ return '<div class="'+(ours(o)?"ours":"")+'"><b>'+esc(o.khata)+'</b><span>'+esc(o.owner)+'</span><b>'+(o.area===null?"—":fmtArea(o.area))+'</b></div>'; }).join("")+'</div></div>';
  }
  return '<div class="recbox"><div class="recbox-h"><b>'+esc(r&&r.type ? r.type : st.record)+'</b>'+recChip(p)+'<span class="statechip'+(stateGuessed(p)?" guess":"")+'">'+esc(st.name)+(stateGuessed(p)?" ?":"")+'</span><span class="sp"></span>'
    + (canEdit() ? '<button class="btn tiny solid" data-rec="'+p.id+'">'+(r&&r.no?"Edit record":"Add record")+'</button>' : "")+'</div>'
    + '<div class="recbox-b"><div class="prose small dim" style="margin:0">'+where+(g ? ' · '+(p.geo&&p.geo.src==="govt"?"government boundary":g.src==="pin"?"pinned on map":"village located")+' ('+g.lat.toFixed(4)+', '+g.lng.toFixed(4)+')' : ' · not located yet')+(polyOf(p)&&p.geo.src!=="govt" ? ' · drawn: '+fmtArea(polyArea(polyOf(p))/SQM.ACRE)+' acre' : "")+'</div>'
    + (iss.length ? '<ul class="issues">'+iss.map(function(i){ return '<li class="'+i.k+'">'+esc(i.t)+'</li>'; }).join("")+'</ul>' : "") + body + govt
    + '<div class="drillrow">'+portalBtns(p)+(canEdit() ? (st.bhunaksha ? '<button class="btn tiny ghost" data-govt="'+p.id+'">'+(p.geo&&p.geo.src==="govt"?"Refresh govt boundary & owners":"Fetch govt boundary & owners")+'</button>' : "")+'<button class="btn tiny ghost" data-locate="'+p.id+'">'+(g?"Re-locate village":"Locate village")+'</button>' : "")+'</div></div></div>';
}

function documentsBlock(p){
  var ds = docsOf(p);
  var list = ds.map(function(d){
    var sm = d.ai_summary || {}, st = d.ai_status;
    var status = st === "done" ? "read · "+(sm.pagesRead||d.pages||"?")+" pages" : st === "running" ? "reading… "+(sm.progress||"") : st === "pending" ? "queued for reading" : st === "error" ? "reading failed" : "not read";
    var ai = "";
    if (st === "done" && sm.facts){
      var f = sm.facts;
      ai = '<div class="ai">'+(sm.kinds ? '<div class="ai-kinds">'+Object.keys(sm.kinds).map(function(k){ return '<span>'+esc(k)+' × '+sm.kinds[k]+'</span>'; }).join("")+'</div>' : "")
        + '<div class="facts">'
        + '<div><em>Parties</em>'+((f.parties||[]).length ? '<ul>'+f.parties.slice(0,12).map(function(x){ return '<li>'+esc(x.name)+' <span class="dim">('+esc(x.role)+')</span></li>'; }).join("")+'</ul>' : '<span class="dim">—</span>')+'</div>'
        + '<div><em>Dates</em>'+((f.dates||[]).length ? '<ul>'+f.dates.slice(0,10).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul>' : '<span class="dim">—</span>')+'</div>'
        + '<div><em>Survey / area</em>'+(((f.survey_numbers||[]).length||(f.area||[]).length) ? '<ul>'+(f.survey_numbers||[]).slice(0,8).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+(f.area||[]).slice(0,6).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul>' : '<span class="dim">—</span>')+'</div>'
        + '<div><em>Consideration / registration</em>'+(((f.consideration||[]).length||(f.registration||[]).length) ? '<ul>'+(f.consideration||[]).slice(0,6).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+(f.registration||[]).slice(0,6).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul>' : '<span class="dim">—</span>')+'</div>'
        + ((f.encumbrances||[]).length ? '<div><em>Encumbrances</em><ul>'+f.encumbrances.slice(0,8).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul></div>' : "")
        + ((f.title_chain||[]).length ? '<div><em>Title chain</em><ul>'+f.title_chain.slice(0,8).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join("")+'</ul></div>' : "")
        + '</div>'
        + ((sm.observations||[]).length ? '<ul class="obs">'+sm.observations.map(function(o){ return '<li class="'+esc(o.severity)+'"><span class="sev '+esc(o.severity)+'">'+esc(o.severity)+'</span>'+esc(o.text)+(o.page?'<a href="/api/documents/'+d.id+'/file#page='+o.page+'" target="_blank" rel="noopener">p.'+o.page+'</a>':"")+'</li>'; }).join("")+'</ul>' : '<p class="prose small dim" style="margin:0">No observations raised.</p>')
        + '</div>';
    } else if (st === "error") ai = '<div class="ai"><p class="prose small down" style="margin:0">'+esc(d.ai_error||"failed")+'</p></div>';
    return '<li class="doc"><div class="doc-h"><b>'+esc(d.filename)+'</b><i>'+fmtBytes(d.size)+(d.pages?' · '+d.pages+' pages':"")+' · '+fmtDate(d.uploaded_at)+(d.uploaded_by?' by '+esc(d.uploaded_by):"")+'</i><span class="sp"></span><i>'+status+'</i>'
      + '<a class="btn tiny ghost" href="/api/documents/'+d.id+'/file" target="_blank" rel="noopener">Open</a><a class="btn tiny ghost" href="/api/documents/'+d.id+'/file?dl=1">Download</a>'
      + (canEdit() ? (S.ai && d.mime==="application/pdf" && st!=="running" ? '<button class="btn tiny ghost" data-reread="'+d.id+'">'+(st==="done"?"Re-read":"Read")+'</button>' : "")+'<button class="btn tiny ghost" data-deldoc="'+d.id+'">✕</button>' : "")+'</div>'+ai+'</li>';
  }).join("");
  return '<div class="recbox"><div class="recbox-h"><b>Documents</b>'+docChip(p)+'<span class="sp"></span>'+(canEdit()?'<button class="btn tiny solid" data-upload="'+p.id+'">Upload</button>':"")+'</div>'
    + '<div class="recbox-b">'+(canEdit() ? '<div class="drop" data-dropzone="'+p.id+'"><b>Drop the property’s document set here</b>PDF scans of deeds, 7/12s, NA orders, search reports — any size. Or tap to choose files.<input type="file" multiple accept="application/pdf,image/*" data-dropinput="'+p.id+'" style="display:none"><progress id="up_'+p.id+'" value="0" max="100" style="display:none"></progress></div>' : "")
    + (ds.length ? '<ul class="doclist">'+list+'</ul>' : '<p class="prose small dim" style="margin:0">No documents uploaded for this property yet.</p>')+'</div></div>';
}

function uploadFiles(id, files){
  if (!files || !files.length) return;
  var fd = new FormData(); Array.prototype.forEach.call(files, function(f){ fd.append("files", f); });
  var prog = $("up_"+id); if (prog){ prog.style.display = "block"; prog.value = 0; }
  var xhr = new XMLHttpRequest(); xhr.open("POST", "/api/parcels/"+id+"/documents");
  xhr.upload.onprogress = function(e){ if (prog && e.lengthComputable) prog.value = Math.round(e.loaded/e.total*100); };
  xhr.onload = function(){
    if (xhr.status >= 200 && xhr.status < 300){ var out = JSON.parse(xhr.responseText); out.forEach(function(d){ S.docs.unshift(d); }); toast(out.length+" file"+(out.length===1?"":"s")+" uploaded"+(S.ai?" — reading starts now":"")); render(); openDetail(id); pollDocs(); }
    else { toast("Upload failed: "+xhr.responseText.slice(0,120), "warn"); if (prog) prog.style.display = "none"; }
  };
  xhr.onerror = function(){ toast("Upload failed — are you online?", "warn"); };
  xhr.send(fd);
}
var POLL = null;
function pollDocs(){
  if (POLL) return;
  POLL = setInterval(function(){
    if (!S.docs.some(function(d){ return d.ai_status === "pending" || d.ai_status === "running"; })){ clearInterval(POLL); POLL = null; return; }
    api("GET", "/api/bootstrap").then(function(d){
      var changed = JSON.stringify(d.documents.map(function(x){ return [x.id, x.ai_status, x.ai_summary && x.ai_summary.progress]; })) !== JSON.stringify(S.docs.map(function(x){ return [x.id, x.ai_status, x.ai_summary && x.ai_summary.progress]; }));
      S.docs = d.documents;
      if (changed){ var top = MSTACK[MSTACK.length-1]; if (S.tab === "documents") { $("body").innerHTML = viewDocuments(); paintDocuments(); } if (top && top.type === "detail") paintFrame(); }
    }).catch(function(){});
  }, 6000);
}

/* ─── parcel form ─── */
function openForm(id){
  var p = id ? byId(id) : {id:"n"+Date.now(), sr:Math.max.apply(null, S.parcels.map(function(x){return Number(x.sr)||0;}).concat([0]))+1, abd:"", snd:"", date:"", owner:"", seller:"", location:"", survey:"", area:null, unit:"ACRE", mortgage:"", landStatus:"", note:"", price:null, value:null, status:"held", state:"MH", district:"", taluka:""};
  var units = ["HECTARE","ARE","ACRE","GUNTHA","CENT","SQM","SQFT","SQYD",""];
  openModal(sheetHead(id?"Edit parcel":"New parcel", id ? ("SR "+p.sr+" · "+p.location) : "Add a parcel")
    + '<div class="sheet-b"><div class="form">'
    + '<div class="f3">'+fld("SR no.", '<input class="mono" id="fSr" value="'+esc(p.sr)+'">')+fld("ABD file no.", '<input class="mono" id="fAbd" value="'+esc(p.abd)+'">')+fld("Sendhwa file no.", '<input class="mono" id="fSnd" value="'+esc(p.snd)+'">')+'</div>'
    + '<div class="f2">'+fld("Owner / purchaser", '<input id="fOwner" value="'+esc(p.owner)+'">')+fld("Seller", '<input id="fSeller" value="'+esc(p.seller)+'">')+'</div>'
    + '<div class="f2">'+fld("Village / location", '<input id="fLoc" value="'+esc(p.location)+'">')+fld("Gut / Khasra / plot no.", '<input class="mono" id="fSurvey" value="'+esc(p.survey)+'">')+'</div>'
    + '<div class="f3">'+fld("State", '<select id="fState">'+S.stateOrder.map(function(k){ return '<option value="'+k+'"'+(k===stateOf(p)?" selected":"")+'>'+esc(S.states[k].name)+'</option>'; }).join("")+'</select>')+fld("District", '<input id="fDist" value="'+esc(p.district||"")+'">')+fld("Taluka / tehsil / mandal", '<input id="fTal" value="'+esc(p.taluka||"")+'">')+'</div>'
    + '<div class="f3">'+fld("Area", '<input class="mono" id="fArea" type="number" step="0.01" inputmode="decimal" value="'+(p.area===null||p.area===undefined?"":p.area)+'">')+fld("Unit", '<select id="fUnit">'+units.map(function(u){ return '<option value="'+u+'"'+(u===p.unit?" selected":"")+'>'+esc(UNIT_LABEL[u])+'</option>'; }).join("")+'</select>')+fld("Deed date", '<input class="mono" id="fDate" type="date" value="'+esc(p.date)+'">', "blank if unknown")+'</div>'
    + '<div class="rule"><span>Money</span></div><div class="f2">'+fld("Purchase price "+symbol(), '<input class="mono" id="fPrice" type="number" inputmode="decimal" min="0" value="'+(p.price===null||p.price===undefined?"":p.price)+'">')+fld("Current value "+symbol(), '<input class="mono" id="fValue" type="number" inputmode="decimal" min="0" value="'+(p.value===null||p.value===undefined?"":p.value)+'">')+'</div>'
    + '<div class="rule"><span>Title</span></div><div class="f2">'+fld("Mortgage / charge", '<input id="fMort" value="'+esc(p.mortgage)+'" placeholder="Lender and branch">')+fld("Land status", '<input id="fLs" value="'+esc(p.landStatus)+'" placeholder="NA, agricultural, plot…">')+'</div>'
    + fld("Village code on the state portal", '<input class="mono" id="fVcode" value="'+esc(p.villageCode||"")+'" placeholder="e.g. 271900050237920000">', "needed for government boundaries")
    + fld("Note", '<textarea id="fNote" rows="2">'+esc(p.note)+'</textarea>')
    + '<p class="prose small down" id="formErr" style="display:none"></p>'
    + '<div class="row-end"><button class="btn ghost" data-close="1">Cancel</button><button class="btn solid" data-save="'+p.id+'" data-new="'+(id?0:1)+'">'+(id?"Save changes":"Add parcel")+'</button></div></div></div>', true);
}
function saveForm(id, isNew){
  var owner = $("fOwner").value.trim(), loc = $("fLoc").value.trim(), survey = $("fSurvey").value.trim();
  if (!owner || (!loc && !survey)){ var e = $("formErr"); e.style.display = "block"; e.textContent = !owner ? "Name the owner on the deed." : "Give a village or a gut/khasra number."; return; }
  var num = function(el){ var v = $(el).value; return v === "" ? null : Number(v); };
  var old = isNew ? {} : (byId(id) || {});
  var p = Object.assign({}, old, {id:id, sr:$("fSr").value.trim(), abd:$("fAbd").value.trim(), snd:$("fSnd").value.trim(), date:$("fDate").value, owner:owner, seller:$("fSeller").value.trim(), location:loc||"Not stated",
    survey:survey, area:num("fArea"), unit:$("fUnit").value, mortgage:$("fMort").value.trim(), landStatus:$("fLs").value.trim(), note:$("fNote").value.trim(), price:num("fPrice"), value:num("fValue"),
    status:old.status||"held", state:$("fState").value, district:$("fDist").value.trim(), taluka:$("fTal").value.trim(), villageCode:$("fVcode").value.trim()});
  saveParcel(p).then(function(){ closeModal(); render(); toast(isNew ? "Parcel added" : "Parcel updated"); }).catch(function(e){ toast(e.message, "warn"); });
}

/* ─── title record form ─── */
function openRecordForm(id){
  var p = byId(id); if (!p) return;
  var st = stateOf(p), r = rec(p) || {};
  var stateOpts = S.stateOrder.map(function(k){ return '<option value="'+k+'"'+(k===st?" selected":"")+'>'+esc(S.states[k].name)+'</option>'; }).join("");
  var unitOpts = Object.keys(RECORD_UNITS).map(function(u){ return '<option value="'+u+'"'+(u===(r.unit||"HECTARE")?" selected":"")+'>'+esc(RECORD_UNITS[u])+'</option>'; }).join("");
  openModal(sheetHead("SR "+p.sr+" · "+p.location, (r.no ? "Edit" : "Add")+" title record")
    + '<div class="sheet-b"><div class="form"><div class="rule"><span>Where the land is</span></div>'
    + '<div class="f3">'+fld("State", '<select id="rState">'+stateOpts+'</select>', stateGuessed(p) ? "guessed — confirm" : "")+fld("District", '<input id="rDist" value="'+esc(p.district||"")+'">')+fld("Taluka / tehsil / mandal", '<input id="rTal" value="'+esc(p.taluka||"")+'">')+'</div>'
    + '<div id="rPortal" class="drillrow"></div><div class="rule"><span>The record</span></div>'
    + '<div class="f3">'+fld("Record type", '<input id="rType" value="'+esc(r.type||S.states[st].record)+'">')+fld('<span id="rNoL">'+esc(S.states[st].nos)+'</span>', '<input class="mono" id="rNo" value="'+esc(r.no||p.survey||"")+'">')+fld("Khata / account no.", '<input class="mono" id="rKhata" value="'+esc(r.khata||"")+'">')+'</div>'
    + fld("Holders / occupants named on the record", '<textarea id="rHold" rows="2" placeholder="Names exactly as printed, comma separated">'+esc(r.holders||"")+'</textarea>', "compared against the owner on the sheet")
    + '<div class="f3">'+fld("Area on record", '<input class="mono" id="rArea" type="number" step="0.0001" inputmode="decimal" value="'+(hasNum(r.area)?r.area:"")+'">')+fld("Unit", '<select id="rUnit">'+unitOpts+'</select>')+fld("Record dated", '<input class="mono" id="rAsOf" type="date" value="'+esc(r.asOf||"")+'">')+'</div>'
    + fld("Encumbrance / other rights (bojha, loans, tenancy)", '<textarea id="rEnc" rows="2" placeholder="Leave blank if the record is clear">'+esc(r.encumbrance||"")+'</textarea>')
    + '<div class="f2">'+fld("Link to the saved PDF", '<input id="rLink" value="'+esc(r.link||"")+'" placeholder="Drive / iCloud link, or upload it under Documents">')+fld("Checked on", '<input class="mono" id="rChecked" type="date" value="'+esc(r.checked||today())+'">')+'</div>'
    + fld("Image of the record", '<div class="datarow"><input id="rImage" value="'+esc(r.image||"")+'" placeholder="/records/village-gat.jpg"><button class="btn ghost tiny" data-recimg="1" style="flex:0 0 auto">Upload image</button><input type="file" id="rImgIn" accept="image/*" style="display:none"></div>', "the highlighted 7/12 shown on the parcel")
    + fld("Remarks", '<textarea id="rRem" rows="2">'+esc(r.remarks||"")+'</textarea>')
    + '<p class="prose small down" id="rErr" style="display:none"></p>'
    + '<div class="row-end">'+(r.no || r.holders ? '<button class="btn danger ghostd" data-recdel="'+p.id+'">Remove record</button>' : "")+'<button class="btn ghost" data-close="1">Cancel</button><button class="btn solid" data-saverec="'+p.id+'">Save record</button></div></div></div>', true);
  paintRecPortal();
  $("rState").addEventListener("change", function(){ var k = $("rState").value; $("rNoL").textContent = S.states[k].nos; if (!r.type) $("rType").value = S.states[k].record; paintRecPortal(); });
}
function paintRecPortal(){
  var st = S.states[$("rState").value];
  $("rPortal").innerHTML = (st.view ? '<a class="btn tiny ghost" href="'+st.view+'" target="_blank" rel="noopener">Open '+esc(st.record)+' portal ↗</a>' : "")+(st.signed ? '<a class="btn tiny ghost" href="'+st.signed+'" target="_blank" rel="noopener">Digitally signed copy ↗</a>' : "")+(st.map ? '<a class="btn tiny ghost" href="'+st.map+'" target="_blank" rel="noopener">Cadastral map ↗</a>' : "")+(st.fee ? '<span class="prose small dim" style="align-self:center">'+esc(st.fee)+' · login and captcha on the portal</span>' : "");
}
function saveRecord(id){
  var p = byId(id); if (!p) return;
  var num = function(el){ var v = $(el).value.trim(); return v === "" ? null : Number(v); };
  var r = {type:$("rType").value.trim(), no:$("rNo").value.trim(), khata:$("rKhata").value.trim(), holders:$("rHold").value.trim(), area:num("rArea"), unit:$("rUnit").value, asOf:$("rAsOf").value, encumbrance:$("rEnc").value.trim(), link:$("rLink").value.trim(), checked:$("rChecked").value || today(), remarks:$("rRem").value.trim(), image:$("rImage").value.trim(),
    state:$("rState").value, district:$("rDist").value.trim(), taluka:$("rTal").value.trim()};
  api("PUT", "/api/parcels/"+id+"/record", r).then(function(nr){
    S.records[id] = Object.assign({}, S.records[id]||{}, nr); p.state = r.state; p.stateGuessed = false; p.district = r.district; p.taluka = r.taluka;
    closeModal(); render(); openDetail(id); toast("Title record saved");
  }).catch(function(e){ toast(e.message, "warn"); });
}

function openSell(id){
  var p = byId(id); if (!p) return;
  openModal(sheetHead("SR "+p.sr+" · "+p.owner, "Sell "+(p.survey||"parcel")+" · "+p.location)
    + '<div class="sheet-b"><div class="form"><div class="f2">'+fld("What happened", '<select id="sType">'+["Sold","Transferred","Acquired by government","Gifted","Exchanged"].map(function(o){ return '<option>'+o+'</option>'; }).join("")+'</select>')+fld("Date", '<input class="mono" id="sDate" type="date" value="'+today()+'">')+'</div>'
    + '<div class="f2">'+fld("Amount received "+symbol(), '<input class="mono" id="sPrice" type="number" inputmode="decimal" min="0" placeholder="0">')+fld("Sold to", '<input id="sBuyer" placeholder="Buyer name">')+'</div>'
    + fld("Note", '<input id="sNote" placeholder="Registration no., payment mode, share sold">')
    + '<div class="settle"><div class="settle-line"><span>Area released</span><b>'+(p.area===null?"—":fmtArea(p.area)+" "+UNIT_LABEL[p.unit])+'</b></div><div class="settle-line minus"><span>Purchase price on record</span><b>'+(hasNum(p.price)?money(p.price):"not entered yet")+'</b></div></div>'
    + '<div class="row-end"><button class="btn ghost" data-close="1">Cancel</button><button class="btn solid" data-dosell="'+p.id+'">Record sale</button></div></div></div>');
}
function doSell(id){
  var p = byId(id); if (!p) return;
  patchParcel(id, {status:"sold", saleType:$("sType").value, saleDate:$("sDate").value || today(), salePrice:Number($("sPrice").value) || 0, buyer:$("sBuyer").value.trim(), saleNote:$("sNote").value.trim()})
    .then(function(){ closeModal(); render(); toast("SR "+p.sr+" recorded as "+$("sType").value.toLowerCase()); }).catch(function(e){ toast(e.message, "warn"); });
}
