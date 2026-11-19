/* qara — шестерёнка в шапке: вход и смена темы в одной панели.
   Грузится после app.js и auth.js. Кнопки «аккаунт» и «тема» прячутся из шапки,
   но продолжают работать: панель вызывает их программно. */
(function () {
  "use strict";
  const icons = document.querySelector(".gnav-icons");
  if (!icons || document.getElementById("setBtn")) return;

  const css = `
#accBtn,#themeBtn{display:none!important}
#setBtn{position:relative}
#setBtn.in::after{content:"";position:absolute;top:8px;right:8px;width:9px;height:9px;border-radius:50%;background:var(--win);box-shadow:0 0 0 2px var(--bg-elev)}
#setBtn svg{transition:transform .5s var(--ease)}
#setBtn.open svg{transform:rotate(60deg)}
.st-scrim{position:fixed;inset:var(--nav-h) 0 0 0;z-index:98;background:rgba(0,0,0,.3);opacity:0;visibility:hidden;transition:opacity .25s,visibility .25s}
.st-scrim.open{opacity:1;visibility:visible}
.st-panel{position:fixed;left:0;right:0;top:var(--nav-h);z-index:99;background:var(--bg-elev);border-radius:0 0 20px 20px;box-shadow:var(--shadow-lg);opacity:0;visibility:hidden;transform:translateY(-10px);transition:opacity .25s var(--ease),transform .3s var(--ease),visibility .25s;padding:6px 0 10px;max-height:calc(100dvh - var(--nav-h))}
.st-panel.open{opacity:1;visibility:visible;transform:none}
@media(min-width:641px){.st-panel{left:auto;right:16px;width:380px;border-radius:0 0 20px 20px}}
.st-row{display:flex;align-items:center;gap:14px;width:100%;min-height:68px;padding:0 22px;background:none;border:0;border-bottom:1px solid var(--line-2);color:var(--text);font:inherit;font-size:18px;text-align:left;cursor:pointer}
.st-row:last-child{border-bottom:0}
.st-row .sub{color:var(--text-2);font-size:15px;margin-left:6px}
.st-row .ic{flex:none;width:24px;height:24px;color:var(--text)}
.st-row .ava{flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-weight:700;font-size:15px}
.st-row .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st-row .chev{flex:none;width:18px;height:18px;color:var(--text-3)}
.st-theme{cursor:default}
.st-seg{display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--fill-2)}
.st-seg button{width:40px;height:34px;display:grid;place-items:center;border:0;border-radius:999px;background:none;color:var(--text-3);cursor:pointer;transition:background .2s,color .2s}
.st-seg button svg{width:19px;height:19px}
.st-seg button.on{background:var(--bg-elev);color:var(--text);box-shadow:var(--shadow-xs)}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const S = (p, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra || ""}>${p}</svg>`;
  const I = {
    gear: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
    user: S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', ' class="ic"'),
    sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: S('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'),
    auto: S('<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8 20h8M12 16v4"/>'),
    chev: S('<path d="M9 6l6 6-6 6"/>', ' class="chev"'),
    pal: S('<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 010 18" fill="currentColor" stroke="none"/>', ' class="ic"'),
  };

  /* ---------- элементы ---------- */
  const gear = document.createElement("button");
  gear.id = "setBtn"; gear.type = "button"; gear.className = "icon-btn"; gear.setAttribute("aria-label", "Настройки"); gear.title = "Настройки"; gear.innerHTML = I.gear;
  const search = document.getElementById("searchBtn");
  search ? search.after(gear) : icons.prepend(gear);

  const scrim = document.createElement("div"); scrim.className = "st-scrim";
  const panel = document.createElement("div"); panel.className = "st-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Настройки");
  document.body.append(scrim, panel);

  const NAMES = { auto: "Авто", light: "Светлая", dark: "Тёмная" };
  let email = null;

  function draw() {
    const cur = store.get("theme", "auto"), acc = document.getElementById("accBtn");
    const logged = !!(acc && acc.classList.contains("in"));
    const accRow = logged
      ? `<button class="st-row" data-a="acc" type="button"><span class="ava">${esc((email || "?")[0].toUpperCase())}</span><span class="grow">${esc(email || "Аккаунт")}</span>${I.chev}</button>`
      : `<button class="st-row" data-a="acc" type="button">${I.user}<span class="grow">Войти</span>${I.chev}</button>`;
    const seg = ["auto", "light", "dark"].map((k) => `<button type="button" data-t="${k}" class="${k === cur ? "on" : ""}" aria-label="${NAMES[k]}" title="${NAMES[k]}">${I[k === "light" ? "sun" : k === "dark" ? "moon" : "auto"]}</button>`).join("");
    panel.innerHTML = accRow + `<div class="st-row st-theme">${I.pal}<span class="grow">Тема<span class="sub">(${NAMES[cur]})</span></span><div class="st-seg">${seg}</div></div>`;
  }

  async function loadEmail() {
    try { const { data } = await sbAuth.auth.getSession(); email = data?.session?.user?.email || null; } catch (e) { email = null; }
    if (panel.classList.contains("open")) draw();
  }

  function open() {
    if (typeof closeFly === "function") closeFly();
    draw(); loadEmail();
    panel.classList.add("open"); scrim.classList.add("open"); gear.classList.add("open");
  }
  function close() { panel.classList.remove("open"); scrim.classList.remove("open"); gear.classList.remove("open"); }

  gear.addEventListener("click", () => (panel.classList.contains("open") ? close() : open()));
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  window.addEventListener("hashchange", close);
  if (search) search.addEventListener("click", close);

  panel.addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.a === "acc") {
      close();
      setTimeout(() => document.getElementById("accBtn")?.click(), 120);
    } else if (t.dataset.t) {
      const h = document.documentElement;
      h.classList.add("theme-anim"); setTimeout(() => h.classList.remove("theme-anim"), 500);
      store.set("theme", t.dataset.t); applyTheme(); draw();
    }
  });

  /* зелёная точка на шестерёнке, когда вы вошли */
  const acc = document.getElementById("accBtn");
  if (acc) {
    const sync = () => { gear.classList.toggle("in", acc.classList.contains("in")); if (acc.classList.contains("in")) loadEmail(); else { email = null; if (panel.classList.contains("open")) draw(); } };
    new MutationObserver(sync).observe(acc, { attributes: true, attributeFilter: ["class"] });
    sync();
  }
})();
