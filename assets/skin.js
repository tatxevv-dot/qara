/* Zone skin v3 — lineups: two connected half-pitches, nothing overlaps (loaded after app.js) */
(function () {
  const avg = (ps) => { const r = ps.map((p) => +p.rating).filter(Boolean); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
  window.matchLineups = function ({ m, pms, evs, H, A }, box) {
    if (!pms.length) { box.innerHTML = noData("Составы появятся примерно за час до начала матча."); return; }
    const goalsBy = {}, cardsBy = {};
    for (const e of evs) {
      if (!e.player_id) continue;
      if (e.type === "goal" || e.type === "penalty_goal") goalsBy[e.player_id] = (goalsBy[e.player_id] || 0) + 1;
      if (e.type === "yellow" || e.type === "red") cardsBy[e.player_id] = e.type;
    }
    const last = (p) => p.player?.raw?.last || (p.player?.name || "").split(" ").slice(-1)[0] || "";
    const dot = (p, x, y) => {
      const g = goalsBy[p.player_id], c = cardsBy[p.player_id];
      return `<a class="pl" href="#/player/${p.player_id}" style="left:${x}%;top:${y}%"><span class="ph"><span>${esc(p.raw?.jersey || "")}</span><img src="${headshot(p.player_id)}" alt="" loading="lazy" onerror="__phErr(this,'${p.player_id}')">`
        + (p.rating ? `<i class="rt rating ${ratingCls(p.rating)}">${Number(p.rating).toFixed(1)}</i>` : "")
        + (p.raw?.subOut ? `<i class="so"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></i>${p.raw.outM != null ? `<em class="sm">${p.raw.outM}'</em>` : ""}` : "")
        + (c ? `<i class="cd ${c === "red" ? "card-r" : "card-y"}"></i>` : "")
        + (g ? `<i class="gl">${ICON.ball}${g > 1 ? `<b>${g}</b>` : ""}</i>` : "")
        + `</span><span class="nm">${esc(last(p))}</span></a>`;
    };
    const half = (tid, away) => {
      const f = (tid === m.home_team_id ? H : A)?.raw?.formation;
      const lines = layoutXI(pms.filter((p) => p.team_id === tid), f).filter((l) => l.length);
      return lines.map((ln, li) => {
        const y0 = 9 + (li / Math.max(1, lines.length - 1)) * 74, y = away ? y0 : 100 - y0;
        return ln.map((p, pi) => { const x0 = 8 + ((pi + 0.5) / ln.length) * 84; return dot(p, away ? 100 - x0 : x0, y); }).join("");
      }).join("");
    };
    const head = (t, tid) => {
      const f = (tid === m.home_team_id ? H : A)?.raw?.formation;
      const a = avg(pms.filter((p) => p.team_id === tid && p.raw?.starter));
      return `<a class="lu-head" href="#/team/${t.id}">${crest(t, "crest sm")}<b>${esc(t.name)}</b><span class="fm">${esc(f || "")}</span>${a ? `<span class="rating ${ratingCls(a)}">${a.toFixed(1)}</span>` : ""}</a>`;
    };
    const bench = (t, tid) => {
      const rows = pms.filter((p) => p.team_id === tid && !p.raw?.starter).sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
        .map((p) => `<a class="brow" href="#/player/${p.player_id}"><span class="no">${esc(p.raw?.jersey || "")}</span>${avatar(p.player_id, p.player?.name)}<span class="grow">${esc(p.player?.name)}<br><small>${esc(p.raw?.pos || "")}${p.raw?.subIn ? ` · <span style="color:var(--win)">↑ ${p.raw.inM}'</span>` : ""}</small></span>${p.minutes ? ratingChip(p.rating) : ""}</a>`).join("");
      return rows ? `<div class="lu-sub">Запасные · ${esc(t.short_name || t.name)}</div><div class="bench1">${rows}</div>` : "";
    };
    const halfH = (tid, home) => {
      const f = (tid === m.home_team_id ? H : A)?.raw?.formation;
      const lines = layoutXI(pms.filter((p) => p.team_id === tid), f).filter((l) => l.length);
      return lines.map((ln, li) => {
        const d0 = 6 + (li / Math.max(1, lines.length - 1)) * 40, x = home ? d0 : 100 - d0;
        return ln.map((p, pi) => { const y0 = 8 + ((pi + 0.5) / ln.length) * 84; return dot(p, x, home ? y0 : 100 - y0); }).join("");
      }).join("");
    };
    const tc = (t) => { const c = teamColor(t); return c ? fitColor(c) : "#8aa0b8"; };
    const hh = (t, tid) => { const f = (tid === m.home_team_id ? H : A)?.raw?.formation; const a = avg(pms.filter((p) => p.team_id === tid && p.raw?.starter)); return `<a class="lu-hh" href="#/team/${t.id}">${crest(t, "crest sm")}<b>${esc(t.name)}</b><span class="fm">${esc(f || "")}</span>${a ? `<span class="rating ${ratingCls(a)}">${a.toFixed(1)}</span>` : ""}</a>`; };
    box.innerHTML = `<div class="lu luw card" style="--hc:${tc(m.home)};--ac:${tc(m.away)}"><div class="lu-hz"><div class="lu-hhead">${hh(m.home, m.home_team_id)}${hh(m.away, m.away_team_id)}</div><div class="lu-hpitch"><svg class="hl" viewBox="0 0 105 68" preserveAspectRatio="none"><g fill="none" stroke="var(--pitch-line)" stroke-width=".3"><rect x="1" y="1" width="103" height="66"/><line x1="52.5" y1="1" x2="52.5" y2="67"/><circle cx="52.5" cy="34" r="9.15"/><rect x="1" y="13.85" width="16.5" height="40.3"/><rect x="1" y="24.85" width="5.5" height="18.3"/><rect x="87.5" y="13.85" width="16.5" height="40.3"/><rect x="98.5" y="24.85" width="5.5" height="18.3"/></g></svg>${halfH(m.home_team_id, true).replace(/class="pl"/g, 'class="pl h"')}${halfH(m.away_team_id, false).replace(/class="pl"/g, 'class="pl a"')}</div></div>
      <div class="lu-vt">${head(m.away, m.away_team_id)}<div class="lu-pitch"><div class="lu-half">${halfLines}${half(m.away_team_id, true).replace(/class="pl"/g, 'class="pl a"')}</div><div class="lu-half flip">${halfLines}${half(m.home_team_id, false).replace(/class="pl"/g, 'class="pl h"')}</div></div>${head(m.home, m.home_team_id)}</div>
      <div class="lu-bench">${bench(m.home, m.home_team_id)}${bench(m.away, m.away_team_id)}</div></div>`;
  };
})();

/* ===== v4: dropdowns, compact calendar, compact tables ===== */
(function () {
  const $$ = (s, e = document) => [...e.querySelectorAll(s)];
  const mk = (cls) => { const s = document.createElement("select"); s.className = "zsel " + (cls || ""); return s; };
  const lab = (b) => b.textContent.trim().replace(/\s+/g, " ") || b.querySelector("img")?.alt || b.title || "–";
  function seg(el) {
    if (el.dataset.z) return; el.dataset.z = 1; return; /* v7: chips stay chips (FotMob style) */
    const btns = $$("button", el); if (btns.length < 2) return;
    const sel = mk();
    btns.forEach((b, i) => { const o = document.createElement("option"); o.value = i; o.textContent = lab(b); sel.appendChild(o); });
    const sync = () => { const i = btns.findIndex((b) => b.classList.contains("on")); if (i >= 0) sel.value = i; };
    sync();
    sel.addEventListener("change", () => btns[sel.value].click());
    el.after(sel); el.style.display = "none";
    new MutationObserver(sync).observe(el, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }
  function pills(el) {
    if (el.dataset.z) return; el.dataset.z = 1;
    const sel = mk();
    $$("a.pill", el).forEach((a) => { const o = document.createElement("option"); o.value = a.getAttribute("href"); o.textContent = a.textContent.trim(); o.selected = a.classList.contains("on"); sel.appendChild(o); });
    sel.addEventListener("change", () => { location.hash = sel.value; });
    el.after(sel); el.style.display = "none";
  }
  function minutes() {
    const r = document.getElementById("minm"); if (!r || r.dataset.z) return; r.dataset.z = 1;
    const lb = r.closest("label"), sel = mk("zmin");
    [[0, "Любые минуты"], [90, "От 90 минут"], [270, "От 270 минут"], [450, "От 450 минут"], [900, "От 900 минут"], [1350, "От 1350 минут"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); });
    sel.addEventListener("change", () => { r.value = sel.value; r.dispatchEvent(new Event("input", { bubbles: true })); });
    const mv = document.getElementById("minv");
    if (mv) new MutationObserver(() => { const v = String(parseInt(mv.textContent) || 0); if ([...sel.options].some((o) => o.value === v)) sel.value = v; }).observe(mv, { childList: true, characterData: true, subtree: true });
    lb.after(sel); lb.style.display = "none";
  }
  function datebar() {
    const bar = document.querySelector(".datebar"); if (!bar || bar.dataset.z) return;
    const on = bar.querySelector(".date.on"); if (!on) return; bar.dataset.z = 1;
    const ds = $$(".date", bar), i = ds.indexOf(on);
    const prev = ds[i - 1]?.getAttribute("href") || "#/", next = ds[i + 1]?.getAttribute("href") || "#/";
    const iso = on.getAttribute("href").split("d=")[1] || "";
    const first = on.firstChild.textContent.trim(), b = on.querySelector("b").textContent.trim();
    const word = /^(Сегодня|Вчера|Завтра)$/.test(first) ? first : first.charAt(0).toUpperCase() + first.slice(1);
    bar.innerHTML = `<a class="arrow" href="${prev}" aria-label="Предыдущий день">${ICON.chevL}</a><label class="dpick"><span>${word}, ${b}</span><input type="date" value="${iso}"></label>${first !== "Сегодня" ? `<a class="today" href="#/">Сегодня</a>` : ""}<a class="arrow" href="${next}" aria-label="Следующий день">${ICON.chevR}</a>`;
    bar.querySelector("input").addEventListener("change", (e) => { if (e.target.value) location.hash = "#/?d=" + e.target.value; });
  }
  function localnav() {
    const short = { "Личные встречи": "Встречи", "Удары и xG": "Удары", "xG-аналитика": "xG" };
    $$(".localnav .tabs a").forEach((a) => { const t = a.textContent.trim(); if (short[t]) a.textContent = short[t]; });
  }
  const PRI = ["О", "Очки", "Рейтинг", "+/-", "Г", "А", "xG", "xPTS", "И", "Голы", "xGA", "Мин"];
  function tables() {
    $$(".tbl").forEach((t) => {
      if (t.dataset.z) return; t.dataset.z = 1;
      const ths = $$("thead th", t); if (ths.length <= 6) return;
      const txt = ths.map((h) => h.textContent.replace(/[↓↑]/g, "").trim());
      const keep = new Set([0, 1]);
      ths.forEach((h, i) => { if (h.classList.contains("sorted")) keep.add(i); });
      for (const p of PRI) { if (keep.size >= 5) break; const i = txt.indexOf(p); if (i >= 0) keep.add(i); }
      const rows = $$("tbody tr", t);
      ths.forEach((h, i) => { if (!keep.has(i)) [h, ...rows.map((r) => r.children[i])].forEach((c) => c && c.classList.add("zh")); });
      const card = t.closest(".card");
      if (card && !card.querySelector(".tbl-more") && !card.querySelector("a.more")) {
        const b = document.createElement("button"); b.type = "button"; b.className = "tbl-more"; b.textContent = "Подробно";
        b.addEventListener("click", () => { if (card.dataset.full) { delete card.dataset.full; b.textContent = "Подробно"; } else { card.dataset.full = "1"; b.textContent = "Свернуть"; } });
        card.appendChild(b);
      }
    });
  }
  let q = 0;
  const run = () => { q = 0; $$(".seg").forEach(seg); minutes(); datebar(); localnav(); tables(); $$("select.pill").forEach((s) => s.classList.add("zsel")); };
  const app = document.getElementById("app");
  if (app) { new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(app, { childList: true, subtree: true }); run(); }
})();

/* ===== v6: keep the active section tab in view ===== */
(function () {
  const app = document.getElementById("app"); if (!app) return;
  let q = 0;
  const run = () => { q = 0; const t = app.querySelector(".localnav .tabs"), a = t && t.querySelector("a.on"); if (a && !t.dataset.sc) { t.dataset.sc = 1; t.scrollLeft = a.offsetLeft - (t.clientWidth - a.offsetWidth) / 2; } };
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(app, { childList: true, subtree: true });
  run();
})();
