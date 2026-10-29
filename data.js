/* ============================================================
   Q4 Sparkle Q4 遊戲 — 共用設定
   ------------------------------------------------------------
   想改人員名單？改下面 ROSTER 陣列，或者喺排行榜頁按「名單」
   直接加人（加咗嘅名會存在本機瀏覽器）。
   想改終點分數？改 FINISH 呢個數字就得。
   ============================================================ */

// 終點線分數
const FINISH = 250000;

// 共用後端（Google Apps Script /exec）。空白 = 淨係用本機 localStorage。
const API =
  "https://script.google.com/macros/s/AKfycbwkk8Fp49_7IazR4ibqSq5Wd3ljh-tH3YmBABW9aoYGuCfLXttbgepvsdgRD9sFOrm1/exec";

// 人員名單唔寫喺呢度（呢啲檔係公開嘅）。
// 名單只由 Google Sheet「roster」表經 API 攞返，Sheet 改完即刻生效。
const ROSTER = [];


// 通行碼（同時用喺前端閘門 + 後端 API 檢查）

const KEY_SCORES = "q4_race_scores_v1";
const KEY_ROSTER = "q4_race_roster_v1";
const KEY_LOG = "q4_race_log_v1";

/* ---------- 儲存層 ---------- */

function getRoster() {
  try {
    const raw = localStorage.getItem(KEY_ROSTER);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : ROSTER.slice();
  } catch (e) {
    return ROSTER.slice();
  }
}

function saveRoster(list) {
  localStorage.setItem(KEY_ROSTER, JSON.stringify(list));
}

// { name: 總分 }
function getScores() {
  try {
    const raw = localStorage.getItem(KEY_SCORES);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (e) {
    return {};
  }
}

function saveScores(obj) {
  localStorage.setItem(KEY_SCORES, JSON.stringify(obj));
}

// 記錄每次入數，方便對數
function getLog() {
  try {
    const raw = localStorage.getItem(KEY_LOG);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function pushLog(entry) {
  const log = getLog();
  log.unshift(entry);
  localStorage.setItem(KEY_LOG, JSON.stringify(log.slice(0, 500)));
}

function addScore(name, points) {
  const s = getScores();
  s[name] = (Number(s[name]) || 0) + points;
  saveScores(s);
  pushLog({ name: name, points: points, time: new Date().toISOString() });
  return s[name];
}

function clearAll() {
  localStorage.removeItem(KEY_SCORES);
  localStorage.removeItem(KEY_LOG);
}

/* ---------- 共用後端（有 API 就全隊共用，冇就本機） ---------- */

let REMOTE = null;

let GATE_REJECTED = false;

async function apiGet() {
  if (!API) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API + "?t=" + Date.now() + "&key=" + encodeURIComponent(apiKey()), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) return j;
        if (j && j.error === "unauthorized") { GATE_REJECTED = true; gateClear(); return null; }
      }
    } catch (e) {
      /* 試多次 */
    }
    await new Promise((res) => setTimeout(res, 600));
  }
  return null;
}

// 用 no-cors 送（Apps Script 唔會擋 CORS），之後靠 apiGet 輪詢確認
async function apiAdd(name, points) {
  if (!API) return false;
  try {
    const body = new URLSearchParams({ name: name, points: String(points), key: apiKey() });
    await fetch(API, { method: "POST", mode: "no-cors", body: body, keepalive: true });
    return true;
  } catch (e) {
    return false;
  }
}

async function syncRemote() {
  const d = await apiGet();
  if (d) {
    REMOTE = { roster: d.roster || [], scores: d.scores || {}, log: d.log || [] };
  }
  return REMOTE;
}

const curRoster = () => (REMOTE && REMOTE.roster.length ? REMOTE.roster : getRoster());
const curScores = () => (REMOTE ? REMOTE.scores : getScores());
const curLog = () => (REMOTE ? REMOTE.log : getLog());

// 入數頁跳轉前攞到嘅最新資料，先攞去頂，免得跳轉後第一下顯示 0
function bootFromSession() {
  if (REMOTE || !API) return;
  try {
    const raw = sessionStorage.getItem("q4_boot");
    if (raw) REMOTE = JSON.parse(raw);
  } catch (e) {
    /* 冇就冇所謂 */
  }
}

/* ---------- 顯示工具 ---------- */

const nf = new Intl.NumberFormat("en-US");

function fmt(n) {
  return nf.format(Math.round(Number(n) || 0));
}

// 時間顯示：Apps Script 回嘅係本地格式字串，parse 唔到就直接攤返原文
function fmtTime(t) {
  const d = new Date(t);
  if (isNaN(d.getTime())) return String(t).slice(0, 24);
  return (
    (d.getMonth() + 1) + "/" + d.getDate() + " " +
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")
  );
}

function pct(score) {
  return Math.min((Number(score) / FINISH) * 100, 999);
}

// 距離終點：正數 = 未到，負數 = 已衝線超額
function gap(score) {
  return FINISH - (Number(score) || 0);
}

