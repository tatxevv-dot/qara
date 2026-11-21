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
      <div class="hr-art">${art}</div>
      <div class="hr-info"><div class="hr-row">${badge(it)}</div>
      <div class="hr-nm">${esc(nm(m.home))} — ${esc(nm(m.away))}</div><div class="hr-sub">Футбол. ${esc(c.short)}</div></div></a>`;
  }
  function mmaBanner(it) {
    const { e, f1, f2 } = it, last = (f) => (f ? f.name.split(" ").slice(-1)[0] : "—");
    const fig = (f, side) => f?.body_url ? `<img class="hr-pl ${side}" src="${esc(f.body_url)}" alt="">` : `<img class="hr-hs ${side}" src="${esc(f?.photo_url || "")}" alt="" onerror="this.style.visibility='hidden'">`;
    return `<a class="hr-card mma" href="#/mma/event/${esc(e.id)}"><span class="hr-ufc">UFC</span>${it._s || it.live ? `<span class="hr-play">${PLAY}</span>` : ""}
      <div class="hr-art">${fig(f1, "l")}${fig(f2, "r")}</div>
      <div class="hr-info"><div class="hr-row">${badge(it)}</div>
      <div class="hr-nm">${esc(last(f1))} — ${esc(last(f2))}</div><div class="hr-sub">ММА. ${esc(e.name.split(":")[0])}</div></div></a>`;
  }

  async function make() {
    const [fb, mm] = await Promise.all([loadFootball(), loadMma().catch(() => [])]);
    const pick = fb.filter((m) => LIVE(m) || m._s);
    if (pick.length < 6) pick.push(...fb.filter((m) => !pick.includes(m)).slice(0, 6 - pick.length));
    const items = await Promise.all(pick.slice(0, 10).map(async (m) => ({ kind: "f", m, date: m.utc_date, live: LIVE(m) })));
    const all = [...items, ...mm].sort((a, b) => (b.live - a.live) || (new Date(a.date) - new Date(b.date))).slice(0, 10);
    if (!all.length) return "";
    return `<section class="hr"><div class="hr-h"><h2>Скоро в эфире</h2><a href="#/streams">все ›</a></div><div class="hr-scroll">${all.map((i) => (i.kind === "m" ? mmaBanner(i) : footballBanner(i))).join("")}</div></section>`;
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
    if (!html) main.insertAdjacentHTML("afterbegin", `<section class="hr hr-sk"><div class="hr-h"><h2>Скоро в эфире</h2></div><div class="hr-scroll"><i class="hr-card"></i><i class="hr-card"></i></div></section>`);
    let h = ""; try { h = await build(); } catch (e) { console.warn("[hero]", e); }
    const m2 = document.querySelector("#app main"); if (!m2) return;
    const sk = m2.querySelector(".hr-sk"); if (sk) sk.remove();
    if (!h || !isHome() || m2.querySelector(".hr")) return;
    m2.insertAdjacentHTML("afterbegin", h);
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
.hr-card{position:relative;flex:none;width:min(68vw,258px);height:372px;border-radius:24px;overflow:hidden;scroll-snap-align:start;color:#fff;text-decoration:none;display:block;box-shadow:var(--shadow-xs)}
.hr-sk .hr-card{background:var(--fill);animation:hrp 1.2s ease-in-out infinite alternate}@keyframes hrp{to{opacity:.55}}
.hr-card::before{content:"";position:absolute;inset:0;background:radial-gradient(90% 50% at 50% 30%,rgba(255,255,255,.18),transparent 70%);z-index:0}
.hr-card.mma{background:linear-gradient(170deg,#c4122b 0%,#14080c 85%)}
.hr-lg,.hr-ufc{position:absolute;top:13px;left:13px;z-index:3;height:36px;min-width:36px;box-sizing:border-box;border-radius:12px;background:#fff}
.hr-lg{width:36px;padding:6px;object-fit:contain}.hr-ufc{padding:0 11px;display:grid;place-items:center;color:#d20a0a;font-weight:900;font-size:16px}
.hr-play{position:absolute;top:14px;right:13px;z-index:3;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}.hr-play svg{width:13px;height:13px;fill:#fff}
.hr-art{position:absolute;left:0;right:0;top:56px;height:240px;z-index:1}
.hr-pl{position:absolute;bottom:0;height:100%;max-width:64%;object-fit:contain;object-position:bottom;filter:drop-shadow(0 10px 18px rgba(0,0,0,.4))}
.hr-pl.l{left:-3%}.hr-pl.r{right:-3%}.hr-pl.flip{transform:scaleX(-1)}
.hr-hs{position:absolute;bottom:0;width:56%;height:88%;object-fit:cover;object-position:top;border-radius:22px 22px 0 0;-webkit-mask-image:linear-gradient(#000 62%,transparent);mask-image:linear-gradient(#000 62%,transparent)}
.hr-hs.l{left:2%}.hr-hs.r{right:2%}
.hr-cr{position:absolute;top:50%;margin-top:-56px;width:112px;height:112px;border-radius:50%;background:rgba(255,255,255,.14);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.hr-cr img{width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}.hr-cr.l{left:3%}.hr-cr.r{right:3%}
.hr-card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:58%;background:linear-gradient(to top,rgba(8,8,16,.94) 0%,rgba(8,8,16,.7) 45%,transparent 100%);z-index:2}
.hr-info{position:absolute;left:15px;right:15px;bottom:15px;z-index:3}
.hr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.hr-b{display:inline-flex;gap:8px;padding:6px 12px;border-radius:12px;background:#ffd60a;color:#111;font-weight:800;font-size:14px}.hr-b i{font-style:normal;opacity:.5}.hr-b.live{background:#e5173f;color:#fff;letter-spacing:.03em}
.hr-mini{display:flex;gap:6px}.hr-mini img{width:30px;height:30px;object-fit:contain}
.hr-nm{font-size:20px;line-height:1.1;font-weight:800;text-transform:uppercase;letter-spacing:-.01em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hr-sub{margin-top:10px;font-size:14px;opacity:.78}
`;
  document.head.appendChild(st);
})();
