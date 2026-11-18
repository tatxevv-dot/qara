/* Zone — account: email + password (Supabase Auth). Favorites sync to table user_prefs. Loaded after app.js. */
(function () {
  "use strict";
  const KEYS = { favTeams: "fav_teams", favLeagues: "fav_leagues", favMatches: "fav_matches" };
  const USER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
  let user = null, timer = 0, pulledFor = null, mode = "in", msg = "", busy = false;

  /* ---- header button ---- */
  const icons = document.querySelector(".gnav-icons");
  const btn = document.createElement("button");
  btn.className = "icon-btn"; btn.id = "accBtn"; btn.type = "button"; btn.setAttribute("aria-label", "Аккаунт"); btn.innerHTML = USER_SVG;
  if (icons) icons.insertBefore(btn, document.getElementById("themeBtn") || null);

  /* ---- sheet ---- */
  const scrim = document.createElement("div");
  scrim.className = "auth-scrim"; scrim.id = "authScrim";
  scrim.innerHTML = '<div class="auth-sheet" role="dialog" aria-modal="true" aria-label="Аккаунт"></div>';
  document.body.appendChild(scrim);
  const sheet = scrim.firstChild;
  const open = () => { scrim.classList.add("open"); draw(); setTimeout(() => { const i = sheet.querySelector("input"); if (i) i.focus(); }, 80); };
  const close = () => { scrim.classList.remove("open"); msg = ""; };
  btn.addEventListener("click", () => (scrim.classList.contains("open") ? close() : open()));
  scrim.addEventListener("click", (e) => { if (e.target === scrim) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  const esc2 = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ruErr = (e) => {
    const m = String(e?.message || e || "");
    if (/invalid login/i.test(m)) return "Неверная почта или пароль";
    if (/already registered|already been registered/i.test(m)) return "Эта почта уже зарегистрирована";
    if (/password.*(least|short)|weak/i.test(m)) return "Пароль минимум 6 символов";
    if (/valid email|invalid.*email/i.test(m)) return "Неверная почта";
    if (/not confirmed/i.test(m)) return "Подтвердите почту по письму";
    if (/rate|too many/i.test(m)) return "Слишком много попыток, подождите";
    return m || "Ошибка";
  };

  const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>';
  const top = (back) => `<div class="auth-top">${back ? `<button type="button" class="auth-back" data-m="${back}">${BACK_SVG}Назад</button>` : "<span></span>"}<button type="button" class="auth-x" data-a="close" aria-label="Закрыть">${X_SVG}</button></div>`;
  const field = (name, ph, type, ac) => `<input type="${type}" name="${name}" placeholder="${ph}" autocomplete="${ac}" autocapitalize="off" spellcheck="false">`;
  const form = (inner, label) => `<form id="authForm" novalidate>${inner}<div class="auth-msg" id="authMsg">${esc2(msg)}</div><button type="submit" class="auth-btn" disabled>${label}</button></form>`;

  function draw() {
    if (mode === "new" && user) {
      sheet.innerHTML = top() + `<h2 class="auth-h">Новый пароль</h2>` + form(field("password", "Пароль", "password", "new-password"), "Сохранить");
    } else if (user) {
      sheet.innerHTML = top() + `<div class="auth-user"><div class="auth-ava">${esc2((user.email || "?")[0].toUpperCase())}</div><div class="auth-mail">${esc2(user.email)}</div></div><button type="button" class="auth-btn ghost" data-a="out">Выйти</button>`;
    } else if (mode === "reset") {
      sheet.innerHTML = top("in") + `<h2 class="auth-h">Сброс пароля</h2>` + form(field("email", "Почта", "email", "email"), "Отправить");
    } else {
      const inn = mode === "in";
      sheet.innerHTML = top() + `<h2 class="auth-h">${inn ? "Вход" : "Регистрация"}</h2>` + form(field("email", "Почта", "email", "email") + field("password", "Пароль", "password", inn ? "current-password" : "new-password") + (inn ? "" : field("password2", "Повторите пароль", "password", "new-password")), inn ? "Войти" : "Создать аккаунт")
        + (inn ? `<button type="button" class="auth-link" data-m="reset">Забыли пароль?</button>` : "")
        + `<div class="auth-or"><span>или</span></div><div class="auth-sw">${inn ? `Нет аккаунта? <button type="button" data-m="up">Регистрация</button>` : `Есть аккаунт? <button type="button" data-m="in">Войти</button>`}</div>`;
    }
  }
  sheet.addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.m) { mode = t.dataset.m; msg = ""; draw(); const i = sheet.querySelector("input"); if (i) i.focus(); }
    else if (t.dataset.a === "close") close();
    else if (t.dataset.a === "out") { await sbAuth.auth.signOut(); close(); }
  });
  sheet.addEventListener("input", (e) => {
    const f = e.target.closest("form"); if (!f) return;
    const ok = [...f.querySelectorAll("input")].every((i) => i.value.trim());
    f.querySelector(".auth-btn").disabled = !ok;
  });
  sheet.addEventListener("submit", async (e) => {
    e.preventDefault(); if (busy) return;
    const f = e.target, email = f.email ? f.email.value.trim() : "", password = f.password ? f.password.value : "";
    const say = (t, ok) => { msg = t; const m = $("#authMsg"); if (m) { m.textContent = t; m.classList.toggle("ok", !!ok); } };
    if (f.password && password.length < 6) return say("Пароль минимум 6 символов");
    if (mode === "up" && f.password2 && f.password2.value !== password) return say("Пароли не совпадают");
    if (mode !== "reset" && email && !/^\S+@\S+\.\S+$/.test(email)) return say("Неверная почта");
    busy = true; say("");
    const sub = f.querySelector(".auth-btn"); sub.disabled = true;
    try {
      if (mode === "in") {
        const { error } = await sbAuth.auth.signInWithPassword({ email, password });
        if (error) throw error;
        close(); if (typeof toast === "function") toast("Вы вошли");
      } else if (mode === "up") {
        const { data, error } = await sbAuth.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) throw new Error("already registered");
        let ses = data.session;
        if (!ses) { const r = await sbAuth.auth.signInWithPassword({ email, password }); ses = r.data && r.data.session; }
        if (ses) { close(); if (typeof toast === "function") toast("Аккаунт создан, вы вошли"); } else say("Письмо отправлено — подтвердите почту и войдите", true);
      } else if (mode === "reset") {
        const { error } = await sbAuth.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        say("Письмо отправлено", true);
      } else if (mode === "new") {
        const { error } = await sbAuth.auth.updateUser({ password });
        if (error) throw error;
        mode = "in"; close(); if (typeof toast === "function") toast("Пароль обновлён");
      }
    } catch (err) { say(ruErr(err)); }
    busy = false; if (sub.isConnected && !(mode === "reset" && msg === "Письмо отправлено")) sub.disabled = false;
  });

  /* ---- favorites <-> user_prefs ---- */
  const idOf = (x) => (x && typeof x === "object" ? x.id : x);
  const union = (a, b) => { const seen = new Set(), out = []; for (const x of [...(a || []), ...(b || [])]) { const i = idOf(x); if (!seen.has(i)) { seen.add(i); out.push(x); } } return out; };
  const origSet = store.set.bind(store);

  async function push() {
    if (!user) return;
    const row = { user_id: user.id, updated_at: new Date().toISOString() };
    for (const [k, c] of Object.entries(KEYS)) row[c] = store.get(k, []);
    const { error } = await sbAuth.from("user_prefs").upsert(row);
    if (error) console.warn("[zone-auth] save", error.message);
  }
  async function pull(remoteWins) {
    if (!user) return;
    const { data, error } = await sbAuth.from("user_prefs").select("*").eq("user_id", user.id).maybeSingle();
    if (error) { console.warn("[zone-auth] load", error.message); return; }
    let changed = false;
    for (const [k, c] of Object.entries(KEYS)) {
      const local = store.get(k, []);
      const next = data ? (remoteWins ? data[c] || [] : union(data[c], local)) : local;
      if (JSON.stringify(next) !== JSON.stringify(local)) { origSet(k, next); changed = true; }
    }
    if (!data || !remoteWins) await push();
    if (changed && typeof route === "function") route();
  }
  store.set = (k, v) => {
    origSet(k, v);
    if (user && KEYS[k]) { clearTimeout(timer); timer = setTimeout(push, 500); }
  };

  /* ---- session ---- */
  sbAuth.auth.onAuthStateChange((ev, session) => {
    user = session?.user || null;
    btn.classList.toggle("in", !!user);
    if (ev === "PASSWORD_RECOVERY") { mode = "new"; open(); }
    if (scrim.classList.contains("open")) draw();
    if (!user) { pulledFor = null; return; }
    if (pulledFor === user.id) return;
    const first = ev === "INITIAL_SESSION";
    pulledFor = user.id;
    setTimeout(() => pull(first), 0);
  });
})();
