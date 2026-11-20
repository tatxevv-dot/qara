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
.sx-t img{width:68px;height:68px;box-sizing:border-box;padding:12px;border-radius:50%;background:#fff;object-fit:contain}
.sx-t b{font-size:16px;font-weight:700;text-align:center;padding:0 10px}

/* вертикальная карточка трансляции */
.sx-card{position:relative;width:202px;height:354px;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;text-decoration:none;color:#fff;background:linear-gradient(170deg,var(--c1) 0%,var(--c2) 78%)}
.sx-card::after{content:"";position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 38%,rgba(255,255,255,.16),transparent 70%);pointer-events:none}
.sx-lg{position:absolute;top:14px;left:14px;width:38px;height:38px;box-sizing:border-box;padding:6px;border-radius:12px;background:#fff;object-fit:contain;z-index:1}
.sx-play{position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;z-index:1;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.sx-play svg{width:12px;height:12px;fill:#fff}
.sx-cr2{position:absolute;left:0;right:0;top:78px;height:120px;display:flex;justify-content:center;align-items:center;z-index:1}
.sx-cr2 .sx-cr{width:92px;height:92px;object-fit:contain;}
.sx-cr2 .sx-cr:first-child{margin-right:-14px}
.sx-badge{position:relative;z-index:1;align-self:flex-start;display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;font-weight:800;font-size:14px;margin-bottom:12px;background:#ffd60a;color:#111}
.sx-badge.live{background:#e5173f;color:#fff;letter-spacing:.02em}
.sx-badge i{font-style:normal;opacity:.55;font-weight:600}
.sx-nm{position:relative;z-index:1;font-size:21px;line-height:1.08;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;display:flex;flex-direction:column;gap:2px;overflow:hidden}
.sx-nm span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-card.mma{background:linear-gradient(170deg,#c4122b 0%,#14080c 80%)}
.sx-ufc{position:absolute;top:14px;left:14px;height:38px;padding:0 10px;border-radius:12px;background:#fff;color:#d20a0a;font-weight:900;font-size:15px;letter-spacing:.02em;display:grid;place-items:center;z-index:1}
.sx-ph{position:relative;width:88px;height:88px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.16);display:grid;place-items:center;font-weight:800;font-size:24px;box-shadow:0 0 0 3px rgba(255,255,255,.9),0 8px 18px rgba(0,0,0,.35);flex:none}
.sx-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}
.sx-cr2 .sx-ph+.sx-ph{margin-left:-16px}
.sx-t .sx-ufcl{width:68px;height:68px;border-radius:50%;background:#fff;color:#d20a0a;display:grid;place-items:center;font-weight:900;font-size:18px}
.sx-sub{position:relative;z-index:1;margin-top:12px;font-size:13px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* карточка эфирной записи */
.sx-rec{width:202px;text-decoration:none;color:var(--text)}
.sx-rec .pic{position:relative;height:114px;border-radius:16px;overflow:hidden;background:linear-gradient(150deg,#4a1470,#2a0a47);display:flex;align-items:center;justify-content:center;gap:0}
.sx-rec .pic .sx-cr{width:60px;height:60px;object-fit:contain;}
.sx-rec .pic .sep{width:1px;height:62px;background:rgba(255,255,255,.35);margin:0 22px}
.sx-rec .pic .lg{position:absolute;top:8px;left:8px;width:26px;height:26px;box-sizing:border-box;padding:4px;border-radius:8px;background:#fff;object-fit:contain}
.sx-rec .pic .tag{position:absolute;left:8px;bottom:8px;padding:3px 8px;border-radius:8px;background:#ffd60a;color:#111;font-size:11px;font-weight:800}
.sx-rec .t{margin-top:10px;font-size:15px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx-rec .s{font-size:14px;color:var(--text-3);margin-top:2px}


/* скелетоны */
.sx-sk-h{height:22px;width:42%;border-radius:8px;margin:0 4px 16px}
.sx-sk-t{width:202px;height:150px;border-radius:22px}
.sx-sk-c{width:202px;height:354px;border-radius:22px}
.sx-sk-p{width:202px;height:114px;border-radius:16px}
.sx-sk-l{height:12px;border-radius:6px;margin-top:10px}
.sx-lgsk{display:flex;align-items:center;gap:14px;padding:14px 4px}
.sx-lgsk .skl.circle{width:36px;height:36px}

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
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10.9 9.9v4.2L14.5 12z"/></svg>Трансляции';
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

  async function loadMma(from, to) {
    const evs = (await run(sb.from("mma_events").select("*").gte("start_time", from).lte("start_time", to).order("start_time", { ascending: true }).limit(10))).filter((e) => e.status !== "FINISHED");
    if (!evs.length) return [];
    const ids = evs.map((e) => e.id);
    const fights = await run(sb.from("mma_fights").select("event_id,bout_order,fighter1_id,fighter2_id,weight_class,is_title").in("event_id", ids).order("bout_order", { ascending: true }));
    const main = {}; fights.forEach((x) => { const c = main[x.event_id]; if (!c || x.bout_order < c.bout_order) main[x.event_id] = x; });
    const fids = [...new Set(Object.values(main).flatMap((x) => [x.fighter1_id, x.fighter2_id]))];
    const fs = {}; if (fids.length) (await run(sb.from("mma_fighters").select("id,name,photo_url").in("id", fids))).forEach((f) => (fs[f.id] = f));
    const has = new Set(); try { (await run(sb.from("mma_streams").select("event_id").in("event_id", ids.map(String)))).forEach((r) => has.add(String(r.event_id))); } catch (e) {}
    return evs.map((e) => { const m = main[e.id] || {}; const live = e.status === "LIVE" || new Date(e.start_time) <= new Date();
      return { _mma: true, id: e.id, name: e.name, utc_date: e.start_time, status: live ? "LIVE" : "SCHEDULED", f1: fs[m.fighter1_id], f2: fs[m.fighter2_id], wc: m.weight_class, _s: has.has(String(e.id)) }; });
  }
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
    
    if (!id || id === "all") { try { up.push(...(await loadMma(from, to))); } catch (e) { console.warn("[streams mma]", e.message); } }
    up.sort((x, y) => (LIVE(y) - LIVE(x)) || (y._s - x._s) || (new Date(x.utc_date) - new Date(y.utc_date)));
    return { up, done };
  }

  /* ---------- шаблоны ---------- */
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const dm = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  const ini = (n) => (n || "?").split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  const fph = (f) => `<span class="sx-ph"><img src="${esc(f?.photo_url || "")}" alt="" loading="lazy" onerror="this.remove()">${esc(ini(f?.name))}</span>`;
  function mmaCard(m) {
    const live = LIVE(m), last = (f) => (f ? f.name.split(" ").slice(-1)[0] : "—");
    const badge = live ? `<span class="sx-badge live">LIVE</span>` : `<span class="sx-badge">${dm(m.utc_date)} <i>·</i> ${fmtTime(m.utc_date)}</span>`;
    return `<a class="sx-card mma" href="#/mma/event/${esc(m.id)}"><span class="sx-ufc">UFC</span>${m._s ? `<span class="sx-play">${PLAY}</span>` : ""}
      <div class="sx-cr2">${fph(m.f1)}${fph(m.f2)}</div>${badge}
      <div class="sx-nm"><span>${esc(last(m.f1))}</span><span>${esc(last(m.f2))}</span></div>
      <div class="sx-sub">ММА. ${esc(m.name.split(":")[0])}</div></a>`;
  }
  function card(m) {
    if (m._mma) return mmaCard(m);
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


  /* ---------- скелетоны ---------- */
  const sb_ = (c, st) => `<i class="skl ${c}"${st ? ` style="${st}"` : ""}></i>`;
  const skRow = (n, cls, extra) => `<div class="sx-row">${Array.from({ length: n }, () => `<div>${sb_(cls)}${extra || ""}</div>`).join("")}</div>`;
  const skSec = (body) => `<div class="sx-sec">${sb_("sx-sk-h")}${body}</div>`;
  const recSk = `${sb_("sx-sk-l", "width:85%")}${sb_("sx-sk-l", "width:45%;margin-top:8px")}`;
  function skeleton(id) {
    const cards = skSec(skRow(3, "sx-sk-c")), recs = skSec(skRow(3, "sx-sk-p", recSk));
    if (!id) return `<div class="wrap sx skl-page"><div class="sx-sec" style="margin-top:20px">${sb_("sx-sk-h")}${skRow(3, "sx-sk-t")}</div>${cards}${recs}</div>`;
    return `<div class="wrap sx skl-page"><div class="sx-sec" style="margin-top:20px">${sb_("sx-sk-h", "width:30%")}</div>${cards}${recs}</div>`;
  }
  const leaguesSk = () => `<div class="wrap lg skl-page"><div style="padding:20px 4px 6px">${sb_("", "height:32px;width:35%;border-radius:10px")}</div><div style="padding:10px 4px">${sb_("", "height:44px;border-radius:14px")}</div>${Array.from({ length: 8 }, (_, i) => `<div class="sx-lgsk">${sb_("circle")}${sb_("", `height:14px;width:${[52, 40, 60, 45, 56, 38, 50, 44][i]}%`)}</div>`).join("")}</div>`;

  /* ---------- страница ---------- */
  let busy = false;
  async function render() {
    if (busy) return; busy = true;
    const app = document.querySelector("#app"), id = partOf(), key = location.hash;
    try {
      addNav(); markActive();
      app.innerHTML = skeleton(id);
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
        h = `<div class="sx-sec" style="margin-top:20px">${head("Турниры")}<div class="sx-row"><a class="sx-t" style="--c1:#c4122b;--c2:#14080c" href="#/mma"><span class="sx-ufcl">UFC</span><b>UFC</b></a>${COMPS.map(tile).join("")}</div></div>
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


  /* «Лиги»: скелетон, пока подгружаются логотипы */
  const origLeagues = window.viewLeagues;
  if (typeof origLeagues === "function") window.viewLeagues = async function () {
    const app = document.querySelector("#app"), self = this, args = arguments;
    app.innerHTML = leaguesSk();
    try {
      await Promise.race([
        Promise.all(COMPS.map((c) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = c.logo; }))),
        new Promise((ok) => setTimeout(ok, 700)),
      ]);
    } catch (e) {}
    if (/^#\/leagues(\/|\?|$)/.test(location.hash)) return origLeagues.apply(self, args);
  };

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
