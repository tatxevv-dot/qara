/* qara — раздел «Все трансляции» (#/streams, #/streams/<лига>, #/streams/all).
   Грузится после app.js. Ничего в других файлах менять не нужно. */
(function () {
  "use strict";

  const isStreams = () => /^#\/streams(\/|\?|$)/.test(location.hash);
  const partOf = () => decodeURIComponent((location.hash.replace(/^#\/?/, "").split("?")[0].split("/")[1]) || "");

  /* ---------- стили ---------- */
  const css = `
.sx{padding-bottom:40px}
.sx-sec{margin-top:28px}
.sx-h{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 4px;margin-bottom:14px}
.sx-h h2{margin:0;font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:var(--text)}
.sx-h a{flex:none;color:var(--accent);font-weight:700;font-size:20px;text-decoration:none}
.sx-back{display:inline-block;margin:18px 4px 0;color:var(--accent);font-weight:600;text-decoration:none}
.sx-title{margin:6px 4px 0;font-size:30px;font-weight:800;letter-spacing:-.02em;color:var(--text)}
.sx-row{display:flex;gap:14px;overflow-x:auto;padding:0 4px 6px;margin:0 -4px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.sx-row::-webkit-scrollbar{display:none}
.sx-row>*{scroll-snap-align:start;flex:none}
.sx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.sx-grid>*{width:auto!important}
.sx-empty{padding:28px 16px;text-align:center;color:var(--text-3);background:var(--bg-elev);border-radius:20px}

/* турниры */
.sx-t{width:202px;height:150px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-decoration:none;color:#fff;background:linear-gradient(145deg,var(--c1),var(--c2));box-shadow:var(--shadow-xs)}
.sx-t img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}
.sx-t b{font-size:16px;font-weight:700;text-align:center;padding:0 10px}

/* вертикальная карточка трансляции */
.sx-card{position:relative;width:202px;height:354px;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;text-decoration:none;color:#fff;background:linear-gradient(170deg,var(--c1) 0%,var(--c2) 78%)}
.sx-card::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 38%,rgba(255,255,255,.16),transparent 70%);pointer-events:none}
.sx-lg{position:absolute;top:16px;left:16px;width:34px;height:34px;object-fit:contain;z-index:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}
.sx-play{position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;z-index:1;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.sx-play svg{width:12px;height:12px;fill:#fff}
.sx-cr2{position:absolute;left:0;right:0;top:78px;height:120px;display:flex;justify-content:center;align-items:center;z-index:1}
.sx-cr2 .sx-cr{width:92px;height:92px;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45))}
.sx-cr2 .sx-cr:first-child{margin-right:-14px}
.sx-badge{position:relative;z-index:1;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;font-weight:800;font-size:14px;margin-bottom:12px;background:#ffd60a;color:#111}
.sx-badge.live{background:#e5173f;color:#fff;letter-spacing:.02em}
.sx-badge i{font-style:normal;opacity:.55;font-weight:600}
.sx-nm{position:relative;z-index:1;font-size:21px;line-height:1.08;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.sx-nm span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-sub{position:relative;z-index:1;margin-top:12px;font-size:13px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* карточка эфирной записи */
.sx-rec{width:202px;text-decoration:none;color:var(--text)}
.sx-rec .pic{position:relative;height:114px;border-radius:16px;overflow:hidden;background:linear-gradient(150deg,#4a1470,#2a0a47);display:flex;align-items:center;justify-content:center;gap:0}
.sx-rec .pic .sx-cr{width:60px;height:60px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
.sx-rec .pic .sep{width:1px;height:62px;background:rgba(255,255,255,.35);margin:0 22px}
.sx-rec .pic .lg{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:20px;height:20px;object-fit:contain;opacity:.9}
.sx-rec .pic .tag{position:absolute;left:8px;bottom:8px;padding:3px 8px;border-radius:8px;background:#ffd60a;color:#111;font-size:11px;font-weight:800}
.sx-rec .t{margin-top:10px;font-size:15px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-rec .s{font-size:14px;color:var(--text-3);margin-top:2px}

/* нижняя панель: 4 пункта */
.tabbar{grid-template-columns:repeat(4,1fr)!important}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------- пункт в шапке и в нижней панели ---------- */
  function addNav() {
    const links = document.querySelector(".gnav-links");
    if (links && !links.querySelector('[data-r="streams"]')) {
      const a = document.createElement("a"); a.href = "#/streams"; a.dataset.r = "streams"; a.textContent = "Все трансляции";
      const first = links.querySelector("a"); first ? first.after(a) : links.prepend(a);
    }
    const tb = document.querySelector(".tabbar");
    if (tb && !tb.querySelector('[data-r="streams"]')) {
      const a = document.createElement("a"); a.href = "#/streams"; a.dataset.r = "streams";
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5l4 2.5-4 2.5z"/></svg>Трансляции';
      const first = tb.querySelector("a"); first ? first.after(a) : tb.prepend(a);
    }
  }
  function markActive() {
    const on = isStreams();
    document.querySelectorAll('.gnav-links a[data-r="streams"],.tabbar a[data-r="streams"]').forEach((a) => a.classList.toggle(on && a.closest(".tabbar") ? "on" : "active", on));
    if (on) document.querySelectorAll('.gnav-links a:not([data-r="streams"])').forEach((a) => a.classList.remove("active"));
    if (on) document.querySelectorAll('.tabbar a:not([data-r="streams"])').forEach((a) => a.classList.remove("on"));
  }

  /* ---------- данные ---------- */
  const GRAD = {
    PL: ["#4b1a73", "#150727"], PD: ["#8a1426", "#1c0a10"], SA: ["#0f4bb0", "#081329"],
    BL1: ["#c4122b", "#1b0a0c"], FL1: ["#2547a8", "#0a1024"], CL: ["#123a8f", "#050b22"], NL: ["#27498c", "#08122b"],
  };
  const grad = (id) => GRAD[id] || ["#34397a", "#0b0c1f"];
  const comp = (id) => COMPS.find((c) => c.id === id) || { id, name: id, short: id, logo: "" };
  const LIVE = (m) => m.status === "LIVE" || m.status === "PAUSED";
  const UP = (m) => LIVE(m) || m.status === "SCHEDULED";
  const nm = (t) => (t && (t.short_name || t.name)) || "—";

  async function load(id) {
    const now = Date.now();
    const from = new Date(now - 4 * 3600e3).toISOString(), to = new Date(now + 10 * 864e5).toISOString(), past = new Date(now - 150 * 864e5).toISOString();
    const ids = id && id !== "all" ? [id] : COMPS.map((c) => c.id);
    const [a, b] = await Promise.all([
      run(sb.from("matches").select(M_SEL).in("competition_id", ids).in("status", ["SCHEDULED", "LIVE", "PAUSED"]).gte("utc_date", from).lte("utc_date", to).order("utc_date", { ascending: true }).limit(150)),
      run(sb.from("matches").select(M_SEL).in("competition_id", ids).eq("status", "FINISHED").not("raw->highlight->>id", "is", null).gte("utc_date", past).order("utc_date", { ascending: false }).limit(80)),
    ]);
    const up = a.filter(UP), done = b.filter((m) => m.status === "FINISHED" && m.raw?.highlight?.id);
    let has = new Set();
    try {
      const all = up.map((m) => m.id);
      if (all.length) (await run(sb.from("match_streams").select("match_id").in("match_id", all))).forEach((r) => has.add(String(r.match_id)));
    } catch (e) { console.warn("[streams]", e.message); }
    up.forEach((m) => { m._s = has.has(String(m.id)); });
    
    up.sort((x, y) => (LIVE(y) - LIVE(x)) || (y._s - x._s) || (new Date(x.utc_date) - new Date(y.utc_date)));
    return { up, done };
  }

  /* ---------- шаблоны ---------- */
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const dm = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  function card(m) {
    const c = comp(m.competition_id), [c1, c2] = grad(m.competition_id), live = LIVE(m);
    const badge = live ? `<span class="sx-badge live">LIVE</span>` : `<span class="sx-badge">${dm(m.utc_date)} <i>·</i> ${fmtTime(m.utc_date)}</span>`;
    return `<a class="sx-card" style="--c1:${c1};--c2:${c2}" href="#/match/${esc(m.id)}">
      <img class="sx-lg" src="${esc(c.logo)}" alt="">${m._s ? `<span class="sx-play">${PLAY}</span>` : ""}
      <div class="sx-cr2">${crest(m.home, "sx-cr")}${crest(m.away, "sx-cr")}</div>
      ${badge}
      <div class="sx-nm"><span>${esc(nm(m.home))}</span><span>${esc(nm(m.away))}</span></div>
      <div class="sx-sub">Футбол. ${esc(c.short)}</div></a>`;
  }
  function rec(m) {
    const c = comp(m.competition_id), score = m.home_goals != null ? `${m.home_goals}:${m.away_goals}` : "";
    return `<a class="sx-rec" href="#/match/${esc(m.id)}"><div class="pic"><img class="lg" src="${esc(c.logo)}" alt="">${crest(m.home, "sx-cr")}<span class="sep"></span>${crest(m.away, "sx-cr")}<span class="tag">▶ Обзор</span></div>
      <div class="t">${esc(nm(m.home))} — ${esc(nm(m.away))}</div><div class="s">${esc(c.short)}${score ? " · " + score : ""} · ${dm(m.utc_date)}</div></a>`;
  }
  function tile(c) {
    const [c1, c2] = grad(c.id);
    return `<a class="sx-t" style="--c1:${c1};--c2:${c2}" href="#/streams/${c.id}"><img src="${esc(c.logo)}" alt=""><b>${esc(c.name)}</b></a>`;
  }
  const head = (t, href) => `<div class="sx-h"><h2>${t}</h2>${href ? `<a href="${href}" aria-label="Все">все ›</a>` : ""}</div>`;
  const row = (arr, fn, empty, grid) => arr.length ? `<div class="${grid ? "sx-grid" : "sx-row"}">${arr.map(fn).join("")}</div>` : `<div class="sx-empty">${empty}</div>`;

  /* ---------- страница ---------- */
  let busy = false;
  async function render() {
    if (busy) return; busy = true;
    const app = document.querySelector("#app"), id = partOf(), key = location.hash;
    try {
      addNav(); markActive();
      app.innerHTML = '<div class="wrap sx"><div class="sx-empty" style="margin-top:24px">Загрузка…</div></div>';
      window.scrollTo({ top: 0 });
      const { up, done } = await load(id);
      if (location.hash !== key) return;
      let h;
      if (id === "all") {
        h = `<a class="sx-back" href="#/streams">‹ Все трансляции</a>
          <div class="sx-sec" style="margin-top:14px">${head("Прямые трансляции")}${row(up, card, "Пока нет запланированных трансляций.", true)}</div>
          <div class="sx-sec">${head("Обзоры матчей")}${row(done, rec, "Обзоров пока нет.", true)}</div>`;
      } else if (id) {
        const c = comp(id);
        h = `<a class="sx-back" href="#/streams">‹ Все трансляции</a>
          <div class="sx-sec" style="margin-top:14px">${head(esc(c.name) + ". Прямые трансляции")}${row(up, card, "Пока нет запланированных трансляций.")}</div>
          <div class="sx-sec">${head(esc(c.name) + ". Обзоры матчей")}${row(done, rec, "Обзоров пока нет.")}</div>`;
      } else {
        h = `<div class="sx-sec" style="margin-top:20px">${head("Турниры")}<div class="sx-row">${COMPS.map(tile).join("")}</div></div>
          <div class="sx-sec">${head("Все трансляции", "#/streams/all")}${row(up.slice(0, 14), card, "Пока нет запланированных трансляций.")}</div>
          <div class="sx-sec">${head("Обзоры матчей", "#/streams/all")}${row(done.slice(0, 14), rec, "Обзоров пока нет.")}</div>`;
      }
      app.innerHTML = `<div class="wrap sx">${h}</div>`;
    } catch (e) {
      console.error(e);
      app.innerHTML = `<div class="wrap sx"><div class="sx-empty" style="margin-top:24px">Не удалось загрузить трансляции. ${esc(e.message || e)}</div></div>`;
    } finally { busy = false; }
  }

  /* ---------- подключение к роутеру app.js ---------- */
  const origHome = window.viewHome;
  window.viewHome = function () { return isStreams() ? render() : origHome.apply(this, arguments); };

  /* страница могла быть открыта сразу по ссылке #/streams — главная из app.js успеет отрисоваться раньше нас */
  let tmr;
  new MutationObserver(() => {
    if (!isStreams()) return;
    clearTimeout(tmr);
    tmr = setTimeout(() => { const a = document.querySelector("#app"); if (a && !a.querySelector(".sx")) render(); }, 80);
  }).observe(document.querySelector("#app"), { childList: true });

  addNav();
  window.addEventListener("hashchange", () => { addNav(); markActive(); });
  if (isStreams()) setTimeout(() => { const a = document.querySelector("#app"); if (!a.querySelector(".sx")) render(); }, 0);
})();
