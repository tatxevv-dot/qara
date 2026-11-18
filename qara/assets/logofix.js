/* Zone — logo contrast fix.
   Logos inside pill buttons / chips are checked against the colour actually behind them.
   Dark logo on dark bg -> turned white; light logo on light bg -> darkened. Re-checked on theme / state change. */
(function () {
  "use strict";
  var SEL = ".seg button img, .comp-head img, .nav-list a img, .sr-item img, .lg-link img";
  var FALLBACK_DARK = /\/(23|9)\.png/; // PL, Ligue 1 — if the pixel read is blocked by CORS
  var cache = {};

  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(r, g, b) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
  function ratio(a, b) { var hi = Math.max(a, b), lo = Math.min(a, b); return (hi + 0.05) / (lo + 0.05); }

  function logoLum(src) {
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var n = 32, c = document.createElement("canvas"); c.width = c.height = n;
          var x = c.getContext("2d"); x.drawImage(im, 0, 0, n, n);
          var d = x.getImageData(0, 0, n, n).data, sum = 0, w = 0;
          for (var i = 0; i < d.length; i += 4) { var a = d[i + 3] / 255; if (a < 0.2) continue; sum += lum(d[i], d[i + 1], d[i + 2]) * a; w += a; }
          res(w ? sum / w : null);
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = src;
    });
    return cache[src];
  }

  function bgLum(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) return lum(+m[0], +m[1], +m[2]);
    }
    return lum(255, 255, 255);
  }

  function fix(img) {
    if (!img.src || img.src.indexOf("data:") === 0) return;
    logoLum(img.src).then(function (l) {
      var b = bgLum(img);
      if (l === null) l = FALLBACK_DARK.test(img.src) ? 0.03 : 0.4;
      var f = "";
      if (ratio(l, b) < 2.2) f = b < 0.4 ? "brightness(0) invert(1)" : "brightness(0.25)";
      if (img.dataset.lf !== f) { img.dataset.lf = f; img.style.filter = f; img.classList.add("logo-fix"); }
    });
  }

  var queued = false;
  function run() { queued = false; [].forEach.call(document.querySelectorAll(SEL), fix); }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(run); } }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-theme"] });
  if (window.matchMedia) { var mq = matchMedia("(prefers-color-scheme: dark)"); (mq.addEventListener ? mq.addEventListener("change", schedule) : mq.addListener(schedule)); }
  document.addEventListener("load", function (e) { if (e.target && e.target.tagName === "IMG") schedule(); }, true);
  schedule();
})();
