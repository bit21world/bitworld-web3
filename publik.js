/* Tautan publik di halaman Masuk/Daftar (terlihat tanpa login).
   Pasang: upload ke folder yang sama dengan index.html, lalu tambahkan
   <script src="/publik.js"></script> tepat di bawah baris <script src="/tim.js"></script>. */
(function () {
  "use strict";
  function logo() {
    /* ganti logo kecil di pojok kiri atas dan ikon tab browser dengan logo baru */
    try {
      /* koin besar transparan di latar belakang (Beranda dan Mining) */
      if (!document.getElementById("latar-baru")) {
        var bg = document.createElement("style");
        bg.id = "latar-baru";
        bg.textContent = "html body::before{display:block!important;background-image:url(/btw-logo-256.png)!important;background-size:min(88vw,520px) auto!important;background-position:center 42%!important;background-repeat:no-repeat!important;opacity:.16!important}";
        document.head.appendChild(bg);
      }
      var im = document.querySelector(".brand img");
      if (im) im.src = "/btw-logo-128.png";
      if (!document.querySelector('link[rel="icon"]')) {
        var l = document.createElement("link");
        l.rel = "icon"; l.type = "image/png"; l.href = "/btw-logo-32.png";
        document.head.appendChild(l);
      }
    } catch (e) {}
  }
  function neon() {
    /* gaya Mining: neon biru, modern (hanya warna, bingkai, dan cahaya; tata letak tidak diubah) */
    try {
      if (document.getElementById("mining-neon")) return;
      var st = document.createElement("style");
      st.id = "mining-neon";
      st.textContent =
        "#v-mine2 #mnUsers{background:rgba(8,24,70,.88)!important;border:1px solid rgba(34,211,238,.6)!important;box-shadow:0 0 16px rgba(34,211,238,.4)!important;color:#bfeeff!important}" +
        "#v-mine2 #mnUsers b{color:#67e8f9!important;text-shadow:0 0 8px rgba(34,211,238,.9)}" +
        "#v-mine2 [class*='mn-card'],#v-mine2 [class*='mn-stat'],#v-mine2 [class*='mn-box'],#v-mine2 [class*='mn-panel'],#v-mine2 [class*='mn-info']{" +
          "background:linear-gradient(160deg,rgba(20,58,150,.82),rgba(5,14,48,.94))!important;" +
          "border:1px solid rgba(56,189,248,.55)!important;border-radius:18px!important;" +
          "box-shadow:0 0 0 1px rgba(56,189,248,.1),0 0 22px rgba(34,211,238,.25),inset 0 1px 0 rgba(255,255,255,.12)!important}" +
        "#v-mine2 .mn-coin{box-shadow:0 0 0 3px rgba(34,211,238,.55),0 0 36px rgba(34,211,238,.75),0 8px 18px rgba(0,20,80,.5)!important}" +
        "#v-mine2 [class*='mn-bal'],#v-mine2 [class*='mn-num'],#v-mine2 [class*='mn-amount'],#v-mine2 [class*='mn-total']{color:#67e8f9!important;text-shadow:0 0 14px rgba(34,211,238,.85),0 2px 0 rgba(0,20,60,.6)!important}" +
        "#v-mine2 button,#v-mine2 [class*='btn']{background:linear-gradient(180deg,#67e8f9,#0ea5e9)!important;color:#021a2e!important;border:0!important;border-radius:14px!important;font-weight:800!important;box-shadow:0 0 22px rgba(34,211,238,.65),inset 0 1px 0 rgba(255,255,255,.55)!important}" +
        "#v-mine2 button:disabled,#v-mine2 button[disabled]{background:linear-gradient(180deg,#334a7a,#1b2c52)!important;color:#9db4e0!important;box-shadow:none!important}";
      document.head.appendChild(st);
    } catch (e) {}
  }
  function init() {
    logo();
    neon();
    var v = document.getElementById("v-auth");
    if (!v || document.getElementById("pubLinks")) return;
    var en = window.ulang !== "id";
    var L = [
      ["/info.html", en ? "Project info" : "Info proyek"],
      ["/token.html", en ? "Token info" : "Info token"],
      ["/team.html", en ? "Team" : "Tim"],
      ["/whitepaper-bitworld-btw-publik-v2.pdf", "Whitepaper"],
      ["https://x.com/bitworld_btw", "X"],
      ["https://t.me/Bitworld_Official", "Telegram"],
      ["https://www.linkedin.com/in/juandri-juan-2b5602449", "LinkedIn"]
    ];
    var d = document.createElement("div");
    d.id = "pubLinks";
    d.style.cssText = "margin-top:10px;text-align:center;font-size:13px;line-height:2";
    L.forEach(function (x, i) {
      var a = document.createElement("a");
      a.href = x[0]; a.textContent = x[1];
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.style.cssText = "color:var(--muted,#8a8fb0);text-decoration:underline;margin:0 8px;white-space:nowrap";
      d.appendChild(a);
    });
    v.appendChild(d);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
