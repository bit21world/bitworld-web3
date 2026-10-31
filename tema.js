(function () {
  /* Tema Hitam & Emas (menggantikan tema ungu/biru). Warna mengikuti logo koin BTW. */
  var css = `
html:root{--bg:#0f1a3a;--fg:#f2f5ff;--muted:#a9b8d9;--accent:#f5b82e;--accent2:#ffd966;--card:rgba(34,50,96,.74);--line:rgba(245,184,46,.22);--surface2:#22356b}
html body{background-color:#0f1a3a!important;background-image:radial-gradient(760px 560px at 50% 52%,rgba(245,184,46,.20),transparent 72%),radial-gradient(900px 460px at 50% -120px,rgba(110,168,255,.34),transparent 70%),linear-gradient(180deg,#1a2a55 0%,#0b1330 100%)!important;background-attachment:fixed!important;color:#f2f5ff!important}
html body main{background:transparent!important}
/* logo koin di belakang konten, warna asli */
html::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:url(/btw-koin-latar.png) no-repeat center 52%/min(86vw,400px) auto;opacity:.26}
html body header{background:#14224a!important;border-bottom:1px solid rgba(245,184,46,.28)!important;box-shadow:0 2px 14px rgba(0,0,0,.5)}
html body .brand{color:#f5d27a!important}
html body .accbtn{background:linear-gradient(180deg,#ffd75a,#f5b82e)!important;color:#3a2a00!important;box-shadow:0 4px 12px rgba(245,184,46,.35)!important;border:0!important}
html body .lang{border-color:rgba(245,184,46,.4)!important}
html body .lang button{color:#a9b8d9!important}
html body .lang button.on{background:#f5b82e!important;color:#1a1400!important}

html body nav.bottom{background:#14224a!important;border-bottom:1px solid rgba(245,184,46,.28)!important;box-shadow:0 6px 16px rgba(0,0,0,.5)!important}
html body nav.bottom button,html body #navDrawer button,html body #n-ambassador,html body #n-tim{background:#22356b!important;color:#f0d58a!important;border:1px solid rgba(245,184,46,.25)!important}
html body nav.bottom button.on,html body #navDrawer button.on,html body #n-ambassador.on,html body #n-tim.on{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;color:#1a1400!important;border-color:#f5b82e!important;box-shadow:0 6px 14px rgba(245,184,46,.35)!important}
html body nav.bottom button.locked{color:#7b8bb3!important}
html body #navDrawer{background:#16264f!important;border:1px solid rgba(245,184,46,.3)!important;box-shadow:0 18px 40px rgba(0,0,0,.7)!important}

html body .card,html body .panel,html body .contract,html body .lockcard{background:rgba(34,50,96,.74)!important;border:1px solid rgba(245,184,46,.22)!important;box-shadow:0 8px 24px rgba(0,0,0,.5)!important;border-radius:20px!important}
html body .lockcard{border-style:dashed!important;border-color:rgba(245,184,46,.5)!important;background:#1d2e5c!important}
html body .lockcard .t{color:#ffd966!important}
html body .panel h2{color:#f5d27a!important}
html body .fm h2{color:#ffd966!important}
html body .panel p,html body .list{color:#e4eaff!important}
html body .muted{color:#a9b8d9!important}
html body .card .label{color:#9aabd0!important}
html body .gold{color:#f5b82e!important}
html body .mono{background:#16264f!important;color:#ffd966!important;border:1px solid rgba(245,184,46,.22)!important}
html body td{color:#e4eaff!important;border-bottom-color:rgba(245,184,46,.15)!important}

html body h1{color:#ffffff!important}
html body .ch{color:transparent!important}
html body .tagline{color:#e9eeff!important;font-weight:600}
html body #v-home .tagline,html body #v-home .muted,html body #v-home h1{text-shadow:0 2px 10px rgba(0,0,0,.9),0 0 3px rgba(0,0,0,.8)}
html body #v-home .muted{color:#c3d0f0!important;font-weight:600}
html body .badge{background:rgba(245,184,46,.12)!important;border:1px solid rgba(245,184,46,.4)!important;color:#ffd966!important}

html body .btn{background:#22356b!important;border:1px solid rgba(245,184,46,.45)!important;color:#f5d27a!important}
html body .btn:hover{background:#2c437f!important;border-color:#f5b82e!important;color:#ffe9a8!important}
html body .btn.primary{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;border-color:#f5b82e!important;color:#1a1400!important;box-shadow:0 8px 18px rgba(245,184,46,.3)!important}
html body .btn.primary:hover{background:linear-gradient(180deg,#f5d36a,#e0a420)!important}
html body .btn:disabled{opacity:.5}

html body .wpmenu button{background:#22356b!important;border:1px solid rgba(245,184,46,.25)!important;color:#f0d58a!important}
html body .wpmenu button.on{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;border-color:#f5b82e!important;color:#1a1400!important}

html body .fm label{color:#e4eaff!important}
html body .fm input,html body input,html body select,html body textarea{background:#101c40!important;color:#ffffff!important;border:1px solid rgba(245,184,46,.35)!important}
html body .fm input:focus{outline:2px solid #f5b82e!important}
html body .fm .sub{color:#a9b8d9!important}
html body .tabs2 button{background:#22356b!important;color:#f0d58a!important}
html body .tabs2 button.on{background:#f5b82e!important;color:#1a1400!important}
html body .mst div{background:#1d2e5c!important;color:#a9b8d9!important}
html body .mst b{color:#ffffff!important}
html body .bal .n{color:#f5b82e!important}
html body .bal .u{color:#9aabd0!important}
html body .fmsg.err{background:#3a1414!important;color:#ffb4b4!important}
html body .fmsg.ok{background:#10301c!important;color:#9be8bb!important}
html body .pbadge{background:#10301c!important;color:#9be8bb!important}
html body .lnk a,html body .panel a:not(.btn){color:#ffd966!important}
html body .note{color:#9aabd0!important}

html body #tokenBody div[style*="0c1120"]{background:#1d2e5c!important;color:#a9b8d9!important}
html body #tokenBody b[style*="f5b82e"]{color:#f5b82e!important}
html body #toast{background:#f5b82e!important;color:#1a1400!important}

/* Menu Ambassador & Tim */
html body [style*="#e4efff"]{background:#1d2e5c!important;color:#a9b8d9!important;border-color:rgba(245,184,46,.4)!important}
html body [style*="#ecebff"]{background:rgba(245,184,46,.15)!important}
html body [style*="#5b52e8"]{color:#ffd966!important}
html body [style*="#6b5ff0,#3b96ff"]{background:linear-gradient(135deg,#fde68a,#f5b82e)!important;color:#1a1400!important;box-shadow:0 6px 16px rgba(245,184,46,.35)!important}
html body [style*="width:"][style*="background:#6b5ff0"]{background:linear-gradient(90deg,#f5b82e,#fde68a)!important}
html body [style*="border:2px solid #fff"]{border-color:#f5b82e!important;box-shadow:0 6px 16px rgba(245,184,46,.35)!important}
html body [style*="#6f7fa6"]{color:#a9b8d9!important}
/* ===== Percantik v3: navy + emas, lebih terang dan nyaman dilihat ===== */
html:root body{--gold:#f5b82e;--gold2:#ffd966;--glass:rgba(34,50,96,.74)}
html:root body header,html:root body nav.bottom{backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
html:root body header{box-shadow:0 1px 0 rgba(160,190,255,.2),0 10px 28px rgba(5,10,30,.45)!important}
html:root body nav.bottom{box-shadow:0 8px 22px rgba(5,10,30,.4)!important}
html:root body .brand span{background:linear-gradient(90deg,#fff,var(--gold2));-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800}
html:root body .brand img{box-shadow:0 0 0 2px rgba(245,184,46,.6),0 0 20px rgba(245,184,46,.4)}

/* Menu */
html:root body nav.bottom button{border:1px solid rgba(160,190,255,.2)!important;border-radius:12px!important;box-shadow:0 4px 0 #0b1330,0 8px 14px rgba(5,10,30,.35)!important;transition:transform .2s,color .2s,border-color .2s!important}
html:root body nav.bottom button.on{border-color:var(--gold)!important;box-shadow:0 4px 0 #a16207,0 10px 22px rgba(245,184,46,.38)!important}
@media (hover:hover){html:root body nav.bottom button:not(.on):hover{border-color:rgba(245,184,46,.6)!important;color:#fff0bf!important}}

/* Judul beranda: emas terang, solid, mudah dibaca */
html:root body #v-home h1,html:root body #v-home h1 .ch{text-shadow:none!important}
html:root body .ch{background:none!important;-webkit-text-fill-color:#ffe9a8!important;color:#ffe9a8!important;text-shadow:0 0 26px rgba(245,184,46,.55)!important;animation:drop .9s var(--spring) both!important;animation-delay:calc(var(--i) * 70ms + 100ms)!important}
html:root body .badge{display:inline-flex;align-items:center;gap:7px;box-shadow:0 0 24px rgba(245,184,46,.18)}
html:root body .badge::before{content:"";width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399}

/* Kartu & panel: kaca navy */
html:root body .card,html:root body .panel,html:root body .contract{position:relative;background:linear-gradient(165deg,rgba(255,255,255,.08),transparent 45%),var(--glass)!important;border:1px solid rgba(160,190,255,.22)!important;box-shadow:0 12px 30px rgba(5,10,30,.4),inset 0 1px 0 rgba(255,255,255,.1)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:transform .25s,box-shadow .25s,border-color .25s}
html:root body .card::after,html:root body .panel::after{content:"";position:absolute;left:20px;right:20px;top:-1px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.85;pointer-events:none}
html:root body .card:hover{transform:translateY(-3px)!important;border-color:rgba(245,184,46,.5)!important;box-shadow:0 16px 36px rgba(5,10,30,.5),0 0 26px rgba(245,184,46,.16)!important}
html:root body .stats .card .value.gold{color:var(--gold2)!important}
html:root body .panel h2::before{content:"";display:inline-block;width:4px;height:1em;border-radius:3px;margin-right:10px;vertical-align:-.15em;background:linear-gradient(var(--gold2),var(--gold))}
html:root body tr:last-child td{border-bottom:0!important}
html:root body td{border-bottom-color:rgba(160,190,255,.16)!important}

/* Tombol */
html:root body .btn{border:1px solid rgba(160,190,255,.3)!important;border-radius:12px!important;box-shadow:0 4px 0 #0b1330,0 9px 16px rgba(5,10,30,.35)!important;transition:transform .2s,box-shadow .2s,border-color .2s!important}
html:root body .btn.primary{border-color:transparent!important;box-shadow:0 5px 0 #a16207,0 12px 26px rgba(245,184,46,.38)!important}
@media (hover:hover){html:root body .btn:hover{transform:translateY(-2px)!important}}
html:root body .btn:focus-visible,html:root body nav.bottom button:focus-visible{outline:2px solid var(--gold2)!important;outline-offset:2px}

/* Form */
html:root body .fm input{border:1px solid rgba(160,190,255,.3)!important;border-radius:12px!important;transition:border-color .2s,box-shadow .2s}
html:root body .fm input:focus{outline:0!important;border-color:var(--gold)!important;box-shadow:0 0 0 3px rgba(245,184,46,.25)}
html:root body .tabs2{background:#101c40;padding:4px;border-radius:14px;border:1px solid rgba(160,190,255,.22)}
html:root body .tabs2 button{background:transparent!important;border-radius:10px}
html:root body .tabs2 button.on{background:linear-gradient(180deg,var(--gold2),var(--gold))!important;box-shadow:0 4px 14px rgba(245,184,46,.3)}

/* Mining */
html:root body .bal{padding:14px 0 10px}
html:root body .bal .n{color:var(--gold2)!important;text-shadow:0 0 28px rgba(245,184,46,.45);font-variant-numeric:tabular-nums}
html:root body .mst div{border:1px solid rgba(160,190,255,.2);border-radius:14px}
html:root body .mst b{color:var(--gold2)!important}

html:root body .wpmenu button.on{box-shadow:0 0 18px rgba(245,184,46,.3)}
html:root body #toast{border-radius:12px;box-shadow:0 12px 30px rgba(5,10,30,.5)}
html:root body .view{scrollbar-width:thin;scrollbar-color:rgba(245,184,46,.4) transparent}
@media (prefers-reduced-motion:reduce){html:root body .card:hover,html:root body .btn:hover{transform:none!important}}

`;

  /* Menimpa warna inline (gaya yang dibuat skrip lain, mis. Tugas, Profil, Pool) yang dibuat untuk tema terang */
  function rgb(h){ h = h.replace("#",""); if (h.length === 3) h = h.replace(/(.)/g,"$1$1"); return "rgb(" + parseInt(h.slice(0,2),16) + ", " + parseInt(h.slice(2,4),16) + ", " + parseInt(h.slice(4,6),16) + ")"; }
  function sel(prop, hex){ return '[style*="' + prop + ':' + hex + ';"],[style*="' + prop + ': ' + rgb(hex) + '"],[style*="' + prop + ':' + rgb(hex) + '"]'; }
  function rule(prop, hexes, decl){ return hexes.map(function(h){ return "html body " + sel(prop,h).split("],[").join("],html body [") ; }).join(",") + "{" + decl + "}\n"; }
  var X = "";
  X += rule("background", ["#fff"], "background:#22356b!important;");
  X += rule("background", ["#f4f5fb","#eef5ff","#f1f7ff","#e4efff","#ecebff","#f3f8ff","#f8f9ff","#fafbff"], "background:#1d2e5c!important;");
  X += rule("background", ["#e8e9f8","#eceefc"], "background:#2c3a66!important;color:#7b8bb3!important;");
  X += rule("background", ["#6b5ff0"], "background:linear-gradient(180deg,#fde68a,#f5b82e)!important;color:#1a1400!important;");
  X += rule("color", ["#12142e","#1b1d3a","#2c2f55","#3d4163"], "color:#f2f5ff!important;");
  X += rule("color", ["#8a8fb0","#6f7fa6","#7a7fa3"], "color:#a9b8d9!important;");
  X += rule("color", ["#5d628a","#5b5f86"], "color:#b9c6e6!important;");
  X += rule("color", ["#5b52e8","#4b44c8","#6b5ff0"], "color:#ffd966!important;");
  X += rule("color", ["#9a9fc0"], "color:#7b8bb3!important;");
  X += rule("color", ["#c0392b","#a12626"], "color:#ff8a7a!important;");
  X += rule("border", ["#eceefc"], "border-color:rgba(245,184,46,.18)!important;");
  X += rule("border-top", ["#eceefc"], "border-color:rgba(245,184,46,.18)!important;");
  X += rule("border", ["#d9dcf3"], "border-color:rgba(245,184,46,.35)!important;");
  X += "html body .view,html body #v-tugas{background:transparent!important;color:#f2f5ff!important}\n";
  css += X;

  var st = document.createElement("style");
  st.id = "tema-emas";
  st.textContent = css;
  document.head.appendChild(st);

  /* ===== Penyesuai otomatis: mengubah warna terang/ungu dari skrip lain (Mining, Tugas, Profil, dst.) menjadi hitam-emas ===== */
  (function () {
    var GOLD = "linear-gradient(180deg,#fde68a,#f5b82e)";
    function parse(c) {
      var m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null;
      var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function lum(c) { return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; }
    function lightCool(c) { return c && c.a > 0.5 && lum(c) > 0.8 && c.b >= c.g - 10; }
    function purple(c) { return c && c.a > 0.3 && c.b - c.g > 45 && c.b >= c.r + 25; }
    function put(el, k, v) { el.style.setProperty(k, v, "important"); }
    function skip(el) {
      var t = el.tagName;
      if (!t || t === "CANVAS" || t === "IMG" || t === "SCRIPT" || t === "STYLE" || t === "VIDEO" || t === "IFRAME") return true;
      if (el.closest && el.closest('canvas,[id*="captcha" i],[class*="captcha" i],[id*="qr" i],[class*="qr" i]')) return true;
      return !!(el.querySelector && el.querySelector("canvas"));
    }
    function fix(el) {
      if (el.nodeType !== 1 || skip(el)) return;
      var cs = getComputedStyle(el), gold = false;
      if (el instanceof SVGElement) {
        var sk = parse(cs.stroke), fl = parse(cs.fill);
        if (purple(sk)) put(el, "stroke", "#f5b82e");
        if (purple(fl)) put(el, "fill", "#f5b82e"); else if (lightCool(fl)) put(el, "fill", "#22356b");
        return;
      }
      var bg = parse(cs.backgroundColor), img = cs.backgroundImage;
      if (purple(bg)) { put(el, "background", GOLD); gold = true; if (lum(bg) > 0.58) put(el, "opacity", ".6"); }
      else if (lightCool(bg)) put(el, "background-color", "#22356b");
      if (!gold && img && img !== "none" && img.indexOf("gradient") > -1) {
        var cols = (img.match(/rgba?\([^)]+\)/g) || []).map(parse);
        if (cols.some(lightCool)) put(el, "background-image", "radial-gradient(circle at 50% 40%,#2a3f78,#1d2e5c)");
        else if (cols.some(purple)) { put(el, "background-image", GOLD); gold = true; }
      }
      var col = parse(cs.color);
      if (gold) put(el, "color", "#1a1400");
      else if (col && col.a > 0.5) {
        if (purple(col)) put(el, "color", "#ffd966");
        else if (lum(col) < 0.3 && col.b >= col.r) put(el, "color", "#f2f5ff");
        else if (lum(col) >= 0.3 && lum(col) < 0.7 && col.b >= col.r + 15) put(el, "color", "#a9b8d9");
      }
      var bw = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
      if (bw) {
        var bt = parse(cs.borderTopColor), bb = parse(cs.borderBottomColor);
        if (lightCool(bt) || purple(bt) || lightCool(bb) || purple(bb)) put(el, "border-color", "rgba(245,184,46,.3)");
      }
    }
    function all(root) {
      if (root.nodeType !== 1) return;
      fix(root);
      var k = root.querySelectorAll("*");
      for (var i = 0; i < k.length; i++) fix(k[i]);
    }
    var main = document.querySelector("main"), drawer = document.getElementById("navDrawer"), obs;
    if (!main || !window.MutationObserver) return;
    function scanAll() { obs.disconnect(); all(main); if (drawer) all(drawer); watch(); }
    function watch() { obs.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] }); }
    obs = new MutationObserver(function (list) {
      obs.disconnect();
      list.forEach(function (m) {
        if (m.type === "childList") { for (var i = 0; i < m.addedNodes.length; i++) all(m.addedNodes[i]); }
        else if (m.type === "attributes") { fix(m.target); }
      });
      watch();
    });
    scanAll();
    window.addEventListener("load", scanAll);
    [600, 1500, 3500].forEach(function (ms) { setTimeout(scanAll, ms); });
  })();

  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", "#14224a");
})();
