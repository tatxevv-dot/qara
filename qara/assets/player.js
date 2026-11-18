/* Zone — собственный плеер трансляций. window.ZonePlayer.mount(box, {url, kind}) -> {destroy}.
   Системный (нативный) плеер устройства включается ТОЛЬКО в полноэкранном режиме. */
(function () {
  const S = (d) => `<svg viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
  const IC = {
    play: S('<path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z"/>'),
    pause: S('<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>'),
    vol: S('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    mute: S('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    gear: S('<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    fs: S('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  };

  function setupUI(box, v, getHls) {
    v.controls = false;
    v.removeAttribute("controls");
    box.classList.add("zp");
    const ui = document.createElement("div");
    ui.className = "zp-ui";
    ui.innerHTML = `
      <button class="zp-big" aria-label="Пуск">${IC.play}</button>
      <div class="zp-spin"></div>
      <div class="zp-bar">
        <div class="zp-prog"><i></i></div>
        <div class="zp-row">
          <button class="zp-b zp-pp" aria-label="Пуск/пауза">${IC.pause}</button>
          <button class="zp-live" aria-label="К прямому эфиру"><span></span>LIVE</button>
          <span class="zp-time"></span>
          <span class="zp-sp"></span>
          <button class="zp-b zp-mute" aria-label="Звук">${IC.mute}</button>
          <button class="zp-b zp-q" aria-label="Качество">${IC.gear}<em>Авто</em></button>
          <button class="zp-b zp-fs" aria-label="На весь экран">${IC.fs}</button>
        </div>
      </div>
      <div class="zp-menu" hidden></div>`;
    box.appendChild(ui);
    const $ = (s) => ui.querySelector(s);
    const pp = $(".zp-pp"), big = $(".zp-big"), mute = $(".zp-mute"), qb = $(".zp-q"), menu = $(".zp-menu"), live = $(".zp-live"), prog = $(".zp-prog i"), time = $(".zp-time");

    let hideT;
    const show = () => { box.classList.add("show"); clearTimeout(hideT); if (!v.paused && menu.hidden) hideT = setTimeout(() => box.classList.remove("show"), 3000); };
    const sync = () => {
      const p = v.paused;
      pp.innerHTML = p ? IC.play : IC.pause;
      box.classList.toggle("paused", p);
      mute.innerHTML = v.muted || v.volume === 0 ? IC.mute : IC.vol;
      if (p) { box.classList.add("show"); clearTimeout(hideT); } else show();
    };
    ["play", "pause", "volumechange"].forEach((e) => v.addEventListener(e, sync));
    v.addEventListener("waiting", () => box.classList.add("buf"));
    ["playing", "canplay"].forEach((e) => v.addEventListener(e, () => box.classList.remove("buf")));

    const toggle = () => { v.paused ? v.play().catch(() => {}) : v.pause(); };
    pp.onclick = big.onclick = (e) => { e.stopPropagation(); toggle(); };
    mute.onclick = (e) => { e.stopPropagation(); v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 1; };
    box.addEventListener("click", (e) => {
      if (e.target.closest(".zp-bar,.zp-menu,.zp-big")) return;
      if (!menu.hidden) { menu.hidden = true; return; }
      box.classList.contains("show") && !v.paused ? box.classList.remove("show") : show();
    });
    box.addEventListener("mousemove", show);

    /* LIVE / progress */
    const isLive = () => !isFinite(v.duration) || getHls()?.levels?.[getHls().currentLevel < 0 ? 0 : getHls().currentLevel]?.details?.live;
    const tick = () => {
      const h = getHls();
      const lv = isLive();
      live.style.display = lv ? "" : "none";
      if (lv) {
        const edge = h?.liveSyncPosition ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) : v.currentTime);
        const behind = edge - v.currentTime > 8;
        live.classList.toggle("off", behind);
        time.textContent = behind ? "−" + Math.round(edge - v.currentTime) + " с" : "";
        prog.style.width = "100%";
      } else {
        const f = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
        time.textContent = `${f(v.currentTime)} / ${f(v.duration || 0)}`;
        prog.style.width = (v.duration ? (v.currentTime / v.duration) * 100 : 0) + "%";
      }
    };
    v.addEventListener("timeupdate", tick);
    live.onclick = (e) => {
      e.stopPropagation();
      const h = getHls();
      const edge = h?.liveSyncPosition ?? (v.seekable.length ? v.seekable.end(v.seekable.length - 1) : null);
      if (edge != null) v.currentTime = edge;
      v.play().catch(() => {});
    };
    $(".zp-prog").onclick = (e) => {
      e.stopPropagation();
      if (!isFinite(v.duration)) return;
      const r = e.currentTarget.getBoundingClientRect();
      v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
    };

    /* Quality */
    let curQ = -1;
    const buildMenu = () => {
      const h = getHls();
      const lv = h?.levels || [];
      if (!lv.length) { qb.style.display = "none"; return; }
      qb.style.display = "";
      const items = [{ i: -1, t: "Авто" }].concat(
        lv.map((l, i) => ({ i, t: l.height ? l.height + "p" : Math.round(l.bitrate / 1000) + " kbps", h: l.height || 0 }))
          .sort((a, b) => b.h - a.h)
      );
      menu.innerHTML = `<div class="zp-mh">Качество</div>` + items.map((o) => `<button data-i="${o.i}" class="${o.i === curQ ? "on" : ""}"><span>${o.t}</span><b>✓</b></button>`).join("");
      qb.querySelector("em").textContent = curQ < 0 ? "Авто" : items.find((x) => x.i === curQ)?.t || "Авто";
    };
    qb.onclick = (e) => { e.stopPropagation(); buildMenu(); menu.hidden = !menu.hidden; show(); };
    menu.onclick = (e) => {
      e.stopPropagation();
      const b = e.target.closest("button[data-i]"); if (!b) return;
      curQ = +b.dataset.i;
      const h = getHls(); if (h) h.currentLevel = curQ;
      menu.hidden = true; buildMenu(); show();
    };
    // called after each playSource
    ui.rebind = () => {
      curQ = -1;
      const h = getHls();
      qb.style.display = "none";
      if (h && window.Hls) {
        h.on(Hls.Events.MANIFEST_PARSED, buildMenu);
        h.on(Hls.Events.LEVEL_SWITCHED, (_, d) => { if (curQ < 0) { const l = h.levels[d.level]; qb.querySelector("em").textContent = l?.height ? "Авто · " + l.height + "p" : "Авто"; } });
        if (h.levels?.length) buildMenu();
      }
    };

    /* Fullscreen: native player only here */
    const fsBtn = $(".zp-fs");
    const inFs = () => document.fullscreenElement === v || document.webkitFullscreenElement === v || v.webkitDisplayingFullscreen;
    fsBtn.onclick = (e) => {
      e.stopPropagation();
      v.controls = true;
      if (v.webkitEnterFullscreen && !v.requestFullscreen) { try { v.webkitEnterFullscreen(); } catch (x) {} }
      else (v.requestFullscreen || v.webkitRequestFullscreen).call(v);
    };
    const exit = () => { if (!inFs()) { v.controls = false; v.removeAttribute("controls"); sync(); } };
    document.addEventListener("fullscreenchange", exit);
    document.addEventListener("webkitfullscreenchange", exit);
    v.addEventListener("webkitendfullscreen", exit);

    sync(); tick();
    return ui;
  }

  const HLS_SRC = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
  let hlsLoading = null;
  const loadHls = () => window.Hls ? Promise.resolve() : (hlsLoading ||= new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = HLS_SRC; s.onload = ok; s.onerror = () => { hlsLoading = null; no(); }; document.head.appendChild(s);
  }));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kindOf = (u, k) => k && k !== "auto" ? k : /\.m3u8(\?|$)/i.test(u) ? "hls" : /\.(mp4|webm|mov)(\?|$)/i.test(u) ? "mp4" : "iframe";

  function mount(box, s) {
    const url = s.url, k = kindOf(url, s.kind);
    box.innerHTML = "";
    if (k === "iframe") { // чужая страница плеера: свой интерфейс невозможен, полноэкран отдаём самому iframe
      box.innerHTML = `<iframe src="${esc(url)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
      return { destroy() { box.innerHTML = ""; } };
    }
    box.innerHTML = `<video playsinline autoplay muted preload="auto"></video>`;
    const v = box.firstChild;
    let hls = null, dead = false;
    const ui = setupUI(box, v, () => hls);
    const fail = (t) => {
      if (dead) return;
      box.classList.remove("buf");
      let e = box.querySelector(".st-err");
      if (!e) { e = document.createElement("div"); e.className = "st-err"; box.appendChild(e); }
      e.textContent = t;
    };
    (async () => {
      if (k === "mp4") { v.src = url; v.addEventListener("error", () => fail("Видео недоступно")); return; }
      try { await loadHls(); } catch (e) {}
      if (dead) return;
      if (window.Hls && Hls.isSupported()) {
        hls = new Hls({ lowLatencyMode: true });
        hls.loadSource(url); hls.attachMedia(v); ui.rebind();
        let retries = 0;
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && retries++ < 3) hls.startLoad();
          else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && retries++ < 3) hls.recoverMediaError();
          else fail("Трансляция недоступна");
        });
      } else if (v.canPlayType("application/vnd.apple.mpegurl")) { // iPhone / Safari: нативный HLS
        v.src = url; v.addEventListener("error", () => fail("Трансляция недоступна"));
      } else fail("Формат не поддерживается");
    })();
    return { destroy() { dead = true; try { hls?.destroy(); } catch (e) {} v.pause(); v.removeAttribute("src"); v.load(); box.innerHTML = ""; } };
  }

  window.ZonePlayer = { mount };
})();
