/* one — football analytics. Vanilla JS + Supabase (read-only, RLS). */
const SUPABASE_URL = "https://pvocjvvzkvzhckilhokx.supabase.co";
const SUPABASE_KEY = "sb_publishable_amz1rV3zMWOZqazzODCDTw_MzIYN6pZ";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); /* data client: always anon, so RLS for "authenticated" never hides matches/leagues/players */
const sbAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "zone-auth" } });

const COMPS = [
  { id: "PL", name: "Premier League", short: "АПЛ", country: "Англия", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png" },
  { id: "PD", name: "LaLiga", short: "Ла Лига", country: "Испания", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png" },
  { id: "SA", name: "Serie A", short: "Серия А", country: "Италия", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png" },
  { id: "BL1", name: "Bundesliga", short: "Бундеслига", country: "Германия", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png" },
  { id: "FL1", name: "Ligue 1", short: "Лига 1", country: "Франция", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png" },
  { id: "CL", name: "Champions League", short: "ЛЧ", country: "Европа", logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/2.png" },
  { id: "NL", name: "Nations League", short: "ЛН", country: "Европа", logo: "data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2730%27 fill=%27%231b4fd8%27/%3E%3Cpath d=%27M32 12l6 12 13 2-9.500 9 2.500 13L32 41l-12 7 2.500-13L13 26l13-2z%27 fill=%27%23fff%27/%3E%3C/svg%3E" },
];
const CUP_IDS = new Set(["CL", "NL"]);
const COMP = new Proxy(Object.fromEntries(COMPS.map((c) => [c.id, c])), { get: (t, k) => t[k] || (typeof k === "string" && k !== "then" ? { id: k, name: k, short: k, country: "", logo: "" } : undefined) }); /* unknown competition ids never crash views */
const TEAM_SEL = "id,name,short_name,crest_url";
const M_SEL = `*,home:teams!matches_home_team_id_fkey(${TEAM_SEL}),away:teams!matches_away_team_id_fkey(${TEAM_SEL})`;

/* ---------------- utils ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => (v == null || isNaN(v) ? "–" : Number(v).toFixed(d));
const sgn = (v, d = 2) => (v == null || isNaN(v) ? "–" : (v > 0 ? "+" : "") + Number(v).toFixed(d));
const app = () => $("#app");
const fmtTime = (d) => new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fmtDate = (d, o = { day: "numeric", month: "short" }) => new Date(d).toLocaleDateString("ru-RU", o);
const fmtDay = (d) => new Date(d).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
const initials = (n) => (n || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const headshot = (id) => `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`;
const crest = (t, cls = "crest") => `<img class="${cls}" src="${esc(t?.crest_url || "")}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
const FM = {}; // espn id -> fotmob id (запасной источник фото)
window.__phErr = (im, id) => { const f = FM[id]; if (f && !im.dataset.fm) { im.dataset.fm = 1; im.src = `https://images.fotmob.com/image_resources/playerimages/${f}.png`; } else im.remove(); };
const avatar = (id, name, cls = "avatar") => `<span class="${cls}"><img src="${headshot(id)}" alt="" loading="lazy" onerror="__phErr(this,'${id}')">${esc(initials(name))}</span>`;
setTimeout(async () => { try { for (let o = 0; ; o += 1000) { const { data } = await sb.from("players").select("id,fotmob_id").not("fotmob_id", "is", null).range(o, o + 999); (data || []).forEach((r) => { FM[r.id] = r.fotmob_id; }); if (!data || data.length < 1000) break; } } catch (e) {} }, 0);
const ratingCls = (r) => (r == null ? "r-na" : r >= 8 ? "r-elite" : r >= 7 ? "r-good" : r >= 6 ? "r-ok" : "r-bad");
const ratingChip = (r) => `<span class="rating ${ratingCls(r)}">${r == null ? "–" : Number(r).toFixed(1)}</span>`;
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem("zone." + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem("zone." + k, JSON.stringify(v)); } catch {} },
};
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 1800); }
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z"/></svg>',
  starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z"/></svg>',
  ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 4.5h-5L8 10z" fill="currentColor"/></svg>',
  sub: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M7 4v13m0 0l-3-3m3 3l3-3" stroke="#34c759"/><path d="M17 20V7m0 0l-3 3m3-3l3 3" stroke="#ff3b30"/></svg>',
  var: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>',
  miss: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/></svg>',
  whistle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="14" r="5"/><path d="M12.5 10.5L21 6v4l-6 2.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
};

/* ---------------- data layer (memo) ---------------- */
const memo = new Map();
async function q(key, fn, ttl = 60000) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  memo.set(key, { t: Date.now(), v });
  return v;
}
async function run(builder) { const { data, error } = await builder; if (error) throw error; return data || []; }
async function fetchAll(make, page = 1000) {
  let out = [], from = 0;
  for (;;) { const rows = await run(make().range(from, from + page - 1)); out = out.concat(rows); if (rows.length < page) break; from += page; }
  return out;
}
const getStandings = (c) => q("st:" + c, () => run(sb.from("standings").select(`*,team:teams(${TEAM_SEL})`).eq("competition_id", c).order("position")));
const getCompMatches = (c) => q("cm:" + c, () => fetchAll(() => sb.from("matches").select(M_SEL).eq("competition_id", c).order("utc_date")));
const getTeamStatsComp = (c) => q("tsc:" + c, () => fetchAll(() => sb.from("team_match_stats").select("match_id,team_id,xg,xga,possession,shots,shots_on_target,matches!inner(competition_id,status)").eq("matches.competition_id", c)));
const getPlayerSeason = (c) => q("ps:" + c, () => fetchAll(() => { let b = sb.from("v_player_season").select("*"); if (c) b = b.eq("competition_id", c); return b.order("minutes", { ascending: false }); }));
const getTeamSeason = (c) => q("tss:" + c, () => run(sb.from("v_team_season").select("*").eq("competition_id", c)));

/* xPTS via independent Poisson */
function pois(l, k) { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; }
function xpts(xgF, xgA) {
  let w = 0, d = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) { const p = pois(xgF, i) * pois(xgA, j); if (i > j) w += p; else if (i === j) d += p; }
  return 3 * w + d;
}

/* ---------------- theme / favorites ---------------- */
function applyTheme() {
  const t = store.get("theme", "auto");
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const b = $("#themeBtn"); if (b) b.title = { auto: "Тема: авто", light: "Тема: светлая", dark: "Тема: тёмная" }[t];
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
const favTeams = () => store.get("favTeams", []);
const favMatches = () => store.get("favMatches", []);
function toggleFavTeam(t) {
  let f = favTeams(); const on = f.some((x) => x.id === t.id);
  f = on ? f.filter((x) => x.id !== t.id) : [...f, { id: t.id, name: t.name, crest_url: t.crest_url }];
  store.set("favTeams", f); toast(on ? "Удалено из избранного" : "Команда в избранном"); return !on;
}
function toggleFavMatch(id) {
  let f = favMatches(); const on = f.includes(id);
  f = on ? f.filter((x) => x !== id) : [...f, id]; store.set("favMatches", f); toast(on ? "Матч убран" : "Матч отслеживается"); return !on;
}

/* ---------------- shell: nav, flyouts, search ---------------- */
function closeFly() { $$(".flyout").forEach((f) => f.classList.remove("open")); $("#scrim").classList.remove("open"); }
function openFly(id) { const f = $("#" + id); const was = f.classList.contains("open"); closeFly(); if (!was) { f.classList.add("open"); $("#scrim").classList.add("open"); } return !was; }
function buildShell() {
  $("#fly-leagues .big").innerHTML = COMPS.map((c) => `<a href="#/league/${c.id}"><img src="${c.logo}" alt="">${c.name}</a>`).join("");
  $("#fly-leagues .small.a").innerHTML = COMPS.map((c) => `<a href="#/league/${c.id}/table">${c.short} — таблица</a>`).join("");
  $("#fly-leagues .small.b").innerHTML = COMPS.map((c) => `<a href="#/league/${c.id}/players">${c.short} — игроки</a>`).join("");
  $("#leaguesBtn").addEventListener("click", () => openFly("fly-leagues"));
  $("#leaguesBtn").addEventListener("mouseenter", () => { if (matchMedia("(hover:hover)").matches && !$("#fly-leagues").classList.contains("open")) openFly("fly-leagues"); });
  $("#fly-leagues").addEventListener("mouseleave", () => { if (matchMedia("(hover:hover)").matches) closeFly(); });
  $("#burger").addEventListener("click", () => openFly("fly-leagues"));
  $("#scrim").addEventListener("click", closeFly);
  $("#themeBtn").addEventListener("click", () => {
    const order = ["auto", "light", "dark"]; const cur = store.get("theme", "auto");
    const nx = order[(order.indexOf(cur) + 1) % 3]; store.set("theme", nx); applyTheme(); toast($("#themeBtn").title);
  });
  $("#searchBtn").addEventListener("click", () => { if (openFly("fly-search")) setTimeout(() => $("#q").focus(), 60); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFly();
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); openFly("fly-search"); setTimeout(() => $("#q").focus(), 60); }
  });
  let tmr; $("#q").addEventListener("input", (e) => { clearTimeout(tmr); tmr = setTimeout(() => doSearch(e.target.value.trim()), 180); });
  $("#q").addEventListener("keydown", (e) => {
    const items = $$("#sres .sr-item"); if (!items.length) return;
    let i = items.findIndex((x) => x.classList.contains("sel"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[i]?.classList.remove("sel"); i = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1); items[i].classList.add("sel"); items[i].scrollIntoView({ block: "nearest" }); }
    if (e.key === "Enter") { (items[i] || items[0]).click(); }
  });
  $("#sres").addEventListener("click", (e) => { if (e.target.closest("a")) { closeFly(); $("#q").value = ""; } });
  doSearch("");
}
async function doSearch(s) {
  const box = $("#sres");
  if (!s) {
    box.innerHTML = `<h6 class="eyebrow">Быстрые ссылки</h6>` + COMPS.map((c) => `<a class="sr-item" href="#/league/${c.id}"><img src="${c.logo}" alt="">${c.name}<small>${c.country}</small></a>`).join("")
      + `<a class="sr-item" href="#/stats">Статистика всех лиг<small>лидеры</small></a><a class="sr-item" href="#/compare">Сравнить игроков<small>радар</small></a>`;
    return;
  }
  const like = `%${s}%`;
  const [teams, players] = await Promise.all([
    run(sb.from("teams").select(TEAM_SEL + ",country").ilike("name", like).limit(8)),
    run(sb.from("players").select("id,name,position,team:teams(name,crest_url)").ilike("name", like).limit(12)),
  ]);
  const comps = COMPS.filter((c) => (c.name + c.short + c.country).toLowerCase().includes(s.toLowerCase()));
  box.innerHTML = (comps.length ? `<h6 class="eyebrow">Турниры</h6>` + comps.map((c) => `<a class="sr-item" href="#/league/${c.id}"><img src="${c.logo}" alt="">${c.name}</a>`).join("") : "")
    + (teams.length ? `<h6 class="eyebrow">Команды</h6>` + teams.map((t) => `<a class="sr-item" href="#/team/${t.id}">${crest(t)}${esc(t.name)}<small>${esc(t.country || "")}</small></a>`).join("") : "")
    + (players.length ? `<h6 class="eyebrow">Игроки</h6>` + players.map((p) => `<a class="sr-item" href="#/player/${p.id}">${avatar(p.id, p.name, "avatar")}${esc(p.name)}<small>${esc(p.team?.name || "")} · ${esc(posRu(p.position))}</small></a>`).join("") : "")
    || `<div class="empty-note">Ничего не найдено</div>`;
  const first = $("#sres .sr-item"); if (first) first.classList.add("sel");
}

/* ---------------- positions ---------------- */
function posGroup(p) {
  p = (p || "").toLowerCase();
  if (p.includes("goal")) return "GK";
  if (p.includes("back") || p.includes("defender") || p.includes("sweeper")) return "DF";
  if (p.includes("mid")) return "MF";
  if (p.includes("forward") || p.includes("striker") || p.includes("wing")) return "FW";
  return "MF";
}
const POS_RU = { GK: "Вратарь", DF: "Защитник", MF: "Полузащитник", FW: "Нападающий" };
const POS_RU_PL = { GK: "Вратари", DF: "Защитники", MF: "Полузащитники", FW: "Нападающие" };
const posRu = (p) => POS_RU[posGroup(p)];

/* ---------------- router ---------------- */
let refreshTimer = null, charts = [];
function killCharts() { charts.forEach((c) => c.destroy()); charts = []; }
async function route() {
  clearInterval(refreshTimer); killCharts(); closeFly(); document.documentElement.style.removeProperty("--home"); document.documentElement.style.removeProperty("--away");
  const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(qs || "");
  $$(".gnav-links a").forEach((a) => a.classList.toggle("active", a.dataset.r === (parts[0] || "home") || (parts[0] === "league" && ((a.dataset.r === "cl" && parts[1] === "CL") || (a.dataset.r === "nl" && parts[1] === "NL")))));
  window.scrollTo({ top: 0 });
  try {
    if (!parts.length) await viewHome(params);
    else if (parts[0] === "league") await viewLeague(parts[1], parts[2] || "overview", params);
    else if (parts[0] === "team") await viewTeam(parts[1], parts[2] || "overview");
    else if (parts[0] === "player") await viewPlayer(parts[1]);
    else if (parts[0] === "match") await viewMatch(parts[1], parts[2] || "facts");
    else if (parts[0] === "leagues") viewLeagues();
    else if (parts[0] === "stats") await viewStats(params.get("c") || "ALL", params.get("s"));
    else if (parts[0] === "compare") await viewCompare(params);
    else await viewHome(params);
  } catch (e) {
    console.error(e);
    app().innerHTML = `<div class="wrap"><div class="card"><div class="empty-note">Не удалось загрузить данные. ${esc(e.message || e)}</div></div></div>`;
  }
}
window.addEventListener("hashchange", route);
const skel = (n = 6) => Array.from({ length: n }, () => `<div class="sk sk-row"></div>`).join("");
const localnav = (title, tabs, cur, base) => `<div class="localnav"><div class="localnav-in"><div class="ttl">${title}</div><nav class="tabs">${tabs.map(([k, l]) => `<a href="${base}/${k}" class="${k === cur ? "on" : ""}">${l}</a>`).join("")}</nav></div></div>`;

/* ---------------- match row ---------------- */
function statusLabel(m) {
  if (m.status === "LIVE") { const c = m.raw?.clock; if (!c || c === "0'") return "LIVE"; const x = /^(\d+)'$/.exec(c); return x && m._t ? Math.min(+x[1] + Math.floor((Date.now() - m._t) / 60000), 120) + "'" : c; }
  if (m.status === "PAUSED") return "Перерыв";
  if (m.status === "FINISHED") return m.raw?.detail && /AET|Pens|ДВ|пен/i.test(m.raw.detail) ? m.raw.detail : "Конец";
  if (m.status === "POSTPONED") return "Перенесён";
  if (m.status === "CANCELLED") return "Отменён";
  return "";
}
function matchRow(m, opts = {}) {
  const live = m.status === "LIVE" || m.status === "PAUSED";
  const played = m.status !== "SCHEDULED" && m.home_goals != null;
  const hw = played && m.home_goals > m.away_goals, aw = played && m.away_goals > m.home_goals;
  const fav = favMatches().includes(m.id);
  const mid = played ? `<span class="sc">${m.home_goals} – ${m.away_goals}</span>` : `<span class="tm-time">${m.status === "SCHEDULED" ? fmtTime(m.utc_date) : "–"}</span>`;
  const st = played || live ? statusLabel(m) : opts.showDate ? fmtDate(m.utc_date) : "";
  return `<a class="mrow ${live ? "live" : ""}" href="#/match/${m.id}">
    <div class="tm h ${hw ? "win" : ""}"><span>${esc(m.home?.short_name || m.home?.name)}</span>${crest(m.home)}</div>
    <div class="mid">${mid}<div class="st">${esc(st)}</div></div>
    <div class="tm ${aw ? "win" : ""}">${crest(m.away)}<span>${esc(m.away?.short_name || m.away?.name)}</span></div>
    <button class="fav ${fav ? "on" : ""}" data-fav="${m.id}" aria-label="Отслеживать матч">${fav ? ICON.star : ICON.starO}</button>
  </a>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fav]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const on = toggleFavMatch(b.dataset.fav); b.classList.toggle("on", on); b.innerHTML = on ? ICON.star : ICON.starO;
});
function resultFor(m, tid) {
  if (m.home_goals == null) return null;
  const gf = m.home_team_id === tid ? m.home_goals : m.away_goals, ga = m.home_team_id === tid ? m.away_goals : m.home_goals;
  return gf > ga ? "W" : gf < ga ? "L" : "D";
}
const formHtml = (arr) => `<span class="form">${arr.map((r) => `<b class="${r}">${{ W: "В", D: "Н", L: "П" }[r]}</b>`).join("")}</span>`;

/* ================= HOME ================= */
async function viewHome(params) {
  const sel = params.get("d") ? new Date(params.get("d") + "T12:00:00") : new Date();
  const state = { filter: store.get("homeFilter", "all"), sort: store.get("homeSort", "comp") };
  const dayStart = new Date(sel); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  let dates = ""; for (let i = -3; i <= 3; i++) {
    const d = new Date(dayStart); d.setDate(d.getDate() + i);
    const diff = Math.round((d - today) / 86400000);
    const lbl = diff === 0 ? "Сегодня" : diff === -1 ? "Вчера" : diff === 1 ? "Завтра" : d.toLocaleDateString("ru-RU", { weekday: "short" });
    dates += `<a class="date ${i === 0 ? "on" : ""}" href="#/?d=${iso(d)}">${lbl}<b>${d.getDate()} ${d.toLocaleDateString("ru-RU", { month: "short" }).replace(".", "")}</b></a>`;
  }
  const prev = new Date(dayStart); prev.setDate(prev.getDate() - 7); const next = new Date(dayStart); next.setDate(next.getDate() + 7);
  const favs = favTeams();
  app().innerHTML = `<div class="wrap"><div class="cols">
    <aside class="left side">
      <div class="card"><div class="card-h">Топ-турниры</div><nav class="nav-list">${COMPS.map((c) => `<a href="#/league/${c.id}"><img src="${c.logo}" alt="">${c.name}</a>`).join("")}</nav><div style="height:10px"></div></div>
      <div class="card"><div class="card-h">Избранные команды</div>${favs.length ? `<nav class="nav-list">${favs.map((t) => `<a href="#/team/${t.id}">${crest(t)}${esc(t.name)}</a>`).join("")}</nav><div style="height:10px"></div>` : `<div class="empty-note">Пусто</div>`}</div>
    </aside>
    <main>
      <div class="card" id="feed">
        <div class="datebar"><a class="arrow" href="#/?d=${iso(prev)}" aria-label="Неделя назад">${ICON.chevL}</a><div class="dates">${dates}</div><a class="arrow" href="#/?d=${iso(next)}" aria-label="Неделя вперёд">${ICON.chevR}</a></div>
        <div class="feed-tools">
          <div class="seg" id="fseg"><button data-f="all">Все</button><button data-f="live"><span class="live-toggle"><span class="live-dot"></span>Live</span></button><button data-f="fav">Избранное</button></div>
          <div class="seg" id="sseg" style="margin-left:auto"><button data-s="comp">Турниры</button><button data-s="time">Время</button></div>
        </div>
        <div id="feedBody">${skel(8)}</div>
      </div>
    </main>
    <aside class="side" id="rightCol">
      <div class="card" id="miniTable"><div class="card-h">Таблица</div>${skel(6)}</div>
      <div class="card" id="potw"><div class="card-h">Лучшие игроки недели</div>${skel(4)}</div>
      <div class="card" id="xgLead"><div class="card-h">Лидеры по xG</div>${skel(4)}</div>
    </aside>
  </div></div>`;
  const setSeg = () => { $$("#fseg button").forEach((b) => b.classList.toggle("on", b.dataset.f === state.filter)); $$("#sseg button").forEach((b) => b.classList.toggle("on", b.dataset.s === state.sort)); };
  setSeg();
  { const on = $(".date.on"); if (on) { const p = on.parentElement; p.scrollLeft = on.offsetLeft - p.offsetLeft - p.clientWidth / 2 + on.clientWidth / 2; } }
  let matches = [];
  const draw = () => {
    let list = matches;
    if (state.filter === "live") list = list.filter((m) => m.status === "LIVE" || m.status === "PAUSED");
    if (state.filter === "fav") { const ft = new Set(favTeams().map((t) => t.id)), fm = new Set(favMatches()); list = list.filter((m) => fm.has(m.id) || ft.has(m.home_team_id) || ft.has(m.away_team_id)); }
    const body = $("#feedBody"); if (!body) return;
    if (!list.length) { body.innerHTML = `<div class="empty-note" style="padding:28px 18px;text-align:center">${state.filter === "live" ? "Сейчас нет матчей в прямом эфире." : state.filter === "fav" ? "Нет матчей избранных команд в этот день." : "В этот день нет матчей топ-5 лиг, Лиги чемпионов и Лиги наций."}<div id="nearBtns" style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap"></div></div>`; if (state.filter === "all") nearDays(); return; }
    if (state.sort === "time") { body.innerHTML = `<div class="comp-group">${list.map((m) => matchRow(m)).join("")}</div>`; return; }
    body.innerHTML = COMPS.map((c) => {
      const ms = list.filter((m) => m.competition_id === c.id); if (!ms.length) return "";
      const lv = ms.filter((m) => m.status === "LIVE").length;
      return `<div class="comp-group"><a class="comp-head" href="#/league/${c.id}"><img src="${c.logo}" alt=""><span class="nm">${c.country} · ${c.name}</span><span class="cnt">${lv ? `<span class="live-dot"></span> ${lv} / ` : ""}${ms.length}</span></a>${ms.map((m) => matchRow(m)).join("")}</div>`;
    }).join("");
  };
  $("#fseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.filter = b.dataset.f; store.set("homeFilter", state.filter); setSeg(); draw(); });
  $("#sseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; state.sort = b.dataset.s; store.set("homeSort", state.sort); setSeg(); draw(); });
  const nearDays = async () => {
    const [pv, nx] = await Promise.all([
      run(sb.from("matches").select("utc_date").lt("utc_date", dayStart.toISOString()).order("utc_date", { ascending: false }).limit(1)),
      run(sb.from("matches").select("utc_date").gte("utc_date", dayEnd.toISOString()).order("utc_date").limit(1)),
    ]);
    const el = $("#nearBtns"); if (!el) return;
    const arr = (d) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
    const btn = (r, t) => { if (!r?.[0]) return ""; const dt = fmtDate(r[0].utc_date, { day: "numeric", month: "long" }), label = (t === "next" ? "Ближайшие матчи · " : "Прошлый тур · ") + dt; return `<a class="near ${t}" href="#/?d=${iso(new Date(r[0].utc_date))}" title="${label}" aria-label="${label}">${t === "next" ? `<span>${dt}</span>${arr("M9 6l6 6-6 6")}` : `${arr("M15 6l-6 6 6 6")}<span>${dt}</span>`}</a>`; };
    el.innerHTML = btn(pv, "prev") + btn(nx, "next");
  };
  const load = async () => {
    matches = await run(sb.from("matches").select(M_SEL).gte("utc_date", dayStart.toISOString()).lt("utc_date", dayEnd.toISOString()).order("utc_date"));
    const now = Date.now(); matches.forEach((m) => { m._t = now; });
    draw();
  };
  await load();
  if (+dayStart === +today) refreshTimer = setInterval(() => { if (matches.some((m) => m.status === "LIVE" || m.status === "PAUSED" || (m.status === "SCHEDULED" && new Date(m.utc_date) < new Date()))) load(); }, 10000);
  homeRight();
}
async function homeRight() {
  let cur = store.get("miniComp", "PL");
  const drawTable = async () => {
    const box = $("#miniTable"); if (!box) return;
    const st = await getStandings(cur);
    box.innerHTML = `<div class="card-h">Таблица<a class="more" href="#/league/${cur}/table">Полностью</a></div>
      <div style="padding:0 14px 10px;overflow-x:auto"><div class="seg" id="mseg">${COMPS.map((c) => `<button data-c="${c.id}" class="${c.id === cur ? "on" : ""}" title="${esc(c.name)}" style="flex:1;display:grid;place-items:center"><img src="${c.logo}" alt="${esc(c.short)}" style="width:18px;height:18px;object-fit:contain;display:block"></button>`).join("")}</div></div>
      <table class="tbl"><thead><tr><th>#</th><th class="l">Команда</th><th>И</th><th>+/-</th><th>О</th></tr></thead><tbody>
      ${st.slice(0, CUP_IDS.has(cur) ? 12 : 10).map((r) => `<tr onclick="location.hash='#/team/${r.team_id}'" style="cursor:pointer"><td class="pos"><i style="background:${r.note_color || "transparent"}"></i>${r.position}</td><td class="l"><span class="team">${crest(r.team, "crest sm")}${esc(r.team?.short_name || r.team?.name)}</span></td><td>${r.played}</td><td>${sgn(r.goals_for - r.goals_against, 0)}</td><td class="pts">${r.points}</td></tr>`).join("")}
      </tbody></table><div style="height:8px"></div>`;
    $("#mseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; cur = b.dataset.c; store.set("miniComp", cur); drawTable(); });
  };
  drawTable();
  // players of the week
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  run(sb.from("player_match_stats").select("rating,goals,assists,player_id,player:players(name),team:teams(name,short_name,crest_url),m:matches!inner(utc_date,competition_id)").gte("m.utc_date", since).not("rating", "is", null).order("rating", { ascending: false }).limit(6)).then((rows) => {
    const box = $("#potw"); if (!box) return;
    box.innerHTML = `<div class="card-h">Лучшие игроки недели<span class="more muted">one рейтинг</span></div>` + (rows.length ? rows.map((r) => `<a class="lead" href="#/player/${r.player_id}">${avatar(r.player_id, r.player?.name)}<div class="who"><div>${esc(r.player?.name)}</div><small>${esc([r.team?.short_name || r.team?.name, COMP[r.m.competition_id]?.short, r.goals ? r.goals + " г" : "", r.assists ? r.assists + " а" : ""].filter(Boolean).join(" · "))}</small></div>${ratingChip(r.rating)}</a>`).join("") + `<div style="height:8px"></div>` : `<div class="empty-note">Нет сыгранных матчей за 7 дней.</div>`);
  });
  run(sb.from("v_player_season").select("player_id,name,team_short,crest_url,xg,goals,competition_id").order("xg", { ascending: false }).limit(6)).then((rows) => {
    const box = $("#xgLead"); if (!box) return;
    box.innerHTML = `<div class="card-h">Лидеры по xG<a class="more" href="#/stats">Вся статистика</a></div>` + rows.map((r, i) => `<a class="lead" href="#/player/${r.player_id}"><span class="rk">${i + 1}</span>${avatar(r.player_id, r.name)}<div class="who"><div>${esc(r.name)}</div><small>${esc(r.team_short)} · ${COMP[r.competition_id]?.short} · ${r.goals} голов</small></div><span class="v">${num(r.xg, 1)}</span></a>`).join("") + `<div style="height:8px"></div>`;
  });
}

/* ================= LEAGUE ================= */
async function viewLeague(id, tab, params) {
  const c = COMP[id]; if (!c) return viewHome(params);
  const tabs = [["overview", "Обзор"], ["table", "Таблица"], ["matches", "Матчи"], ["players", "Игроки"], ["teams", "Команды"], ["xg", "xG-аналитика"]];
  app().innerHTML = `<div class="wrap">${localnav(`<img src="${c.logo}" class="crest" alt=""><span class="t">${c.name}</span>`, tabs, tab, `#/league/${id}`)}
    <div id="lbody">${tab === "overview" ? `<div class="card"><div class="hero"><img src="${c.logo}" class="crest lg" alt=""><div class="meta"><h1 class="title">${c.name}</h1></div></div><div style="height:24px"></div></div><div class="section-gap"></div>` : ""}<div id="lcontent">${skel(10)}</div></div></div>`;
  const box = $("#lcontent");
  if (tab === "overview") return leagueOverview(id, box);
  if (tab === "table") return leagueTable(id, box);
  if (tab === "matches") return leagueMatches(id, box);
  if (tab === "players") return leaguePlayers(id, box);
  if (tab === "teams") return leagueTeams(id, box);
  if (tab === "xg") return leagueXG(id, box);
}
async function leagueOverview(id, box) {
  const [st, ms, ps] = await Promise.all([getStandings(id), getCompMatches(id), getPlayerSeason(id)]);
  const fin = ms.filter((m) => m.status === "FINISHED");
  const goals = fin.reduce((s, m) => s + m.home_goals + m.away_goals, 0);
  const upcoming = ms.filter((m) => m.status === "SCHEDULED" && new Date(m.utc_date) > new Date()).slice(0, 8);
  const recent = fin.slice(-8).reverse();
  const live = ms.filter((m) => m.status === "LIVE" || m.status === "PAUSED");
  const leaders = (k, label, d = 0, filt = () => true) => {
    const rows = ps.filter(filt).sort((a, b) => b[k] - a[k]).slice(0, 5);
    return `<div class="card"><div class="card-h">${label}<a class="more" href="#/league/${id}/players?s=${k}">Все</a></div>${rows.map((r, i) => `<a class="lead" href="#/player/${r.player_id}"><span class="rk">${i + 1}</span>${avatar(r.player_id, r.name)}<div class="who"><div>${esc(r.name)}</div><small>${esc(r.team_short)}</small></div><span class="v">${num(r[k], d)}</span></a>`).join("")}<div style="height:8px"></div></div>`;
  };
  box.innerHTML = `<div class="cols two"><main>
      ${live.length ? `<div class="card"><div class="card-h"><span class="live-dot"></span> Сейчас в эфире</div>${live.map((m) => matchRow(m)).join("")}<div style="height:8px"></div></div>` : ""}
      <div class="card"><div class="card-h">Таблица<a class="more" href="#/league/${id}/table">Подробно</a></div>${standingsTable(st, null, { compact: true })}</div>
      <div class="section-gap"></div>
      <div class="leaders-grid">${leaders("goals", "Голы")}${leaders("assists", "Ассисты")}${leaders("xg", "Ожидаемые голы (xG)", 2)}${leaders("rating", "one рейтинг", 2, (r) => r.minutes >= Math.max(180, fin.length / Math.max(1, st.length) * 2 * 45))}</div>
    </main>
    <aside class="side">
      <div class="card"><div class="card-h">Ближайшие матчи<a class="more" href="#/league/${id}/matches">Все</a></div>${upcoming.map((m) => matchRow(m, { showDate: true })).join("") || `<div class="empty-note">Нет запланированных матчей.</div>`}<div style="height:8px"></div></div>
      <div class="card"><div class="card-h">Последние результаты</div>${recent.map((m) => matchRow(m, { showDate: true })).join("")}<div style="height:8px"></div></div>
    </aside></div>`;
}
function standingsTable(st, hl, o = {}) {
  if (!st.length) return `<div class="empty-note">Таблица пока недоступна.</div>`;
  const groups = [...new Set(st.map((r) => r.group_name || ""))];
  const notes = [...new Map(st.filter((r) => r.note).map((r) => [r.note, r.note_color])).entries()];
  const forms = o.forms || {};
  const body = (rows) => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th class="l">Команда</th><th>И</th><th>В</th><th>Н</th><th>П</th><th>Мячи</th><th>+/-</th><th>О</th>${o.compact ? "" : "<th>Форма</th>"}</tr></thead><tbody>
    ${rows.map((r) => `<tr class="${r.team_id === hl ? "hl" : ""}" onclick="location.hash='#/team/${r.team_id}'" style="cursor:pointer"><td class="pos"><i style="background:${r.note_color || "transparent"}"></i>${r.position}</td><td class="l"><span class="team">${crest(r.team)}${esc(r.team?.name)}</span></td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.goals_for}:${r.goals_against}</td><td>${sgn(r.goals_for - r.goals_against, 0)}</td><td class="pts">${r.points}</td>${o.compact ? "" : `<td>${formHtml(forms[r.team_id] || [])}</td>`}</tr>`).join("")}
    </tbody></table></div>`;
  return groups.map((g) => (g ? `<div class="card-h" style="padding-top:8px">${esc(g)}</div>` : "") + body(st.filter((r) => (r.group_name || "") === g))).join("")
    + (notes.length ? `<div class="legend">${notes.map(([n, col]) => `<span><i style="background:${col}"></i>${esc(noteRu(n))}</span>`).join("")}</div>` : "");
}
const noteRu = (n) => ({ "Champions League": "Лига чемпионов", "Europa League": "Лига Европы", "Conference League": "Лига конференций", "Relegation": "Вылет", "Relegation Playoff": "Стыки за выживание", "UEFA Conference League Qualifiers": "Квалификация ЛК", "Champions League Qualifiers": "Квалификация ЛЧ", "Round of 16": "1/8 финала", "Knockout Round Playoffs": "Плей-офф раунд", "Eliminated": "Выбывание", "Promotion": "Повышение" }[n] || n);

function computeTable(ms, mode) {
  const T = {};
  const get = (t) => (T[t.id] ??= { team: t, team_id: t.id, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0, seq: [] });
  for (const m of ms.filter((m) => m.status === "FINISHED")) {
    const sides = [[m.home, m.home_goals, m.away_goals, "home"], [m.away, m.away_goals, m.home_goals, "away"]];
    for (const [t, gf, ga, side] of sides) {
      if (mode === "home" && side !== "home") continue;
      if (mode === "away" && side !== "away") continue;
      const r = get(t); r.seq.push({ gf, ga });
    }
  }
  for (const r of Object.values(T)) {
    const seq = mode === "form" ? r.seq.slice(-5) : r.seq;
    for (const { gf, ga } of seq) { r.played++; r.goals_for += gf; r.goals_against += ga; if (gf > ga) { r.won++; r.points += 3; } else if (gf === ga) { r.drawn++; r.points++; } else r.lost++; }
  }
  return Object.values(T).sort((a, b) => b.points - a.points || (b.goals_for - b.goals_against) - (a.goals_for - a.goals_against) || b.goals_for - a.goals_for).map((r, i) => ({ ...r, position: i + 1 }));
}
function formsFrom(ms) {
  const f = {};
  for (const m of ms.filter((m) => m.status === "FINISHED")) {
    (f[m.home_team_id] ??= []).push(resultFor(m, m.home_team_id));
    (f[m.away_team_id] ??= []).push(resultFor(m, m.away_team_id));
  }
  for (const k in f) f[k] = f[k].slice(-5);
  return f;
}
async function xgTable(id) {
  const [ms, ts] = await Promise.all([getCompMatches(id), getTeamStatsComp(id)]);
  const byMatch = {}; for (const t of ts) (byMatch[t.match_id] ??= {})[t.team_id] = t;
  const T = {};
  for (const m of ms.filter((m) => m.status === "FINISHED")) {
    const s = byMatch[m.id]; if (!s || !s[m.home_team_id] || !s[m.away_team_id]) continue;
    const h = s[m.home_team_id], a = s[m.away_team_id];
    for (const [t, me, op, gf, ga] of [[m.home, h, a, m.home_goals, m.away_goals], [m.away, a, h, m.away_goals, m.home_goals]]) {
      const r = (T[t.id] ??= { team: t, team_id: t.id, played: 0, xg: 0, xga: 0, xpts: 0, pts: 0, gf: 0, ga: 0, shots: 0, sot: 0 });
      r.played++; r.xg += +me.xg || 0; r.xga += +op.xg || 0; r.xpts += xpts(+me.xg || 0, +op.xg || 0);
      r.pts += gf > ga ? 3 : gf === ga ? 1 : 0; r.gf += gf; r.ga += ga; r.shots += me.shots || 0; r.sot += me.shots_on_target || 0;
    }
  }
  return Object.values(T).sort((a, b) => b.xpts - a.xpts).map((r, i) => ({ ...r, rank: i + 1 }));
}
async function leagueTable(id, box) {
  const [st, ms] = await Promise.all([getStandings(id), getCompMatches(id)]);
  let mode = "all";
  const draw = async () => {
    let html = "";
    if (mode === "all") html = standingsTable(st, null, { forms: formsFrom(ms) });
    else if (mode === "xg") {
      const rows = await xgTable(id);
      html = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th class="l">Команда</th><th>И</th><th>xG</th><th>xGA</th><th>xGD</th><th>Голы</th><th>Г−xG</th><th>xPTS</th><th>Очки</th><th>О−xPTS</th></tr></thead><tbody>
        ${rows.map((r) => `<tr onclick="location.hash='#/team/${r.team_id}'" style="cursor:pointer"><td>${r.rank}</td><td class="l"><span class="team">${crest(r.team)}${esc(r.team.name)}</span></td><td>${r.played}</td><td>${num(r.xg, 1)}</td><td>${num(r.xga, 1)}</td><td>${sgn(r.xg - r.xga, 1)}</td><td>${r.gf}:${r.ga}</td><td style="color:${r.gf - r.xg >= 0 ? "var(--win)" : "var(--loss)"}">${sgn(r.gf - r.xg, 1)}</td><td class="pts">${num(r.xpts, 1)}</td><td>${r.pts}</td><td style="color:${r.pts - r.xpts >= 0 ? "var(--win)" : "var(--loss)"}">${sgn(r.pts - r.xpts, 1)}</td></tr>`).join("")}
        </tbody></table></div>`;
    } else html = standingsTable(computeTable(ms, mode), null, { forms: formsFrom(ms) });
    $("#tbody").innerHTML = html;
  };
  box.innerHTML = `<div class="card"><div class="feed-tools"><div class="seg" id="tseg"><button data-m="all" class="on">Общая</button><button data-m="home">Дома</button><button data-m="away">В гостях</button><button data-m="form">Форма (5)</button><button data-m="xg">xG</button></div><span class="muted" style="margin-left:auto;font-size:12px">Обновлено ${st[0] ? fmtDate(st[0].updated_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–"}</span></div><div id="tbody"></div></div>`;
  $("#tseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; $$("#tseg button").forEach((x) => x.classList.toggle("on", x === b)); $("#tbody").innerHTML = skel(10); draw(); });
  draw();
}
async function leagueMatches(id, box) {
  const ms = await getCompMatches(id);
  const teams = [...new Map(ms.flatMap((m) => [[m.home.id, m.home], [m.away.id, m.away]])).values()].sort((a, b) => a.name.localeCompare(b.name));
  let f = "all", team = "";
  const draw = () => {
    let list = ms;
    if (f === "played") list = list.filter((m) => m.status === "FINISHED");
    if (f === "upcoming") list = list.filter((m) => m.status === "SCHEDULED" || m.status === "LIVE" || m.status === "PAUSED");
    if (team) list = list.filter((m) => m.home_team_id === team || m.away_team_id === team);
    const byDay = {}; for (const m of list) (byDay[new Date(m.utc_date).toDateString()] ??= []).push(m);
    const keys = Object.keys(byDay);
    $("#mbody").innerHTML = keys.length ? keys.map((k) => `<div class="comp-group"><div class="comp-head"><span class="nm" style="text-transform:capitalize">${fmtDay(byDay[k][0].utc_date)}</span><span class="cnt">${byDay[k].length}</span></div>${byDay[k].map((m) => matchRow(m)).join("")}</div>`).join("") : `<div class="empty-note">Нет матчей.</div>`;
    if (f === "all" && !team) { const up = $$("#mbody .comp-group").find((g, i) => { const d = byDay[keys[i]]; return d.some((m) => m.status !== "FINISHED"); }); up?.scrollIntoView({ block: "start", behavior: "instant" }); window.scrollBy(0, -110); }
  };
  box.innerHTML = `<div class="card"><div class="feed-tools"><div class="seg" id="mseg2"><button data-f="all" class="on">Все</button><button data-f="played">Сыгранные</button><button data-f="upcoming">Предстоящие</button></div>
    <select id="mteam" class="pill" style="margin-left:auto;border:0;appearance:auto"><option value="">Все команды</option>${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></div><div id="mbody"></div></div>`;
  $("#mseg2").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; f = b.dataset.f; $$("#mseg2 button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  $("#mteam").addEventListener("change", (e) => { team = e.target.value; draw(); });
  draw();
}
function sortableTable(el, cols, rows, o = {}) {
  let sk = o.sort || cols.find((c) => c.sort)?.k, dir = -1;
  const draw = () => {
    const rs = [...rows].sort((a, b) => { const va = cols.find((c) => c.k === sk)?.v?.(a) ?? a[sk], vb = cols.find((c) => c.k === sk)?.v?.(b) ?? b[sk]; const x = va ?? -1e9, y = vb ?? -1e9; const c = y > x ? 1 : y < x ? -1 : 0; return dir < 0 ? c : -c; }).slice(0, o.limit || 400);
    el.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th>${cols.map((c) => `<th class="${c.l ? "l" : ""} ${c.sort !== false ? "sortable" : ""} ${c.k === sk ? "sorted" : ""}" data-k="${c.k}" title="${esc(c.title || "")}">${c.h}${c.k === sk ? (dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead><tbody>
      ${rs.map((r, i) => `<tr ${o.href ? `onclick="location.hash='${o.href(r)}'" style="cursor:pointer"` : ""}><td class="muted">${i + 1}</td>${cols.map((c) => `<td class="${c.l ? "l" : ""}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>${rs.length ? "" : `<div class="empty-note">Нет данных под эти фильтры.</div>`}`;
    $$("th.sortable", el).forEach((th) => th.addEventListener("click", () => { if (sk === th.dataset.k) dir = -dir; else { sk = th.dataset.k; dir = -1; } draw(); }));
  };
  draw();
}
const p90 = (v, m) => (m ? (v / m) * 90 : 0);
function playerCols(per90) {
  const P = (k, d = 2) => ({ v: (r) => (per90 ? p90(r[k], r.minutes) : +r[k]), f: (r) => num(per90 ? p90(r[k], r.minutes) : r[k], per90 ? 2 : d) });
  return [
    { k: "name", h: "Игрок", l: 1, sort: false, f: (r) => `<span class="team">${avatar(r.player_id, r.name)}<span><b style="font-weight:600">${esc(r.name)}</b><br><small class="muted">${esc(posRu(r.position))}</small></span></span>` },
    { k: "team_short", h: "Команда", l: 1, sort: false, f: (r) => `<span class="team">${crest({ crest_url: r.crest_url }, "crest sm")}${esc(r.team_short)}</span>` },
    { k: "apps", h: "И", title: "Матчи" }, { k: "minutes", h: "Мин", title: "Минуты" },
    { k: "goals", h: "Г", title: "Голы", ...P("goals", 0) }, { k: "assists", h: "А", title: "Ассисты", ...P("assists", 0) },
    { k: "xg", h: "xG", title: "Ожидаемые голы", ...P("xg") }, { k: "xa", h: "xA", title: "Ожидаемые ассисты", ...P("xa") },
    { k: "gmx", h: "Г−xG", title: "Реализация выше/ниже ожидаемой", v: (r) => r.goals - r.xg, f: (r) => `<span style="color:${r.goals - r.xg >= 0 ? "var(--win)" : "var(--loss)"}">${sgn(r.goals - r.xg, 1)}</span>` },
    { k: "shots", h: "Удары", ...P("shots", 0) }, { k: "shots_on_target", h: "В створ", ...P("shots_on_target", 0) },
    { k: "fouls_won", h: "Фолы на нём", ...P("fouls_won", 0) },
    { k: "yellow", h: "ЖК" }, { k: "red", h: "КК" },
    { k: "rating", h: "Рейтинг", f: (r) => ratingChip(r.rating) },
  ];
}
async function leaguePlayers(id, box, params) {
  const ps = await getPlayerSeason(id);
  const s = new URLSearchParams(location.hash.split("?")[1] || "").get("s") || "goals";
  let pos = "ALL", per90 = false, minMin = 0, text = "";
  box.innerHTML = `<div class="card"><div class="feed-tools">
      <div class="seg" id="pseg"><button data-p="ALL" class="on">Все</button><button data-p="GK">Вр</button><button data-p="DF">Защ</button><button data-p="MF">ПЗ</button><button data-p="FW">Нап</button></div>
      <div class="seg" id="p90"><button data-v="0" class="on">Всего</button><button data-v="1">На 90</button></div>
      <label class="muted" style="font-size:13px;display:flex;align-items:center;gap:8px">Мин. минут <input id="minm" type="range" min="0" max="1500" step="90" value="0"><b id="minv" class="tnum">0</b></label>
      <input id="ptext" placeholder="Поиск игрока" style="margin-left:auto;font:inherit;font-size:13px;padding:7px 12px;border-radius:980px;border:1px solid var(--line);background:var(--bg-elev);color:var(--text);outline:none">
    </div><div id="ptbl"></div></div>`;
  const draw = () => {
    const rows = ps.filter((r) => (pos === "ALL" || posGroup(r.position) === pos) && r.minutes >= minMin && (!text || r.name.toLowerCase().includes(text)));
    sortableTable($("#ptbl"), playerCols(per90), rows, { sort: s, href: (r) => `#/player/${r.player_id}`, limit: 300 });
  };
  $("#pseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; pos = b.dataset.p; $$("#pseg button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  $("#p90").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; per90 = b.dataset.v === "1"; if (per90 && minMin < 270) { minMin = 270; $("#minm").value = 270; $("#minv").textContent = 270; } $$("#p90 button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  $("#minm").addEventListener("input", (e) => { minMin = +e.target.value; $("#minv").textContent = minMin; draw(); });
  $("#ptext").addEventListener("input", (e) => { text = e.target.value.toLowerCase(); draw(); });
  draw();
}
async function leagueTeams(id, box) {
  const ts = await getTeamSeason(id);
  const pg = (k, d = 1) => ({ v: (r) => r[k] / r.played, f: (r) => num(r[k] / r.played, d) });
  box.innerHTML = `<div class="card"><div class="feed-tools"><b>Командная статистика</b></div><div id="ttbl"></div></div>`;
  sortableTable($("#ttbl"), [
    { k: "name", h: "Команда", l: 1, sort: false, f: (r) => `<span class="team">${crest(r)}${esc(r.name)}</span>` },
    { k: "played", h: "И" },
    { k: "xg", h: "xG", ...pg("xg", 2) }, { k: "xga", h: "xGA", ...pg("xga", 2) },
    { k: "goals_for", h: "Голы", ...pg("goals_for", 2) }, { k: "goals_against", h: "Пропущ.", ...pg("goals_against", 2) },
    { k: "shots", h: "Удары", ...pg("shots") }, { k: "shots_on_target", h: "В створ", ...pg("shots_on_target") },
    { k: "possession", h: "Владение", f: (r) => num(r.possession, 1) + "%" }, { k: "passes_avg", h: "Пасы" }, { k: "pass_accuracy", h: "Точн.", f: (r) => num(r.pass_accuracy, 1) + "%" },
    { k: "tackles", h: "Отборы", ...pg("tackles") }, { k: "interceptions", h: "Перехв.", ...pg("interceptions") },
    { k: "clearances", h: "Выносы", ...pg("clearances") }, { k: "crosses", h: "Навесы", ...pg("crosses") },
    { k: "corners", h: "Угловые", ...pg("corners") }, { k: "fouls", h: "Фолы", ...pg("fouls") }, { k: "clean_sheets", h: "На ноль" },
  ], ts, { sort: "xg", href: (r) => `#/team/${r.team_id}` });
}
async function leagueXG(id, box) {
  const rows = await xgTable(id);
  box.innerHTML = `<div class="grid2">
    <div class="card"><div class="card-h">Очки vs ожидаемые очки (xPTS)</div><div class="card-b muted" style="font-size:13px">Выше диагонали — команда набирает больше, чем заслуживает по качеству моментов.</div><div class="chart-box"><canvas id="c1"></canvas></div></div>
    <div class="card"><div class="card-h">Атака vs оборона</div><div class="card-b muted" style="font-size:13px">xG за матч (создают) против xGA за матч (позволяют). Правый нижний угол — лучшие.</div><div class="chart-box"><canvas id="c2"></canvas></div></div>
  </div><div class="section-gap"></div><div class="card"><div class="card-h">Разница xG (xGD) по командам</div><div class="chart-box" style="height:${Math.max(300, rows.length * 22)}px"><canvas id="c3"></canvas></div></div>`;
  const imgs = await Promise.all(rows.map((r) => new Promise((res) => { const im = new Image(22, 22); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res("circle"); im.src = r.team.crest_url; })));
  const cs = getComputedStyle(document.documentElement); const tc = cs.getPropertyValue("--text-2"), gc = cs.getPropertyValue("--line-2");
  const base = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gc }, ticks: { color: tc } }, y: { grid: { color: gc }, ticks: { color: tc } } } };
  const tipName = { callbacks: { label: (ctx) => ctx.raw.n + ": " + ctx.raw.x.toFixed(2) + " / " + ctx.raw.y.toFixed(2) } };
  const mx = Math.max(...rows.map((r) => Math.max(r.pts, r.xpts))) + 2;
  charts.push(new Chart($("#c1"), { type: "scatter", data: { datasets: [
    { data: rows.map((r) => ({ x: r.xpts, y: r.pts, n: r.team.name })), pointStyle: imgs, pointRadius: 11 },
    { type: "line", data: [{ x: 0, y: 0 }, { x: mx, y: mx }], borderColor: gc, borderDash: [4, 4], pointRadius: 0 } ] },
    options: { ...base, plugins: { legend: { display: false }, tooltip: tipName }, scales: { x: { ...base.scales.x, title: { display: true, text: "xPTS", color: tc }, min: 0 }, y: { ...base.scales.y, title: { display: true, text: "Очки", color: tc }, min: 0 } } } }));
  charts.push(new Chart($("#c2"), { type: "scatter", data: { datasets: [{ data: rows.map((r) => ({ x: r.xg / r.played, y: r.xga / r.played, n: r.team.name })), pointStyle: imgs, pointRadius: 11 }] },
    options: { ...base, plugins: { legend: { display: false }, tooltip: tipName }, scales: { x: { ...base.scales.x, title: { display: true, text: "xG за матч", color: tc } }, y: { ...base.scales.y, reverse: true, title: { display: true, text: "xGA за матч (меньше — лучше)", color: tc } } } } }));
  const sorted = [...rows].sort((a, b) => (b.xg - b.xga) - (a.xg - a.xga));
  charts.push(new Chart($("#c3"), { type: "bar", data: { labels: sorted.map((r) => r.team.short_name || r.team.name), datasets: [{ data: sorted.map((r) => +(r.xg - r.xga).toFixed(2)), backgroundColor: sorted.map((r) => (r.xg - r.xga >= 0 ? "#34c759" : "#ff3b30")), borderRadius: 4 }] },
    options: { ...base, indexAxis: "y" } }));
}

/* ================= TEAM ================= */
async function viewTeam(id, tab) {
  const [team] = await run(sb.from("teams").select("*").eq("id", id));
  if (!team) { app().innerHTML = `<div class="wrap"><div class="card"><div class="empty-note">Команда не найдена.</div></div></div>`; return; }
  setTC(team);
  const comps = await run(sb.from("standings").select("*,team:teams(" + TEAM_SEL + ")").eq("team_id", id));
  const league = comps.find((c) => !CUP_IDS.has(c.competition_id)) || comps[0];
  const fav = favTeams().some((t) => t.id === id);
  const tabs = [["overview", "Обзор"], ["matches", "Матчи"], ["squad", "Состав"], ["stats", "Статистика"], ["table", "Таблица"]];
  app().innerHTML = `<div class="wrap">${localnav(`${crest(team)}<span class="t">${esc(team.name)}</span>`, tabs, tab, `#/team/${id}`)}
    <div class="card"><div class="hero">${crest(team, "crest lg")}<div class="meta"><h1 class="title">${esc(team.name)}</h1>
      <p>${comps.map((c) => `${COMP[c.competition_id]?.short}: ${c.position}-е место, ${c.points} очк.`).join(" · ") || ""}</p></div>
      <div class="hero-actions"><button class="btn ghost ${fav ? "on" : ""}" id="followBtn">${fav ? "✓ Вы следите" : "+ Следить"}</button></div></div><div style="height:24px"></div></div>
    <div class="section-gap"></div><div id="tcontent">${skel(8)}</div></div>`;
  $("#followBtn").addEventListener("click", (e) => { const on = toggleFavTeam(team); e.target.classList.toggle("on", on); e.target.textContent = on ? "✓ Вы следите" : "+ Следить"; });
  const box = $("#tcontent");
  const ms = await run(sb.from("matches").select(M_SEL).or(`home_team_id.eq.${id},away_team_id.eq.${id}`).order("utc_date"));
  if (tab === "overview") return teamOverview(team, ms, comps, league, box);
  if (tab === "matches") { box.innerHTML = `<div class="card">${ms.map((m) => `<div style="display:flex;align-items:center"><img src="${COMP[m.competition_id]?.logo}" style="width:18px;margin-left:16px" alt="" title="${COMP[m.competition_id]?.name}"><div style="flex:1">${matchRow(m, { showDate: true })}</div></div>`).join("")}</div>`; return; }
  if (tab === "squad") return teamSquad(id, box);
  if (tab === "stats") return teamStats(team, comps, box);
  if (tab === "table") { if (!league) { box.innerHTML = `<div class="card"><div class="empty-note">Нет таблицы.</div></div>`; return; } const st = await getStandings(league.competition_id); const cms = await getCompMatches(league.competition_id); box.innerHTML = `<div class="card"><div class="card-h">${COMP[league.competition_id].name}</div>${standingsTable(st, id, { forms: formsFrom(cms) })}</div>`; return; }
}
async function teamOverview(team, ms, comps, league, box) {
  const id = team.id;
  const fin = ms.filter((m) => m.status === "FINISHED"), up = ms.filter((m) => m.status !== "FINISHED" && m.status !== "POSTPONED");
  const nx = up[0];
  const form = fin.slice(-5).map((m) => resultFor(m, id));
  const ps = await run(sb.from("v_player_season").select("*").eq("team_id", id));
  const agg = {}; for (const p of ps) { const a = (agg[p.player_id] ??= { ...p, goals: 0, assists: 0, xg: 0, minutes: 0, apps: 0, rsum: 0, rn: 0 }); a.goals += p.goals; a.assists += p.assists; a.xg += +p.xg; a.minutes += p.minutes; a.apps += p.apps; if (p.rating) { a.rsum += p.rating * p.apps; a.rn += p.apps; } }
  const pl = Object.values(agg).map((a) => ({ ...a, rating: a.rn ? a.rsum / a.rn : null }));
  const top = (k, lbl, d = 0, filt = () => true) => `<div class="card"><div class="card-h">${lbl}</div>${pl.filter(filt).sort((a, b) => b[k] - a[k]).slice(0, 3).map((r) => `<a class="lead" href="#/player/${r.player_id}">${avatar(r.player_id, r.name)}<div class="who"><div>${esc(r.name)}</div><small>${esc(posRu(r.position))}</small></div><span class="v">${k === "rating" ? ratingChip(r.rating) : num(r[k], d)}</span></a>`).join("")}<div style="height:8px"></div></div>`;
  const ts = league ? (await getTeamSeason(league.competition_id)).find((t) => t.team_id === id) : null;
  box.innerHTML = `<div class="cols two"><main>
    ${nx ? `<div class="card"><div class="card-h">Следующий матч<span class="more muted">${COMP[nx.competition_id]?.name}</span></div><a class="next-match" href="#/match/${nx.id}"><div class="t">${crest(nx.home, "crest md")}${esc(nx.home.name)}</div><div class="c"><b>${fmtTime(nx.utc_date)}</b>${fmtDay(nx.utc_date)}</div><div class="t">${crest(nx.away, "crest md")}${esc(nx.away.name)}</div></a></div>` : ""}
    <div class="card"><div class="card-h">Сезон в цифрах</div><div class="card-b"><div class="tiles">
      ${league ? `<div class="tile"><div class="v">${league.position}</div><div class="k">Место · ${COMP[league.competition_id].short}</div></div><div class="tile"><div class="v">${league.points}</div><div class="k">Очки</div></div><div class="tile"><div class="v">${league.goals_for}:${league.goals_against}</div><div class="k">Мячи</div></div>` : ""}
      ${ts ? `<div class="tile"><div class="v">${num(ts.xg, 1)}</div><div class="k">xG</div></div><div class="tile"><div class="v">${num(ts.xga, 1)}</div><div class="k">xGA</div></div><div class="tile"><div class="v">${num(ts.possession, 0)}%</div><div class="k">Владение</div></div><div class="tile"><div class="v">${ts.clean_sheets}</div><div class="k">Сухие матчи</div></div>` : ""}
      <div class="tile"><div class="v" style="font-size:16px;padding:5px 0">${formHtml(form)}</div><div class="k">Форма</div></div>
    </div></div></div>
    <div class="section-gap"></div>
    <div class="leaders-grid">${top("goals", "Бомбардиры")}${top("assists", "Ассистенты")}${top("xg", "xG", 2)}${top("rating", "Рейтинг", 1, (r) => r.minutes >= 180)}</div>
  </main><aside class="side">
    <div class="card"><div class="card-h">Последние матчи<a class="more" href="#/team/${id}/matches">Все</a></div>${fin.slice(-6).reverse().map((m) => matchRow(m, { showDate: true })).join("") || `<div class="empty-note">Нет сыгранных матчей.</div>`}<div style="height:8px"></div></div>
    <div class="card"><div class="card-h">Предстоящие</div>${up.slice(0, 5).map((m) => matchRow(m, { showDate: true })).join("") || `<div class="empty-note">Нет запланированных матчей.</div>`}<div style="height:8px"></div></div>
  </aside></div>`;
}
async function teamSquad(id, box) {
  const [players, ps] = await Promise.all([run(sb.from("players").select("*").eq("team_id", id)), run(sb.from("v_player_season").select("*").eq("team_id", id))]);
  const agg = {}; for (const p of ps) { const a = (agg[p.player_id] ??= { apps: 0, minutes: 0, goals: 0, assists: 0, xg: 0, rs: 0, rn: 0, yellow: 0 }); a.apps += p.apps; a.minutes += p.minutes; a.goals += p.goals; a.assists += p.assists; a.xg += +p.xg; a.yellow += p.yellow; if (p.rating) { a.rs += p.rating * p.apps; a.rn += p.apps; } }
  const groups = ["GK", "DF", "MF", "FW"];
  box.innerHTML = groups.map((g) => {
    const list = players.filter((p) => posGroup(p.position) === g).sort((a, b) => (agg[b.id]?.minutes || 0) - (agg[a.id]?.minutes || 0));
    if (!list.length) return "";
    return `<div class="card"><div class="card-h">${POS_RU_PL[g]}<span class="more muted">${list.length}</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>№</th><th class="l">Игрок</th><th>И</th><th>Мин</th><th>Г</th><th>А</th><th>xG</th><th>ЖК</th><th>Рейтинг</th></tr></thead><tbody>
      ${list.map((p) => { const a = agg[p.id] || {}; return `<tr onclick="location.hash='#/player/${p.id}'" style="cursor:pointer"><td class="muted">${esc(p.raw?.jersey || "")}</td><td class="l"><span class="team">${avatar(p.id, p.name)}<span><b style="font-weight:600">${esc(p.name)}</b><br><small class="muted">${esc(p.position || "")}</small></span></span></td><td>${a.apps || 0}</td><td>${a.minutes || 0}</td><td>${a.goals || 0}</td><td>${a.assists || 0}</td><td>${num(a.xg || 0, 2)}</td><td>${a.yellow || 0}</td><td>${ratingChip(a.rn ? a.rs / a.rn : null)}</td></tr>`; }).join("")}
    </tbody></table></div></div>`;
  }).join("") || `<div class="card"><div class="empty-note">Нет данных</div></div>`;
}
async function teamStats(team, comps, box) {
  const parts = await Promise.all(comps.map(async (c) => {
    const all = await getTeamSeason(c.competition_id); const me = all.find((t) => t.team_id === team.id); if (!me) return "";
    const metrics = [["xg", "xG за матч", 1, 2], ["xga", "xGA за матч", -1, 2], ["goals_for", "Голы за матч", 1, 2], ["goals_against", "Пропущено за матч", -1, 2], ["shots", "Удары за матч", 1, 1], ["shots_on_target", "Удары в створ", 1, 1], ["possession", "Владение, %", 1, 1, true], ["pass_accuracy", "Точность паса, %", 1, 1, true], ["passes_avg", "Пасы за матч", 1, 0, true], ["tackles", "Отборы за матч", 1, 1], ["interceptions", "Перехваты за матч", 1, 1], ["corners", "Угловые за матч", 1, 1], ["fouls", "Фолы за матч", -1, 1], ["xgd", "Разница xG за матч", 1, 2], ["sot_pct", "Точность ударов, %", 1, 1], ["conv", "Реализация, % (голы/удары)", 1, 1]];
    const val = (t, k, abs) => k === "xgd" ? (t.xg - t.xga) / t.played : k === "sot_pct" ? (t.shots ? t.shots_on_target / t.shots * 100 : 0) : k === "conv" ? (t.shots ? t.goals_for / t.shots * 100 : 0) : (abs ? +t[k] : t[k] / t.played);
    return `<div class="card"><div class="card-h"><img src="${COMP[c.competition_id].logo}" class="crest" alt="">${COMP[c.competition_id].name}<span class="more muted">перцентиль среди ${all.length} команд</span></div><div class="card-b">
      ${metrics.map(([k, l, dir, d, abs]) => { const v = val(me, k, abs); const arr = all.map((t) => val(t, k, abs)); const pct = Math.round((arr.filter((x) => (dir > 0 ? x < v : x > v)).length / Math.max(1, arr.length - 1)) * 100); return pctRow(l, num(v, d), pct); }).join("")}
    </div></div>`;
  }));
  box.innerHTML = parts.join("") || `<div class="card"><div class="empty-note">Нет данных.</div></div>`;
}
function pctColor() { return "var(--tc)"; }
function setTC(t) { const c = teamColor(t); document.documentElement.style.setProperty("--tc", c ? fitColor(c) : "var(--accent,#0a6cff)"); }
const pctRow = (l, v, p) => `<div class="pct-row"><div>${l}<div class="val">${v}</div></div><div class="pct-bar"><i style="width:${Math.max(3, p)}%;background:${pctColor(p)}"></i></div><div class="n">${p}</div></div>`;

/* ================= PLAYER ================= */
async function viewPlayer(id) {
  const [p] = await run(sb.from("players").select("*,team:teams(" + TEAM_SEL + ",country)").eq("id", id));
  if (!p) { app().innerHTML = `<div class="wrap"><div class="card"><div class="empty-note">Игрок не найден.</div></div></div>`; return; }
  const [seasons, logs, shots] = await Promise.all([
    run(sb.from("v_player_season").select("*").eq("player_id", id)),
    run(sb.from("player_match_stats").select("*,m:matches!inner(" + M_SEL.replace("*,", "id,utc_date,competition_id,home_team_id,away_team_id,home_goals,away_goals,status,") + ")").eq("player_id", id)).then((r) => r.sort((a, b) => new Date(b.m.utc_date) - new Date(a.m.utc_date))),
    run(sb.from("match_events").select("match_id,minute,type,raw,detail").eq("player_id", id).in("type", ["goal", "penalty_goal", "penalty_missed", "shot_on", "shot_off", "shot_blocked", "woodwork"])),
  ]);
  const tot = seasons.reduce((a, s) => { for (const k of ["apps", "starts", "minutes", "goals", "assists", "shots", "shots_on_target", "yellow", "red"]) a[k] = (a[k] || 0) + s[k]; a.xg = (a.xg || 0) + +s.xg; a.xa = (a.xa || 0) + +s.xa; if (s.rating) { a.rs = (a.rs || 0) + s.rating * s.apps; a.rn = (a.rn || 0) + s.apps; } return a; }, {});
  const g = posGroup(p.position); setTC(p.team);
  app().innerHTML = `<div class="wrap">
    <div class="card"><div class="hero">${avatar(p.id, p.name, "avatar xl")}<div class="meta"><div class="eyebrow"><a class="link" href="#/team/${p.team?.id}">${esc(p.team?.name || "")}</a> · ${esc(p.position || POS_RU[g])}${p.raw?.jersey ? " · №" + esc(p.raw.jersey) : ""}</div><h1 class="title">${esc(p.name)}</h1></div>
      <div class="hero-actions"><a class="btn" href="#/compare?a=${p.id}">Сравнить</a></div></div>
      <div class="card-b" style="padding-top:22px"><div class="tiles">
        <div class="tile"><div class="v">${tot.apps || 0}</div><div class="k">Матчи (${tot.starts || 0} в старте)</div></div><div class="tile"><div class="v">${tot.minutes || 0}</div><div class="k">Минуты</div></div>
        <div class="tile"><div class="v">${tot.goals || 0}</div><div class="k">Голы</div></div><div class="tile"><div class="v">${tot.assists || 0}</div><div class="k">Ассисты</div></div>
        <div class="tile"><div class="v">${num(tot.xg || 0, 2)}</div><div class="k">xG</div></div><div class="tile"><div class="v">${num(tot.xa || 0, 2)}</div><div class="k">xA</div></div>
        <div class="tile"><div class="v">${tot.shots || 0}</div><div class="k">Удары (${tot.shots_on_target || 0} в створ)</div></div>
        <div class="tile"><div class="v">${tot.rn ? num(tot.rs / tot.rn, 2) : "–"}</div><div class="k">Средний рейтинг</div></div><div class="tile"><div class="v">${num(p90(tot.goals || 0, tot.minutes || 0), 2)}</div><div class="k">Голы /90</div></div><div class="tile"><div class="v">${num((tot.xg || 0) + (tot.xa || 0), 2)}</div><div class="k">xG+xA</div></div><div class="tile"><div class="v">${tot.shots ? Math.round(tot.shots_on_target / tot.shots * 100) + "%" : "–"}</div><div class="k">Точность ударов</div></div><div class="tile"><div class="v">${tot.yellow || 0}/${tot.red || 0}</div><div class="k">Жёлтые / красные</div></div>
      </div></div></div>
    <div class="section-gap"></div>
    <div class="grid2"><div class="card" id="pctCard"><div class="card-h">Перцентили</div>${skel(6)}</div>
      <div class="card"><div class="card-h">Карта ударов<span class="more muted">${shots.length} ударов · xG ${num(shots.reduce((s, x) => s + (+x.raw?.xg || 0), 0), 2)}</span></div><div class="pitch-wrap">${shots.length ? halfPitchShots(shots) : `<div class="empty-note">Нет ударов с координатами.</div>`}</div></div></div>
    <div class="section-gap"></div>
    <div class="card"><div class="card-h">По турнирам</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Турнир</th><th class="l">Команда</th><th>И</th><th>Мин</th><th>Г</th><th>А</th><th>xG</th><th>xA</th><th>Удары</th><th>ЖК</th><th>Рейтинг</th></tr></thead><tbody>
      ${seasons.map((s) => `<tr><td class="l"><a class="team" href="#/league/${s.competition_id}"><img src="${COMP[s.competition_id]?.logo}" class="crest sm" alt="">${COMP[s.competition_id]?.name}</a></td><td class="l">${esc(s.team_short)}</td><td>${s.apps}</td><td>${s.minutes}</td><td>${s.goals}</td><td>${s.assists}</td><td>${num(s.xg, 2)}</td><td>${num(s.xa, 2)}</td><td>${s.shots}</td><td>${s.yellow}</td><td>${ratingChip(s.rating)}</td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="section-gap"></div>
    <div class="card"><div class="card-h">Матчи</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th class="l">Дата</th><th class="l">Матч</th><th>Мин</th><th>Г</th><th>А</th><th>Удары</th><th>xG</th><th>Рейтинг</th></tr></thead><tbody>
      ${logs.filter((l) => l.minutes > 0).map((l) => { const m = l.m; const r = resultFor({ ...m }, l.team_id); return `<tr onclick="location.hash='#/match/${m.id}'" style="cursor:pointer"><td class="l muted">${fmtDate(m.utc_date)}</td><td class="l"><span class="team">${crest(m.home, "crest sm")}${esc(m.home?.short_name)} <b>${m.home_goals ?? ""}–${m.away_goals ?? ""}</b> ${esc(m.away?.short_name)}${crest(m.away, "crest sm")} ${r ? formHtml([r]) : ""}</span></td><td>${l.minutes}'</td><td>${l.goals || ""}</td><td>${l.assists || ""}</td><td>${l.shots || 0}</td><td>${num(l.xg, 2)}</td><td>${ratingChip(l.rating)}</td></tr>`; }).join("") || `<tr><td colspan="8" class="muted">Нет сыгранных матчей.</td></tr>`}
    </tbody></table></div></div>
  </div>`;
  // percentiles vs same position, same main competition
  const main = seasons.filter((s) => !CUP_IDS.has(s.competition_id)).sort((a, b) => b.minutes - a.minutes)[0] || seasons[0];
  if (!main) { $("#pctCard").innerHTML = `<div class="card-h">Перцентили</div><div class="empty-note">Нет данных.</div>`; return; }
  const pool = (await getPlayerSeason(main.competition_id)).filter((r) => posGroup(r.position) === g && r.minutes >= 270);
  const me = main;
  const mets = pctMetrics(g);
  $("#pctCard").innerHTML = `<div class="card-h">Перцентили<span class="more muted">vs ${POS_RU_PL[g].toLowerCase()} · ${COMP[main.competition_id].short} · ${pool.length} игроков</span></div><div class="card-b">${me.minutes < 270 ? `<div class="muted" style="font-size:13px;padding-bottom:8px">Мало минут (<270) — перцентили ориентировочные.</div>` : ""}${mets.map(([l, f, d]) => { const v = f(me); const arr = pool.map(f); const pct = Math.round((arr.filter((x) => x < v).length / Math.max(1, arr.length)) * 100); return pctRow(l, num(v, d), pct); }).join("")}</div>`;
}
function pctMetrics(g) {
  const per = (k) => (r) => p90(+r[k], r.minutes);
  const base = [["Голы /90", per("goals"), 2], ["xG /90", per("xg"), 2], ["Удары /90", per("shots"), 2], ["В створ /90", per("shots_on_target"), 2], ["Ассисты /90", per("assists"), 2], ["xA /90", per("xa"), 2], ["xG+xA /90", (r) => p90(+r.xg + +r.xa, r.minutes), 2], ["Точность ударов, %", (r) => (r.shots ? r.shots_on_target / r.shots * 100 : 0), 0], ["Фолы на нём /90", per("fouls_won"), 2], ["Фолы /90 (инв.)", (r) => -p90(+r.fouls, r.minutes), 2], ["one рейтинг", (r) => +r.rating || 0, 2]];
  if (g === "GK") return [["Сейвы /90", per("saves"), 2], ["Пропущено /90 (инв.)", (r) => -p90(r.conceded, r.minutes), 2], ["% отражённых", (r) => (r.shots_faced ? (r.saves / r.shots_faced) * 100 : 0), 0], ["one рейтинг", (r) => +r.rating || 0, 2]];
  return base;
}

/* ---------------- pitch drawing ---------------- */
const pitchLinesV = `<svg class="lines" viewBox="0 0 68 105" preserveAspectRatio="none"><g fill="none" stroke="var(--pitch-line)" stroke-width=".35"><rect x="1" y="1" width="66" height="103"/><line x1="1" y1="52.5" x2="67" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><rect x="13.85" y="1" width="40.3" height="16.5"/><rect x="24.85" y="1" width="18.3" height="5.5"/><rect x="13.85" y="87.5" width="40.3" height="16.5"/><rect x="24.85" y="98.5" width="18.3" height="5.5"/></g></svg>`;
const pitchLinesH = `<svg class="lines" viewBox="0 0 105 68" preserveAspectRatio="none"><g fill="none" stroke="var(--pitch-line)" stroke-width=".35"><rect x="1" y="1" width="103" height="66"/><line x1="52.5" y1="1" x2="52.5" y2="67"/><circle cx="52.5" cy="34" r="9.15"/><rect x="1" y="13.85" width="16.5" height="40.3"/><rect x="1" y="24.85" width="5.5" height="18.3"/><rect x="87.5" y="13.85" width="16.5" height="40.3"/><rect x="98.5" y="24.85" width="5.5" height="18.3"/></g></svg>`;
const halfLines = `<svg class="lines" viewBox="0 0 68 52.5" preserveAspectRatio="none"><g fill="none" stroke="var(--pitch-line)" stroke-width=".35"><rect x="1" y="1" width="66" height="51.5"/><rect x="13.85" y="1" width="40.3" height="16.5"/><rect x="24.85" y="1" width="18.3" height="5.5"/><path d="M24.85 17.5a9.15 9.15 0 0018.3 0"/><path d="M24.85 52.5a9.15 9.15 0 0118.3 0"/></g></svg>`;
function shotCls(t) { return t === "goal" || t === "penalty_goal" ? "goal" : t === "shot_on" || t === "woodwork" ? "on" : t === "shot_blocked" ? "blk" : "off"; }
const SHOT_RU = { goal: "Гол", penalty_goal: "Гол с пенальти", penalty_missed: "Нереализованный пенальти", shot_on: "Удар в створ", shot_off: "Мимо", shot_blocked: "Заблокирован", woodwork: "Каркас ворот" };
function shotTip(s) { return `<b>${esc(s.raw?.names?.[0] || "")}</b>${SHOT_RU[s.type]} · ${s.raw?.clock || s.minute + "'"}<br>xG ${num(s.raw?.xg, 2)} · ${s.raw?.header ? "головой" : s.raw?.foot === "L" ? "левой" : s.raw?.foot === "R" ? "правой" : ""}${s.raw?.assist ? "<br>Пас: " + esc(s.raw.assist) : ""}`; }
function halfPitchShots(shots) {
  return `<div class="pitch shotmap" style="aspect-ratio:68/52.5">${halfLines}${shots.filter((s) => s.raw?.x != null).map((s) => { const sz = 8 + Math.sqrt(+s.raw.xg || 0.02) * 30; const left = 100 - s.raw.y, top = ((100 - s.raw.x) / 50) * 100; return `<span class="shot ${shotCls(s.type)}" style="left:${left}%;top:${top}%;width:${sz}px;height:${sz}px" data-tip="${esc(shotTip(s))}"></span>`; }).join("")}</div>
  <div class="legend" style="padding:10px 0 0"><span><i style="background:var(--win)"></i>Гол</span><span><i style="background:#fff;border:1px solid var(--line)"></i>В створ</span><span><i style="background:rgba(127,127,127,.3)"></i>Мимо/блок</span><span>Размер = xG</span></div>`;
}
document.addEventListener("mouseover", (e) => { const s = e.target.closest("[data-tip]"); const tip = $("#tip"); if (!s) { tip.classList.remove("show"); return; } tip.innerHTML = s.dataset.tip; tip.classList.add("show"); const r = s.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 270, r.left + r.width / 2 + 10) + "px"; tip.style.top = r.top - 10 - tip.offsetHeight + "px"; });

/* ================= MATCH ================= */
/* ---------------- team colors (match page stats) ---------------- */
const TEAM_COLORS = [
  [/paris fc/, "#2E6BB5"], [/aek/, "#E8B800"], [/coventry/, "#59B3E6"], [/deportivo/, "#1D4F9C"], [/fenerbahce/, "#F5C400"], [/frosinone/, "#E8C400"], [/hull/, "#F5A100"], [/ipswich/, "#1D4F9C"], [/lask/, "#2B2B2B"], [/le mans/, "#E8B800"], [/malaga/, "#2B7BD0"], [/monza/, "#D2122E"], [/paderborn/, "#1D4F9C"], [/racing/, "#00875A"], [/sabah/, "#6A3FA0"], [/schalke/, "#004D9D"], [/bratislava/, "#4EA3DC"], [/elversberg/, "#2B2B2B"], [/troyes/, "#1D4F9C"], [/venezia/, "#E87A00"], [/viking/, "#1D4F9C"], [/rennes|rennais/, "#E13327"],
  [/germany/, "#2B2B2B"], [/netherlands|holland/, "#FF6A00"], [/france/, "#1C3F8A"], [/england/, "#1D2C5E"], [/spain/, "#C60B1E"], [/italy/, "#0A5CA8"], [/portugal/, "#C8102E"], [/croatia/, "#D2122E"], [/belgium/, "#E30613"], [/switzerland/, "#D52B1E"], [/austria/, "#ED2939"], [/denmark/, "#C8102E"], [/norway/, "#BA0C2F"], [/sweden/, "#F2C500"], [/poland/, "#DC143C"], [/czech/, "#D7141A"], [/scotland/, "#0A3D8F"], [/wales/, "#C8102E"], [/northern ireland/, "#169B62"], [/republic of ireland|^ireland/, "#169B62"], [/turkey|turkiye/, "#E30A17"], [/greece/, "#0D5EAF"], [/serbia/, "#C6363C"], [/ukraine/, "#F2C500"], [/hungary/, "#CE2939"], [/romania/, "#F2C500"], [/slovakia/, "#0B4EA2"], [/slovenia/, "#1B5BA8"], [/bulgaria/, "#1D9053"], [/israel/, "#0A5CA8"], [/iceland/, "#02529C"], [/finland/, "#0A5CA8"], [/albania/, "#E41E20"], [/georgia/, "#E30613"], [/kazakhstan/, "#00AFCA"], [/bosnia/, "#1B4F9C"], [/montenegro/, "#C8102E"], [/luxembourg/, "#00A1DE"], [/armenia/, "#F2A800"], [/azerbaijan/, "#009FDC"], [/belarus/, "#D22730"], [/north macedonia/, "#D20000"], [/estonia/, "#0072CE"], [/latvia/, "#9E3039"], [/lithuania/, "#FDB913"], [/cyprus/, "#0A5CA8"], [/malta/, "#CF142B"], [/kosovo/, "#244AA5"], [/moldova/, "#0A3D8F"], [/faroe/, "#0A5CA8"], [/gibraltar/, "#D22730"], [/andorra/, "#0A3D8F"], [/san marino/, "#5EB6E4"], [/liechtenstein/, "#C8102E"],
  [/arsenal/, "#EF0107"], [/aston villa/, "#7A263A"], [/bournemouth/, "#DA291C"], [/brentford/, "#E30613"], [/brighton/, "#0057B8"], [/burnley/, "#6C1D45"], [/chelsea/, "#034694"], [/crystal palace/, "#1B458F"], [/everton/, "#003399"], [/fulham/, "#2B2B2B"], [/leeds/, "#E6B800"], [/liverpool/, "#C8102E"], [/man(chester)? ?c/, "#6CABDD"], [/man(chester)? ?u/, "#DA291C"], [/newcastle/, "#2B2B2B"], [/nottingham|forest/, "#DD0000"], [/sunderland/, "#EB172B"], [/tottenham|spurs/, "#132257"], [/west ham/, "#7A263A"], [/wolverhampton|wolves/, "#E8A500"],
  [/barcelona/, "#A50044"], [/real madrid/, "#E8B400"], [/atletico/, "#CB3524"], [/athletic/, "#EE2523"], [/real sociedad/, "#0067B1"], [/villarreal/, "#E8C600"], [/betis/, "#0BB363"], [/sevilla/, "#D4021D"], [/valencia/, "#EE7F00"], [/girona/, "#CD2534"], [/celta/, "#6FA8DC"], [/osasuna/, "#D91A21"], [/mallorca/, "#E20613"], [/getafe/, "#005999"], [/rayo/, "#E53027"], [/espanyol/, "#007FC8"], [/alaves/, "#0761AF"], [/elche/, "#00875A"], [/levante/, "#B4053F"], [/oviedo/, "#1D4F9C"],
  [/inter(?!\s?miami)/, "#0068A8"], [/\bmilan\b/, "#FB090B"], [/juventus/, "#2B2B2B"], [/napoli/, "#12A0D7"], [/\broma\b/, "#8E1F2F"], [/lazio/, "#6EC6EE"], [/atalanta/, "#1E71B8"], [/fiorentina/, "#5B2A86"], [/bologna/, "#A52A2A"], [/torino/, "#8A1E41"], [/genoa/, "#A52A2A"], [/udinese/, "#666666"], [/cagliari/, "#A6192E"], [/sassuolo/, "#00A550"], [/lecce/, "#E8B800"], [/parma/, "#E8C400"], [/como/, "#1E4D9B"], [/verona/, "#E8C400"], [/cremonese/, "#C8102E"], [/pisa/, "#0A3D8F"],
  [/bayern/, "#DC052D"], [/dortmund/, "#E8C800"], [/leverkusen/, "#E32221"], [/leipzig/, "#DD0741"], [/stuttgart/, "#E32219"], [/frankfurt/, "#E1000F"], [/monchengladbach|gladbach/, "#00A650"], [/wolfsburg/, "#65B32E"], [/freiburg/, "#D40000"], [/hoffenheim/, "#1961B5"], [/mainz/, "#C3141E"], [/union berlin/, "#EB1923"], [/werder|bremen/, "#1D9053"], [/augsburg/, "#BA3733"], [/heidenheim/, "#E2001A"], [/pauli/, "#6B3A2A"], [/koln|cologne/, "#ED1C24"], [/hamburg/, "#0A3F7E"],
  [/paris|psg/, "#004170"], [/marseille/, "#2FAEE0"], [/lyon/, "#1C3F8A"], [/monaco/, "#E4002B"], [/lille/, "#E4002B"], [/nice/, "#C8102E"], [/\blens\b/, "#E8B800"], [/rennes/, "#E13327"], [/strasbourg/, "#009FE3"], [/nantes/, "#E8C400"], [/toulouse/, "#6A3FA0"], [/brest/, "#E2001A"], [/reims/, "#D01F2E"], [/lorient/, "#F58220"], [/angers/, "#2B2B2B"], [/auxerre/, "#0A5CA8"], [/le havre/, "#0A5CA8"], [/metz/, "#8A1538"], [/paris fc/, "#2E6BB5"],
  [/benfica/, "#E30613"], [/porto/, "#003D84"], [/sporting/, "#008057"], [/ajax/, "#D2122E"], [/psv/, "#E2001A"], [/celtic/, "#16A34A"], [/galatasaray/, "#E8A500"], [/brugge/, "#0C6BAF"], [/slavia/, "#D2122E"], [/feyenoord/, "#E2001A"], [/salzburg/, "#D2122E"], [/copenhagen/, "#2A5CA8"], [/olympiacos/, "#D2122E"], [/kairat/, "#E8B800"], [/qarabag/, "#2B2B2B"], [/pafos/, "#0A5CA8"], [/bodo|glimt/, "#E8C400"], [/union saint|saint-gilloise/, "#E8C400"], [/shakhtar/, "#F58220"],
];
function teamColor(t) {
  const n = ((t?.name || "") + " " + (t?.short_name || "")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hit = TEAM_COLORS.find(([re]) => re.test(n));
  return hit ? hit[1] : null;
}
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const lumOf = (h) => { const [r, g, b] = hex2rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
function fitColor(h) {
  const dark = document.documentElement.dataset.theme === "dark", l = lumOf(h);
  if (dark && l < 0.28) return rgb2hex(hex2rgb(h).map((v) => v + (255 - v) * 0.45));
  if (!dark && l > 0.62) return rgb2hex(hex2rgb(h).map((v) => v * 0.78));
  return h;
}
function applyMatchColors(m) {
  const root = document.documentElement.style;
  let a = teamColor(m.home), b = teamColor(m.away);
  if (a) a = fitColor(a); if (b) b = fitColor(b);
  if (a && b) { const x = hex2rgb(a), y = hex2rgb(b); if (Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110) b = fitColor(lumOf(a) > 0.45 ? "#1F2A44" : "#E8B800"); }
  if (a) root.setProperty("--home", a); if (b) root.setProperty("--away", b);
}

/* Мягкое обновление матча: страница не перерисовывается, подменяются только шапка и содержимое вкладки.
   Всё остальное (в т.ч. плеер трансляции) остаётся нетронутым, скролл не сбрасывается. */
let softBusy = false;
async function softMatch(id, tab) {
  const live = $("#app"), cont = $("#mcontent"), wrap = live && $(".wrap", live), card = wrap && $(".card", wrap), nav = wrap && $(".localnav", wrap);
  if (softBusy || !cont || !card || !nav || document.hidden) return;
  softBusy = true;
  const tmp = document.createElement("div"); tmp.id = "app"; tmp.style.cssText = "position:fixed;left:-99999px;top:0;width:900px;visibility:hidden";
  live.id = "app_live"; cont.id = "mcontent_live"; document.body.appendChild(tmp);
  try {
    memo.clear(); killCharts();
    await viewMatch(id, tab);
    const nw = $(".wrap", tmp);
    if (nw && location.hash.startsWith("#/match/" + id) && cont.isConnected) {
      card.innerHTML = $(".card", nw).innerHTML;
      const nn = $(".localnav", nw); if (nn) nav.innerHTML = nn.innerHTML;
      cont.replaceChildren(...$("#mcontent", tmp).childNodes);
    }
  } catch (e) { console.warn("[soft]", e); }
  finally { live.id = "app"; cont.id = "mcontent"; tmp.remove(); softBusy = false; }
}

async function viewMatch(id, tab) {
  const [m] = await run(sb.from("matches").select(M_SEL).eq("id", id));
  if (!m) { app().innerHTML = `<div class="wrap"><div class="card"><div class="empty-note">Матч не найден.</div></div></div>`; return; }
  applyMatchColors(m);
  const [ts, pms, evs] = await Promise.all([
    run(sb.from("team_match_stats").select("*").eq("match_id", id)),
    run(sb.from("player_match_stats").select("*,player:players(name,raw)").eq("match_id", id)),
    run(sb.from("match_events").select("*").eq("match_id", id).order("minute")),
  ]);
  evs.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0) || (a.raw?.extra || 0) - (b.raw?.extra || 0) || (a.raw?.seq || 0) - (b.raw?.seq || 0));
  const c = COMP[m.competition_id];
  const live = m.status === "LIVE" || m.status === "PAUSED", played = m.home_goals != null && m.status !== "SCHEDULED";
  const goals = evs.filter((e) => ["goal", "penalty_goal", "own_goal"].includes(e.type));
  const scorerList = (tid) => goals.filter((g) => (g.type === "own_goal" ? g.team_id !== tid : g.team_id === tid)).map((g) => `${esc(g.raw?.names?.[0] || "")} ${g.raw?.clock || g.minute + "'"}${g.type === "penalty_goal" ? " (пен.)" : g.type === "own_goal" ? " (авто)" : ""}`).join("<br>");
  // own goal team_id in ESPN is the scoring player's team (conceding side) — handle both
  const tabs = [["facts", "Детали"], ["lineups", "Составы"], ["stats", "Статистика"], ["comm", "Комментарии"], ["table", "Таблица"], ["h2h", "Матчи"]];
  const H = ts.find((t) => t.team_id === m.home_team_id), A = ts.find((t) => t.team_id === m.away_team_id);
  app().innerHTML = `<div class="wrap">
    <div class="card"><div class="mh">
      <a class="compline" href="#/league/${m.competition_id}"><img src="${c?.logo}" alt="">${c?.name} · ${fmtDay(m.utc_date)}, ${fmtTime(m.utc_date)}</a>
      <div class="mh-grid"><a class="mh-team" href="#/team/${m.home.id}">${crest(m.home, "crest lg")}${esc(m.home.name)}</a>
        <div><div class="mh-score ${played ? "" : "pre"}">${played ? `${m.home_goals} – ${m.away_goals}` : fmtTime(m.utc_date)}</div><div class="mh-status ${live ? "live" : ""}">${live ? `<span class="live-dot"></span> ` : ""}${played || live ? statusLabel(m) : fmtDate(m.utc_date, { weekday: "long", day: "numeric", month: "long" })}</div>${m.raw?.aggregate ? `<div class="mh-status">${esc(m.raw.aggregate)}</div>` : ""}</div>
        <a class="mh-team" href="#/team/${m.away.id}">${crest(m.away, "crest lg")}${esc(m.away.name)}</a></div>
      ${goals.length ? `<div class="scorers"><div class="h">${scorerList(m.home_team_id)}</div><div class="ball">${ICON.ball}</div><div class="a">${scorerList(m.away_team_id)}</div></div>` : ""}
      <div class="mh-info">${m.raw?.venue ? `<span>${ICON.pin}${esc(m.raw.venue)}${m.raw.city ? ", " + esc(m.raw.city) : ""}</span>` : ""}${m.raw?.attendance ? `<span>${ICON.users}${Number(m.raw.attendance).toLocaleString("ru-RU")}</span>` : ""}${m.raw?.referee ? `<span>${ICON.whistle}${esc(m.raw.referee)}</span>` : ""}${H && A ? `<span><b>xG</b>&nbsp;${num(H.xg, 2)} – ${num(A.xg, 2)}</span>` : ""}</div>
    </div></div>
    ${localnav(`${crest(m.home, "crest sm")}<span class="t">${esc(m.home.short_name)} ${played ? m.home_goals + "–" + m.away_goals : "–"} ${esc(m.away.short_name)}</span>${crest(m.away, "crest sm")}`, tabs, tab, `#/match/${id}`)}
    <div id="mcontent"></div><div id="polls"></div></div>`;
  $(".localnav").style.marginTop = "16px";
  const box = $("#mcontent");
  const ctx = { m, ts, pms, evs, H, A };
  if (tab === "facts") matchFacts(ctx, box);
  else if (tab === "stats") matchStats(ctx, box);
  else if (tab === "lineups") matchLineups(ctx, box);
  else if (tab === "shots") matchShots(ctx, box);
  else if (tab === "comm") matchComm(ctx, box);
  else if (tab === "table") { const st = await getStandings(m.competition_id); const cms = await getCompMatches(m.competition_id); box.innerHTML = `<div class="card">${standingsTable(st.filter((r) => !r.group_name || st.find((x) => x.team_id === m.home_team_id)?.group_name === r.group_name), null, { forms: formsFrom(cms) }).replace(new RegExp(`(<tr class=")(" onclick="location.hash='#/team/(${m.home_team_id}|${m.away_team_id})')`, "g"), "$1hl$2")}</div>`; }
  else if (tab === "h2h") matchH2H(ctx, box);
  if (tab === "facts") matchPolls(m);
  if (live) { clearInterval(refreshTimer); refreshTimer = setInterval(() => softMatch(id, tab), 15000); }
}
function noData(msg) { return `<div class="card"><div class="empty-note" style="padding:28px 18px;text-align:center">${msg}</div></div>`; }
function matchFacts({ m, evs, H, A, pms }, box) {
  if (!evs.length && m.status === "SCHEDULED") return matchPreview(m, box);
  const sideOf = (e) => (e.team_id === m.home_team_id ? "h" : "a");
  const row = (e) => {
    const s = sideOf(e); let ic = "", main = "", sub = "";
    const n = e.raw?.names || [];
    if (["goal", "penalty_goal"].includes(e.type)) { ic = ICON.ball; main = `<b>${esc(n[0] || "")}</b>`; sub = e.type === "penalty_goal" ? "Пенальти" : e.raw?.assist ? "Пас: " + esc(e.raw.assist) : e.raw?.header ? "Головой" : ""; }
    else if (e.type === "own_goal") { ic = ICON.ball; main = `<b>${esc(n[0] || "")}</b>`; sub = "Автогол"; }
    else if (e.type === "yellow") { ic = `<span class="card-y"></span>`; main = esc(n[0] || ""); sub = "Жёлтая карточка"; }
    else if (e.type === "red") { ic = `<span class="card-r"></span>`; main = esc(n[0] || ""); sub = "Красная карточка"; }
    else if (e.type === "sub") { ic = ICON.sub; main = `<span style="color:var(--win)">${esc(n[0] || "")}</span>`; sub = `<span style="color:var(--loss)">${esc(n[1] || "")}</span>`; }
    else if (e.type === "penalty_missed") { ic = ICON.miss; main = esc(n[0] || ""); sub = "Не забил пенальти"; }
    else if (e.type === "var") { ic = ICON.var; main = "VAR"; sub = esc((e.detail || "").replace(/^VAR Decision: /, "").slice(0, 60)); }
    else return "";
    const cell = `<div class="ev ${s}">${s === "h" ? `<div>${main}<small>${sub}</small></div><span class="tl-ic">${ic}</span>` : `<span class="tl-ic">${ic}</span><div>${main}<small>${sub}</small></div>`}</div>`;
    return `<div class="tl-row">${s === "h" ? cell : "<div></div>"}<div class="min">${esc(e.raw?.clock || (e.minute ?? "") + "'")}</div>${s === "a" ? cell : "<div></div>"}</div>`;
  };
  let tl = "", half = false;
  for (const e of evs) {
    if (e.type === "period" && /half/i.test(e.detail || "") && !half) { half = true; const hg = evs.filter((x) => (x.minute ?? 0) <= 45 && !(x.raw?.period > 1)); tl += `<div class="tl-sep">Перерыв</div>`; continue; }
    if (e.type === "period") continue;
    tl += row(e);
  }
  const best = [...pms].filter((p) => p.rating).sort((a, b) => b.rating - a.rating)[0];
  const hs = H?.raw?.s || {}, as = A?.raw?.s || {};
  box.innerHTML = `<div class="cols two"><main>${momentum(m, evs)}<div class="card"><div class="card-h">События матча</div><div class="card-b"><div class="tl">${tl || `<div class="empty-note">Событий пока нет.</div>`}</div></div></div>
    <div class="section-gap"></div><div class="card"><div class="card-h">xG по ходу матча</div><div class="chart-box sm"><canvas id="xgRace"></canvas></div></div></main>
    <aside class="side">
      ${best ? `<div class="card"><div class="card-h">Игрок матча</div><a class="lead" href="#/player/${best.player_id}" style="padding-bottom:16px">${avatar(best.player_id, best.player?.name)}<div class="who"><div><b>${esc(best.player?.name)}</b></div><small>${best.goals ? best.goals + " г · " : ""}${best.assists ? best.assists + " а · " : ""}${best.minutes}'</small></div>${ratingChip(best.rating)}</a></div>` : ""}
      <div class="card"><div class="card-h">Информация</div><div class="card-b"><dl class="infol"><dt>Дата</dt><dd>${fmtDay(m.utc_date)}, ${fmtTime(m.utc_date)}</dd><dt>Турнир</dt><dd>${esc(COMP[m.competition_id]?.name || "")}</dd>${m.raw?.venue ? `<dt>Стадион</dt><dd>${esc(m.raw.venue)}${m.raw.city ? ", " + esc(m.raw.city) : ""}</dd>` : ""}${m.raw?.referee ? `<dt>Судья</dt><dd>${esc(m.raw.referee)}</dd>` : ""}${m.raw?.attendance ? `<dt>Зрители</dt><dd>${Number(m.raw.attendance).toLocaleString("ru-RU")}</dd>` : ""}</dl></div></div>
      ${H && A ? `<div class="card"><div class="card-h">Главная статистика<a class="more" href="#/match/${m.id}/stats">Вся</a></div><div class="card-b">
        <div class="eyebrow" style="text-align:center">Владение мячом</div><div class="possn"><span class="h">${num(H.possession, 0)}%</span><span class="a">${num(A.possession, 0)}%</span></div><div class="poss"><div class="ph" style="width:${H.possession}%"></div><div class="pa" style="width:${A.possession}%"></div></div>
        ${[["xG", H.xg, A.xg, 2], ["Удары", H.shots, A.shots], ["В створ", H.shots_on_target, A.shots_on_target], ["Пасы", H.passes, A.passes], ["Угловые", H.corners, A.corners], ["Жёлтые", hs.yellowCards, as.yellowCards]].map(([l, a, b, d]) => vsRow(l, a, b, d)).join("")}
      </div></div>` : ""}
    </aside></div>`;
  xgRace(m, evs);
}
async function matchPolls(m) {
  const box = $("#polls"); if (!box) return;
  const vid = (() => { try { let v = localStorage.getItem("zvid"); if (!v) { v = crypto.randomUUID(); localStorage.setItem("zvid", v); } return v; } catch { return "anon-" + Math.random().toString(36).slice(2, 12); } })();
  const mine = (() => { try { return JSON.parse(localStorage.getItem("zvotes:" + m.id) || "{}"); } catch { return {}; } })();
  const P = [["winner", "Кто победит?", [["h", m.home.short_name], ["d", "Ничья"], ["a", m.away.short_name]]], ["btts", "Обе команды забьют?", [["y", "Да"], ["n", "Нет"]]], ["first", "Кто забьёт первым?", [["h", m.home.short_name], ["none", "Никто"], ["a", m.away.short_name]]]];
  const open = m.status === "SCHEDULED";
  let cnt = {};
  const load = async () => { try { const { data } = await sb.rpc("poll_counts", { p_match: String(m.id) }); cnt = {}; (data || []).forEach((r) => ((cnt[r.poll] ||= {})[r.choice] = +r.n)); } catch {} };
  const draw = () => { box.innerHTML = `<div class="section-gap"></div><div class="card"><div class="card-h">Прогнозы болельщиков</div><div class="card-b polls">${P.map(([k, t, o]) => { const c = cnt[k] || {}, tot = Object.values(c).reduce((a, b) => a + b, 0), voted = mine[k]; return `<div class="poll"><div class="pt"><span>${t}</span><small>${tot.toLocaleString("ru-RU")} голосов</small></div><div class="po">${o.map(([v, l]) => { const pc = tot ? Math.round(((c[v] || 0) / tot) * 100) : 0; const col = v === "h" ? "var(--home)" : v === "a" ? "var(--away)" : "var(--text-2)"; return `<button data-p="${k}" data-v="${v}" class="${voted === v ? "me" : ""}" ${voted || !open ? "disabled" : ""} style="--c:${col}"><span class="l">${esc(l)}</span><span class="n">${voted || !open ? pc + "%" : ""}</span><i style="width:${voted || !open ? pc : 0}%"></i></button>`; }).join("")}</div></div>`; }).join("")}${open ? "" : `<div class="muted" style="font-size:12px">Голосование закрыто — матч начался</div>`}</div></div>`; };
  await load(); draw();
  box.onclick = async (e) => { const b = e.target.closest("button[data-p]"); if (!b || b.disabled) return; const k = b.dataset.p, v = b.dataset.v; mine[k] = v; try { localStorage.setItem("zvotes:" + m.id, JSON.stringify(mine)); } catch {} const { error } = await sb.from("poll_votes").insert({ match_id: String(m.id), poll: k, choice: v, voter: vid }); if (error && error.code !== "23505") { delete mine[k]; toast("Не удалось проголосовать"); } await load(); draw(); };
}
function momentum(m, evs) {
  const ks = ["goal", "penalty_goal", "shot_on", "shot_off", "shot_blocked", "woodwork"];
  const end = Math.max(90, ...evs.map((e) => Math.min(130, e.minute || 0))), SG = 3.2;
  const L = [], ev = evs.filter((e) => ks.includes(e.type) && (e.team_id === m.home_team_id || e.team_id === m.away_team_id));
  if (!ev.length) return "";
  for (let t = 0; t <= end; t++) { let v = 0; for (const e of ev) { const w = ((+e.raw?.xg || 0.05) + (/goal/.test(e.type) ? 0.3 : 0)) * Math.exp(-((t - (e.minute || 0)) ** 2) / (2 * SG * SG)); v += e.team_id === m.home_team_id ? w : -w; } L.push(v); }
  const mx = Math.max(0.25, ...L.map(Math.abs)), W = 300, Hh = 100, X = (t) => (t / end) * W, Y = (v) => Hh / 2 - (v / mx) * 42;
  const pts = L.map((v, t) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`), line = "M" + pts.join(" L"), area = `${line} L${W},${Hh / 2} L0,${Hh / 2}Z`, u = "mo" + m.id;
  const dots = ev.filter((e) => /goal/.test(e.type)).map((e) => { const h = e.team_id === m.home_team_id, t = Math.min(end, e.minute || 0), n = e.raw?.names || [], tm = h ? m.home : m.away; const side = t / end < 0.2 ? "l" : t / end > 0.8 ? "r" : "";
    return `<button type="button" class="mo-g ${side}" style="left:${(X(t) / W * 100).toFixed(2)}%;top:${Y(L[Math.round(t)]).toFixed(1)}%;--c:${h ? "var(--home)" : "var(--away)"}" onclick="document.querySelectorAll('.mo-g.open').forEach(x=>x!==this&&x.classList.remove('open'));this.classList.toggle('open')"><span class="mo-tip"><b>${esc(n[0] || "Гол")}</b> ${esc(e.raw?.clock || (e.minute ?? "") + "'")}${e.type === "penalty_goal" ? " (пен.)" : e.type === "own_goal" ? " (авто)" : ""}<small>${esc(tm.short_name)}${e.raw?.assist ? " · пас: " + esc(e.raw.assist) : ""}${e.raw?.xg != null ? " · xG " + num(e.raw.xg, 2) : ""}</small></span></button>`; }).join("");
  const grid = [0, 15, 30, 45, 60, 75, 90].filter((t) => t <= end).map((t) => `<line x1="${X(t)}" y1="0" x2="${X(t)}" y2="${Hh}" stroke="var(--line)" stroke-width=".4" ${t === 45 ? 'stroke-dasharray="2 2"' : ""}/>`).join("");
  return `<div class="card"><div class="card-h">Моментум матча</div><div class="card-b"><div class="mo-wrap"><svg viewBox="0 0 ${W} ${Hh}" style="width:100%;height:auto;display:block;overflow:visible"><defs><clipPath id="${u}u"><rect x="0" y="0" width="${W}" height="${Hh / 2}"/></clipPath><clipPath id="${u}d"><rect x="0" y="${Hh / 2}" width="${W}" height="${Hh / 2}"/></clipPath><linearGradient id="${u}gh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--home)" stop-opacity=".55"/><stop offset="1" stop-color="var(--home)" stop-opacity=".05"/></linearGradient><linearGradient id="${u}ga" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--away)" stop-opacity=".55"/><stop offset="1" stop-color="var(--away)" stop-opacity=".05"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#${u}gh)" clip-path="url(#${u}u)"/><path d="${area}" fill="url(#${u}ga)" clip-path="url(#${u}d)"/><path d="${line}" fill="none" stroke="var(--home)" stroke-width="1.3" clip-path="url(#${u}u)" stroke-linejoin="round"/><path d="${line}" fill="none" stroke="var(--away)" stroke-width="1.3" clip-path="url(#${u}d)" stroke-linejoin="round"/><line x1="0" y1="${Hh / 2}" x2="${W}" y2="${Hh / 2}" stroke="var(--text-2)" stroke-width=".5" opacity=".5"/></svg>${dots}</div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-2);margin-top:6px"><span style="color:var(--home);font-weight:700">${esc(m.home.short_name)}</span><span>0' · 15' · 30' · 45' · 60' · 75' · 90'</span><span style="color:var(--away);font-weight:700">${esc(m.away.short_name)}</span></div></div></div><div class="section-gap"></div>`;
}
function vsRow(l, a, b, d = 0, invert = false) {
  const va = +a || 0, vb = +b || 0; const ha = invert ? va < vb : va > vb, hb = invert ? vb < va : vb > va;
  return `<div class="vs-row"><b class="${ha ? "lh" : ""}">${num(a, d)}</b><span class="c">${l}</span><b class="${hb ? "la" : ""}" style="text-align:right">${num(b, d)}</b></div>`;
}
function xgRace(m, evs) {
  const el = $("#xgRace"); if (!el) return;
  const shots = evs.filter((e) => e.raw?.xg != null);
  if (!shots.length) { el.parentElement.innerHTML = `<div class="empty-note">Нет данных об ударах.</div>`; return; }
  const mk = (tid) => { let s = 0; const pts = [{ x: 0, y: 0 }]; for (const e of shots.filter((e) => e.team_id === tid)) { const t = (e.minute || 0) + (e.raw?.extra || 0) / 10; pts.push({ x: t, y: s }); s += +e.raw.xg; pts.push({ x: t, y: s, goal: ["goal", "penalty_goal"].includes(e.type), n: e.raw?.names?.[0] }); } pts.push({ x: Math.max(90, ...shots.map((e) => e.minute || 0)), y: s }); return pts; };
  const cs = getComputedStyle(document.documentElement); const tc = cs.getPropertyValue("--text-2"), gc = cs.getPropertyValue("--line-2");
  const ds = (tid, col, lbl) => ({ label: lbl, data: mk(tid), borderColor: col, backgroundColor: col, borderWidth: 2.5, stepped: false, tension: 0, pointRadius: (c) => (c.raw?.goal ? 6 : 0), pointBorderColor: "#fff", pointBorderWidth: 2 });
  charts.push(new Chart(el, { type: "line", data: { datasets: [ds(m.home_team_id, cs.getPropertyValue("--home").trim(), m.home.short_name), ds(m.away_team_id, cs.getPropertyValue("--away").trim(), m.away.short_name)] },
    options: { responsive: true, maintainAspectRatio: false, parsing: false, plugins: { legend: { labels: { color: tc, boxWidth: 12 } }, tooltip: { filter: (i) => i.raw.goal, callbacks: { label: (c) => `Гол: ${c.raw.n} (${c.raw.y.toFixed(2)} xG)` } } }, scales: { x: { type: "linear", min: 0, grid: { color: gc }, ticks: { color: tc, stepSize: 15, callback: (v) => v + "'" } }, y: { min: 0, grid: { color: gc }, ticks: { color: tc } } } } }));
}
async function matchPreview(m, box) {
  const [hm, am, st] = await Promise.all([
    run(sb.from("matches").select(M_SEL).or(`home_team_id.eq.${m.home_team_id},away_team_id.eq.${m.home_team_id}`).eq("status", "FINISHED").order("utc_date", { ascending: false }).limit(5)),
    run(sb.from("matches").select(M_SEL).or(`home_team_id.eq.${m.away_team_id},away_team_id.eq.${m.away_team_id}`).eq("status", "FINISHED").order("utc_date", { ascending: false }).limit(5)),
    getStandings(m.competition_id),
  ]);
  const sH = st.find((r) => r.team_id === m.home_team_id), sA = st.find((r) => r.team_id === m.away_team_id);
  box.innerHTML = `<div class="grid2"><div class="card"><div class="card-h">Форма: ${esc(m.home.name)}<span class="more">${formHtml(hm.map((x) => resultFor(x, m.home_team_id)).reverse())}</span></div>${hm.map((x) => matchRow(x, { showDate: true })).join("")}<div style="height:8px"></div></div>
    <div class="card"><div class="card-h">Форма: ${esc(m.away.name)}<span class="more">${formHtml(am.map((x) => resultFor(x, m.away_team_id)).reverse())}</span></div>${am.map((x) => matchRow(x, { showDate: true })).join("")}<div style="height:8px"></div></div></div>
    ${sH && sA ? `<div class="section-gap"></div><div class="card"><div class="card-h">Сравнение по таблице</div><div class="card-b">${vsRow("Место", sH.position, sA.position, 0, true)}${vsRow("Очки", sH.points, sA.points)}${vsRow("Забито", sH.goals_for, sA.goals_for)}${vsRow("Пропущено", sH.goals_against, sA.goals_against, 0, true)}</div></div>` : ""}`;
}
function matchStats({ m, H, A, evs }, box) {
  if (!H || !A) { box.innerHTML = noData("Нет данных"); return; }
  const h = H.raw?.s || {}, a = A.raw?.s || {};
  const pc = (x, y) => (+y ? (+x / +y) * 100 : null);
  const rows = [["__Обзор"], ["Ожидаемые голы (xG)", H.xg, A.xg, 2], ["Удары", h.totalShots, a.totalShots], ["Угловые", h.wonCorners, a.wonCorners], ["Фолы", h.foulsCommitted, a.foulsCommitted, 0, 1], ["Офсайды", h.offsides, a.offsides, 0, 1], ["Жёлтые карточки", h.yellowCards, a.yellowCards, 0, 1], ["Красные карточки", h.redCards, a.redCards, 0, 1],
    ["__Удары"], ["Удары в створ", h.shotsOnTarget, a.shotsOnTarget], ["Мимо", (h.totalShots - h.shotsOnTarget - h.blockedShots) || null, (a.totalShots - a.shotsOnTarget - a.blockedShots) || null], ["Заблокированные", h.blockedShots, a.blockedShots], ["Удары в штрафной", h.shotsInsideBox ?? h.shotsIBox, a.shotsInsideBox ?? a.shotsIBox], ["Штанга/перекладина", h.hitWoodwork ?? h.woodworkHit, a.hitWoodwork ?? a.woodworkHit], ["Пенальти", h.penaltyKickShots, a.penaltyKickShots], ["Точность ударов, %", pc(h.shotsOnTarget, h.totalShots), pc(a.shotsOnTarget, a.totalShots), 0], ["xG за удар", pc(H.xg, h.totalShots) / 100, pc(A.xg, a.totalShots) / 100, 2],
    ["__Пасы"], ["Пасы", h.totalPasses, a.totalPasses], ["Точные пасы", h.accuratePasses, a.accuratePasses], ["Точность паса, %", H.pass_accuracy, A.pass_accuracy, 0], ["Длинные передачи", h.totalLongBalls, a.totalLongBalls], ["Точные длинные", h.accurateLongBalls, a.accurateLongBalls], ["Навесы", h.totalCrosses, a.totalCrosses], ["Точные навесы", h.accurateCrosses, a.accurateCrosses], ["Передачи в штрафную", h.passesIntoBox, a.passesIntoBox], ["Вбрасывания", h.throwIns, a.throwIns],
    ["__Единоборства"], ["Единоборства выиграно", h.duelsWon, a.duelsWon], ["Верховые выиграно", h.aerialsWon ?? h.aerialDuelsWon, a.aerialsWon ?? a.aerialDuelsWon], ["Дриблинг", h.takeOnsWon ?? h.dribblesWon, a.takeOnsWon ?? a.dribblesWon], ["Потери мяча", h.possessionLost ?? h.dispossessed, a.possessionLost ?? a.dispossessed, 0, 1],
    ["__Оборона"], ["Отборы", h.totalTackles, a.totalTackles], ["Успешные отборы", h.effectiveTackles, a.effectiveTackles], ["Перехваты", h.interceptions, a.interceptions], ["Выносы", h.totalClearance, a.totalClearance], ["Блок-шоты", h.shotsBlocked ?? h.blockedShotsDef, a.shotsBlocked ?? a.blockedShotsDef],
    ["__Вратарь"], ["Сейвы", h.saves, a.saves], ["Предотвращено голов", (A.xg ?? 0) - (a.goalsConceded ?? 0) || null, (H.xg ?? 0) - (h.goalsConceded ?? 0) || null, 2]];
  const row = ([l, x, y, d, inv]) => { if (x == null && y == null) return ""; const vx = +x || 0, vy = +y || 0, t = vx + vy || 1, lead = vx === vy ? "" : (inv ? vx < vy : vx > vy) ? "h" : "a"; return `<div class="statrow ${lead}"><div class="lbl"><b class="${lead === "h" ? "chip-num lead-h" : ""}">${num(x, d || 0)}</b><span>${l}</span><b class="${lead === "a" ? "chip-num lead-a" : ""}">${num(y, d || 0)}</b></div><div class="bars"><div class="bh"><i style="width:${(vx / t) * 100}%"></i></div><div class="ba"><i style="width:${(vy / t) * 100}%"></i></div></div></div>`; };
  let body = "", sec = "", buf = "";
  for (const r of rows) { if (r[0].startsWith("__")) { if (buf) body += sec + buf; sec = `<div class="statsec">${r[0].slice(2)}</div>`; buf = ""; } else buf += row(r); }
  if (buf) body += sec + buf;
  box.innerHTML = `<div class="card" style="max-width:760px;margin:0 auto"><div class="card-b" style="padding-top:18px">
    <div class="team-line" style="padding:0 0 4px">${crest(m.home)}<span class="eyebrow">Владение мячом</span>${crest(m.away)}</div>
    <div class="possn"><span class="h">${num(H.possession, 0)}%</span><span class="a">${num(A.possession, 0)}%</span></div>
    <div class="poss"><div class="ph" style="width:${H.possession}%"></div><div class="pa" style="width:${A.possession}%"></div></div>
    ${body}</div></div><div class="section-gap"></div><div id="shotsbox"></div>`;
  if (evs?.some((e) => e.raw?.x != null)) matchShots({ m, evs, H, A }, $("#shotsbox"));
}
function matchComm({ m, evs }, box) {
  const T = { goal: "⚽ Гол!", penalty_goal: "⚽ Гол с пенальти!", own_goal: "⚽ Автогол", yellow: "🟨 Жёлтая карточка", red: "🟥 Красная карточка", sub: "🔁 Замена", penalty_missed: "Пенальти не реализован", var: "VAR", shot_on: "Удар в створ", shot_off: "Удар мимо", shot_blocked: "Удар заблокирован", woodwork: "Штанга/перекладина" };
  const key = new Set(["goal", "penalty_goal", "own_goal", "yellow", "red", "penalty_missed", "var"]);
  let only = false;
  const draw = () => {
    const l = evs.filter((e) => e.type !== "period" && T[e.type] && (!only || key.has(e.type))).slice().reverse();
    $("#cm").innerHTML = l.map((e) => { const n = e.raw?.names || []; const tm = e.team_id === m.home_team_id ? m.home : e.team_id === m.away_team_id ? m.away : null; return `<div class="comm ${key.has(e.type) ? "key" : ""}"><span class="mn">${esc(e.raw?.clock || (e.minute ?? "") + "'")}</span>${tm ? crest(tm, "crest sm") : "<span></span>"}<div><b>${T[e.type]}</b> ${e.type === "sub" ? `${esc(n[0] || "")} ← ${esc(n[1] || "")}` : esc(n[0] || "")}${e.detail ? `<div class="muted" style="font-size:13px">${esc(e.detail.slice(0, 220))}</div>` : ""}</div></div>`; }).join("") || `<div class="empty-note" style="padding:24px;text-align:center">Комментариев пока нет</div>`;
  };
  box.innerHTML = `<div class="card"><div class="feed-tools"><div class="seg" id="cmseg"><button data-k="0" class="on">Все</button><button data-k="1">Ключевые</button></div></div><div id="cm"></div></div>`;
  $("#cmseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; only = b.dataset.k === "1"; $$("#cmseg button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  draw();
}
function depthOf(abbr, pos) {
  const a = (abbr || "").toUpperCase(), p = (pos || "").toLowerCase();
  if (a === "G" || a === "GK" || p.includes("goal")) return 0;
  if (/WB/.test(a) || p.includes("wing back")) return 1.5;
  if (/^(CD|CB|LB|RB|D|SW)/.test(a) || p.includes("back") || p.includes("defender")) return 1;
  if (/^DM/.test(a) || p.includes("defensive mid")) return 2;
  if (/^AM/.test(a) || p.includes("attacking mid")) return 3;
  if (/^(LM|RM)/.test(a)) return 2.6;
  if (/^(CM|M)/.test(a) || p.includes("midfield")) return 2.5;
  if (/^(LW|RW)/.test(a) || p.includes("winger")) return 3.4;
  return 4;
}
function sideOf(abbr) { const a = (abbr || "").toUpperCase(); if (/-L$|^L/.test(a)) return -1; if (/-R$|^R/.test(a)) return 1; return 0; }
function layoutXI(players, formation) {
  const xi = players.filter((p) => p.raw?.starter);
  const gk = xi.filter((p) => depthOf(p.raw?.abbr, p.raw?.pos) === 0);
  const out = xi.filter((p) => !gk.includes(p)).sort((a, b) => depthOf(a.raw?.abbr, a.raw?.pos) - depthOf(b.raw?.abbr, b.raw?.pos) || (a.raw?.place || 0) - (b.raw?.place || 0));
  let lines = (formation || "").split("-").map(Number).filter(Boolean);
  if (lines.reduce((s, x) => s + x, 0) !== out.length) lines = [4, 3, 3].slice(0, 3);
  if (lines.reduce((s, x) => s + x, 0) !== out.length) lines = [out.length];
  const res = [[...gk]]; let i = 0;
  for (const n of lines) { res.push(out.slice(i, i + n).sort((a, b) => sideOf(a.raw?.abbr) - sideOf(b.raw?.abbr))); i += n; }
  return res;
}
function matchLineups({ m, pms, evs, H, A }, box) {
  if (!pms.length) { box.innerHTML = noData("Составов пока нет"); return; }
  const goalsBy = {}, cardsBy = {};
  for (const e of evs) { if (!e.player_id) continue; if (["goal", "penalty_goal"].includes(e.type)) goalsBy[e.player_id] = (goalsBy[e.player_id] || 0) + 1; if (e.type === "yellow" || e.type === "red") cardsBy[e.player_id] = e.type; }
  const dot = (p, x, y) => `<a class="pl-dot ${p.team_id === m.home_team_id ? "ph" : "pa"}" href="#/player/${p.player_id}" style="left:${x}%;top:${y}%"><span class="rt">${p.rating ? ratingChip(p.rating) : ""}</span><span class="badges">${goalsBy[p.player_id] ? `<span class="gball">${ICON.ball}${goalsBy[p.player_id] > 1 ? goalsBy[p.player_id] : ""}</span>` : ""}${cardsBy[p.player_id] ? `<span class="${cardsBy[p.player_id] === "red" ? "card-r" : "card-y"}" style="padding:0;width:8px;height:11px"></span>` : ""}${p.raw?.subOut ? `<span style="color:#ff3b30">↓${p.raw.outM ?? ""}</span>` : ""}</span><span class="face"><img src="${headshot(p.player_id)}" alt="" onerror="__phErr(this,'${p.player_id}')">${esc(p.raw?.jersey || "")}</span><span class="nm">${esc(p.player?.raw?.last || p.player?.name?.split(" ").slice(-1)[0] || "")}</span></a>`;
  const half = (tid, top) => {
    const lines = layoutXI(pms.filter((p) => p.team_id === tid), (tid === m.home_team_id ? H : A)?.raw?.formation);
    return lines.map((ln, li) => ln.map((p, pi) => { const y = 4 + (li / Math.max(1, lines.length - 1)) * 40; const x = ((pi + 1) / (ln.length + 1)) * 100; return dot(p, top ? 100 - x : x, top ? y + 1 : 100 - y - 1); }).join("")).join("");
  };
  const halfH = (tid, home) => {
    const lines = layoutXI(pms.filter((p) => p.team_id === tid), (tid === m.home_team_id ? H : A)?.raw?.formation);
    return lines.map((ln, li) => ln.map((p, pi) => { const d = 6 + (li / Math.max(1, lines.length - 1)) * 40; const y = ((pi + 1) / (ln.length + 1)) * 100; return dot(p, home ? d : 100 - d, home ? y : 100 - y); }).join("")).join("");
  };
  const tcol = (t) => { const c = teamColor(t); return c ? fitColor(c) : "#8aa0b8"; };
  const bench = (tid) => pms.filter((p) => p.team_id === tid && !p.raw?.starter).sort((a, b) => (b.minutes || 0) - (a.minutes || 0)).map((p) => `<a class="brow" href="#/player/${p.player_id}"><span class="no">${esc(p.raw?.jersey || "")}</span>${avatar(p.player_id, p.player?.name)}<span class="grow">${esc(p.player?.name)}<br><small>${esc(p.raw?.pos || "")}${p.raw?.subIn ? ` · <span style="color:var(--win)">↑ ${p.raw.inM}'</span>` : ""}</small></span>${p.minutes ? ratingChip(p.rating) : ""}</a>`).join("");
  box.innerHTML = `<div class="cols two"><main><div class="card lu"><div class="lu-head"><span class="t h">${crest(m.home, "crest sm")} ${esc(m.home.name)} <em>${esc(H?.raw?.formation || "")}</em></span><span class="t a"><em>${esc(A?.raw?.formation || "")}</em> ${esc(m.away.name)} ${crest(m.away, "crest sm")}</span></div>
    <div class="pitch-wrap lu-h" style="padding-top:0"><div class="pitch h lu-pitch" style="--hc:${tcol(m.home)};--ac:${tcol(m.away)}">${pitchLinesH}${halfH(m.home_team_id, true)}${halfH(m.away_team_id, false)}</div></div>
    <div class="lu-v"><div class="team-line">${crest(m.away, "crest sm")} ${esc(m.away.name)} <span class="muted">${esc(A?.raw?.formation || "")}</span></div>
    <div class="pitch-wrap" style="padding-top:0"><div class="pitch lu-pitch" style="--hc:${tcol(m.home)};--ac:${tcol(m.away)}">${pitchLinesV}${half(m.away_team_id, true)}${half(m.home_team_id, false)}</div></div>
    <div class="team-line">${crest(m.home, "crest sm")} ${esc(m.home.name)} <span class="muted">${esc(H?.raw?.formation || "")}</span></div></div></div></main>
    <aside class="side"><div class="card"><div class="card-h">Запасные · ${esc(m.home.short_name)}</div><div class="card-b">${bench(m.home_team_id)}</div></div><div class="card"><div class="card-h">Запасные · ${esc(m.away.short_name)}</div><div class="card-b">${bench(m.away_team_id)}</div></div></aside></div>`;
}
function matchShots({ m, evs, H, A }, box) {
  const shots = evs.filter((e) => e.raw?.x != null);
  if (!shots.length) { box.innerHTML = noData("Нет данных"); return; }
  let filt = "all";
  const draw = () => {
    const list = shots.filter((s) => filt === "all" || s.team_id === filt);
    $("#smap").innerHTML = pitchLinesH + list.map((s) => { const home = s.team_id === m.home_team_id; const x = home ? s.raw.x : 100 - s.raw.x, y = home ? s.raw.y : 100 - s.raw.y; const sz = 9 + Math.sqrt(+s.raw.xg || 0.02) * 34; return `<span class="shot ${shotCls(s.type)}" style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;${shotCls(s.type) === "off" ? `border-color:${home ? "#8ec5ff" : "#ffb38f"}` : ""}" data-tip="${esc(shotTip(s))}"></span>`; }).join("");
    $("#slist").innerHTML = list.slice().reverse().map((s) => `<div class="brow"><span class="no">${esc(s.raw?.clock || "")}</span>${crest(s.team_id === m.home_team_id ? m.home : m.away, "crest sm")}<span class="grow">${esc(s.raw?.names?.[0] || "")}<br><small>${SHOT_RU[s.type]}${s.raw?.header ? " · головой" : ""}${s.raw?.assist ? " · пас " + esc(s.raw.assist) : ""}</small></span><b class="tnum">${num(s.raw.xg, 2)}</b></div>`).join("");
  };
  const sum = (tid, f) => shots.filter((s) => s.team_id === tid).filter(f).length;
  const big = (tid) => sum(tid, (s) => +s.raw.xg >= 0.3 && !s.raw.penalty);
  box.innerHTML = `<div class="card"><div class="feed-tools"><div class="seg" id="shseg"><button data-t="all" class="on">Обе команды</button><button data-t="${m.home_team_id}">${esc(m.home.short_name)}</button><button data-t="${m.away_team_id}">${esc(m.away.short_name)}</button></div></div>
    <div class="pitch-wrap" style="padding-top:0"><div class="pitch h shotmap" id="smap"></div><div class="legend" style="padding:10px 0 0"><span><i style="background:var(--win)"></i>Гол</span><span><i style="background:#fff;border:1px solid var(--line)"></i>В створ</span><span><i style="background:rgba(0,0,0,.35)"></i>Блок</span><span><i style="border:1.5px solid #8ec5ff"></i>Мимо</span></div></div></div>
    <div class="section-gap"></div><div class="grid2"><div class="card"><div class="card-h">Сводка</div><div class="card-b">${vsRow("xG", H?.xg, A?.xg, 2)}${vsRow("xG без пенальти", shots.filter((s) => s.team_id === m.home_team_id && !s.raw.penalty).reduce((a, s) => a + +s.raw.xg, 0), shots.filter((s) => s.team_id === m.away_team_id && !s.raw.penalty).reduce((a, s) => a + +s.raw.xg, 0), 2)}${vsRow("Удары", sum(m.home_team_id, () => 1), sum(m.away_team_id, () => 1))}${vsRow("Голевые моменты (xG ≥ 0.3)", big(m.home_team_id), big(m.away_team_id))}${vsRow("xG за удар", (H?.xg || 0) / Math.max(1, sum(m.home_team_id, () => 1)), (A?.xg || 0) / Math.max(1, sum(m.away_team_id, () => 1)), 2)}${vsRow("Удары головой", sum(m.home_team_id, (s) => s.raw.header), sum(m.away_team_id, (s) => s.raw.header))}
      </div></div>
      <div class="card"><div class="card-h">Все удары</div><div class="card-b" id="slist" style="max-height:420px;overflow:auto"></div></div></div>`;
  $("#shseg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filt = b.dataset.t; $$("#shseg button").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
  draw();
}
async function matchH2H({ m }, box) {
  const list = await run(sb.from("matches").select(M_SEL).or(`and(home_team_id.eq.${m.home_team_id},away_team_id.eq.${m.away_team_id}),and(home_team_id.eq.${m.away_team_id},away_team_id.eq.${m.home_team_id})`).order("utc_date", { ascending: false }));
  const fin = list.filter((x) => x.status === "FINISHED");
  const w = fin.filter((x) => resultFor(x, m.home_team_id) === "W").length, l = fin.filter((x) => resultFor(x, m.home_team_id) === "L").length;
  box.innerHTML = `<div class="card" style="max-width:760px;margin:0 auto"><div class="h2h"><div><div class="n" style="color:var(--home)">${w}</div><small>${esc(m.home.short_name)}</small></div><div><div class="n">${fin.length - w - l}</div><small>Ничьи</small></div><div><div class="n" style="color:var(--away)">${l}</div><small>${esc(m.away.short_name)}</small></div></div>
    ${list.map((x) => `<div style="display:flex;align-items:center"><img src="${COMP[x.competition_id]?.logo}" style="width:18px;margin-left:16px" alt=""><div style="flex:1">${matchRow(x, { showDate: true })}</div></div>`).join("")}</div>`;
}

/* ================= STATS (all leagues) ================= */
async function viewStats(c, sKey) {
  const comp = c === "ALL" ? null : c;
  app().innerHTML = `<div class="wrap"><div class="card"><div class="hero"><div class="meta"><h1 class="title">Статистика</h1></div></div>
    <div class="feed-tools" style="padding:20px 28px 22px"><div class="pills" id="cpills"><a class="pill ${!comp ? "on" : ""}" href="#/stats"><svg class="pl-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>Все турниры</a>${COMPS.map((x) => `<a class="pill ${comp === x.id ? "on" : ""}" href="#/stats?c=${x.id}"><img class="pl-logo" src="${x.logo}" alt="" onerror="this.remove()">${x.short}</a>`).join("")}</div></div></div>
    <div class="section-gap"></div><div id="sbody">${skel(10)}</div></div>`;
  { const cp = $("#cpills"), on = cp && cp.querySelector(".pill.on"); if (on) cp.scrollLeft = Math.max(0, on.offsetLeft - (cp.clientWidth - on.offsetWidth) / 2); }
  const ps = await getPlayerSeason(comp);
  const agg = comp ? ps : Object.values(ps.reduce((o, r) => { const a = (o[r.player_id] ??= { ...r, goals: 0, assists: 0, xg: 0, xa: 0, shots: 0, shots_on_target: 0, minutes: 0, apps: 0, yellow: 0, rs: 0, rn: 0 }); for (const k of ["goals", "assists", "shots", "shots_on_target", "minutes", "apps", "yellow"]) a[k] += r[k]; a.xg += +r.xg; a.xa += +r.xa; if (r.rating) { a.rs += r.rating * r.apps; a.rn += r.apps; } a.rating = a.rn ? a.rs / a.rn : null; return o; }, {}));
  const m90 = (r) => r.minutes >= 450;
  const CATS = [
    { k: "goals", t: "Голы", f: (r) => r.goals },
    { k: "assists", t: "Ассисты", f: (r) => r.assists },
    { k: "ga", t: "Гол + пас", f: (r) => r.goals + r.assists },
    { k: "xg", t: "xG", f: (r) => +r.xg, d: 2 },
    { k: "xa", t: "xA", f: (r) => +r.xa, d: 2 },
    { k: "fin", t: "Реализация: голы − xG", f: (r) => r.goals - r.xg, d: 2 },
    { k: "shots", t: "Удары", f: (r) => r.shots },
    { k: "sot", t: "Удары в створ", f: (r) => r.shots_on_target },
    { k: "rating", t: "one рейтинг", f: (r) => +r.rating || 0, d: 2, filt: m90 },
    { k: "g90", t: "Голы за 90", f: (r) => p90(r.goals, r.minutes), d: 2, filt: m90 },
    { k: "xg90", t: "xG за 90", f: (r) => p90(+r.xg, r.minutes), d: 2, filt: m90 },
    { k: "yc", t: "Жёлтые карточки", f: (r) => r.yellow },
  ];
  const GROUPS = [["Рейтинг", ["rating"]], ["Результативность", ["goals", "assists", "ga"]], ["Ожидаемые голы", ["xg", "xa", "fin"]], ["Удары", ["shots", "sot"]], ["Эффективность", ["g90", "xg90"]], ["Дисциплина", ["yc"]]];
  const rank = (ct, n) => agg.filter(ct.filt || (() => true)).map((r) => ({ r, v: ct.f(r) })).sort((a, b) => b.v - a.v).slice(0, n);
  const base = "#/stats" + (comp ? "?c=" + comp : "");
  const cur = CATS.find((x) => x.k === sKey);
  if (cur) {
    $("#sbody").innerHTML = `<a class="s-back" href="${base}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>Вся статистика</a>
      <div class="card"><div class="card-h">${cur.t}${cur.sub ? ` <small class="muted">· ${cur.sub}</small>` : ""}</div>${rank(cur, 30).map(({ r, v }, i) => `<a class="lead" href="#/player/${r.player_id}"><span class="rk">${i + 1}</span>${avatar(r.player_id, r.name)}<div class="who"><div>${esc(r.name)}</div><small>${esc(r.team_short)}</small></div><span class="v">${num(v, cur.d || 0)}</span></a>`).join("")}<div style="height:8px"></div></div>`;
    window.scrollTo({ top: 0 });
    return;
  }
  const cardOf = (ct) => `<a class="card scard" href="${base}${comp ? "&" : "?"}s=${ct.k}"><div class="card-h">${ct.t}${ct.sub ? ` <small class="muted">${ct.sub}</small>` : ""}<svg class="go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></div>${rank(ct, 3).map(({ r, v }, i) => `<div class="lead">${avatar(r.player_id, r.name)}<div class="who"><div>${esc(r.name)}</div><small>${esc(r.team_short)}</small></div><span class="v${i ? "" : " top"}">${num(v, ct.d || 0)}</span></div>`).join("")}<div style="height:8px"></div></a>`;
  $("#sbody").innerHTML = `${GROUPS.map(([t, ks], i) => `<section class="s-grp" data-g="${i}"><h2 class="s-h">${t}</h2><div class="leaders-grid">${ks.map((k) => cardOf(CATS.find((x) => x.k === k))).join("")}</div></section>`).join("")}`;
}

/* ================= COMPARE ================= */
async function viewCompare(params) {
  const ids = [params.get("a"), params.get("b")];
  app().innerHTML = `<div class="wrap"><div class="card"><div class="hero"><div class="meta"><h1 class="title">Сравнение игроков</h1></div></div>
    <div class="card-b" style="padding:22px 28px 26px"><div class="cmp-pick">${[0, 1].map((i) => `<div class="dd"><input id="pick${i}" placeholder="${i ? "Второй игрок" : "Первый игрок"}" autocomplete="off"><div class="dd-list" id="dd${i}"></div></div>`).join("")}</div></div></div>
    <div class="section-gap"></div><div id="cbody"></div></div>`;
  const sel = [null, null];
  const load = async (id) => { const rows = await run(sb.from("v_player_season").select("*").eq("player_id", id)); if (!rows.length) return null; const a = rows.reduce((o, r) => { for (const k of ["goals", "assists", "shots", "shots_on_target", "minutes", "apps", "yellow", "fouls_won", "saves"]) o[k] = (o[k] || 0) + r[k]; o.xg = (o.xg || 0) + +r.xg; o.xa = (o.xa || 0) + +r.xa; if (r.rating) { o.rs = (o.rs || 0) + r.rating * r.apps; o.rn = (o.rn || 0) + r.apps; } return o; }, { ...rows[0] }); a.rating = a.rn ? a.rs / a.rn : null; return a; };
  const draw = () => {
    killCharts();
    const [a, b] = sel;
    [0, 1].forEach((i) => { if (sel[i]) $("#pick" + i).value = sel[i].name; });
    if (!a || !b) { $("#cbody").innerHTML = a || b ? noData("Выберите второго игрока.") : ""; return; }
    const mets = [["Голы /90", (r) => p90(r.goals, r.minutes)], ["xG /90", (r) => p90(r.xg, r.minutes)], ["Удары /90", (r) => p90(r.shots, r.minutes)], ["В створ /90", (r) => p90(r.shots_on_target, r.minutes)], ["Ассисты /90", (r) => p90(r.assists, r.minutes)], ["xA /90", (r) => p90(r.xa, r.minutes)], ["Фолы на нём /90", (r) => p90(r.fouls_won, r.minutes)], ["Рейтинг", (r) => +r.rating || 0]];
    $("#cbody").innerHTML = `<div class="grid2"><div class="card"><div class="card-h">Радар (за 90 минут, нормировано)</div><div class="chart-box" style="height:380px"><canvas id="radar"></canvas></div></div>
      <div class="card"><div class="team-line" style="padding:18px 18px 8px"><a class="team" href="#/player/${a.player_id}">${avatar(a.player_id, a.name)} ${esc(a.name)}</a><a class="team" href="#/player/${b.player_id}">${esc(b.name)} ${avatar(b.player_id, b.name)}</a></div><div class="card-b">
      ${vsRow("Матчи", a.apps, b.apps)}${vsRow("Минуты", a.minutes, b.minutes)}${vsRow("Голы", a.goals, b.goals)}${vsRow("Ассисты", a.assists, b.assists)}${vsRow("xG", a.xg, b.xg, 2)}${vsRow("xA", a.xa, b.xa, 2)}${mets.map(([l, f]) => vsRow(l, f(a), f(b), 2)).join("")}</div></div></div>`;
    const mx = mets.map(([, f]) => Math.max(f(a), f(b), 0.0001));
    const cs = getComputedStyle(document.documentElement); const tc = cs.getPropertyValue("--text-2"), gc = cs.getPropertyValue("--line");
    charts.push(new Chart($("#radar"), { type: "radar", data: { labels: mets.map(([l]) => l), datasets: [a, b].map((p, i) => ({ label: p.name, data: mets.map(([, f], j) => +(f(p) / mx[j] * 100).toFixed(0)), borderColor: i ? "#ff6b35" : "#0071e3", backgroundColor: i ? "rgba(255,107,53,.18)" : "rgba(0,113,227,.18)", borderWidth: 2, pointRadius: 3 })) },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } } }, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: gc }, angleLines: { color: gc }, pointLabels: { color: tc, font: { size: 11 } } } } } }));
  };
  [0, 1].forEach((i) => {
    let t; const inp = $("#pick" + i), dd = $("#dd" + i);
    inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => { const s = inp.value.trim(); if (s.length < 2) { dd.innerHTML = ""; return; } const rows = await run(sb.from("players").select("id,name,team:teams(name,crest_url)").ilike("name", `%${s}%`).limit(8)); dd.innerHTML = rows.map((p) => `<a class="sr-item" data-id="${p.id}">${avatar(p.id, p.name)}${esc(p.name)}<small>${esc(p.team?.name || "")}</small></a>`).join(""); }, 180); });
    dd.addEventListener("click", async (e) => { const a = e.target.closest("[data-id]"); if (!a) return; dd.innerHTML = ""; sel[i] = await load(a.dataset.id); if (!sel[i]) toast("У игрока нет сыгранных минут"); const p = new URLSearchParams(); if (sel[0]) p.set("a", sel[0].player_id); if (sel[1]) p.set("b", sel[1].player_id); history.replaceState(null, "", "#/compare?" + p); draw(); });
    inp.addEventListener("blur", () => setTimeout(() => (dd.innerHTML = ""), 200));
  });
  await Promise.all(ids.map(async (id, i) => { if (id) sel[i] = await load(id); }));
  draw();
}

/* ---------------- boot ---------------- */
applyTheme();
buildShell();
/* ---------------- leagues page (#/leagues) ---------------- */
function viewLeagues() {
  const fol = () => store.get("favLeagues", []).filter((id) => COMP[id]);
  let edit = false, query = "";
  const open = {};
  app().innerHTML = `<div class="wrap lg"><h1 class="lg-title">Лиги</h1><label class="lg-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="lgq" type="search" placeholder="Найти лигу" autocomplete="off" spellcheck="false"></label><div id="lgbody"></div></div>`;
  const body = $("#lgbody");
  const row = (c, btn) => `<div class="lg-row"><a class="lg-link" href="#/league/${c.id}"><img src="${c.logo}" alt="" loading="lazy"><span>${esc(c.name)}</span></a>${btn || ""}</div>`;
  const head = (t, act, label) => `<div class="lg-h"><h2>${t}</h2>${act ? `<button type="button" class="lg-a" data-act="${act}">${label}</button>` : ""}</div>`;
  function draw() {
    const f = fol(), q = query.trim().toLowerCase();
    const ok = (c) => !q || (c.name + " " + c.short + " " + c.country).toLowerCase().includes(q);
    const mine = f.map((id) => COMP[id]).filter(ok);
    const sug = store.get("lgHideSug", false) || q ? [] : COMPS.filter((c) => !f.includes(c.id) && ok(c));
    const all = COMPS.filter(ok);
    let h = "";
    if (mine.length) h += head("Вы следите", "edit", edit ? "Готово" : "Изменить") + mine.map((c) => row(c, edit ? `<button type="button" class="lg-btn rm" data-act="unf" data-id="${c.id}">Убрать</button>` : "")).join("");
    if (sug.length) h += head("Рекомендуемые", "hide", "Больше не показывать") + sug.map((c) => row(c, `<button type="button" class="lg-btn" data-act="fol" data-id="${c.id}">Следить</button>`)).join("");
    const groups = {};
    all.forEach((c) => (groups[c.country] = groups[c.country] || []).push(c));
    h += head("Все турниры") + (Object.keys(groups).map((k) => {
      const list = groups[k], on = q || open[k];
      return `<div class="lg-grp"><button type="button" class="lg-gh" data-act="grp" data-k="${esc(k)}"><img src="${list[0].logo}" alt=""><b>${esc(k)}</b><svg class="chev${on ? " up" : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>${on ? `<div class="lg-sub">${list.map((c) => row(c, f.includes(c.id) ? "" : `<button type="button" class="lg-btn" data-act="fol" data-id="${c.id}">Следить</button>`)).join("")}</div>` : ""}</div>`;
    }).join("") || `<div class="lg-empty">Ничего не найдено</div>`);
    body.innerHTML = h;
  }
  body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act, id = b.dataset.id;
    if (a === "edit") edit = !edit;
    else if (a === "hide") store.set("lgHideSug", true);
    else if (a === "fol") store.set("favLeagues", [...fol().filter((x) => x !== id), id]);
    else if (a === "unf") { store.set("favLeagues", fol().filter((x) => x !== id)); if (!fol().length) edit = false; }
    else if (a === "grp") open[b.dataset.k] = !open[b.dataset.k];
    draw();
  });
  $("#lgq").addEventListener("input", (e) => { query = e.target.value; draw(); });
  draw();
}

route();
