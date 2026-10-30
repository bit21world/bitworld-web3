(function () {
  /* Tema Hitam & Emas (menggantikan tema ungu/biru). Warna mengikuti logo koin BTW. */
  var css = `
html:root{--bg:#080604;--fg:#f4efe0;--muted:#b3a784;--accent:#f5b82e;--accent2:#ffd966;--card:rgba(26,20,8,.86);--line:rgba(245,184,46,.22);--surface2:#1c1608}
html body{background-color:#080604!important;background-image:radial-gradient(760px 560px at 50% 52%,rgba(214,160,40,.30),transparent 72%),radial-gradient(900px 420px at 50% -120px,rgba(245,184,46,.16),transparent 70%),linear-gradient(180deg,#15100a 0%,#050403 100%)!important;background-attachment:fixed!important;color:#f4efe0!important}
html body main{background:transparent!important}
/* logo koin di belakang konten, warna asli */
html::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:url(/btw-koin-latar.png) no-repeat center 52%/min(86vw,400px) auto;opacity:.34}
html body header{background:#0d0a05!important;border-bottom:1px solid rgba(245,184,46,.28)!important;box-shadow:0 2px 14px rgba(0,0,0,.5)}
html body .brand{color:#f5d27a!important}
html body .accbtn{background:linear-gradient(180deg,#ffd75a,#f5b82e)!important;color:#3a2a00!important;box-shadow:0 4px 12px rgba(245,184,46,.35)!important;border:0!important}
html body .lang{border-color:rgba(245,184,46,.4)!important}
html body .lang button{color:#b3a784!important}
html body .lang button.on{background:#f5b82e!important;color:#1a1400!important}

html body nav.bottom{background:#0d0a05!important;border-bottom:1px solid rgba(245,184,46,.28)!important;box-shadow:0 6px 16px rgba(0,0,0,.5)!important}
html body nav.bottom button,html body #navDrawer button,html body #n-ambassador,html body #n-tim{background:#1a1408!important;color:#f0d58a!important;border:1px solid rgba(245,184,46,.25)!important}
html body nav.bottom button.on,html body #navDrawer button.on,html body #n-ambassador.on,html body #n-tim.on{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;color:#1a1400!important;border-color:#f5b82e!important;box-shadow:0 6px 14px rgba(245,184,46,.35)!important}
html body nav.bottom button.locked{color:#7d7458!important}
html body #navDrawer{background:#120e06!important;border:1px solid rgba(245,184,46,.3)!important;box-shadow:0 18px 40px rgba(0,0,0,.7)!important}

html body .card,html body .panel,html body .contract,html body .lockcard{background:rgba(26,20,8,.86)!important;border:1px solid rgba(245,184,46,.22)!important;box-shadow:0 8px 24px rgba(0,0,0,.5)!important;border-radius:20px!important}
html body .lockcard{border-style:dashed!important;border-color:rgba(245,184,46,.5)!important;background:#17120a!important}
html body .lockcard .t{color:#ffd966!important}
html body .panel h2{color:#f5d27a!important}
html body .fm h2{color:#ffd966!important}
html body .panel p,html body .list{color:#e9e1c9!important}
html body .muted{color:#b3a784!important}
html body .card .label{color:#a39878!important}
html body .gold{color:#f5b82e!important}
html body .mono{background:#120e06!important;color:#ffd966!important;border:1px solid rgba(245,184,46,.22)!important}
html body td{color:#e9e1c9!important;border-bottom-color:rgba(245,184,46,.15)!important}

html body h1{color:#fff7dc!important}
html body .ch{color:transparent!important}
html body .tagline{color:#efe6c8!important;font-weight:600}
html body #v-home .tagline,html body #v-home .muted,html body #v-home h1{text-shadow:0 2px 10px rgba(0,0,0,.9),0 0 3px rgba(0,0,0,.8)}
html body #v-home .muted{color:#d9cca4!important;font-weight:600}
html body .badge{background:rgba(245,184,46,.12)!important;border:1px solid rgba(245,184,46,.4)!important;color:#ffd966!important}

html body .btn{background:#1a1408!important;border:1px solid rgba(245,184,46,.45)!important;color:#f5d27a!important}
html body .btn:hover{background:#261d0a!important;border-color:#f5b82e!important;color:#ffe9a8!important}
html body .btn.primary{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;border-color:#f5b82e!important;color:#1a1400!important;box-shadow:0 8px 18px rgba(245,184,46,.3)!important}
html body .btn.primary:hover{background:linear-gradient(180deg,#f5d36a,#e0a420)!important}
html body .btn:disabled{opacity:.5}

html body .wpmenu button{background:#1a1408!important;border:1px solid rgba(245,184,46,.25)!important;color:#f0d58a!important}
html body .wpmenu button.on{background:linear-gradient(180deg,#fde68a,#f5b82e)!important;border-color:#f5b82e!important;color:#1a1400!important}

html body .fm label{color:#e9e1c9!important}
html body .fm input,html body input,html body select,html body textarea{background:#0e0b04!important;color:#fff7dc!important;border:1px solid rgba(245,184,46,.35)!important}
html body .fm input:focus{outline:2px solid #f5b82e!important}
html body .fm .sub{color:#b3a784!important}
html body .tabs2 button{background:#1c1608!important;color:#f0d58a!important}
html body .tabs2 button.on{background:#f5b82e!important;color:#1a1400!important}
html body .mst div{background:#17120a!important;color:#b3a784!important}
html body .mst b{color:#fff7dc!important}
html body .bal .n{color:#f5b82e!important}
html body .bal .u{color:#a39878!important}
html body .fmsg.err{background:#3a1414!important;color:#ffb4b4!important}
html body .fmsg.ok{background:#10301c!important;color:#9be8bb!important}
html body .pbadge{background:#10301c!important;color:#9be8bb!important}
html body .lnk a,html body .panel a:not(.btn){color:#ffd966!important}
html body .note{color:#a39878!important}

html body #tokenBody div[style*="0c1120"]{background:#17120a!important;color:#b3a784!important}
html body #tokenBody b[style*="f5b82e"]{color:#f5b82e!important}
html body #toast{background:#f5b82e!important;color:#1a1400!important}

/* Menu Ambassador & Tim */
html body [style*="#e4efff"]{background:#17120a!important;color:#a89f86!important;border-color:rgba(245,184,46,.4)!important}
html body [style*="#ecebff"]{background:rgba(245,184,46,.15)!important}
html body [style*="#5b52e8"]{color:#ffd966!important}
html body [style*="#6b5ff0,#3b96ff"]{background:linear-gradient(135deg,#fde68a,#f5b82e)!important;color:#1a1400!important;box-shadow:0 6px 16px rgba(245,184,46,.35)!important}
html body [style*="width:"][style*="background:#6b5ff0"]{background:linear-gradient(90deg,#f5b82e,#fde68a)!important}
html body [style*="border:2px solid #fff"]{border-color:#f5b82e!important;box-shadow:0 6px 16px rgba(245,184,46,.35)!important}
html body [style*="#6f7fa6"]{color:#a89f86!important}
`;

  /* Menimpa warna inline (gaya yang dibuat skrip lain, mis. Tugas, Profil, Pool) yang dibuat untuk tema terang */
  function rgb(h){ h = h.replace("#",""); if (h.length === 3) h = h.replace(/(.)/g,"$1$1"); return "rgb(" + parseInt(h.slice(0,2),16) + ", " + parseInt(h.slice(2,4),16) + ", " + parseInt(h.slice(4,6),16) + ")"; }
  function sel(prop, hex){ return '[style*="' + prop + ':' + hex + ';"],[style*="' + prop + ': ' + rgb(hex) + '"],[style*="' + prop + ':' + rgb(hex) + '"]'; }
  function rule(prop, hexes, decl){ return hexes.map(function(h){ return "html body " + sel(prop,h).split("],[").join("],html body [") ; }).join(",") + "{" + decl + "}\n"; }
  var X = "";
  X += rule("background", ["#fff"], "background:#1a1408!important;");
  X += rule("background", ["#f4f5fb","#eef5ff","#f1f7ff","#e4efff","#ecebff","#f3f8ff","#f8f9ff","#fafbff"], "background:#17120a!important;");
  X += rule("background", ["#e8e9f8","#eceefc"], "background:#2a2416!important;color:#7d7458!important;");
  X += rule("background", ["#6b5ff0"], "background:linear-gradient(180deg,#fde68a,#f5b82e)!important;color:#1a1400!important;");
  X += rule("color", ["#12142e","#1b1d3a","#2c2f55","#3d4163"], "color:#f4efe0!important;");
  X += rule("color", ["#8a8fb0","#6f7fa6","#7a7fa3"], "color:#b3a784!important;");
  X += rule("color", ["#5d628a","#5b5f86"], "color:#cdbf98!important;");
  X += rule("color", ["#5b52e8","#4b44c8","#6b5ff0"], "color:#ffd966!important;");
  X += rule("color", ["#9a9fc0"], "color:#7d7458!important;");
  X += rule("color", ["#c0392b","#a12626"], "color:#ff8a7a!important;");
  X += rule("border", ["#eceefc"], "border-color:rgba(245,184,46,.18)!important;");
  X += rule("border-top", ["#eceefc"], "border-color:rgba(245,184,46,.18)!important;");
  X += rule("border", ["#d9dcf3"], "border-color:rgba(245,184,46,.35)!important;");
  X += "html body .view,html body #v-tugas{background:transparent!important;color:#f4efe0!important}\n";
  css += X;

  var st = document.createElement("style");
  st.id = "tema-emas";
  st.textContent = css;
  document.head.appendChild(st);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", "#0d0a05");
})();
