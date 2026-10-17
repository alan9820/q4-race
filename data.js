/* ============================================================
   Q4 衝線競賽 — 共用設定
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

// 人員名單（可以喺頁面內直接加 / 刪，呢個只係預設名單）
const ROSTER = [
  "Alan",
  "Ellie",
  "Kevin",
  "Abby",
  "Abigail",
  "Anson",
  "Batson",
  "Catherine",
  "Krystal",
  "Lay",
  "Macy",
  "Monica",
  "Nathaniel",
  "Porter",
  "Ric",
  "Ridi",
  "Stella",
  "Stephanie",
  "Vito",
  "Pecky",
];

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

async function apiGet() {
  if (!API) return null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API + "?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ok) return j;
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
    const body = new URLSearchParams({ name: name, points: String(points) });
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
