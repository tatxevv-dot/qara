/* qara — карусель баннеров ближайших трансляций на главной (над расписанием).
   Грузится после app.js. Звёзды: assets/stars/manifest.json + PNG без фона. */
(function () {
  "use strict";
  const isHome = () => { const h = location.hash; return h === "" || h === "#" || h === "#/" || /^#\/\?/.test(h); };
  const GRAD = { PL: ["#4b1a73", "#150727"], PD: ["#8a1426", "#1c0a10"], SA: ["#0f4bb0", "#081329"], BL1: ["#c4122b", "#1b0a0c"], FL1: ["#2547a8", "#0a1024"], CL: ["#123a8f", "#050b22"], NL: ["#27498c", "#08122b"] };
  const grad = (id) => GRAD[id] || ["#34397a", "#0b0c1f"];
  const comp = (id) => COMPS.find((c) => c.id === id) || { id, name: id, short: id, logo: "" };
  const Q = async (q) => { const { data, error } = await q; if (error) throw error; return data || []; };
  const LIVE = (m) => m.status === "LIVE" || m.status === "PAUSED";
  const nm = (t) => (t && (t.short_name || t.name)) || "—";
  const dm = (d) => new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';

  /* ---------- данные ---------- */
  async function loadFootball() {
    const now = Date.now(), from = new Date(now - 4 * 36e5).toISOString(), to = new Date(now + 7 * 864e5).toISOString();
    const ms = (await Q(sb.from("matches").select(M_SEL).in("competition_id", COMPS.map((c) => c.id)).in("status", ["SCHEDULED", "LIVE", "PAUSED"]).gte("utc_date", from).lte("utc_date", to).order("utc_date", { ascending: true }).limit(120)));
    const has = new Set();
    try { if (ms.length) (await Q(sb.from("match_streams").select("match_id").in("match_id", ms.map((m) => m.id)))).forEach((r) => has.add(String(r.match_id))); } catch (e) {}
    ms.forEach((m) => { m._s = has.has(String(m.id)); });
    return ms;
  }
  async function loadMma() {
    const now = Date.now(), from = new Date(now - 6 * 36e5).toISOString(), to = new Date(now + 7 * 864e5).toISOString();
    const evs = (await Q(sb.from("mma_events").select("*").gte("start_time", from).lte("start_time", to).order("start_time", { ascending: true }).limit(5))).filter((e) => e.status !== "FINISHED");
    if (!evs.length) return [];
    const ids = evs.map((e) => e.id);
    const fights = await Q(sb.from("mma_fights").select("event_id,bout_order,fighter1_id,fighter2_id,weight_class").in("event_id", ids).order("bout_order", { ascending: true }));
    const main = {}; fights.forEach((x) => { const c = main[x.event_id]; if (!c || x.bout_order < c.bout_order) main[x.event_id] = x; });
    const fids = [...new Set(Object.values(main).flatMap((x) => [x.fighter1_id, x.fighter2_id]))];
    const fs = {}; if (fids.length) (await Q(sb.from("mma_fighters").select("*").in("id", fids))).forEach((f) => (fs[f.id] = f));
    const has = new Set(); try { (await Q(sb.from("mma_streams").select("event_id").in("event_id", ids.map(String)))).forEach((r) => has.add(String(r.event_id))); } catch (e) {}
    return evs.map((e) => { const m = main[e.id] || {}; return { kind: "m", e, f1: fs[m.fighter1_id], f2: fs[m.fighter2_id], date: e.start_time, live: e.status === "LIVE" || new Date(e.start_time) <= new Date(), _s: has.has(String(e.id)) }; });
  }

  /* ---------- баннеры ---------- */
  const badge = (it) => it.live ? `<span class="hr-b live">LIVE</span>` : `<span class="hr-b">${dm(it.date)} <i>·</i> ${fmtTime(it.date)}</span>`;
  const bigCrest = (t, side) => `<span class="hr-cr ${side}">${crest(t, "")}</span>`;

  function footballBanner(it) {
    const m = it.m, c = comp(m.competition_id);
    const [c1, c2] = grad(m.competition_id), bg = `linear-gradient(170deg,${c1} 0%,${c2} 85%)`;
    const art = `${bigCrest(m.home, "l")}${bigCrest(m.away, "r")}`;
    return `<a class="hr-card" style="background:${bg}" href="#/match/${esc(m.id)}">
      <img class="hr-lg" src="${esc(c.logo)}" alt="">${it.live || m._s ? `<span class="hr-play">${PLAY}</span>` : ""}
      <div class="hr-art">${art}<div class="hr-mid"><b>VS</b>${badge(it)}</div></div>
      <div class="hr-info"><div class="hr-nm">${esc(nm(m.home))} — ${esc(nm(m.away))}</div><div class="hr-sub">Футбол. ${esc(c.short)}</div></div></a>`;
  }
  function mmaBanner(it) {
    const { e, f1, f2 } = it, last = (f) => (f ? f.name.split(" ").slice(-1)[0] : "—");
    const fig = (f, side) => f?.body_url ? `<img class="hr-pl ${side}" src="${esc(f.body_url)}" alt="">` : `<img class="hr-hs ${side}" src="${esc(f?.photo_url || "")}" alt="" onerror="this.style.visibility='hidden'">`;
    return `<a class="hr-card mma" href="#/mma/event/${esc(e.id)}"><span class="hr-ufc">UFC</span>${it._s || it.live ? `<span class="hr-play">${PLAY}</span>` : ""}
      <div class="hr-art">${fig(f1, "l")}${fig(f2, "r")}<div class="hr-mid"><b>VS</b>${badge(it)}</div></div>
      <div class="hr-info"><div class="hr-nm">${esc(last(f1))} — ${esc(last(f2))}</div><div class="hr-sub">ММА. ${esc(e.name.split(":")[0])}</div></div></a>`;
  }

  async function make() {
    const [fb, mm] = await Promise.all([loadFootball(), loadMma().catch(() => [])]);
    const pick = fb.filter((m) => LIVE(m) || m._s);
    if (pick.length < 6) pick.push(...fb.filter((m) => !pick.includes(m)).slice(0, 6 - pick.length));
    const items = await Promise.all(pick.slice(0, 10).map(async (m) => ({ kind: "f", m, date: m.utc_date, live: LIVE(m) })));
    const all = [...items, ...mm].sort((a, b) => (b.live - a.live) || ((b.kind === "m" && b.live) - (a.kind === "m" && a.live)) || (new Date(a.date) - new Date(b.date))).slice(0, 10);
    if (!all.length) return "";
    return `<section class="hr"><div class="hr-h"><h2>Скоро в эфире</h2><a href="#/streams">все ›</a></div><div class="hr-wrap"><div class="hr-scroll">${all.map((i) => (i.kind === "m" ? mmaBanner(i) : footballBanner(i))).join("")}</div></div></section>`;
  }

  /* ---------- автолистание + точки ---------- */
  const DUR = 13; /* секунд на один баннер */
  let curWrap = null;
  document.addEventListener("visibilitychange", () => { if (curWrap) curWrap.classList.toggle("paused", document.hidden); });
  function setup(sec) {
    const sc = sec && sec.querySelector(".hr-scroll"), wrap = sec && sec.querySelector(".hr-wrap");
    if (!sc || !wrap || sec.classList.contains("hr-sk")) return;
    const cards = [...sc.children];
    if (cards.length < 2) return;
    const vis = Math.max(1, Math.round(sc.clientWidth / (cards[0].offsetWidth + 12)));
    const pages = cards.length - vis + 1;
    if (pages < 2) return;
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    wrap.insertAdjacentHTML("beforeend", `<div class="hr-dots">${'<i class="hr-d"><u></u></i>'.repeat(pages)}</div>`);
    const dots = [...wrap.querySelectorAll(".hr-d")];
    const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) wrap.classList.add("static");
    curWrap = wrap;
    let idx = -1;
    const set = (i) => { dots.forEach((d) => d.classList.remove("on")); void wrap.offsetWidth; idx = i; dots[i].classList.add("on"); };
    const go = (i) => { sc.scrollTo({ left: i * step, behavior: "smooth" }); set(i); };
    wrap.addEventListener("animationend", (e) => { if (e.target.closest && e.target.closest(".hr-d.on")) go((idx + 1) % pages); });
    const pause = () => wrap.classList.add("paused"), play = () => wrap.classList.remove("paused");
    ["touchstart", "pointerdown", "mouseenter"].forEach((n) => sc.addEventListener(n, pause, { passive: true }));
    ["touchend", "touchcancel", "pointerup", "mouseleave"].forEach((n) => sc.addEventListener(n, play, { passive: true }));
    let tt; sc.addEventListener("scroll", () => { clearTimeout(tt); tt = setTimeout(() => { const i = Math.min(pages - 1, Math.max(0, Math.round(sc.scrollLeft / step))); if (i !== idx) set(i); }, 120); }, { passive: true });
    set(0);
  }

  /* ---------- вставка на главную ---------- */
  let html = "", at = 0, pend = null;
  async function build() {
    if (html && Date.now() - at < 9e4) return html;
    if (!pend) pend = make().finally(() => (pend = null));
    html = await pend; at = Date.now(); return html;
  }
  async function inject() {
    if (!isHome()) return;
    const main = document.querySelector("#app main");
    if (!main || main.querySelector(".hr")) return;
    if (!html) main.insertAdjacentHTML("afterbegin", `<section class="hr hr-sk"><div class="hr-h"><h2>Скоро в эфире</h2></div><div class="hr-wrap"><div class="hr-scroll"><i class="hr-card"></i><i class="hr-card"></i></div></div></section>`);
    let h = ""; try { h = await build(); } catch (e) { console.warn("[hero]", e); }
    const m2 = document.querySelector("#app main"); if (!m2) return;
    const sk = m2.querySelector(".hr-sk"); if (sk) sk.remove();
    if (!h || !isHome() || m2.querySelector(".hr")) return;
    m2.insertAdjacentHTML("afterbegin", h);
    setTimeout(() => setup(m2.querySelector(".hr")), 0);
  }
  let t; const kick = () => { clearTimeout(t); t = setTimeout(inject, 40); };
  new MutationObserver(kick).observe(document.querySelector("#app"), { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();

  /* ---------- стили ---------- */
  const st = document.createElement("style");
  st.textContent = `
.hr{margin:0 0 18px}
.hr-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 4px;margin-bottom:12px}
.hr-h h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--text)}.hr-h a{color:var(--accent);font-weight:700;font-size:16px}
.hr-scroll{display:flex;gap:12px;overflow-x:auto;padding:0 4px 4px;margin:0 -4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hr-scroll::-webkit-scrollbar{display:none}
.hr-card{position:relative;flex:0 0 100%;height:200px;border-radius:22px;overflow:hidden;scroll-snap-align:start;color:#fff;text-decoration:none;display:block;box-shadow:var(--shadow-xs)}
@media(min-width:900px){.hr-card{flex-basis:calc(50% - 6px)}}
.hr-wrap{position:relative}
.hr-dots{position:absolute;left:0;right:0;bottom:12px;z-index:5;display:flex;justify-content:center;align-items:center;gap:5px;pointer-events:none}
.hr-d{position:relative;display:block;width:6px;height:4px;border-radius:3px;background:rgba(255,255,255,.38);overflow:hidden;transition:width .35s cubic-bezier(.2,.8,.2,1)}
.hr-d.on{width:30px}
.hr-d u{position:absolute;inset:0;background:#fff;border-radius:3px;transform:scaleX(0);transform-origin:left;text-decoration:none}
.hr-d.on u{animation:hrfill ${DUR}s linear forwards}
@keyframes hrfill{to{transform:scaleX(1)}}
.hr-wrap.paused .hr-d.on u{animation-play-state:paused}
.hr-wrap.static .hr-d.on u{animation:none;transform:scaleX(1)}
.hr-sk .hr-card{background:var(--fill);animation:hrp 1.2s ease-in-out infinite alternate}@keyframes hrp{to{opacity:.55}}
.hr-card::before{content:"";position:absolute;inset:0;background:radial-gradient(70% 90% at 50% 40%,rgba(255,255,255,.16),transparent 70%);z-index:0}
.hr-card.mma{background:linear-gradient(135deg,#c4122b 0%,#14080c 90%)}
.hr-lg,.hr-ufc{position:absolute;top:12px;left:12px;z-index:3;height:34px;min-width:34px;box-sizing:border-box;border-radius:11px;background:#fff}
.hr-lg{width:34px;padding:5px;object-fit:contain}.hr-ufc{padding:0 10px;display:grid;place-items:center;color:#d20a0a;font-weight:900;font-size:14px}
.hr-play{position:absolute;top:12px;right:12px;z-index:3;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.hr-play svg{width:12px;height:12px;fill:#fff}
.hr-art{position:absolute;inset:0;z-index:1}
.hr-cr{position:absolute;top:46px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.hr-cr img{width:60px;height:60px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}.hr-cr.l{left:7%}.hr-cr.r{right:7%}
.hr-mid{position:absolute;left:50%;top:62px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px}
.hr-mid b{font-size:20px;font-weight:800;letter-spacing:.06em;opacity:.8}
.hr-pl{position:absolute;bottom:0;height:100%;max-width:38%;object-fit:contain;object-position:bottom;filter:drop-shadow(0 8px 14px rgba(0,0,0,.4))}.hr-pl.l{left:2%}.hr-pl.r{right:2%}.hr-pl.flip{transform:scaleX(-1)}
.hr-hs{position:absolute;bottom:0;width:30%;height:76%;object-fit:cover;object-position:top;border-radius:18px 18px 0 0;-webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}.hr-hs.l{left:5%}.hr-hs.r{right:5%}
.hr-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to top,rgba(8,8,16,.9) 0%,rgba(8,8,16,.55) 55%,transparent 100%);z-index:2}
.hr-info{position:absolute;left:14px;right:14px;bottom:24px;z-index:3;text-align:center}
.hr-b{display:inline-flex;gap:7px;padding:5px 11px;border-radius:11px;background:#ffd60a;color:#111;font-weight:800;font-size:13px;white-space:nowrap}.hr-b i{font-style:normal;opacity:.5}.hr-b.live{background:#e5173f;color:#fff;letter-spacing:.03em}
.hr-nm{font-size:17px;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hr-sub{margin-top:4px;font-size:12.5px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
  document.head.appendChild(st);
})();
