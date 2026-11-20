/* qara — UFC / MMA. Маршруты: #/mma, #/mma/event/ID, #/mma/fighter/ID, #/mma/rankings[/Класс] */
(function () {
  const E = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Q = async (b) => { const { data, error } = await b; if (error) throw error; return data || []; };
  const root = () => document.getElementById("app");
  const WC_RU = { "Flyweight": "Наилегчайший", "Bantamweight": "Легчайший", "Featherweight": "Полулёгкий", "Lightweight": "Лёгкий", "Welterweight": "Полусредний", "Middleweight": "Средний", "Light Heavyweight": "Полутяжёлый", "Heavyweight": "Тяжёлый", "Women's Strawweight": "Жен. соломенный", "Women's Flyweight": "Жен. наилегчайший", "Women's Bantamweight": "Жен. легчайший" };
  const WC_ORDER = Object.keys(WC_RU);
  const wcRu = (w) => WC_RU[w] || w || "";
  const METH = { "KO/TKO": "КО/ТКО", "Submission": "Сабмишн", "Decision": "Решение" };
  const SECT = { main: "Основной кард", prelim: "Прелимы", early: "Ранние прелимы" };
  const STANCE = { Orthodox: "Правосторонняя", Southpaw: "Левосторонняя", Switch: "Switch" };
  const fmtD = (d, o) => new Date(d).toLocaleDateString("ru-RU", o || { day: "numeric", month: "long" });
  const fmtT = (d) => new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const rec = (f) => `${f.wins}-${f.losses}${f.draws ? "-" + f.draws : ""}${f.no_contests ? ` (${f.no_contests} NC)` : ""}`;
  const age = (b) => (b ? Math.floor((Date.now() - new Date(b)) / 31557600000) : null);
  const flag = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...cc.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))) : "");
  const ini = (n) => (n || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const ph = (f, cls = "mm-ph") => `<span class="${cls}"><img src="${E(f?.photo_url || "")}" alt="" loading="lazy" onerror="this.remove()">${E(ini(f?.name))}</span>`;
  const skel = (n = 6) => Array.from({ length: n }, () => `<div class="sk sk-row"></div>`).join("");
  const set = (h) => { root().innerHTML = h; };
  const FSEL = "id,name,nickname,country,country_code,photo_url,wins,losses,draws,no_contests,weight_class";

  const subnav = (cur) => `<div class="mm-sub"><a href="#/mma" class="${cur === "sched" ? "on" : ""}">Карды</a><a href="#/mma/rankings" class="${cur === "rank" ? "on" : ""}">Рейтинги</a></div>`;
  const head = (t, s) => `<div class="mm-h"><h1>${t}</h1>${s ? `<p>${s}</p>` : ""}</div>`;

  /* ---------- карты бойца в строке боя ---------- */
  function side(f, win, right) {
    if (!f) return `<div class="mm-side ${right ? "r" : ""}"><span class="mm-nm">—</span></div>`;
    return `<a class="mm-side ${right ? "r" : ""} ${win === true ? "w" : win === false ? "l" : ""}" href="#/mma/fighter/${f.id}">${ph(f)}<span class="mm-who"><b>${E(f.name)}</b><small>${rec(f)}${f.country_code ? " · " + flag(f.country_code) : ""}</small></span></a>`;
  }
  function fightRow(x, f1, f2) {
    const done = x.status === "FINISHED";
    const w1 = done && x.winner_id ? x.winner_id === x.fighter1_id : null;
    const w2 = done && x.winner_id ? x.winner_id === x.fighter2_id : null;
    const mid = done
      ? `<div class="mm-res"><b>${E(METH[x.method] || x.method || "")}</b><small>${x.end_round ? "Р" + x.end_round : ""}${x.end_time ? " · " + E(x.end_time) : ""}</small></div>`
      : `<div class="mm-res"><b>vs</b><small>${x.scheduled_rounds || 3} раунд.</small></div>`;
    return `<div class="mm-fight">
      <div class="mm-fm">${x.is_title ? `<span class="mm-belt">Титульный бой</span>` : ""}<span>${E(wcRu(x.weight_class))}</span></div>
      <div class="mm-fr">${side(f1, w1, false)}${mid}${side(f2, w2, true)}</div>
      ${done && x.method_detail ? `<div class="mm-det">${E(x.method_detail)}</div>` : ""}
    </div>`;
  }

  /* ---------- расписание ---------- */
  async function viewSchedule(params) {
    const tab = params.get("t") === "past" ? "past" : "up";
    set(`<div class="wrap mm">${head("UFC", "Карды, бои и рейтинги")}${subnav("sched")}<div class="mm-tabs"><a href="#/mma" class="pill ${tab === "up" ? "on" : ""}">Ближайшие</a><a href="#/mma?t=past" class="pill ${tab === "past" ? "on" : ""}">Прошедшие</a></div><div id="mmL">${skel(6)}</div></div>`);
    const now = new Date().toISOString();
    let q = sb.from("mma_events").select("*");
    q = tab === "up" ? q.gte("start_time", now).order("start_time", { ascending: true }).limit(20) : q.lt("start_time", now).order("start_time", { ascending: false }).limit(30);
    const ev = await Q(q);
    if (!ev.length) { document.getElementById("mmL").innerHTML = `<div class="card"><div class="empty-note">Карты не найдены.</div></div>`; return; }
    const ids = ev.map((e) => e.id);
    const fights = await Q(sb.from("mma_fights").select("*").in("event_id", ids).order("bout_order", { ascending: true }));
    const fids = [...new Set(fights.flatMap((x) => [x.fighter1_id, x.fighter2_id]))];
    const fs = {}; for (let i = 0; i < fids.length; i += 150) (await Q(sb.from("mma_fighters").select(FSEL).in("id", fids.slice(i, i + 150)))).forEach((f) => (fs[f.id] = f));
    const main = {}; fights.forEach((x) => { const c = main[x.event_id]; if (!c || x.bout_order < c.bout_order) main[x.event_id] = x; });
    const cnt = {}; fights.forEach((x) => (cnt[x.event_id] = (cnt[x.event_id] || 0) + 1));
    document.getElementById("mmL").innerHTML = ev.map((e) => {
      const m = main[e.id], f1 = m && fs[m.fighter1_id], f2 = m && fs[m.fighter2_id];
      const done = e.status === "FINISHED";
      return `<a class="card mm-ev" href="#/mma/event/${e.id}">
        <div class="mm-evh"><div><b>${E(e.name)}</b><small>${E([e.venue, e.city, e.country].filter(Boolean).join(", "))}</small></div><div class="mm-date">${fmtD(e.start_time)}<small>${done ? "Завершён" : fmtT(e.start_time)}</small></div></div>
        ${m ? `<div class="mm-main">${side(f1, done && m.winner_id ? m.winner_id === m.fighter1_id : null, false).replace("<a ", "<span ").replace("</a>", "</span>")}<div class="mm-res"><b>${done ? E(METH[m.method] || "") : "vs"}</b><small>${m.is_title ? "Титул · " : ""}${E(wcRu(m.weight_class))}</small></div>${side(f2, done && m.winner_id ? m.winner_id === m.fighter2_id : null, true).replace("<a ", "<span ").replace("</a>", "</span>")}</div>` : ""}
        <div class="mm-evf">${cnt[e.id] || 0} боёв${e.event_type === "numbered" ? " · Номерной" : " · Fight Night"}</div></a>`;
    }).join("");
  }

  /* ---------- карт ---------- */
  async function viewEvent(id) {
    set(`<div class="wrap mm">${skel(8)}</div>`);
    const [e] = await Q(sb.from("mma_events").select("*").eq("id", id));
    if (!e) { set(`<div class="wrap"><div class="card"><div class="empty-note">Карт не найден.</div></div></div>`); return; }
    const fights = await Q(sb.from("mma_fights").select("*").eq("event_id", id).order("bout_order", { ascending: true }));
    const fids = [...new Set(fights.flatMap((x) => [x.fighter1_id, x.fighter2_id]))];
    const fs = {}; if (fids.length) (await Q(sb.from("mma_fighters").select(FSEL).in("id", fids))).forEach((f) => (fs[f.id] = f));
    const groups = {}; fights.forEach((x) => (groups[x.card_section || "main"] ||= []).push(x));
    const blocks = ["main", "prelim", "early"].filter((k) => groups[k]).map((k) =>
      `<div class="card mm-sec"><div class="card-h">${SECT[k]}</div>${groups[k].map((x) => fightRow(x, fs[x.fighter1_id], fs[x.fighter2_id])).join("")}</div>`).join("");
    set(`<div class="wrap mm"><a class="mm-back" href="#/mma">← Все карды</a>
      ${head(E(e.name), `${fmtD(e.start_time, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${fmtT(e.start_time)}<br>${E([e.venue, e.city, e.country].filter(Boolean).join(", "))}`)}
      ${e.stream_url ? `<a class="pill" href="${E(e.stream_url)}" target="_blank" rel="noopener">Смотреть</a>` : ""}
      ${blocks || `<div class="card"><div class="empty-note">Бои ещё не объявлены.</div></div>`}</div>`);
  }

  /* ---------- боец ---------- */
  async function viewFighter(id) {
    set(`<div class="wrap mm">${skel(8)}</div>`);
    const [f] = await Q(sb.from("mma_fighters").select("*").eq("id", id));
    if (!f) { set(`<div class="wrap"><div class="card"><div class="empty-note">Боец не найден.</div></div></div>`); return; }
    const [fights, rk] = await Promise.all([
      Q(sb.from("mma_fights").select("*").or(`fighter1_id.eq.${id},fighter2_id.eq.${id}`)),
      Q(sb.from("mma_rankings").select("*").eq("fighter_id", id)),
    ]);
    const oppIds = [...new Set(fights.map((x) => (x.fighter1_id == id ? x.fighter2_id : x.fighter1_id)))];
    const evIds = [...new Set(fights.map((x) => x.event_id))];
    const [opps, evs] = await Promise.all([
      oppIds.length ? Q(sb.from("mma_fighters").select(FSEL).in("id", oppIds)) : [],
      evIds.length ? Q(sb.from("mma_events").select("id,name,start_time").in("id", evIds)) : [],
    ]);
    const O = {}; opps.forEach((o) => (O[o.id] = o)); const EV = {}; evs.forEach((e) => (EV[e.id] = e));
    fights.sort((a, b) => new Date(EV[b.event_id]?.start_time || 0) - new Date(EV[a.event_id]?.start_time || 0));
    const r = rk[0]; const rkTxt = r ? (r.rank === 0 ? "Чемпион" : `#${r.rank} в дивизионе`) : "";
    const kv = (k, v) => (v == null || v === "" ? "" : `<div class="mm-kv"><span>${k}</span><b>${E(v)}</b></div>`);
    const bar = (l, v, suf = "") => (v == null ? "" : `<div class="mm-bar"><div><span>${l}</span><b>${v}${suf}</b></div><i><u style="width:${Math.min(100, suf === "%" ? v : v * 10)}%"></u></i></div>`);
    const tot = Math.max(1, f.wins);
    const seg = (n, c, l) => (n ? `<div class="mm-seg" style="flex:${n}"><i class="${c}"></i><span>${l} ${n}</span></div>` : "");
    const hist = fights.filter((x) => x.status === "FINISHED").map((x) => {
      const o = O[x.fighter1_id == id ? x.fighter2_id : x.fighter1_id];
      const res = !x.winner_id ? "ничья" : x.winner_id == id ? "Победа" : "Поражение";
      const cls = !x.winner_id ? "d" : x.winner_id == id ? "w" : "l";
      return `<a class="mm-h-row" href="#/mma/event/${x.event_id}"><span class="mm-chip ${cls}">${res === "Победа" ? "П" : res === "Поражение" ? "Пр" : "Н"}</span><span class="mm-hw"><b>${E(o?.name || "—")}</b><small>${E(EV[x.event_id]?.name || "")} · ${fmtD(EV[x.event_id]?.start_time, { day: "numeric", month: "short", year: "numeric" })}</small></span><span class="mm-hm">${E(METH[x.method] || x.method || "")}<small>${x.end_round ? "Р" + x.end_round : ""}${x.end_time ? " · " + E(x.end_time) : ""}</small></span></a>`;
    }).join("");
    const next = fights.filter((x) => x.status !== "FINISHED").map((x) => {
      const o = O[x.fighter1_id == id ? x.fighter2_id : x.fighter1_id];
      return `<a class="mm-h-row" href="#/mma/event/${x.event_id}"><span class="mm-chip d">vs</span><span class="mm-hw"><b>${E(o?.name || "—")}</b><small>${E(EV[x.event_id]?.name || "")}</small></span><span class="mm-hm">${fmtD(EV[x.event_id]?.start_time)}</span></a>`;
    }).join("");
    set(`<div class="wrap mm"><a class="mm-back" href="#/mma/rankings${r ? "/" + encodeURIComponent(r.weight_class) : ""}">← Рейтинги</a>
      <div class="card mm-prof"><div class="mm-ptop">${ph(f, "mm-ph big")}<div><h1>${E(f.name)}</h1>${f.nickname ? `<p>«${E(f.nickname)}»</p>` : ""}<div class="mm-tags"><span>${E(wcRu(f.weight_class))}</span>${rkTxt ? `<span class="hl">${rkTxt}</span>` : ""}${f.country ? `<span>${flag(f.country_code)} ${E(f.country)}</span>` : ""}</div></div></div>
        <div class="mm-rec"><b>${rec(f)}</b><small>В-П-Н</small></div></div>
      <div class="mm-grid">
        <div class="card"><div class="card-h">Данные</div><div class="mm-kvs">${kv("Возраст", age(f.birth_date))}${kv("Рост", f.height_cm && f.height_cm + " см")}${kv("Размах рук", f.reach_cm && f.reach_cm + " см")}${kv("Стойка", STANCE[f.stance] || f.stance)}${kv("Страна", f.country)}</div></div>
        <div class="card"><div class="card-h">Победы по методам</div><div class="mm-seg-w">${seg(f.ko_wins, "ko", "КО/ТКО")}${seg(f.sub_wins, "sub", "Сабмишн")}${seg(f.dec_wins, "dec", "Решение")}</div><div style="height:14px"></div></div>
        <div class="card"><div class="card-h">Удары</div><div class="mm-bars">${bar("Поражённых за минуту", f.sig_strikes_per_min)}${bar("Точность", f.strike_accuracy, "%")}${bar("Пропущено за минуту", f.sig_strikes_absorbed_per_min)}${bar("Защита", f.strike_defense, "%")}</div></div>
        <div class="card"><div class="card-h">Борьба</div><div class="mm-bars">${bar("Тейкдауны за 15 мин", f.td_per_15)}${bar("Точность тейкдаунов", f.td_accuracy, "%")}${bar("Защита от тейкдаунов", f.td_defense, "%")}${bar("Сабмишны за 15 мин", f.sub_per_15)}</div></div>
      </div>
      ${next ? `<div class="card"><div class="card-h">Предстоящие бои</div>${next}</div>` : ""}
      <div class="card"><div class="card-h">История боёв</div>${hist || `<div class="empty-note">Нет данных о боях.</div>`}</div></div>`);
  }

  /* ---------- рейтинги ---------- */
  async function viewRankings(wc) {
    wc = wc ? decodeURIComponent(wc) : "Lightweight";
    set(`<div class="wrap mm">${head("Рейтинги UFC", "Чемпион и топ-15 дивизиона")}${subnav("rank")}<div class="mm-wc">${WC_ORDER.map((w) => `<a class="pill ${w === wc ? "on" : ""}" href="#/mma/rankings/${encodeURIComponent(w)}">${E(wcRu(w))}</a>`).join("")}</div><div id="mmL">${skel(8)}</div></div>`);
    const rk = await Q(sb.from("mma_rankings").select("rank,fighter_id").eq("weight_class", wc).order("rank", { ascending: true }));
    const ids = rk.map((r) => r.fighter_id);
    const fs = {}; if (ids.length) (await Q(sb.from("mma_fighters").select(FSEL).in("id", ids))).forEach((f) => (fs[f.id] = f));
    const row = (r) => { const f = fs[r.fighter_id]; if (!f) return ""; return `<a class="lead mm-rk ${r.rank === 0 ? "ch" : ""}" href="#/mma/fighter/${f.id}"><span class="rk">${r.rank === 0 ? "C" : r.rank}</span>${ph(f)}<div class="who"><div>${E(f.name)}</div><small>${f.nickname ? "«" + E(f.nickname) + "»" : E(f.country || "")}</small></div><span class="v">${rec(f)}</span></a>`; };
    const ch = rk.filter((r) => r.rank === 0), top = rk.filter((r) => r.rank > 0);
    document.getElementById("mmL").innerHTML = rk.length
      ? `${ch.length ? `<div class="card"><div class="card-h">Чемпион</div>${ch.map(row).join("")}<div style="height:6px"></div></div>` : ""}<div class="card"><div class="card-h">Топ-15</div>${top.map(row).join("")}<div style="height:6px"></div></div>`
      : `<div class="card"><div class="empty-note">Рейтинг пока пуст.</div></div>`;
  }

  /* ---------- вход из роутера ---------- */
  window.viewMma = async function (parts, params) {
    document.title = "UFC — qara.";
    if (parts[0] === "event" && parts[1]) return viewEvent(parts[1]);
    if (parts[0] === "fighter" && parts[1]) return viewFighter(parts[1]);
    if (parts[0] === "rankings") return viewRankings(parts[1]);
    return viewSchedule(params || new URLSearchParams());
  };

  /* ---------- карточка на главной ---------- */
  let busy = false;
  async function homeCard() {
    if (busy) return; const h = location.hash; if (h && h !== "#/" && h !== "#") return;
    const app = root(); if (!app || app.querySelector("#mmHome")) return;
    const wrap = app.querySelector(".wrap"); if (!wrap) return;
    busy = true;
    try {
      const [e] = await Q(sb.from("mma_events").select("*").gte("start_time", new Date().toISOString()).order("start_time", { ascending: true }).limit(1));
      if (!e || app.querySelector("#mmHome")) return;
      const [m] = await Q(sb.from("mma_fights").select("*").eq("event_id", e.id).order("bout_order", { ascending: true }).limit(1));
      let a, b; if (m) (await Q(sb.from("mma_fighters").select(FSEL).in("id", [m.fighter1_id, m.fighter2_id]))).forEach((f) => (f.id === m.fighter1_id ? (a = f) : (b = f)));
      const d = document.createElement("div"); d.id = "mmHome"; d.className = "card mm-home";
      d.innerHTML = `<div class="card-h">UFC · ближайший кард<a class="more" href="#/mma">Все карды</a></div><a class="mm-ev-in" href="#/mma/event/${e.id}"><div class="mm-evh"><div><b>${E(e.name)}</b><small>${fmtD(e.start_time)} · ${fmtT(e.start_time)}</small></div></div>${a && b ? `<div class="mm-main">${ph(a)}<span class="mm-vs"><b>${E(a.name)}</b> vs <b>${E(b.name)}</b></span>${ph(b)}</div>` : ""}</a>`;
      wrap.appendChild(d);
    } catch (e) { /* ignore */ } finally { busy = false; }
  }
  new MutationObserver(homeCard).observe(document.getElementById("app") || document.body, { childList: true });
  homeCard();
})();
