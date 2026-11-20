/* red card badge next to club crest: match list rows + match header */
(function () {
  const app = document.getElementById("app"); if (!app) return;
  const cache = {}; // matchId -> { t: ts, teams: Set }
  const TTL = 60000;
  const put = (host, n) => {
    const img = host.querySelector("img"); if (!img || !n) return;
    let w = img.parentElement.classList.contains("rcw") ? img.parentElement : null;
    if (!w) { w = document.createElement("span"); w.className = "rcw"; img.replaceWith(w); w.appendChild(img); }
    const b = document.createElement("span"); b.className = "rcb"; b.title = "Красная карточка";
    b.innerHTML = "<i></i>" + (n > 1 ? "<b>" + n + "</b>" : ""); w.appendChild(b);
  };
  async function load(ids) {
    const need = ids.filter((id) => !cache[id] || Date.now() - cache[id].t > TTL);
    for (let i = 0; i < need.length; i += 60) {
      const part = need.slice(i, i + 60);
      try {
        const [ev, ms] = await Promise.all([
          run(sb.from("match_events").select("match_id,team_id").eq("type", "red").in("match_id", part)),
          run(sb.from("matches").select("id,home_team_id,away_team_id").in("id", part)),
        ]);
        for (const id of part) cache[id] = { t: Date.now(), home: 0, away: 0 };
        const mm = {}; for (const m of ms) mm[String(m.id)] = m;
        for (const e of ev) { const m = mm[String(e.match_id)], c = cache[String(e.match_id)] || cache[e.match_id]; if (!m || !c) continue; if (String(e.team_id) === String(m.home_team_id)) c.home++; else if (String(e.team_id) === String(m.away_team_id)) c.away++; }
      } catch (e) { /* ignore */ }
    }
  }
  let busy = false, again = false;
  async function run_() {
    if (busy) { again = true; return; } busy = true;
    try {
      const rows = [...app.querySelectorAll('a.mrow[href^="#/match/"]')].filter((r) => !r.dataset.rc);
      const hdr = location.hash.match(/^#\/match\/([^/?]+)/);
      const ids = new Set(rows.map((r) => r.getAttribute("href").slice(8).split("?")[0]));
      if (hdr) ids.add(hdr[1]);
      if (!ids.size) return;
      await load([...ids]);
      for (const r of rows) {
        r.dataset.rc = 1;
        const c = cache[r.getAttribute("href").slice(8).split("?")[0]]; if (!c) continue;
        if (c.home) { const h = r.querySelector(".tm.h"); if (h) put(h, c.home); }
        if (c.away) { const a = r.querySelector(".tm:not(.h)"); if (a) put(a, c.away); }
      }
      if (hdr && cache[hdr[1]]) {
        const c = cache[hdr[1]];
        const ts = [...app.querySelectorAll(".mh-team")].filter((t) => !t.dataset.rc);
        if (ts.length === 2) {
          ts.forEach((t, i) => { t.dataset.rc = 1; put(t, i === 0 ? c.home : c.away); });
        }
      }
    } finally { busy = false; if (again) { again = false; schedule(); } }
  }
  let q = 0; const schedule = () => { if (!q) q = requestAnimationFrame(() => { q = 0; run_(); }); };
  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  schedule();
})();