function scaleMax() {
  const s = curScores();
  const top = Math.max(FINISH, ...Object.values(s).map((v) => Number(v) || 0), 0);
  return Math.max(FINISH, Math.ceil((top * 1.08) / 25000) * 25000);
}

function board() {
  const roster = curRoster();
  const s = curScores();
  const rows = roster.map((name) => ({ name: name, score: Number(s[name]) || 0 }));
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

function statusText(score) {
  const g = gap(score);
  if (g > 0) return { text: "距離終點 " + fmt(g) + " 分", cls: "behind" };
  return { text: "已衝線 +" + fmt(-g) + " 分", cls: "passed" };
}

/* ---------- 團隊總目標 ---------- */

// 全隊總分對全隊總目標（人數 × 終點分數）
function teamTotal() {
  const rows = board();
  const sum = rows.reduce((a, r) => a + r.score, 0);
  const target = FINISH * (rows.length || 1);
  return {
    sum: sum,
    target: target,
    gap: target - sum,
    pct: target ? (sum / target) * 100 : 0,
    done: rows.filter((r) => r.score >= FINISH).length,
    total: rows.length,
  };
}

/* ---------- 跑道 bar ---------- */

// score 只可以係數字
function trackHTML(score, opts) {
  opts = opts || {};
  const max = scaleMax();
  const p = Math.max(0, Math.min((Number(score) / max) * 100, 100));
  const finishP = (FINISH / max) * 100;
  const passed = Number(score) >= FINISH;
  return (
    '<div class="track' + (passed ? " passed" : "") + '">' +
      '<div class="lane">' +
        '<div class="fill" style="width:' + p.toFixed(2) + '%"></div>' +
        (passed ? '<div class="glow"></div>' : "") +
      '</div>' +
      '<div class="finish" style="left:' + finishP.toFixed(2) + '%">' +
        '<span class="flag">🏁</span>' +
      '</div>' +
      '<div class="runner" style="left:' + p.toFixed(2) + '%">' +
        (opts.small ? "" : '<span class="dot"></span>') +
      "</div>" +
    "</div>"
  );
}

function barWrap(score, extraClass) {
  return (
    '<div class="trackwrap ' + (extraClass || "") + '">' +
      trackHTML(score) +
      '<div class="scalebar"><span>0</span><span>終點 ' + fmt(FINISH) + '</span><span>' + fmt(scaleMax()) + "</span></div>" +
    "</div>"
  );
}

/* ---------- 通行碼（冇 link 嘅人入唔到） ---------- */
/* 通行碼唔寫死喺度（呢啲檔係公開嘅）。用戶輸入一次，記喺部機 localStorage。 */
function apiKey() { return gateKey(); }

function gateKey() {
  try { return localStorage.getItem("q4_key") || ""; }
  catch (e) { return ""; }
}

function gateSet(k) {
  try { localStorage.setItem("q4_key", k); } catch (e) {}
}

function gateClear() {
  try { localStorage.removeItem("q4_key"); } catch (e) {}
}

function gatePassed() {
  return !!gateKey();
}

function gateInit() {
  var key = gateKey();
  if (GATE_REJECTED) { gateClear(); key = ""; }
  var q = new URLSearchParams(location.search).get("k");
  if (q) {
    gateSet(q);
    // 清走 k 參數，唔好留喺分享 link / 瀏覽紀錄
    var u = new URL(location.href);
    u.searchParams.delete("k");
    location.replace(u.pathname + u.search + u.hash);
    return true;
  }
  if (key) return true;
  gateShow();
  return false;
}

function gateShow() {
  document.body.classList.add("gated");
  var box = document.createElement("div");
  box.className = "gatebox";
  box.innerHTML =
    '<div class="gatetitle">🔒 呢個頁面需要通行碼</div>' +
    '<div class="gatesub">請用 Alan 交嘅完整 link 開（通行碼已經喺 link 裏面）。<br>如果只係得個網址，可以喺下面貼上通行碼：</div>' +
    '<input id="gateIn" type="text" placeholder="通行碼" autocomplete="off">' +
    '<button id="gateBtn">進入</button>' +
    '<div class="gateerr" id="gateErr"></div>';
  document.body.appendChild(box);
  var input = document.getElementById("gateIn");
  var err = document.getElementById("gateErr");
  async function tryKey() {
    var v = (input.value || "").trim();
    if (!v) { err.textContent = "請貼上通行碼。"; return; }
    gateSet(v);
    if (API) {
      err.textContent = "檢查緊…";
      var d = await apiGet();
      if (d) { location.reload(); return; }
      if (GATE_REJECTED) { gateClear(); err.textContent = "通行碼唔啱，請搵 Alan 攞返。"; return; }
      // 後端未開通行碼檢查 → 當通過
    }
    location.reload();
  }
  document.getElementById("gateBtn").addEventListener("click", tryKey);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryKey(); });
  input.focus();
}
