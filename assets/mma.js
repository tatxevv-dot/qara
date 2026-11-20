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
  const flag = (cc) => (cc && /^[a-z]{2}(-[a-z]{3})?$/i.test(cc) ? `<img class=\"mm-fl\" src=\"https://flagcdn.com/w40/${cc.toLowerCase()}.png\" srcset=\"https://flagcdn.com/w80/${cc.toLowerCase()}.png 2x\" alt=\"\" loading=\"lazy\" onerror=\"this.remove()\">` : "");
  const ini = (n) => (n || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const ph = (f, cls = "mm-ph") => `<span class="${cls}"><img src="${E(f?.photo_url || "")}" alt="" loading="lazy" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"><em>${E(ini(f?.name))}</em></span>`;
  const skel = (n = 6) => Array.from({ length: n }, () => `<div class="sk sk-row"></div>`).join("");
  const set = (h) => { root().innerHTML = h; };
  const FSEL = "id,name,nickname,country,country_code,photo_url,wins,losses,draws,no_contests,weight_class";

  const subnav = (cur, tab) => { const on = (k) => (cur === k ? " on" : ""); return `<nav class="mm-seg" aria-label="Разделы UFC"><a href="#/mma" class="${cur === "sched" && tab !== "past" ? "on" : ""}">Ближайшие</a><a href="#/mma?t=past" class="${cur === "sched" && tab === "past" ? "on" : ""}">Прошедшие</a><a href="#/mma/rankings" class="${on("rank").trim()}">Рейтинги</a></nav>`; };
  const head = (t, s) => `<div class="mm-h"><h1>${t}</h1>${s ? `<p>${s}</p>` : ""}</div>`;

  /* ---------- карты бойца в строке боя ---------- */
  function side(f, win, right) {
    if (!f) return `<div class="mm-side ${right ? "r" : ""}"><span class="mm-nm">—</span></div>`;
    return `<a class="mm-side ${right ? "r" : ""} ${win === true ? "w" : win === false ? "l" : ""}" href="#/mma/fighter/${f.id}">${ph(f)}<span class="mm-who"><b>${E(f.name)}</b><small>${rec(f)}${f.country_code ? flag(f.country_code) : ""}</small></span></a>`;
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
  const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const isLive = (e) => e.status === "LIVE" || (e.status !== "FINISHED" && new Date(e.start_time) <= new Date());
  const when = (d) => { const t = new Date(d), n = new Date(); const k = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); return k <= 0 ? "Сегодня" : k === 1 ? "Завтра" : "Через " + k + " дн."; };
  const PLAYI = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';

  function hero(e, m, f1, f2, hasS) {
    const live = isLive(e);
    const fig = (f, r) => f ? `<a class="mm-hf ${r ? "r" : ""}" href="#/mma/fighter/${f.id}">${ph(f, "mm-ph hero")}<b>${E(f.name)}</b><small>${rec(f)}${f.country_code ? flag(f.country_code) : ""}</small></a>` : `<div class="mm-hf"></div>`;
    return `<section class="mm-hero">
      <div class="mm-hero-top"><span class="mm-chip-live ${live ? "on" : ""}">${live ? "LIVE" : when(e.start_time)}</span><span class="mm-hero-eb">Ближайший кард</span></div>
      <h2>${E(e.name)}</h2>
      <p class="mm-hero-meta"><b>${fmtD(e.start_time)} · ${fmtT(e.start_time)}</b><span>${E([e.venue, e.city, e.country].filter(Boolean).join(", "))}</span></p>
      ${m ? `<div class="mm-hero-fr">${fig(f1, false)}<div class="mm-hero-vs"><i>VS</i><small>${m.is_title ? "Титульный бой" : "Главный бой"}</small><small>${E(wcRu(m.weight_class))}</small></div>${fig(f2, true)}</div>` : ""}
      <a class="mm-hero-btn" href="#/mma/event/${e.id}"><span>${PLAYI}</span>Смотреть трансляцию</a>
      <div class="mm-hero-ft">${e.cnt || 0} боёв · ${e.event_type === "numbered" ? "Номерной турнир" : "Fight Night"}${hasS ? " · есть трансляция" : ""}</div>
    </section>`;
  }
  function evRow(e, m, f1, f2) {
    const d = new Date(e.start_time), done = e.status === "FINISHED";
    const vs = m ? `${E(f1?.name || "—")} <i>vs</i> ${E(f2?.name || "—")}` : "";
    return `<a class="mm-row" href="#/mma/event/${e.id}">
      <div class="mm-dt"><b>${d.getDate()}</b><span>${MON[d.getMonth()]}</span></div>
      <div class="mm-rb"><b>${E(e.name)}</b><span>${vs}</span><small>${done ? "Завершён" : fmtT(e.start_time)} · ${E([e.city, e.country].filter(Boolean).join(", "))}</small></div>
      <div class="mm-av">${m ? ph(f1, "mm-ph md") + ph(f2, "mm-ph md") : ""}</div>
    </a>`;
  }

  async function viewSchedule(params) {
    const tab = params.get("t") === "past" ? "past" : "up";
    set(`<div class="wrap mm"><h1 class="mm-title">UFC</h1>${subnav("sched", tab)}<div id="mmL"><div class="sk mm-hero-sk"></div>${skel(4)}</div></div>`);
    const now = new Date().toISOString();
    let q = sb.from("mma_events").select("*");
    q = tab === "up" ? q.gte("start_time", new Date(Date.now() - 6 * 36e5).toISOString()).order("start_time", { ascending: true }).limit(20) : q.lt("start_time", now).order("start_time", { ascending: false }).limit(30);
    const ev = await Q(q);
    const L = document.getElementById("mmL");
    if (!ev.length) { L.innerHTML = `<div class="card"><div class="empty-note">Карты не найдены.</div></div>`; return; }
    const ids = ev.map((e) => e.id);
    const [fights, srows] = await Promise.all([
      Q(sb.from("mma_fights").select("*").in("event_id", ids).order("bout_order", { ascending: true })),
      tab === "up" ? Q(sb.from("mma_streams").select("event_id").in("event_id", ids.map(String))).catch(() => []) : Promise.resolve([]),
    ]);
    const fids = [...new Set(fights.flatMap((x) => [x.fighter1_id, x.fighter2_id]))];
    const fs = {}; for (let i = 0; i < fids.length; i += 150) (await Q(sb.from("mma_fighters").select(FSEL).in("id", fids.slice(i, i + 150)))).forEach((f) => (fs[f.id] = f));
    const main = {}; fights.forEach((x) => { const c = main[x.event_id]; if (!c || x.bout_order < c.bout_order) main[x.event_id] = x; });
    const cnt = {}; fights.forEach((x) => (cnt[x.event_id] = (cnt[x.event_id] || 0) + 1));
    const hasS = new Set(srows.map((r) => String(r.event_id)));
    const rows = (list) => list.map((e) => { const m = main[e.id]; return evRow(e, m, m && fs[m.fighter1_id], m && fs[m.fighter2_id]); }).join("");
    if (tab === "up") {
      const [h, ...rest] = ev; h.cnt = cnt[h.id]; const m = main[h.id];
      L.innerHTML = hero(h, m, m && fs[m.fighter1_id], m && fs[m.fighter2_id], hasS.has(String(h.id))) + (rest.length ? `<h3 class="mm-sec">Дальше в календаре</h3><div class="card mm-list">${rows(rest)}</div>` : "");
    } else L.innerHTML = `<div class="card mm-list">${rows(ev)}</div>`;
  }

  /* ---------- карт ---------- */
  let isAdmin = false, uid = null, curPlayer = null;
  const killP = () => { try { curPlayer?.destroy(); } catch (e) {} curPlayer = null; };
  async function checkAdmin() {
    try { const { data: s } = await sbAuth.auth.getSession(); uid = s?.session?.user?.id || null; isAdmin = false;
      if (uid) { const { data } = await sbAuth.rpc("is_admin"); isAdmin = data === true; } } catch (e) { isAdmin = false; }
  }
  const curEventId = () => { const m = location.hash.match(/^#\/mma\/event\/([^/?]+)/); return m ? m[1] : null; };

  function playerCard(e, rows) {
    const start = new Date(e.start_time), upcoming = e.status !== "FINISHED" && start.getTime() > Date.now();
    if (rows.length) {
      return `<div class="card stream-card" id="mmTop"><div class="card-h">Трансляция<span class="live-dot" style="margin-left:8px"></span>${rows.length > 1 ? `<span class="st-srcs">${rows.map((s, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}">${E(s.title || "Поток " + (i + 1))}</button>`).join("")}</span>` : ""}</div><div class="st-item"><div class="st-box"></div></div></div>`;
    }
    if (upcoming) {
      return `<div class="card stream-card" id="mmTop"><div class="card-h">Трансляция</div><div class="st-item"><div class="st-box"><button type="button" class="st-ph" aria-label="Трансляция"><span class="st-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="st-ph-msg" role="status" aria-live="polite"></span></button></div></div></div>`;
    }
    return `<div class="card stream-card" id="mmTop"><div class="card-h">Трансляция</div><div class="st-item"><div class="st-box"><div class="st-err"><div>Запись трансляции недоступна</div></div></div></div></div>`;
  }

  function adminPanel(e, rows) {
    return `<div class="card" id="mmAdm"><div class="card-h">Трансляции (админ)</div>
      ${rows.length ? rows.map((s, i) => `<div class="st-item"><div class="st-head"><b>${E(s.title || "Трансляция " + (i + 1))}</b><small>${[s.language, s.quality, s.commentator].filter(Boolean).map(E).join(" · ")}</small><button type="button" class="adm-btn del" data-del="${s.id}">Убрать</button></div><small style="opacity:.6;word-break:break-all">${E(s.url)}</small></div>`).join("") : `<div class="st-item"><small style="opacity:.6">Трансляций пока нет</small></div>`}
      <div class="adm-bar"><button type="button" class="adm-btn" id="admOpen">Добавить трансляцию</button></div>
      <form id="admForm" class="adm-form" hidden novalidate>
        <div class="full"><label>Ссылка на трансляцию *</label><input name="url" placeholder="https://… (.m3u8 / .mp4 / страница плеера)" autocomplete="off" autocapitalize="off"></div>
        <div class="full"><label>Название</label><input name="title" placeholder="Например: Основной поток"></div>
        <div><label>Тип</label><select name="kind"><option value="auto">Авто</option><option value="hls">HLS (.m3u8)</option><option value="mp4">Видео (mp4)</option><option value="iframe">Встраиваемая страница</option></select></div>
        <div><label>Язык</label><input name="language" placeholder="RU"></div>
        <div><label>Качество</label><input name="quality" placeholder="1080p"></div>
        <div><label>Комментатор</label><input name="commentator"></div>
        <div class="full"><div class="adm-msg" id="admMsg" style="padding:0"></div><button type="submit" class="adm-btn">Добавить трансляцию</button> <button type="button" class="adm-btn ghost" id="admCancel">Отмена</button></div>
      </form></div>`;
  }

  async function mountStreams(e, wrap) {
    const id = String(e.id);
    let rows = [];
    try { rows = await Q(sb.from("mma_streams").select("*").eq("event_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true })); } catch (er) { console.warn("[mma streams]", er.message); }
    if (curEventId() !== id) return;
    killP(); wrap.querySelector("#mmTop")?.remove(); wrap.querySelector("#mmAdm")?.remove();
    const anchor = wrap.querySelector(".mm-h");
    const tmp = document.createElement("div"); tmp.innerHTML = playerCard(e, rows);
    const top = tmp.firstElementChild; anchor.after(top);
    const box = top.querySelector(".st-box");
    if (rows.length) {
      const play = (i) => { killP(); curPlayer = window.ZonePlayer.mount(box, rows[i]); };
      play(0);
      top.querySelectorAll(".st-srcs button").forEach((b) => (b.onclick = () => { top.querySelectorAll(".st-srcs button").forEach((x) => x.classList.toggle("on", x === b)); play(+b.dataset.i); }));
    } else {
      const btn = top.querySelector(".st-ph"), out = top.querySelector(".st-ph-msg");
      if (btn) btn.onclick = () => {
        const start = new Date(e.start_time), left = start.getTime() - Date.now(), hhmm = fmtT(e.start_time);
        out.textContent = left <= 600000 ? "Трансляция скоро появится" : "Трансляция появится за 10 минут до начала · начало в " + hhmm;
        btn.classList.add("shown");
      };
    }
    if (!isAdmin) return;
    const t2 = document.createElement("div"); t2.innerHTML = adminPanel(e, rows);
    const sec = t2.firstElementChild; wrap.appendChild(sec);
    const form = sec.querySelector("#admForm"), msg = sec.querySelector("#admMsg"), say = (t, ok) => { msg.textContent = t; msg.classList.toggle("ok", !!ok); };
    sec.querySelector("#admOpen").onclick = () => { form.hidden = !form.hidden; if (!form.hidden) form.url.focus(); };
    sec.querySelector("#admCancel").onclick = () => { form.hidden = true; say(""); };
    sec.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-del]"); if (!b || !confirm("Убрать эту трансляцию?")) return;
      b.disabled = true; const { error } = await sbAuth.from("mma_streams").delete().eq("id", b.dataset.del);
      if (error) { b.disabled = false; return toast("Ошибка: " + error.message); } toast("Трансляция убрана"); mountStreams(e, wrap);
    });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault(); const url = form.url.value.trim();
      if (!/^https?:\/\/\S+$/i.test(url)) return say("Вставьте ссылку, начинающуюся с http(s)://");
      const row = { event_id: id, url, kind: form.kind.value };
      for (const k of ["title", "language", "quality", "commentator"]) { const v = form[k].value.trim(); if (v) row[k] = v; }
      row.sort_order = rows.length; const btn = form.querySelector("button[type=submit]"); btn.disabled = true; say("");
      const { error } = await sbAuth.from("mma_streams").insert(row); btn.disabled = false;
      if (error) return say(/row-level|permission/i.test(error.message) ? "Нет прав: аккаунт не админ" : error.message);
      toast("Трансляция добавлена"); mountStreams(e, wrap);
    });
  }

  async function viewEvent(id) {
    killP();
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
      ${blocks || `<div class="card"><div class="empty-note">Бои ещё не объявлены.</div></div>`}</div>`);
    await checkAdmin();
    if (curEventId() === String(id)) mountStreams(e, root().querySelector(".wrap"));
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
    if (!(parts[0] === "event")) killP();
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

  /* ---------- UFC вторым пунктом в меню (после «Матчи») ---------- */
  const TAB_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V7a2 2 0 014 0v3M11 10V6a2 2 0 014 0v4M15 10V8a2 2 0 014 0v6a6 6 0 01-6 6h-1a6 6 0 01-5-3l-2-3a1.6 1.6 0 012.6-1.8L7 13"/></svg>';
  let navBusy = false;
  function placeNav() {
    if (navBusy) return; navBusy = true;
    try {
      [[".gnav-links", "UFC"], [".tabbar", TAB_ICON + "UFC"]].forEach(([sel, html]) => {
        const box = document.querySelector(sel); if (!box) return;
        let a = box.querySelector('[data-r="mma"]');
        if (!a) { a = document.createElement("a"); a.href = "#/mma"; a.dataset.r = "mma"; a.innerHTML = html; }
        const first = box.querySelector("a"); if (first && first !== a && first.nextElementSibling !== a) first.after(a);
      });
      const on = /^#\/mma(\/|\?|$)/.test(location.hash);
      document.querySelectorAll('.gnav-links a[data-r="mma"]').forEach((a) => a.classList.toggle("active", on));
      document.querySelectorAll('.tabbar a[data-r="mma"]').forEach((a) => a.classList.toggle("on", on));
      if (on) { document.querySelectorAll('.gnav-links a:not([data-r="mma"])').forEach((a) => a.classList.remove("active")); document.querySelectorAll('.tabbar a:not([data-r="mma"])').forEach((a) => a.classList.remove("on")); }
    } finally { navBusy = false; }
  }
  ["gnav-links", "tabbar"].forEach((c) => { const el = document.querySelector("." + c); if (el) new MutationObserver(placeNav).observe(el, { childList: true }); });
  addEventListener("hashchange", () => setTimeout(placeNav, 0));
  placeNav(); setTimeout(placeNav, 300);
})();
