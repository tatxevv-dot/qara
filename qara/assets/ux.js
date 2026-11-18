/* Zone — UX layer.
   Additive on top of app.js: it never touches app.js internals, it only observes the DOM.
   - turns the generic .sk-row placeholders into skeletons shaped like the real content
   - shows a full-page skeleton while match / team / player pages fetch
   - staggered entrance + count-up for NEW nodes only (live refreshes never replay)
   - sliding segmented-control thumb, top loader bar, mobile tab bar, header shadow
   Every feature is guarded: if something fails, the app keeps working. */
(function () {
  "use strict";
  var appEl = document.getElementById("app");
  if (!appEl) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var safe = function (fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { if (window.console) console.warn("[zone-ux]", e); } }; };

  /* ---------------------------------------------------------------
     1. Skeleton templates
     --------------------------------------------------------------- */
  var W = [62, 48, 72, 55, 66, 44, 58, 70];
  var rep = function (n, f) { var s = ""; for (var i = 0; i < n; i++) s += f(i); return s; };
  var bar = function (w, h, extra) { return '<i class="skl ' + (extra || "") + '" style="width:' + w + "%;height:" + (h || 12) + 'px"></i>'; };
  var circ = function (c) { return '<i class="skl circle ' + (c || "") + '"></i>'; };

  var T = {};
  T.mrows = function (n, o) {
    o = o || 0;
    return rep(n, function (i) {
      return '<div class="skl-mrow"><div class="skl-tm h">' + bar(W[(i + o) % 8]) + circ() + '</div><i class="skl pill-sk"></i><div class="skl-tm">' + circ() + bar(W[(i + o + 3) % 8]) + '</div><i class="skl circle sm"></i></div>';
    });
  };
  T.feed = function () {
    return '<div class="skl-wrap">' + rep(2, function (g) {
      return '<div class="skl-group"><div class="skl-head">' + circ("sm") + bar(34, 11) + "</div>" + T.mrows(g ? 3 : 4, g * 2) + "</div>";
    }) + "</div>";
  };
  T.leads = function (n) {
    return '<div class="skl-wrap">' + rep(n || 4, function (i) {
      return '<div class="skl-lead">' + circ("md") + '<div class="col">' + bar(W[i % 8], 12) + bar(34, 10) + "</div>" + bar(10, 20, "pill") + "</div>";
    }) + "</div>";
  };
  T.trows = function (n, cols) {
    cols = cols || 4;
    var cells = function (k) { return rep(k, function () { return bar(100, 10); }); };
    return '<div class="skl-wrap"><div class="skl-tr skl-th" style="--c:' + cols + '">' + bar(100, 9) + "<span></span>" + bar(30, 9) + cells(cols) + "</div>" +
      rep(n || 8, function (i) {
        return '<div class="skl-tr" style="--c:' + cols + '">' + bar(100, 10) + circ("sm") + bar(W[i % 8], 12) + cells(cols) + "</div>";
      }) + "</div>";
  };
  T.pct = function (n) {
    return '<div class="card-b skl-wrap">' + rep(n || 6, function (i) {
      return '<div class="skl-pct">' + bar(Math.min(100, W[i % 8] + 20), 11) + bar(100, 8) + bar(100, 11) + "</div>";
    }) + "</div>";
  };
  T.card = function (body) { return '<div class="card"><div class="skl-card-h">' + bar(28, 14) + "</div>" + body + "</div>"; };
  T.cardsGrid = function (n, rows) {
    return '<div class="leaders-grid">' + rep(n, function () { return T.card(T.leads(rows)); }) + "</div>";
  };
  T.charts = function () {
    return '<div class="grid2">' + rep(2, function () { return T.card('<div class="skl-chart skl"></div>'); }) + '</div><div class="section-gap"></div>' + T.card('<div class="skl-chart skl tall"></div>');
  };
  T.cols2 = function () {
    return '<div class="cols two"><main>' + T.card(T.trows(8, 6)) + '<div class="section-gap"></div>' + T.cardsGrid(4, 3) + '</main><aside class="side">' + T.card(T.mrows(5)) + T.card(T.mrows(5, 2)) + "</aside></div>";
  };
  T.tiles = function (n) { return '<div class="skl-tiles">' + rep(n, function () { return '<i class="skl"></i>'; }) + "</div>"; };
  T.pageMatch = function () {
    return '<div class="wrap skl-page"><div class="card"><div class="skl-mh">' + bar(0, 12).replace("width:0%", "width:min(240px,70%)") +
      '<div class="skl-mh-grid"><div class="skl-team">' + circ("lg") + bar(60, 14) + '</div><i class="skl" style="width:112px;height:58px;border-radius:14px"></i><div class="skl-team">' + circ("lg") + bar(60, 14) + "</div></div></div></div>" +
      '<div class="skl-localnav" style="margin-top:16px">' + bar(0, 12).replace("width:0%", "width:120px") + '<i class="skl" style="margin-left:auto;width:min(320px,55%);height:30px;border-radius:980px"></i></div>' +
      '<div class="cols two"><main>' + T.card(T.mrows(6, 1)) + "</main><aside class=\"side\">" + T.card(T.leads(4)) + "</aside></div></div>";
  };
  T.pageHero = function (withNav) {
    return '<div class="wrap skl-page">' + (withNav ? '<div class="skl-localnav">' + circ("sm") + bar(0, 12).replace("width:0%", "width:140px") + '<i class="skl" style="margin-left:auto;width:min(300px,55%);height:30px;border-radius:980px"></i></div>' : "") +
      '<div class="card"><div class="skl-hero">' + circ("lg") + '<div class="col">' + bar(30, 11) + bar(55, 28) + bar(70, 12) + "</div></div>" + T.tiles(8) + "</div>" +
      '<div class="section-gap"></div><div class="grid2">' + T.card(T.pct(6)) + T.card(T.leads(5)) + "</div></div>";
  };

  var routeParts = function () {
    return location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  };

  function templateFor(parent, n) {
    var id = parent.id || "", p = routeParts(), page = p[0], tab = p[2] || "overview";
    switch (id) {
      case "feedBody": return T.feed();
      case "miniTable": return T.trows(6, 3);
      case "potw": case "xgLead": return T.leads(5);
      case "tbody": return T.trows(10, 7);
      case "pctCard": return T.pct(6);
      case "sbody": return T.cardsGrid(6, 5);
      case "lcontent":
      case "tcontent":
        if (tab === "overview") return T.cols2();
        if (tab === "matches") return T.card(T.mrows(9));
        if (tab === "xg") return T.charts();
        if (tab === "stats") return T.card(T.pct(9));
        if (page === "league" && (tab === "players" || tab === "teams")) return T.card(T.trows(10, 9));
        return T.card(T.trows(10, tab === "squad" ? 6 : 7));
    }
    return T.trows(Math.min(n || 6, 8), 4);
  }

  var swapSkeletons = safe(function (nodes) {
    var rows = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType !== 1) continue;
      if (n.classList.contains("sk-row")) rows.push(n);
      if (n.querySelectorAll) rows.push.apply(rows, n.querySelectorAll(".sk-row"));
    }
    if (!rows.length) return;
    var groups = [], seen = [];
    rows.forEach(function (r) {
      var p = r.parentElement;
      if (!p) return;
      var k = seen.indexOf(p);
      if (k < 0) { seen.push(p); groups.push([]); k = seen.length - 1; }
      if (groups[k].indexOf(r) < 0) groups[k].push(r);
    });
    groups.forEach(function (list, k) {
      var html = templateFor(seen[k], list.length);
      list[0].insertAdjacentHTML("beforebegin", html);
      list.forEach(function (r) { r.remove(); });
    });
  });

  /* ---------------------------------------------------------------
     2. Motion — only for NEW nodes, only right after a navigation,
        a click, or when a skeleton has just been replaced by content
     --------------------------------------------------------------- */
  var animUntil = 0;
  var markAnimate = function (ms) { animUntil = Math.max(animUntil, Date.now() + (ms || 1000)); };
  var enter = function (el) { if (el && el.nodeType === 1) el._enter = Date.now() + 1700; };
  var isLive = function (n) {
    if (Date.now() < animUntil) return true;
    if (window.__zn && Date.now() - window.__zn < 1100) return true;
    for (var p = n; p && p !== document; p = p.parentNode) if (p._enter && p._enter > Date.now()) return true;
    return false;
  };

  var STAGGER = ".card,.mrow,.lead,.tile,.statrow,.pct-row,.tl-row,.brow,.nav-list a,.date,.next-match,.tbl tbody tr";
  var PLAIN = ".pct-bar i,.bars i,.poss>div,.mh-score";
  var COUNT = ".tile .v,.mh-score,.h2h .n";

  var fx = safe(function (root) {
    var idx = [], per = [];
    var add = function (el) {
      if (el.classList.contains("fx")) return;
      var p = el.parentElement, k = per.indexOf(p);
      if (k < 0) { per.push(p); idx.push(0); k = per.length - 1; }
      el.style.setProperty("--i", Math.min(idx[k]++, 14));
      el.classList.add("fx");
    };
    var list = $$(STAGGER, root);
    if (root.matches && root.matches(STAGGER)) list.unshift(root);
    list.forEach(add);
    var plain = $$(PLAIN, root);
    if (root.matches && root.matches(PLAIN)) plain.unshift(root);
    plain.forEach(function (el) { el.classList.add("fx"); });
  });

  var countUp = safe(function (el) {
    if (reduce || el.children.length || el._cu) return;
    el._cu = 1;
    var txt = el.textContent, parts = txt.split(/(\d+(?:\.\d+)?)/);
    if (parts.length < 3) return;
    var nums = parts.map(function (p, i) { return i % 2 ? { v: parseFloat(p), d: (p.split(".")[1] || "").length } : null; });
    var t0 = performance.now(), dur = 900;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - t, 3);
      el.textContent = parts.map(function (p, i) { return nums[i] ? (nums[i].v * k).toFixed(nums[i].d) : p; }).join("");
      if (t < 1) requestAnimationFrame(step); else el.textContent = txt;
    })(t0);
  });

  /* ---------------------------------------------------------------
     3. Images fade in
     --------------------------------------------------------------- */
  var imgs = function (root) {
    var list = root.tagName === "IMG" ? [root] : $$("img", root);
    list.forEach(function (im) { if (im.complete) im.classList.add("ld"); });
  };
  var imgDone = function (e) { if (e.target && e.target.tagName === "IMG") e.target.classList.add("ld"); };
  document.addEventListener("load", imgDone, true);
  document.addEventListener("error", imgDone, true);

  /* ---------------------------------------------------------------
     4. Sliding thumb for segmented controls
     --------------------------------------------------------------- */
  var initSeg = safe(function (seg) {
    if (seg._thumb) return;
    var th = document.createElement("span");
    th.className = "seg-thumb";
    th.setAttribute("aria-hidden", "true");
    seg.insertBefore(th, seg.firstChild);
    seg._thumb = th;
    var place = function (instant) {
      var on = seg.querySelector("button.on");
      if (!on || !seg.offsetWidth) { th.style.opacity = "0"; return; }
      if (instant) th.style.transition = "none";
      th.style.opacity = "1";
      th.style.width = on.offsetWidth + "px";
      th.style.transform = "translateX(" + on.offsetLeft + "px)";
      if (instant) { void th.offsetWidth; th.style.transition = ""; }
    };
    seg._place = place;
    seg.classList.add("has-thumb");
    place(true);
    new MutationObserver(function () { place(false); }).observe(seg, { attributes: true, subtree: true, attributeFilter: ["class"] });
  });
  var replaceSegs = function () { $$(".seg").forEach(function (s) { if (s._place) s._place(true); }); };
  window.addEventListener("resize", replaceSegs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(replaceSegs);

  /* ---------------------------------------------------------------
     5. Process added nodes
     --------------------------------------------------------------- */
  var process = safe(function (n) {
    if (n.nodeType !== 1 || !n.isConnected) return;
    imgs(n);
    $$(".seg", n).concat(n.classList && n.classList.contains("seg") ? [n] : []).forEach(initSeg);
    if (isLive(n)) {
      fx(n);
      if (!reduce) {
        $$(COUNT, n).concat(n.matches && n.matches(COUNT) ? [n] : []).forEach(countUp);
      }
    }
  });

  var isSkeleton = function (n) {
    return n.nodeType === 1 && ((n.matches && n.matches(".skl-wrap,.skl-page,.skl")) || (n.querySelector && n.querySelector(".skl-wrap,.skl-page")));
  };

  var stamp = function () { appEl.dataset.hash = location.hash; };

  var mo = new MutationObserver(safe(function (recs) {
    var added = [];
    recs.forEach(function (r) {
      for (var i = 0; i < r.removedNodes.length; i++) {
        if (isSkeleton(r.removedNodes[i])) { enter(r.target); break; }
      }
      for (var j = 0; j < r.addedNodes.length; j++) added.push(r.addedNodes[j]);
    });
    if (added.length) {
      swapSkeletons(added);
      added.forEach(process);
    }
    stamp();
  }));
  mo.observe(appEl, { childList: true, subtree: true });

  /* ---------------------------------------------------------------
     6. Full-page skeleton for routes that fetch before they render
     --------------------------------------------------------------- */
  var showPageSkeleton = safe(function () {
    var p = routeParts(), html = null;
    if (p[0] === "match") html = T.pageMatch();
    else if (p[0] === "team") html = T.pageHero(true);
    else if (p[0] === "player") html = T.pageHero(false);
    if (html) appEl.innerHTML = html;
    stamp();
  });

  /* ---------------------------------------------------------------
     7. Top loader bar
     --------------------------------------------------------------- */
  var barEl = document.getElementById("loader");
  var loader = {
    t: 0,
    start: function () {
      if (!barEl) return;
      clearInterval(this.t);
      barEl.style.transform = "";
      barEl.classList.remove("done");
      void barEl.offsetWidth;
      barEl.classList.add("run");
      var t0 = Date.now(), self = this;
      this.t = setInterval(function () {
        if (!appEl.querySelector(".skl-wrap,.skl-page") || Date.now() - t0 > 15000) self.end();
      }, 180);
    },
    end: function () {
      clearInterval(this.t);
      if (!barEl || !barEl.classList.contains("run")) return;
      var cur = getComputedStyle(barEl).transform;
      barEl.style.transform = cur && cur !== "none" ? cur : "scaleX(.9)";
      barEl.classList.remove("run");
      void barEl.offsetWidth;
      barEl.classList.add("done");
      barEl.style.transform = "scaleX(1)";
    }
  };

  /* ---------------------------------------------------------------
     8. Tab bar, header shadow, theme transition, navigation hooks
     --------------------------------------------------------------- */
  var setActive = function () {
    var key = routeParts()[0] || "home";
    $$(".tabbar [data-r]").forEach(function (a) { a.classList.toggle("on", a.dataset.r === key); });
    var l = document.getElementById("tbLeagues");
    if (l) l.classList.toggle("on", ["leagues", "league", "team", "player", "match"].indexOf(key) > -1);
  };
  var tbL = document.getElementById("tbLeagues"), tbS = document.getElementById("tbSearch");
  if (tbS) tbS.addEventListener("click", function () { var b = $("#searchBtn"); if (b) b.click(); });

  var nav = $(".gnav");
  var onScroll = function () { if (nav) nav.classList.toggle("scrolled", window.scrollY > 4); };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.addEventListener("click", function (e) {
    markAnimate(900);
    if (e.target.closest && e.target.closest("#themeBtn")) {
      var h = document.documentElement;
      h.classList.add("theme-anim");
      setTimeout(function () { h.classList.remove("theme-anim"); }, 500);
    }
  }, true);

  window.addEventListener("hashchange", safe(function () {
    setActive();
    loader.start();
    if (appEl.dataset.hash !== location.hash) showPageSkeleton();
  }));

  /* ---------------------------------------------------------------
     9. Boot: handle whatever app.js already rendered
     --------------------------------------------------------------- */
  markAnimate(1300);
  setActive();
  swapSkeletons([appEl]);
  process(appEl);
  if (!appEl.firstElementChild) showPageSkeleton(); else stamp();
  if (appEl.querySelector(".skl-wrap,.skl-page")) loader.start();
})();
