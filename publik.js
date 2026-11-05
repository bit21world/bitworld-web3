/* Tautan publik di halaman Masuk/Daftar (terlihat tanpa login).
   Pasang: upload ke folder yang sama dengan index.html, lalu tambahkan
   <script src="/publik.js"></script> tepat di bawah baris <script src="/tim.js"></script>. */
(function () {
  "use strict";
  function init() {
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
