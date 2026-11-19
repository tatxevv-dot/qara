/* Zone — match streams (table match_streams). Admins add/delete from the bottom of a match page. Loaded after app.js/auth.js. */
(function () {
  "use strict";
  let isAdmin = false, uid = null, lastKey = "", lastStatus = "", lastHl = false;
  const matchId = () => { const m = location.hash.match(/^#\/match\/([^/?]+)/); return m ? decodeURIComponent(m[1]) : null; };
  const kindOf = (u, k) => k && k !== "auto" ? k : /\.m3u8(\?|$)/i.test(u) ? "hls" : /\.(mp4|webm|mov)(\?|$)/i.test(u) ? "mp4" : "iframe";
  const killPlayers = () => { try { cur?.destroy(); } catch (e) {} cur = null; };

  async function checkAdmin() {
    try { const { data: s } = await sbAuth.auth.getSession(); uid = s?.session?.user?.id || null; isAdmin = false;
      if (uid) { const { data } = await sbAuth.rpc("is_admin"); isAdmin = data === true; } } catch (e) { isAdmin = false; }
  }

  let cur = null;
  const mountPlayer = (box, s) => { cur = window.ZonePlayer.mount(box, s); };

  async function render(force) {
    const id = matchId(), wrap = $("#app .wrap");
    if (!id || !wrap || !$("#mcontent")) { if (!id) { killPlayers(); lastKey = ""; } return; }
    const key = id + "|" + isAdmin;
    if (!force && $("#mstream-top, #mstreams") && lastKey === key) return;
    killPlayers(); $("#mstream-top")?.remove(); $("#mstreams")?.remove(); lastKey = key;
    let rows = [];
    try { rows = await run(sb.from("match_streams").select("*").eq("match_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true })); } catch (e) { console.warn("[streams]", e.message); }
    if (matchId() !== id || !$("#app .wrap")) return;
    const w = $("#app .wrap"), nav = $(".localnav", w);

    let mt = null;
    try { [mt] = await run(sb.from("matches").select("utc_date,status,raw,home:teams!matches_home_team_id_fkey(name),away:teams!matches_away_team_id_fkey(name)").eq("id", id)); } catch (e) {}
    if (matchId() !== id || !$("#app .wrap")) return;
    lastStatus = mt?.status || ""; lastHl = false;

    /* ---- player: at the top, under the match header ---- */
    if (mt?.status === "FINISHED") {
      /* ---- finished: highlights take the place of the stream ---- */
      const h = mt.raw?.highlight, ok = !!(h && /^[\w-]{11}$/.test(h.id)); lastHl = ok;
      const top = document.createElement("div"); top.id = "mstream-top"; top.className = "card stream-card"; top.style.marginTop = "16px";
      if (ok) top.innerHTML = `<div class="card-h">Обзор матча</div><div class="st-item"><div class="st-box"><iframe src="https://www.youtube-nocookie.com/embed/${h.id}?rel=0" title="${esc(h.title || "Обзор матча")}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></div>`;
      else {
        const q = encodeURIComponent(`${mt.home?.name || ""} ${mt.away?.name || ""} highlights ${(mt.utc_date || "").slice(0, 10)}`);
        top.innerHTML = `<div class="card-h">Обзор матча</div><div class="st-item"><div class="st-box"><div class="st-err"><div>Обзор появится после публикации<br><a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Искать на YouTube ↗</a></div></div></div></div>`;
      }
      if (nav) nav.before(top); else w.appendChild(top);
    }
    else if (rows.length) {
      const top = document.createElement("div"); top.id = "mstream-top"; top.className = "card stream-card"; top.style.marginTop = "16px";
      top.innerHTML = `<div class="card-h">Трансляция<span class="live-dot" style="margin-left:8px"></span>${rows.length > 1 ? `<span class="st-srcs">${rows.map((s, i) => `<button type="button" data-i="${i}" class="${i ? "" : "on"}">${esc(s.title || "Поток " + (i + 1))}</button>`).join("")}</span>` : ""}</div><div class="st-item"><div class="st-box"></div></div>`;
      if (nav) nav.before(top); else w.appendChild(top);
      const box = $(".st-box", top), play = (i) => { killPlayers(); mountPlayer(box, rows[i]); };
      play(0);
      $$(".st-srcs button", top).forEach((b) => b.onclick = () => { $$(".st-srcs button", top).forEach((x) => x.classList.toggle("on", x === b)); play(+b.dataset.i); });
    }
    else {
      /* ---- upcoming match, no stream yet: placeholder ---- */
      const start = mt ? new Date(mt.utc_date) : null;
      if (mt && start && mt.status === "SCHEDULED" && start.getTime() > Date.now()) {
        const top = document.createElement("div"); top.id = "mstream-top"; top.className = "card stream-card";
        top.innerHTML = `<div class="card-h">Трансляция</div><div class="st-item"><div class="st-box"><button type="button" class="st-ph" aria-label="Трансляция"><span class="st-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span><span class="st-ph-msg" role="status" aria-live="polite"></span></button></div></div>`;
        if (nav) nav.before(top); else w.appendChild(top);
        const btn = $(".st-ph", top), out = $(".st-ph-msg", top);
        btn.onclick = () => {
          const left = start.getTime() - Date.now(), hhmm = start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          out.textContent = left <= 600000 ? "Трансляция скоро появится" : "Трансляция появится за 10 минут до начала матча · начало в " + hhmm;
          btn.classList.add("shown");
        };
      }
    }
    if (!isAdmin) return;

    /* ---- admin panel: at the bottom ---- */
    const sec = document.createElement("div"); sec.id = "mstreams"; sec.style.marginTop = "16px";
    sec.innerHTML = `<div class="card"><div class="card-h">Трансляции (админ)</div>
      ${rows.length ? rows.map((s, i) => `<div class="st-item"><div class="st-head"><b>${esc(s.title || "Трансляция " + (i + 1))}</b><small>${[s.language, s.quality, s.commentator].filter(Boolean).map(esc).join(" · ")}</small><button type="button" class="adm-btn del" data-del="${s.id}">Убрать</button></div><small style="opacity:.6;word-break:break-all">${esc(s.url)}</small></div>`).join("") : `<div class="st-item"><small style="opacity:.6">Трансляций пока нет</small></div>`}
      <div class="adm-bar"><button type="button" class="adm-btn" id="admOpen">Добавить трансляцию</button></div>
      <form id="admForm" class="adm-form" hidden novalidate>
        <div class="full"><label>Ссылка на трансляцию *</label><input name="url" placeholder="https://… (.m3u8 / .mp4 / страница плеера)" autocomplete="off" autocapitalize="off"></div>
        <div class="full"><label>Название</label><input name="title" placeholder="Например: Основной поток"></div>
        <div><label>Тип</label><select name="kind"><option value="auto">Авто</option><option value="hls">HLS (.m3u8)</option><option value="mp4">Видео (mp4)</option><option value="iframe">Встраиваемая страница</option></select></div>
        <div><label>Язык</label><input name="language" placeholder="RU"></div>
        <div><label>Качество</label><input name="quality" placeholder="1080p"></div>
        <div><label>Комментатор</label><input name="commentator"></div>
        <div class="full"><div class="adm-msg" id="admMsg" style="padding:0"></div><button type="submit" class="adm-btn">Добавить трансляцию</button> <button type="button" class="adm-btn ghost" id="admCancel">Отмена</button></div>
      </form></div>${mt?.status === "FINISHED" ? `<div class="card" style="margin-top:16px"><div class="card-h">Обзор матча (админ)</div>
        <div class="st-item"><small style="opacity:.6;word-break:break-all">${mt.raw?.highlight?.id ? "Сейчас: https://youtu.be/" + esc(mt.raw.highlight.id) : "Обзор не добавлен"}</small></div>
        <form id="hlForm" class="adm-form" novalidate>
          <div class="full"><label>Ссылка на YouTube</label><input name="url" placeholder="https://www.youtube.com/watch?v=… или https://youtu.be/…" autocomplete="off" autocapitalize="off"></div>
          <div class="full"><div class="adm-msg" id="hlMsg" style="padding:0"></div><button type="submit" class="adm-btn">Сохранить обзор</button>${mt.raw?.highlight?.id ? ` <button type="button" class="adm-btn del" id="hlDel">Убрать обзор</button>` : ""}</div>
        </form></div>` : ""}`;
    w.appendChild(sec);
    const form = $("#admForm", sec), msg = $("#admMsg", sec), say = (t, ok) => { msg.textContent = t; msg.classList.toggle("ok", !!ok); };
    $("#admOpen", sec).onclick = () => { form.hidden = !form.hidden; if (!form.hidden) form.url.focus(); };
    $("#admCancel", sec).onclick = () => { form.hidden = true; say(""); };
    sec.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]"); if (!b || !confirm("Убрать эту трансляцию?")) return;
      b.disabled = true; const { error } = await sbAuth.from("match_streams").delete().eq("id", b.dataset.del);
      if (error) { b.disabled = false; return toast("Ошибка: " + error.message); } toast("Трансляция убрана"); render(true);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); const f = form, url = f.url.value.trim();
      if (!/^https?:\/\/\S+$/i.test(url)) return say("Вставьте ссылку, начинающуюся с http(s)://");
      const row = { match_id: id, url, kind: f.kind.value };
      for (const k of ["title", "language", "quality", "commentator"]) { const v = f[k].value.trim(); if (v) row[k] = v; }
      row.sort_order = rows.length; const btn = $("button[type=submit]", f); btn.disabled = true; say("");
      const { error } = await sbAuth.from("match_streams").insert(row); btn.disabled = false;
      if (error) return say(/row-level|permission/i.test(error.message) ? "Нет прав: аккаунт не админ" : error.message);
      toast("Трансляция добавлена"); render(true);
    });

    /* ---- highlight (finished matches): saved via RPC, readable by everyone from matches.raw.highlight ---- */
    const hlForm = $("#hlForm", sec);
    if (hlForm) {
      const hmsg = $("#hlMsg", sec), hsay = (t) => { hmsg.textContent = t; };
      const ytId = (u) => { u = u.trim(); if (/^[\w-]{11}$/.test(u)) return u;
        try { const x = new URL(u), h = x.hostname.replace(/^(www|m)\./, "");
          if (h === "youtu.be") return x.pathname.slice(1).split("/")[0] || null;
          if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) return x.searchParams.get("v") || (x.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/) || [])[1] || null;
        } catch (e) {} return null; };
      const save = async (vid) => {
        const { error } = await sbAuth.rpc("set_match_highlight", { p_match: id, p_video: vid, p_title: vid ? "Обзор матча" : null });
        if (error) return hsay(/not admin|permission/i.test(error.message) ? "Нет прав: аккаунт не админ" : error.message);
        toast(vid ? "Обзор сохранён" : "Обзор убран"); render(true);
      };
      hlForm.addEventListener("submit", (e) => { e.preventDefault(); const vid = ytId(hlForm.url.value); if (!vid) return hsay("Не похоже на ссылку YouTube"); hsay(""); save(vid); });
      $("#hlDel", sec)?.addEventListener("click", () => { if (confirm("Убрать обзор?")) save(null); });
    }
  }

  /* match finished while the page is open, or highlight appeared later -> swap the player */
  setInterval(async () => {
    const id = matchId(); if (!id || !lastStatus || document.hidden || (lastStatus === "FINISHED" && lastHl)) return;
    try {
      const [m] = await run(sb.from("matches").select("status,raw").eq("id", id));
      if (m && matchId() === id && ((m.status === "FINISHED" && lastStatus !== "FINISHED") || (m.status === "FINISHED" && m.raw?.highlight?.id))) render(true);
    } catch (e) {}
  }, 60000);

  let t = 0; const kick = (force) => { clearTimeout(t); t = setTimeout(() => render(force), 60); };
  new MutationObserver(() => kick(false)).observe($("#app"), { childList: true });
  addEventListener("hashchange", () => kick(false));
  sbAuth.auth.onAuthStateChange(() => { setTimeout(async () => { const was = isAdmin + "|" + uid; await checkAdmin(); if (was !== isAdmin + "|" + uid) kick(true); }, 0); });
  checkAdmin().then(() => kick(true));
})();
