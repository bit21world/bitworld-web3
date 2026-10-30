/* Menu Tim Bitworld (add-on): kartu peran yang rapi, tanpa mengubah index.html.
   Pasang: upload file ini ke folder yang sama dengan index.html, lalu tambahkan
   <script src="/tim.js"></script> tepat di bawah baris <script src="/ambassador.js"></script>.
   Nama, foto, dan deskripsi peran diubah di bagian PENGATURAN di bawah. */
(function () {
  "use strict";

  /* ============ PENGATURAN: ubah di sini ============ */
  /* name kosong ("") = tampil "Segera diumumkan". photo kosong = tampil huruf awal.
     photo boleh berupa "/foto-juan.jpg" (file di folder yang sama) atau link https://. */
  var TEAM = [
    {
      tag: "FOUNDER",
      role: { id: "Founder & Lead Developer", en: "Founder & Lead Developer" },
      name: "Juan",
      photo: "/foto-juan.jpg",
      desc: {
        id: "Memimpin arah proyek dan membangun produk Bitworld.",
        en: "Leads the project's direction and builds the Bitworld product."
      }
    },
    {
      tag: "TREASURY",
      role: { id: "Treasury Lead (Bendahara)", en: "Treasury Lead" },
      name: "",
      photo: "",
      desc: {
        id: "Memegang dompet alokasi dan membayar reward Ambassador sebulan sekali. Setiap pembayaran dicatat di menu Distribusi.",
        en: "Manages the allocation wallets and pays Ambassador rewards once a month. Every payment is recorded in the Distribution menu."
      }
    },
    {
      tag: "AMBASSADOR",
      role: { id: "Ambassador Program Manager", en: "Ambassador Program Manager" },
      name: "Tanisa",
      photo: "/foto-tanisa.png",
      desc: {
        id: "Menerima pendaftaran Ambassador, memverifikasi referral, dan menyusun rekap bulanan.",
        en: "Reviews Ambassador applications, verifies referrals, and prepares the monthly summary."
      }
    },
    {
      tag: "COMMUNITY",
      role: { id: "Community & Support Lead", en: "Community & Support Lead" },
      name: "",
      photo: "",
      desc: {
        id: "Menjaga kanal resmi dan menjawab pertanyaan anggota komunitas.",
        en: "Looks after the official channels and answers community questions."
      }
    }
  ];

  /* ============ Helper ============ */
  function L() { return window.lang === "en" ? "en" : "id"; }
  function T(id, en) { return L() === "en" ? en : id; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safePhoto(u) { return /^(https:\/\/|\/)[^\s"'<>]+$/i.test(u || "") ? u : ""; }

  /* ============ Halaman ============ */
  function card(m) {
    var open = !m.name;
    var photo = safePhoto(m.photo);
    var av;
    var base = "width:68px;height:68px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;";
    if (photo && !open) {
      av = "<div style='" + base + "box-shadow:0 6px 16px rgba(107,95,240,.35);border:2px solid #fff'><img src='" + esc(photo) + "' alt='" + esc(m.name) + "' style='width:100%;height:100%;object-fit:cover'></div>";
    } else if (open) {
      av = "<div style='" + base + "background:#e4efff;color:#6f7fa6;border:2px dashed rgba(88,76,214,.35);font-size:24px;font-weight:800'>?</div>";
    } else {
      av = "<div style='" + base + "background:linear-gradient(135deg,#6b5ff0,#3b96ff);color:#fff;font-size:26px;font-weight:800;box-shadow:0 6px 16px rgba(107,95,240,.35)'>" + esc(m.name.charAt(0).toUpperCase()) + "</div>";
    }
    var tagBg = open ? "#e4efff" : "#ecebff";
    return "<div class='panel' style='margin:0;display:flex;gap:14px;align-items:center'>" + av +
      "<div style='min-width:0'>" +
      "<span style='display:inline-block;font-size:10px;letter-spacing:1px;font-weight:800;padding:3px 9px;border-radius:999px;background:" + tagBg + ";color:#5b52e8'>" + esc(m.tag) + "</span>" +
      "<h2 style='font-size:17px;margin:6px 0 2px'>" + esc(m.role[L()]) + "</h2>" +
      "<div style='font-weight:700;font-size:14px;" + (open ? "color:#6f7fa6" : "") + "'>" + (open ? T("Segera diumumkan", "To be announced") : esc(m.name)) + "</div>" +
      "<p style='font-size:12.5px;margin-top:6px'>" + esc(m.desc[L()]) + "</p>" +
      "</div></div>";
  }

  function render() {
    var v = document.getElementById("v-team");
    if (!v) return;
    var h = "<div class='panel' style='margin:0'><h2>" + T("Tim Bitworld", "Bitworld Team") + "</h2>" +
      "<p>" + T(
        "Orang-orang di balik Bitworld dan tugas masing-masing. Nama dan foto hanya ditampilkan setelah yang bersangkutan setuju.",
        "The people behind Bitworld and what each one does. Names and photos are shown only after the person agrees."
      ) + "</p></div>";
    TEAM.forEach(function (m) { h += card(m); });

    h += "<div class='panel' style='margin:0'><h2>" + T("Prinsip kerja", "How we work") + "</h2><ul class='list'>";
    (L() === "en" ? [
      "Transparent: allocation wallets and every distribution can be checked on BscScan and in the Distribution menu.",
      "Two sets of eyes: every reward payout is prepared by one person and approved by another.",
      "The team never asks for your seed phrase, private key, or payment."
    ] : [
      "Transparan: dompet alokasi dan setiap distribusi bisa dicek di BscScan dan menu Distribusi.",
      "Dua pasang mata: setiap pembayaran reward disusun satu orang dan disetujui orang lain.",
      "Tim tidak pernah meminta seed phrase, private key, atau pembayaran."
    ]).forEach(function (x) { h += "<li>" + esc(x) + "</li>"; });
    h += "</ul></div>";

    if (window.VIEWS && window.VIEWS.ambassador) {
      h += "<div class='actions' style='margin-top:2px'><button class='btn primary' type='button' data-go='ambassador'>" +
        T("Lihat Program Ambassador", "See the Ambassador Program") + "</button></div>";
    }
    v.innerHTML = h;
  }

  /* ============ Tombol di Beranda (jalan masuk kedua) ============ */
  function homeCta() {
    var home = document.getElementById("v-home");
    if (!home) return;
    var box = document.getElementById("homeTim");
    if (!box) {
      box = document.createElement("div");
      box.id = "homeTim";
      box.style.cssText = "margin-top:8px;text-align:center";
      var anchor = document.getElementById("homeAmb") || document.getElementById("homeSocial");
      if (anchor && anchor.parentNode === home) anchor.insertAdjacentElement("afterend", box); else home.appendChild(box);
    }
    box.innerHTML = '<button class="btn" type="button" data-go="team">' + T("Kenali Tim Bitworld", "Meet the Bitworld Team") + "</button>";
  }

  /* ============ Tombol menu ============ */
  var btn = null, tries = 0;
  function placeBtn() {
    var host = document.getElementById("navDrawer") || document.querySelector("nav.bottom");
    if (!host) return;
    if (!btn) {
      btn = document.getElementById("n-tim");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.id = "n-tim";
        btn.setAttribute("data-go", "team");
      }
    }
    btn.textContent = T("Tim", "Team");
    if (btn.parentNode !== host) host.appendChild(btn);
  }

  /* ============ Pasang ============ */
  function init() {
    var main = document.querySelector("main");
    if (!main || !window.VIEWS || typeof window.VIEWS !== "object") {
      if (window.console) console.warn("tim.js: struktur halaman tidak dikenali, menu tidak dipasang.");
      return;
    }
    var st = document.createElement("style");
    st.textContent = ":where(#n-tim){font:inherit;font-weight:600;cursor:pointer;padding:10px 12px;border:1px solid rgba(88,76,214,.14);border-radius:12px;background:#f1f7ff;color:#5b5f86}";
    document.head.appendChild(st);

    var v = document.getElementById("v-team");
    if (!v) {
      v = document.createElement("section");
      v.className = "view";
      v.id = "v-team";
      main.appendChild(v);
    }
    window.VIEWS.team = "v-team";

    render();
    homeCta();
    placeBtn();

    var iv = setInterval(function () { placeBtn(); if (++tries > 40) clearInterval(iv); }, 500);
    document.addEventListener("click", function () { setTimeout(placeBtn, 60); });
    ["lang-id", "lang-en"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", function () { setTimeout(function () { render(); homeCta(); placeBtn(); }, 0); });
    });

    if (location.hash === "#team" && typeof window.go === "function") window.go("team");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();