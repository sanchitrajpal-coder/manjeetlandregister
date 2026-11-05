// Rough Devanagari → Latin romaniser and a consonant-skeleton matcher, so
// "GIRNERATANDA" finds "गिरनेरा तांडा" without hand mapping every village.
const V = { "अ":"a","आ":"a","इ":"i","ई":"i","उ":"u","ऊ":"u","ए":"e","ऐ":"ai","ओ":"o","औ":"au","ऋ":"ri","ॲ":"a","ऑ":"o" };
const M = { "ा":"a","ि":"i","ी":"i","ु":"u","ू":"u","े":"e","ै":"ai","ो":"o","ौ":"au","ृ":"ri","ॅ":"a","ॉ":"o","ं":"n","ँ":"n","ः":"" };
const C = { "क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"n","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"n","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","ळ":"l","क्ष":"ksh","ज्ञ":"dny","ड़":"d","ढ़":"dh","ऱ":"r","य़":"y" };
function roman(s) {
  let out = "", i = 0;
  s = String(s || "").normalize("NFC");
  while (i < s.length) {
    const ch = s[i], two = s.slice(i, i + 2);
    if (C[two]) { out += C[two]; i += 2; }
    else if (C[ch]) { out += C[ch]; i++; if (s[i] === "्") { i++; continue; } if (!M[s[i]] && s[i] !== "्") out += "a"; }
    else if (V[ch]) { out += V[ch]; i++; }
    else if (M[ch]) { out += M[ch]; i++; }
    else if (ch === "्" || ch === "़") { i++; }
    else { out += ch; i++; }
  }
  return out;
}
/* consonant skeleton: drop vowels and h, collapse doubles, v≈w, ph≈f */
function skel(s) {
  return String(s || "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-zऀ-ॿ ]+/g, " ")
    .split(/\s+/).filter(Boolean).map(w => {
      let r = /[ऀ-ॿ]/.test(w) ? roman(w) : w;
      r = r.replace(/w/g, "v").replace(/ph/g, "f").replace(/ck/g, "k").replace(/q/g, "k").replace(/z/g, "j").replace(/x/g, "ks");
      r = r.replace(/gaon$|ganv$|gav$|gam$/, "gv").replace(/pur$|pura$/, "pr").replace(/wadi$|vadi$/, "vd");   // village suffixes
      r = r.replace(/h/g, "").replace(/[aeiou]/g, "");
      r = r.replace(/nv$/, "v").replace(/m(?=[pb])/g, "n");     // anusvara vs m
      r = r.replace(/(.)\1+/g, "$1");
      return r;
    }).join(" ");
}
/* score 0..1 for how well the sheet's name matches a portal name */
function score(sheet, portal) {
  const a = skel(sheet).split(" ").filter(Boolean), b = skel(portal).split(" ").filter(Boolean);
  if (!a.length || !b.length) return 0;
  // first word must match closely; extra words (khurd/budruk/tanda) help
  const joinA = a.join(""), joinB = b.join("");
  if (joinA === joinB) return 1.1;
  const A = a[0], B = b[0];
  const sim = (x, y) => { // 1 - normalised edit distance
    const m = x.length, n = y.length; if (!m || !n) return 0; const dp = Array.from({length:m+1}, (_, i) => [i].concat(Array(n).fill(0)));
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (x[i-1] === y[j-1] ? 0 : 1));
    return 1 - dp[m][n] / Math.max(m, n); };
  let s = A === B ? 1 : (joinA === joinB ? 1 : 0);
  if (!s) { const sm = Math.max(sim(A, B), sim(joinA, joinB)); if (sm >= 0.75) s = sm; }
  if (!s) return 0;
  const restA = a.slice(1).join(""), restB = b.slice(1).join("");
  if (restA && restB) s += restA === restB ? 0.3 : (restA.startsWith(restB.slice(0, 2)) || restB.startsWith(restA.slice(0, 2))) ? 0.15 : -0.2;
  else if (restA || restB) s -= 0.1;
  return s;
}
module.exports = { roman, skel, score };
