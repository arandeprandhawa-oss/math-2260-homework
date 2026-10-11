/* Practice-page engine. A page hands it a list of questions and it builds the
   whole page: header, question strip, answer checking, solutions, progress.

   Each question is an object:
     {
       title: "Short name",
       ref:   "Devore §3.3, Exercise 29, p. 116",
       orig:  { ...the numbers from the assignment or textbook... },
       gen()  { return { ...fresh random numbers in the same shape as orig... }; },
       build(p, c) {            // p = the numbers, c = helpers that make answer boxes
         return { html: "...question text with ${c.num(answer, 3)} boxes...",
                  sol:  "...worked solution..." };
       }
     }

   Answer boxes (each returns HTML to drop into the question text):
     c.num(answer, dp)            number, correct when it matches to dp decimal places
     c.num(answer, {rel: 0.005})  number, correct within 0.5% (for very small answers)
     c.sel(options, index)        drop-down, index of the right option
     c.radio(options, index, mix) pick one; mix = true shuffles the options
     c.multi(options, [indexes])  select all that apply
     c.set(["HH","HT"])           a typed list of outcomes, any order

   Maths: write \( ... \) inline and $$ ... $$ on its own line. In a template
   string use String.raw (available here as P.R) so backslashes survive.         */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var P = root.Practice = {};

  /* ---------- helpers for question writers ---------- */
  P.R = String.raw;
  P.ri = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  P.pick = function (a) { return a[P.ri(0, a.length - 1)]; };
  P.shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = P.ri(0, i), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  P.sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  /* fx(0.12345, 3) -> "0.123"   (round to dp places, always showing dp places) */
  P.fx = function (x, dp) { var m = Math.pow(10, dp); return (Math.round(x * m + (x >= 0 ? 1e-9 : -1e-9)) / m).toFixed(dp); };
  /* tr(0.30000000004) -> "0.3"   (trim floating-point noise and trailing zeros) */
  P.tr = function (x) { return String(+(+x).toFixed(8)); };
  P.gcd = function (a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; };
  /* frac(6, 36) -> "\tfrac{1}{6}"  (a reduced fraction in TeX) */
  P.frac = function (n, d) { if (n === 0) return "0"; var g = P.gcd(n, d); return d / g === 1 ? String(n / g) : "\\tfrac{" + n / g + "}{" + d / g + "}"; };
  /* split `total` hundredths (or any integer total) among weights, each at least `min` */
  P.scaleInt = function (w, total, min) {
    var s = P.sum(w), v = w.map(function (x) { return Math.max(min, Math.round(x / s * total)); });
    v[v.indexOf(Math.max.apply(null, v))] += total - P.sum(v);
    return v;
  };
  P.part = function (label, html) { return '<div class="part"><b>(' + label + ")</b><div>" + html + "</div></div>"; };
  P.table = function (head, rows, cls) {
    return '<div class="tw"><table' + (cls ? ' class="' + cls + '"' : "") + ">" +
      (head ? "<tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr>" : "") +
      rows.map(function (r) { return "<tr>" + r.map(function (v, i) { return (i === 0 ? "<th>" : "<td>") + v + (i === 0 ? "</th>" : "</td>"); }).join("") + "</tr>"; }).join("") +
      "</table></div>";
  };

  /* ---------- answer boxes ---------- */
  P.ctx = function (qid) {
    var parts = [];
    function id() { return qid + "-" + parts.length; }
    return {
      parts: parts,
      num: function (ans, o) {
        if (typeof o === "number") o = { dp: o };
        o = o || {};
        var p = { t: "num", ans: ans };
        if (o.rel != null) p.rel = o.rel;
        else p.tol = o.tol != null ? o.tol : (o.dp == null ? 5e-4 : 0.5 * Math.pow(10, -o.dp));
        var i = id(); parts.push(p);
        return '<span class="f"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" id="' + i + '" aria-label="' + (o.label || "Answer") + '">' +
          (o.unit ? '<span class="unit">' + o.unit + "</span>" : "") + '<i class="mk"></i></span>';
      },
      sel: function (opts, ans) {
        var i = id(); parts.push({ t: "sel", ans: ans });
        return '<span class="f"><select id="' + i + '" aria-label="Choose"><option value="">choose…</option>' +
          opts.map(function (o, k) { return '<option value="' + k + '">' + o + "</option>"; }).join("") + '</select><i class="mk"></i></span>';
      },
      radio: function (opts, ans, mix) {
        var i = id(), order = opts.map(function (_, k) { return k; });
        if (mix) order = P.shuffle(order);
        parts.push({ t: "radio", ans: ans });
        return '<div class="opts" id="' + i + '" role="radiogroup">' + order.map(function (k) {
          return '<label><input type="radio" name="' + i + '" value="' + k + '" id="' + i + "-o" + k + '"><span>' + opts[k] + "</span></label>";
        }).join("") + '<span class="mk"></span></div>';
      },
      multi: function (opts, ans) {
        var i = id(), order = P.shuffle(opts.map(function (_, k) { return k; }));
        parts.push({ t: "multi", ans: ans });
        return '<div class="opts" id="' + i + '">' + order.map(function (k) {
          return '<label><input type="checkbox" value="' + k + '" id="' + i + "-o" + k + '"><span>' + opts[k] + "</span></label>";
        }).join("") + '<span class="mk"></span></div>';
      },
      set: function (target) {
        var i = id(); parts.push({ t: "set", ans: target.map(function (x) { return String(x).toUpperCase(); }) });
        return '<span class="f wide"><input type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" id="' + i + '" aria-label="List the outcomes"><i class="mk"></i></span>';
      }
    };
  };

  /* "0.25", ".25", "1/4", "25%" and "1,250" are all accepted */
  P.parse = function (s) {
    s = String(s).trim().replace(/\s+/g, "").replace(/\$/g, "");
    if (!s) return null;
    var pct = false;
    if (s.slice(-1) === "%") { pct = true; s = s.slice(0, -1); }
    s = s.replace(/,(?=\d{3}(\D|$))/g, "");
    var v, f = s.match(/^([-+]?\d*\.?\d+)\/(\d*\.?\d+)$/);
    if (f) v = parseFloat(f[1]) / parseFloat(f[2]);
    else if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) v = parseFloat(s);
    else return NaN;
    return pct ? v / 100 : v;
  };
  P.isRight = function (p, v) {
    if (v === null || isNaN(v)) return false;
    return p.rel != null ? Math.abs(v - p.ans) <= p.rel * Math.abs(p.ans) + 1e-12 : Math.abs(v - p.ans) <= p.tol + 1e-9;
  };

  /* ---------- the page ---------- */
  P.page = function (cfg) {
    P.config = cfg;
    if (typeof document === "undefined") return;
    var QS = cfg.questions, key = "m2260:" + cfg.key, origLabel = cfg.originalLabel || "Original numbers";
    var solved = {};
    try { solved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { solved = {}; }
    function save() { try { localStorage.setItem(key, JSON.stringify(solved)); } catch (e) {} }

    var wrap = document.createElement("div");
    wrap.className = "pr-wrap";
    wrap.innerHTML =
      '<header class="pr-top">' + (cfg.where ? '<p class="pr-where">' + cfg.where + "</p>" : "") +
      "<h1>" + cfg.title + "</h1>" + (cfg.intro ? '<p class="pr-intro">' + cfg.intro + "</p>" : "") +
      '<div class="pr-topbar"><button class="primary" id="pr-allnew" type="button">New numbers for all ' + QS.length + "</button>" +
      '<button id="pr-allorig" type="button">Back to ' + origLabel.toLowerCase() + '</button><span class="pr-tally" id="pr-tally"></span></div></header>' +
      '<nav class="pr-strip" id="pr-strip" aria-label="Questions"></nav><main class="pr-main" id="pr-main"></main>' +
      '<p class="pr-foot">Decimals, fractions such as 7/10 and percents such as 28% are all accepted. An answer is marked correct when it matches to the rounding the question asks for.</p>';
    var here = document.currentScript;
    if (here && here.parentNode === document.body) document.body.insertBefore(wrap, here); else document.body.appendChild(wrap);

    var main = wrap.querySelector("#pr-main"), strip = wrap.querySelector("#pr-strip"), tally = wrap.querySelector("#pr-tally");
    var S = QS.map(function () { return {}; });
    function $(id) { return document.getElementById(id); }
    function typeset(el) {
      if (window.MathJax && MathJax.typesetPromise) { if (MathJax.typesetClear) MathJax.typesetClear([el]); MathJax.typesetPromise([el]).catch(function () {}); }
    }
    function showTally() {
      var n = 0, done = 0;
      QS.forEach(function (q, i) { var k = solved["q" + (i + 1)] || 0; n += k; if (k) done++; });
      tally.textContent = n ? n + " version" + (n === 1 ? "" : "s") + " solved on this device" : "";
      if (window.Site) Site.report({ done: done, total: QS.length });
    }
    function count(i) { var n = solved["q" + (i + 1)] || 0; $("pr-cnt" + i).textContent = n ? "solved ×" + n : ""; }
    function render(i, params, fresh) {
      var q = QS[i], st = S[i], c = P.ctx("q" + (i + 1)), out = q.build(params, c);
      st.parts = c.parts; st.sol = out.sol; st.credited = false; st.params = params;
      $("pr-body" + i).innerHTML = out.html;
      var sol = $("pr-sol" + i); sol.hidden = true; sol.innerHTML = "";
      $("pr-solbtn" + i).textContent = "Show solution";
      var status = $("pr-status" + i); status.textContent = ""; status.dataset.s = "";
      var tag = $("pr-vtag" + i); tag.textContent = fresh ? "New numbers" : origLabel; tag.dataset.new = fresh ? "1" : "";
      strip.children[i].dataset.s = "";
      typeset($("pr-body" + i));
    }
    function check(i) {
      var st = S[i], ok = 0, blank = 0;
      st.parts.forEach(function (p, k) {
        var e = $("q" + (i + 1) + "-" + k), r, w;
        if (p.t === "num") { var v = P.parse(e.value); r = v === null ? null : P.isRight(p, v); w = e.parentElement; }
        else if (p.t === "sel") { r = e.value === "" ? null : +e.value === p.ans; w = e.parentElement; }
        else if (p.t === "radio") { var ch = e.querySelector("input:checked"); r = ch ? +ch.value === p.ans : null; w = e; }
        else if (p.t === "multi") {
          var got = [].slice.call(e.querySelectorAll("input:checked")).map(function (x) { return +x.value; }).sort(function (a, b) { return a - b; });
          r = got.length ? got.join() === p.ans.slice().sort(function (a, b) { return a - b; }).join() : null; w = e;
        } else {
          var raw = e.value.trim(); w = e.parentElement;
          if (!raw) r = p.ans.length ? null : true;
          else {
            var toks = (raw.toUpperCase().match(/[A-Z0-9.\-]+/g) || []).filter(function (t) { return t !== "NONE" && t !== "EMPTY"; }), seen = {};
            toks.forEach(function (t) { seen[t] = 1; });
            r = Object.keys(seen).length === p.ans.length && p.ans.every(function (t) { return seen[t]; });
          }
        }
        w.dataset.r = r === null ? "" : (r ? "ok" : "no");
        if (r) ok++; if (r === null) blank++;
      });
      var n = st.parts.length, all = ok === n, status = $("pr-status" + i);
      status.textContent = all ? "All correct. Try new numbers." : ok + " of " + n + " correct" + (blank ? ", " + blank + " blank" : "");
      status.dataset.s = all ? "ok" : "part"; strip.children[i].dataset.s = all ? "ok" : "part";
      if (all && !st.credited) { st.credited = true; var kk = "q" + (i + 1); solved[kk] = (solved[kk] || 0) + 1; save(); count(i); showTally(); }
      return all;
    }
    function toggleSol(i) {
      var sol = $("pr-sol" + i), btn = $("pr-solbtn" + i);
      if (sol.hidden) { sol.innerHTML = "<h3>Worked solution</h3>" + S[i].sol; sol.hidden = false; btn.textContent = "Hide solution"; typeset(sol); }
      else { sol.hidden = true; btn.textContent = "Show solution"; }
    }
    QS.forEach(function (q, i) {
      var a = document.createElement("a");
      a.href = "#q" + (i + 1); a.textContent = i + 1; a.setAttribute("aria-label", "Question " + (i + 1) + ": " + q.title);
      strip.appendChild(a);
      var s = document.createElement("section");
      s.className = "pr-q"; s.id = "q" + (i + 1);
      s.innerHTML = '<div class="pr-qhead"><span class="pr-qnum">' + (i + 1) + '</span><h2 class="pr-qtitle">' + q.title + '</h2><span class="pr-vtag" id="pr-vtag' + i + '"></span>' +
        '<span class="pr-qref">' + (q.ref || "") + ' <span id="pr-cnt' + i + '"></span></span></div>' +
        '<div class="pr-body" id="pr-body' + i + '"></div>' +
        '<div class="pr-actions"><button class="primary" type="button" id="pr-chk' + i + '">Check answers</button><button type="button" id="pr-new' + i + '">New numbers</button>' +
        '<button type="button" id="pr-solbtn' + i + '">Show solution</button><button class="quiet" type="button" id="pr-orig' + i + '">' + origLabel + "</button>" +
        '<span class="pr-status" id="pr-status' + i + '" role="status"></span></div><div class="pr-sol" id="pr-sol' + i + '" hidden></div>';
      main.appendChild(s);
      $("pr-chk" + i).onclick = function () { check(i); };
      $("pr-new" + i).onclick = function () { render(i, q.gen(), true); };
      $("pr-orig" + i).onclick = function () { render(i, q.orig, false); };
      $("pr-solbtn" + i).onclick = function () { toggleSol(i); };
      s.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches("input[type=text]")) check(i); });
      s.addEventListener("input", function (e) { var w = e.target.closest(".f,.opts"); if (w) w.dataset.r = ""; });
      render(i, q.orig, false); count(i);
    });
    $("pr-allnew").onclick = function () { QS.forEach(function (q, i) { render(i, q.gen(), true); }); };
    $("pr-allorig").onclick = function () { QS.forEach(function (q, i) { render(i, q.orig, false); }); };
    showTally();
    P._check = check; P._state = S; P._render = render;

    /* load MathJax from the site's own copy (works offline) */
    if (!window.MathJax || !window.MathJax.typesetPromise) {
      window.MathJax = { tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["$$", "$$"]] }, svg: { fontCache: "global" }, options: { enableMenu: false } };
      /* tex-svg.js sits in the same folder as this file */
      var sc = document.querySelector('script[src*="practice.js"]');
      var mj = document.createElement("script");
      mj.src = (sc ? sc.src.replace(/practice\.js.*$/, "") : "") + "tex-svg.js"; mj.async = true;
      document.head.appendChild(mj);
    }
  };

  if (typeof module !== "undefined") module.exports = P;
})();
