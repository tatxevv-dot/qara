/* qara — UFC redesign layer. Keeps the existing fighter, ranking and event-detail views. */
(function () {
  "use strict";
  if (typeof sb === "undefined" || typeof window.viewMma !== "function") return;

  const originalViewMma = window.viewMma;
  const app = () => document.getElementById("app");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const query = async (builder) => {
    const { data, error } = await builder;
    if (error) throw error;
    return data || [];
  };
  const wc = {
    Flyweight: "Наилегчайший", Bantamweight: "Легчайший", Featherweight: "Полулёгкий",
    Lightweight: "Лёгкий", Welterweight: "Полусредний", Middleweight: "Средний",
    "Light Heavyweight": "Полутяжёлый", Heavyweight: "Тяжёлый",
    "Women's Strawweight": "Женский соломенный", "Women's Flyweight": "Женский наилегчайший",
    "Women's Bantamweight": "Женский легчайший"
  };
  const method = { "KO/TKO": "КО / ТКО", Submission: "Сабмишн", Decision: "Решение" };
  const date = (v, opts) => v ? new Date(v).toLocaleDateString("ru-RU", opts || { day: "numeric", month: "long" }) : "Дата уточняется";
  const time = (v) => v ? new Date(v).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const record = f => f ? `${f.wins ?? 0}-${f.losses ?? 0}${f.draws ? `-${f.draws}` : ""}` : "";
  const initials = n => String(n || "?").split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase();
  const photo = f => `<span class="ur-face">${f?.photo_url ? `<img src="${esc(f.photo_url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span>${esc(initials(f?.name))}</span></span>`;
  const location = e => [e.venue, e.city, e.country].filter(Boolean).join(" · ");
  const liveElapsed = start => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 1000));
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };
  const countdown = start => {
    const ms = new Date(start).getTime() - Date.now();
    if (!Number.isFinite(ms)) return "Время уточняется";
    if (ms <= 0) return "Ожидаем обновления статуса";
    const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000);
    return d ? `Через ${d} дн. ${h} ч.` : h ? `Через ${h} ч. ${m} мин.` : `Через ${m} мин.`;
  };
  const hasLiveStream = rows => rows.some(s => s.is_active !== false && /^https?:\/\//i.test(s.url || ""));

  const styles = `
  .ur-wrap{padding-bottom:42px}.ur-hero{position:relative;overflow:hidden;border-radius:26px;padding:26px;margin:4px 0 18px;background:radial-gradient(ellipse at 85% 15%,rgba(255,65,80,.25),transparent 42%),linear-gradient(135deg,#191b22,#08090d);color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.14)}
  .ur-kicker{display:flex;align-items:center;gap:9px;color:#bfc2cc;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.ur-mark{width:8px;height:8px;border-radius:50%;background:#ff3b4e;box-shadow:0 0 0 5px rgba(255,59,78,.14)}
  .ur-hero h1{font-size:clamp(30px,5vw,46px);line-height:1.02;letter-spacing:-.055em;margin:18px 0 8px;color:#fff}.ur-hero p{margin:0;color:#b8bac4;font-size:14px;line-height:1.5;max-width:560px}
  .ur-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.ur-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:13px;background:#f5f5f7;color:#15161a;font-weight:800;font-size:13px;text-decoration:none}.ur-btn.ghost{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.13)}
  .ur-subnav{display:flex;gap:7px;margin:0 0 17px}.ur-subnav a{padding:9px 15px;border-radius:12px;background:var(--fill-2);color:var(--text-2);font-size:13px;font-weight:700;text-decoration:none}.ur-subnav a.on{background:var(--text);color:var(--bg-elev)}
  .ur-tabs{display:flex;gap:8px;margin:0 0 16px;overflow:auto;scrollbar-width:none}.ur-tabs a{white-space:nowrap;text-decoration:none;padding:9px 14px;border:1px solid var(--line-2);border-radius:999px;color:var(--text-2);font-size:13px;font-weight:700}.ur-tabs a.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .ur-section{margin:20px 0}.ur-section-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 3px 12px}.ur-section-head h2{font-size:19px;letter-spacing:-.03em;margin:0}.ur-section-head span{font-size:12px;color:var(--text-3)}
  .ur-live{border:1px solid rgba(255,59,78,.25);background:linear-gradient(135deg,rgba(255,59,78,.09),var(--bg-elev) 58%);border-radius:20px;padding:17px;margin-bottom:13px}.ur-live-top{display:flex;justify-content:space-between;gap:12px;align-items:center}.ur-live-label{display:inline-flex;align-items:center;gap:8px;color:#ed3548;font-size:12px;font-weight:900;letter-spacing:.08em}.ur-pulse{width:8px;height:8px;background:#ed3548;border-radius:50%;animation:urPulse 1.35s infinite}.ur-clock{font-variant-numeric:tabular-nums;font-size:12px;color:var(--text-3);font-weight:700}.ur-event-name{font-size:19px;font-weight:850;letter-spacing:-.035em;margin:12px 0 3px}.ur-meta{font-size:12px;color:var(--text-3)}
  .ur-fight{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:9px;margin:15px 0 3px}.ur-fighter{display:flex;align-items:center;gap:9px;min-width:0}.ur-fighter.right{flex-direction:row-reverse;text-align:right}.ur-face{position:relative;display:grid;place-items:center;overflow:hidden;width:42px;height:42px;border-radius:50%;background:var(--fill-2);color:var(--text-2);font-size:12px;font-weight:800;flex:none}.ur-face img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}.ur-face span{position:relative}.ur-fighter b{display:block;font-size:12px;line-height:1.25;overflow-wrap:anywhere}.ur-fighter small{display:block;color:var(--text-3);font-size:10px;margin-top:3px}.ur-vs{font-size:11px;color:var(--text-3);font-weight:900}.ur-live-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px}.ur-note{font-size:11px;color:var(--text-3)}
  .ur-event{display:block;text-decoration:none;color:inherit;background:var(--bg-elev);border:1px solid var(--line-2);border-radius:18px;padding:15px;margin-bottom:10px;transition:transform .2s,border-color .2s}.ur-event:hover{transform:translateY(-2px);border-color:var(--accent)}.ur-event-top{display:flex;justify-content:space-between;gap:12px}.ur-event h3{font-size:15px;line-height:1.25;margin:0;letter-spacing:-.02em}.ur-event-date{text-align:right;white-space:nowrap;font-size:12px;font-weight:800}.ur-event-date small{display:block;color:var(--text-3);font-weight:500;margin-top:3px}.ur-event-meta{font-size:11px;color:var(--text-3);margin-top:5px}.ur-event-fight{display:flex;align-items:center;gap:9px;margin-top:13px;padding-top:12px;border-top:1px solid var(--line-2)}.ur-event-fight .ur-face{width:32px;height:32px}.ur-event-fight b{font-size:12px;line-height:1.3}.ur-event-fight .ur-versus{font-size:11px;color:var(--text-3);font-weight:800;margin:0 2px}.ur-event-bottom{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;font-size:11px;color:var(--text-3)}.ur-event-cta{font-size:12px;font-weight:800;color:var(--accent)}.ur-empty{padding:22px 15px;text-align:center;color:var(--text-3);background:var(--bg-elev);border:1px dashed var(--line-2);border-radius:17px;font-size:13px;line-height:1.5}
  .ur-streams{margin-top:24px;padding-top:18px;border-top:1px solid var(--line-2)}.ur-streams .ur-event{min-width:230px;max-width:290px;flex:1}.ur-streams-row{display:flex;gap:12px;overflow:auto;padding:2px 2px 9px;scrollbar-width:thin}.ur-streams-row .ur-event{margin:0}.ur-stream-tag{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:99px;background:rgba(237,53,72,.12);color:#ed3548;font-size:10px;font-weight:900}
  @keyframes urPulse{0%,100%{box-shadow:0 0 0 0 rgba(237,53,72,.45)}50%{box-shadow:0 0 0 6px rgba(237,53,72,0)}}
  @media(max-width:560px){.ur-hero{padding:21px;border-radius:21px}.ur-event{padding:13px}.ur-fight{gap:5px}.ur-fighter{gap:6px}.ur-fighter .ur-face{width:34px;height:34px}.ur-live{padding:14px}}
  @media(prefers-reduced-motion:reduce){.ur-pulse{animation:none}.ur-event{transition:none}}
  `;
  if (!document.getElementById("ur-styles")) {
    const style = document.createElement("style"); style.id = "ur-styles"; style.textContent = styles; document.head.appendChild(style);
  }

  async function loadEvents() {
    const events = await query(sb.from("mma_events").select("*").order("start_time", { ascending: false }).limit(80));
    const ids = events.map(e => e.id);
    if (!ids.length) return { events, fights: [], fighters: {}, streams: {} };
    const [fights, streamRows] = await Promise.all([
      query(sb.from("mma_fights").select("*").in("event_id", ids).order("bout_order", { ascending: true })),
      query(sb.from("mma_streams").select("event_id,url,title,is_active,sort_order").in("event_id", ids))
        .catch(() => [])
    ]);
    const fighterIds = [...new Set(fights.flatMap(f => [f.fighter1_id, f.fighter2_id]).filter(Boolean))];
    const fighterRows = [];
    for (let i = 0; i < fighterIds.length; i += 150) {
      fighterRows.push(...await query(sb.from("mma_fighters").select("id,name,nickname,country,country_code,photo_url,wins,losses,draws").in("id", fighterIds.slice(i, i + 150))));
    }
    const fighters = Object.fromEntries(fighterRows.map(f => [String(f.id), f]));
    const streams = {};
    streamRows.filter(s => s.is_active !== false && /^https?:\/\//i.test(s.url || "")).forEach(s => (streams[String(s.event_id)] ||= []).push(s));
    return { events, fights, fighters, streams };
  }

  function fightPreview(f, fighters) {
    if (!f) return "";
    const a = fighters[String(f.fighter1_id)], b = fighters[String(f.fighter2_id)];
    if (!a && !b) return "";
    return `<div class="ur-fight"><div class="ur-fighter">${photo(a)}<div><b>${esc(a?.name || "Боец не указан")}</b><small>${esc(record(a))}</small></div></div><span class="ur-vs">VS</span><div class="ur-fighter right"><div><b>${esc(b?.name || "Боец не указан")}</b><small>${esc(record(b))}</small></div>${photo(b)}</div></div>`;
  }
  function eventCard(e, fights, fighters, streams, type) {
    const eventFights = fights.filter(f => String(f.event_id) === String(e.id));
    const main = eventFights[0];
    const live = e.status === "LIVE";
    const finished = e.status === "FINISHED";
    const stream = hasLiveStream(streams[String(e.id)] || []);
    const when = finished ? "Завершён" : live ? "LIVE сейчас" : countdown(e.start_time);
    const cta = live && stream ? "Смотреть трансляцию" : finished ? "Смотреть результаты" : "Открыть кард";
    return `<a class="ur-event" href="#/mma/event/${encodeURIComponent(e.id)}">
      <div class="ur-event-top"><div><h3>${esc(e.name)}</h3><div class="ur-event-meta">${esc(location(e) || (e.event_type === "numbered" ? "Номерной турнир UFC" : "UFC Fight Night"))}</div></div>
      <div class="ur-event-date">${date(e.start_time)}<small>${time(e.start_time)}${time(e.start_time) ? " · " : ""}${esc(when)}</small></div></div>
      ${fightPreview(main, fighters)}
      <div class="ur-event-bottom"><span>${eventFights.length} ${eventFights.length === 1 ? "бой" : "боёв"}${e.event_type === "numbered" ? " · Номерной" : " · Fight Night"}</span><span class="ur-event-cta">${stream && live ? "▶ " : ""}${cta} →</span></div>
    </a>`;
  }

  let renderToken = 0;
  async function redesignedSchedule(params) {
    const token = ++renderToken;
    const tab = params?.get("t") === "past" ? "past" : "up";
    const target = app();
    target.innerHTML = `<div class="wrap mm ur-wrap"><div class="ur-hero"><div class="ur-kicker"><i class="ur-mark"></i> QARA FIGHT NIGHT</div><h1>UFC</h1><p>Турниры, прямые эфиры, результаты боёв и рейтинги бойцов — в одном месте.</p><div class="ur-actions"><a class="ur-btn" href="#/mma/rankings">Рейтинги бойцов</a><a class="ur-btn ghost" href="#/streams">Все трансляции</a></div></div><div class="ur-subnav"><a class="on" href="#/mma">Турниры</a><a href="#/mma/rankings">Рейтинги</a></div><div class="ur-tabs"><a class="${tab === "up" ? "on" : ""}" href="#/mma">Ближайшие</a><a class="${tab === "past" ? "on" : ""}" href="#/mma?t=past">Завершённые</a></div><div class="ur-empty">Загружаем турниры UFC…</div></div>`;
    try {
      const data = await loadEvents();
      if (token !== renderToken || !/^#\/mma(?:\?|$)/.test(location.hash)) return;
      const now = Date.now();
      const live = data.events.filter(e => e.status === "LIVE").sort((a,b) => new Date(a.start_time)-new Date(b.start_time));
      const upcoming = data.events.filter(e => e.status !== "FINISHED" && e.status !== "CANCELLED" && e.status !== "LIVE" && new Date(e.start_time).getTime() >= now).sort((a,b) => new Date(a.start_time)-new Date(b.start_time));
      const past = data.events.filter(e => e.status === "FINISHED" || (e.status !== "LIVE" && e.status !== "CANCELLED" && new Date(e.start_time).getTime() < now)).sort((a,b) => new Date(b.start_time)-new Date(a.start_time));
      const list = tab === "past" ? past : upcoming;
      const liveHtml = tab === "up" && live.length ? `<section class="ur-section"><div class="ur-section-head"><h2>Сейчас в эфире</h2><span>${live.length} ${live.length === 1 ? "турнир" : "турнира"}</span></div>${live.map(e => {
        const f = data.fights.find(x => String(x.event_id) === String(e.id));
        const active = hasLiveStream(data.streams[String(e.id)] || []);
        return `<div class="ur-live"><div class="ur-live-top"><span class="ur-live-label"><i class="ur-pulse"></i> LIVE</span><span class="ur-clock" data-live-start="${esc(e.start_time)}">${liveElapsed(e.start_time)}</span></div><div class="ur-event-name">${esc(e.name)}</div><div class="ur-meta">${esc(location(e) || "Турнир UFC")}</div>${fightPreview(f, data.fighters)}<div class="ur-live-foot"><span class="ur-note">${active ? "Доступен активный поток" : "Турнир идёт, но ссылка на эфир пока не добавлена"}</span><a class="ur-btn" href="#/mma/event/${encodeURIComponent(e.id)}">${active ? "Смотреть трансляцию" : "Открыть кард"} →</a></div></div>`;
      }).join("")}</section>` : "";
      const sectionTitle = tab === "past" ? "Результаты турниров" : "Следующие турниры";
      const cards = list.map(e => eventCard(e, data.fights, data.fighters, data.streams, tab)).join("");
      const empty = tab === "past" ? "Завершённых турниров пока нет в базе." : "Пока нет подтверждённых предстоящих турниров. Загляни позже — список обновится вместе с данными.";
      const wrap = target.querySelector(".ur-wrap");
      wrap.innerHTML = `<div class="ur-hero"><div class="ur-kicker"><i class="ur-mark"></i> QARA FIGHT NIGHT</div><h1>UFC</h1><p>Турниры, прямые эфиры, результаты боёв и рейтинги бойцов — в одном месте.</p><div class="ur-actions"><a class="ur-btn" href="#/mma/rankings">Рейтинги бойцов</a><a class="ur-btn ghost" href="#/streams">Все трансляции</a></div></div><div class="ur-subnav"><a class="on" href="#/mma">Турниры</a><a href="#/mma/rankings">Рейтинги</a></div><div class="ur-tabs"><a class="${tab === "up" ? "on" : ""}" href="#/mma">Ближайшие</a><a class="${tab === "past" ? "on" : ""}" href="#/mma?t=past">Завершённые</a></div>${liveHtml}<section class="ur-section"><div class="ur-section-head"><h2>${sectionTitle}</h2><span>${list.length} ${tab === "past" ? "в базе" : "в календаре"}</span></div>${cards || `<div class="ur-empty">${empty}</div>`}</section>`;
      const tick = () => {
        wrap.querySelectorAll("[data-live-start]").forEach(el => { el.textContent = liveElapsed(el.dataset.liveStart); });
      };
      tick();
      if (window.__urLiveTimer) clearInterval(window.__urLiveTimer);
      if (live.length) window.__urLiveTimer = setInterval(tick, 1000);
    } catch (error) {
      if (token !== renderToken) return;
      const wrap = target.querySelector(".ur-wrap");
      if (wrap) wrap.insertAdjacentHTML("beforeend", `<div class="ur-empty">Не удалось загрузить турниры UFC. ${esc(error.message || error)}</div>`);
      console.error("[qara UFC redesign]", error);
    }
  }

  window.viewMma = function (parts, params) {
    if (!parts || !parts.length || parts[0] === "") return redesignedSchedule(params || new URLSearchParams());
    return originalViewMma.apply(this, arguments);
  };

  /* UFC also appears inside the existing all-sports streams page. */
  let streamsBusy = false;
  async function addUfcToStreams() {
    const page = document.querySelector("#app .sx");
    if (!page || page.querySelector(".ur-streams") || streamsBusy || !/^#\/streams(?:\/|\?|$)/.test(location.hash)) return;
    streamsBusy = true;
    try {
      const data = await loadEvents();
      if (!page.isConnected || !/^#\/streams(?:\/|\?|$)/.test(location.hash) || page.querySelector(".ur-streams")) return;
      const now = Date.now();
      const picks = data.events.filter(e => e.status === "LIVE" || (e.status !== "FINISHED" && e.status !== "CANCELLED" && new Date(e.start_time).getTime() >= now)).sort((a,b) => (a.status === "LIVE" ? -1 : b.status === "LIVE" ? 1 : new Date(a.start_time)-new Date(b.start_time))).slice(0, 8);
      const html = `<section class="ur-streams"><div class="ur-section-head"><h2>UFC · турниры и эфиры</h2><a class="ur-event-cta" href="#/mma">Все турниры →</a></div>${picks.length ? `<div class="ur-streams-row">${picks.map(e => eventCard(e, data.fights, data.fighters, data.streams, "up")).join("")}</div>` : `<div class="ur-empty">В календаре пока нет подтверждённых турниров UFC.</div>`}</section>`;
      const sections = page.querySelectorAll(".sx-sec");
      const reviews = [...sections].find(s => /Обзоры матчей/.test(s.textContent));
      if (reviews) reviews.insertAdjacentHTML("beforebegin", html); else page.insertAdjacentHTML("beforeend", html);
    } catch (e) {
      console.warn("[qara UFC streams]", e);
    } finally { streamsBusy = false; }
  }
  const mo = new MutationObserver(() => { if (/^#\/streams(?:\/|\?|$)/.test(location.hash)) addUfcToStreams(); });
  mo.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { if (window.__urLiveTimer) clearInterval(window.__urLiveTimer); setTimeout(addUfcToStreams, 100); });
  if (/^#\/streams(?:\/|\?|$)/.test(location.hash)) setTimeout(addUfcToStreams, 250);
})();
