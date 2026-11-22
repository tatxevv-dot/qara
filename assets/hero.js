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

  /* ---------- баннеры: плоский фирменный стиль лиг ---------- */
  const svgUri = (x) => `url("data:image/svg+xml,${encodeURIComponent(x)}")`;
  const PL_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225' preserveAspectRatio='xMidYMid slice'><path d='M0 60 C90 20 170 120 260 80 S380 20 400 40 L400 120 C330 100 270 170 190 150 S60 90 0 130Z' fill='#4b1c71' opacity='.9'/><path d='M0 150 C80 120 170 210 270 170 S370 130 400 150 L400 225 L0 225Z' fill='#5c2788' opacity='.75'/><path d='M150 0 C220 50 300 20 400 -10 L400 0Z' fill='#6a35a0'/></svg>`;
  const CL_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225' preserveAspectRatio='xMidYMid slice'><g fill='none' stroke-width='3' stroke-linecap='round'><path d='M330 0 C340 40 380 60 400 70' stroke='#4be3ff'/><path d='M345 0 C355 34 385 50 400 56' stroke='#9b5cff'/><path d='M360 0 C368 28 390 40 400 44' stroke='#ffe14a'/><path d='M0 170 C40 175 70 200 90 225' stroke='#4be3ff'/><path d='M0 185 C30 190 55 208 70 225' stroke='#9b5cff'/><path d='M0 200 C20 204 40 216 50 225' stroke='#4bff9a'/></g></svg>`;
  const SKIN = {
    PL: { bg: `${svgUri(PL_SVG)} center/cover no-repeat, #3a1458`, logo: "w" },
    PD: { bg: "#ee5b4d", logo: "w" },
    BL1: { bg: "linear-gradient(90deg,#b3141f 0%,#d92b1c 100%)", logo: "w" },
    FL1: { bg: "#3b74f6", logo: "w" },
    SA: { bg: "linear-gradient(180deg,#8cc7da 0%,#47b8cf 52%,#a6ecee 100%)", logo: "o", line: "#0b2b3b" },
    CL: { bg: `${svgUri(CL_SVG)} center/cover no-repeat, #0a1450`, logo: "w" },
    UFC: { bg: "#e4112b", logo: "w" },
  };
  const skin = (id) => SKIN[id] || { bg: "#20233a", logo: "w" };
  const dayLbl = (d) => { const t = new Date(d), n = new Date(); const k = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5); return (k === 0 ? "Сегодня" : k === 1 ? "Завтра" : dm(d)) + " · " + fmtTime(d); };
  const caption = (live, title, sub) => `<div class="hr-cap"><div class="hr-nm">${live ? '<span class="hr-live">LIVE</span>' : ""}<span>${esc(title)}</span></div><div class="hr-sub">${esc(sub)}</div></div>`;

  function footballBanner(it) {
    const m = it.m, c = comp(m.competition_id), k = skin(m.competition_id);
    const lg = c.logo ? `<img class="hr-lg ${k.logo}" src="${esc(c.logo)}" alt="">` : "";
    return `<a class="hr-item" href="#/match/${esc(m.id)}"><div class="hr-card k-${esc(m.competition_id)}"${k.line ? ` style="--ln:${k.line}"` : ""}>${lg}<i class="hr-ln"></i><span class="hr-tm l">${crest(m.home, "")}</span><span class="hr-tm r">${crest(m.away, "")}</span></div>${caption(it.live, nm(m.home) + " — " + nm(m.away), (it.live ? "" : dayLbl(it.date) + " · ") + c.short)}</a>`;
  }
  function mmaBanner(it) {
    const { e, f1, f2 } = it, label = e.name.split(":")[0].trim(), last = (f) => (f ? f.name.split(" ").slice(-1)[0] : "—");
    const mark = /fight night/i.test(label) ? `<div class="hr-ufcl"><b>UFC</b><span>FIGHT<i>NIGHT</i></span></div>` : `<div class="hr-ufcl"><b>${esc(label)}</b></div>`;
    const fig = (f, side) => `<span class="hr-tm fg ${side}">${f?.body_url ? `<img class="hr-bd" src="${esc(f.body_url)}" alt="">` : `<img class="hr-hd" src="${esc(f?.photo_url || "")}" alt="" onerror="this.style.visibility='hidden'">`}</span>`;
    return `<a class="hr-item" href="#/mma/event/${esc(e.id)}"><div class="hr-card k-UFC">${mark}<i class="hr-ln"></i>${fig(f1, "l")}${fig(f2, "r")}</div>${caption(it.live, last(f1) + " — " + last(f2), (it.live ? "" : dayLbl(it.date) + " · ") + label)}</a>`;
  }

  async function make() {
    const [fb, mm] = await Promise.all([loadFootball(), loadMma().catch(() => [])]);
    const pick = fb.filter((m) => LIVE(m) || m._s);
    if (pick.length < 6) pick.push(...fb.filter((m) => !pick.includes(m)).slice(0, 6 - pick.length));
    const items = await Promise.all(pick.slice(0, 10).map(async (m) => ({ kind: "f", m, date: m.utc_date, live: LIVE(m) })));
    const all = [...items, ...mm].sort((a, b) => (b.live - a.live) || (new Date(a.date) - new Date(b.date))).slice(0, 10);
    if (!all.length) return "";
    return `<section class="hr"><div class="hr-h"><h2>Скоро в эфире</h2><a href="#/streams">все ›</a></div><div class="hr-wrap"><div class="hr-scroll">${all.map((i) => (i.kind === "m" ? mmaBanner(i) : footballBanner(i))).join("")}</div></div></section>`;
  }

  /* ---------- автолистание + точки ---------- */
  const DUR = 5; /* секунд на один баннер */
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
    if (!html) main.insertAdjacentHTML("afterbegin", `<section class="hr hr-sk"><div class="hr-h"><h2>Скоро в эфире</h2></div><div class="hr-wrap"><div class="hr-scroll"><div class="hr-item"><div class="hr-card"></div></div><div class="hr-item"><div class="hr-card"></div></div></div></div></section>`);
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
  const SKIN_CSS = Object.entries(SKIN).map(([k, v]) => `.hr-card.k-${k}{background:${v.bg}}`).join("\n");
  st.textContent = `
.hr{margin:0 0 18px}
.hr-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 4px;margin-bottom:12px}
.hr-h h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:var(--text)}.hr-h a{color:var(--accent);font-weight:700;font-size:16px}
.hr-wrap{position:relative}
.hr-scroll{display:flex;gap:12px;overflow-x:auto;padding:0 4px 4px;margin:0 -4px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hr-scroll::-webkit-scrollbar{display:none}
.hr-item{flex:0 0 100%;min-width:0;scroll-snap-align:start;display:block;color:var(--text);text-decoration:none}
@media(min-width:900px){.hr-item{flex-basis:calc(50% - 6px)}}
.hr-card{position:relative;aspect-ratio:1.78/1;border-radius:22px;overflow:hidden;color:#fff;background:#20233a}
${SKIN_CSS}
.hr-sk .hr-card{background:var(--fill);animation:hrp 1.2s ease-in-out infinite alternate}@keyframes hrp{to{opacity:.55}}
.hr-lg{position:absolute;left:50%;top:9%;height:19%;max-width:40%;transform:translateX(-50%);object-fit:contain}
.hr-lg.w{filter:brightness(0) invert(1)}
.hr-ln{position:absolute;left:50%;top:38%;height:50%;width:2px;margin-left:-1px;border-radius:2px;background:var(--ln,#fff)}
.hr-tm{position:absolute;top:38%;height:52%;width:34%;display:flex;align-items:center;justify-content:center}
.hr-tm.l{left:8%}.hr-tm.r{right:8%}
.hr-tm:not(.fg) img{width:100%!important;height:100%!important;object-fit:contain;filter:none}
.hr-tm.fg{top:30%;height:70%;align-items:flex-end}
.hr-bd{width:100%;height:100%;object-fit:contain;object-position:bottom}
.hr-hd{height:68%;aspect-ratio:1;border-radius:50%;object-fit:cover;object-position:top;box-shadow:0 0 0 2px #fff;margin-bottom:12%;background:rgba(255,255,255,.2)}
.hr-ufcl{position:absolute;left:50%;top:8%;transform:translateX(-50%);text-align:center;line-height:1;font-style:italic;color:#fff;white-space:nowrap}
.hr-ufcl b{display:block;font-size:30px;font-weight:900;letter-spacing:-.03em}
.hr-ufcl span{display:block;margin-top:-1px;font-size:12px;font-weight:800;letter-spacing:.05em}.hr-ufcl i{font-weight:300}
.hr-cap{padding:10px 4px 0}
.hr-nm{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden}
.hr-nm span:last-child{overflow:hidden;text-overflow:ellipsis}
.hr-live{flex:none;background:#e5173f;color:#fff;font-size:11px;font-weight:800;letter-spacing:.04em;padding:2px 7px;border-radius:6px}
.hr-sub{margin-top:2px;font-size:13px;color:var(--text-3)}
.hr-dots{display:flex;justify-content:center;align-items:center;gap:5px;margin-top:12px;pointer-events:none}
.hr-d{position:relative;display:block;width:6px;height:4px;border-radius:3px;background:rgba(128,128,128,.35);overflow:hidden;transition:width .35s cubic-bezier(.2,.8,.2,1)}
.hr-d.on{width:30px}
.hr-d u{position:absolute;inset:0;background:var(--text);border-radius:3px;transform:scaleX(0);transform-origin:left;text-decoration:none}
.hr-d.on u{animation:hrfill ${DUR}s linear forwards}
@keyframes hrfill{to{transform:scaleX(1)}}
.hr-wrap.paused .hr-d.on u{animation-play-state:paused}
.hr-wrap.static .hr-d.on u{animation:none;transform:scaleX(1)}
`;
  document.head.appendChild(st);
})();
