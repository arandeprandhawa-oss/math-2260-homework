/* Shared helper for every page. A page loads it with these two lines in its <head>:

     <link rel="stylesheet" href="site.css">
     <script src="site.js"></script>

   It does three small things:
     1. remembers each page's progress so the home page can show it,
     2. when the site is running inside the tab bar, makes a link to another page
        switch to that page's tab (instead of loading it under the wrong tab),
     3. when a page is opened on its own, adds a small bar with a link back home. */
(function () {
  "use strict";
  var HOME = "00-home.html";                 // the home page's file name
  var FORMULAS = "01-formula-sheet.html";    // the formula sheet's file name
  var SITE_NAME = "MATH 2260 practice";
  var PROG_KEY = "m2260:progress", JUMP_KEY = "m2260:jump";

  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function leafOf(url) {
    var p = String(url).split("#")[0].split("?")[0].split("/").pop() || "";
    try { p = decodeURIComponent(p); } catch (e) {}
    return p;
  }

  var file = leafOf(location.pathname);
  var framed = false;
  try { framed = window.parent !== window && !!window.parent.location.href; } catch (e) { framed = false; }

  window.Site = {
    file: file,
    home: HOME,
    /* A practice page calls Site.report({done: 3, total: 10}) whenever its score changes. */
    report: function (p) {
      if (!p || !(p.total > 0) || !file) return;
      var all = read(PROG_KEY, {});
      all[file] = { done: Math.max(0, Math.min(p.done | 0, p.total | 0)), total: p.total | 0, t: Date.now() };
      write(PROG_KEY, all);
    },
    allProgress: function () { return read(PROG_KEY, {}); }
  };

  function ready(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }

  /* ----- 2. inside the tab bar: links to other pages switch tabs ----- */
  var slugs = null;   // file name -> the tab's address, read from the site.json the publishing script writes
  function toSlug(s) {
    var x = String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return x || "page";
  }
  if (framed && window.fetch) {
    fetch("../site.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.tabs || d.layout === "single") return;
      var used = {}, map = {};
      d.tabs.forEach(function (t) {
        var s = toSlug(t.label), base = s, n = 2;
        while (used[s]) { s = base + "-" + n; n++; }
        used[s] = true;
        map[leafOf(t.file).toLowerCase()] = s;
      });
      slugs = map;
    }).catch(function () {});
    document.addEventListener("click", function (e) {
      if (!slugs || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank") return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^[a-z]+:/i.test(href) || href.indexOf("/") >= 0) return;
      var leaf = leafOf(href), slug = slugs[leaf.toLowerCase()];
      if (!slug || leaf === file) return;
      e.preventDefault();
      var hash = href.indexOf("#") >= 0 ? href.slice(href.indexOf("#")) : "";
      try {
        if (hash) sessionStorage.setItem(JUMP_KEY, JSON.stringify({ file: leaf, hash: hash })); else sessionStorage.removeItem(JUMP_KEY);
      } catch (err) {}
      try { window.parent.location.hash = slug; } catch (err) { location.href = href; }
    });
  }
  /* after a tab switch, go to the question the link pointed at */
  var jump = null;
  try { jump = JSON.parse(sessionStorage.getItem(JUMP_KEY)); sessionStorage.removeItem(JUMP_KEY); } catch (e) {}
  if (jump && jump.file === file && jump.hash) {
    var go = function () { var el = document.getElementById(jump.hash.slice(1)); if (el) el.scrollIntoView(); };
    ready(go); window.addEventListener("load", function () { setTimeout(go, 150); });
  }

  /* ----- 3. opened on its own: a small bar back to the home page ----- */
  ready(function () {
    if (framed || file === HOME || document.querySelector(".sx-nav")) return;
    var nav = document.createElement("nav");
    nav.className = "sx-nav";
    nav.setAttribute("aria-label", "Site");
    nav.innerHTML = '<div class="sx-nav-in"><a class="sx-home"></a><a class="sx-link"></a></div>';
    var h = nav.querySelector(".sx-home"), f = nav.querySelector(".sx-link");
    h.href = HOME; h.textContent = SITE_NAME;
    if (file === FORMULAS) f.parentNode.removeChild(f); else { f.href = FORMULAS; f.textContent = "Formula sheet"; }
    document.body.insertBefore(nav, document.body.firstChild);
  });
})();
