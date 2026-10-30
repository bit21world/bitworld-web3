/* Program Ambassador Bitworld: menu + halaman (add-on).
   Pasang: upload file ini ke folder yang sama dengan index.html, lalu tambahkan
   <script src="/ambassador.js"></script> tepat di bawah baris <script src="/tema.js"></script>.
   Angka reward dan link formulir bisa diubah di bagian PENGATURAN di bawah. */
(function () {
  "use strict";

  /* ============ PENGATURAN: ubah di sini ============ */
  var AMB = {
    FORM_URL: "https://forms.gle/uteqzkg5WP4BeoNW8",                                   // tempel link Google Form di sini (harus diawali https://)
    TELEGRAM_URL: "https://t.me/Bitworld_Official",
    POOL: 50000,                                    // kuota total reward program (BTW)
    LEVELS: [
      { name: "Bronze",   color: "#cd7f32", need: 5,   bonus: 10 },
      { name: "Silver",   color: "#8f9bb3", need: 15,  bonus: 45 },
      { name: "Gold",     color: "#d9a400", need: 40,  bonus: 160 },
      { name: "Platinum", color: "#6b5ff0", need: 100, bonus: 500 }
    ],
    CONTENT_TOP: [50, 30, 20]                       // bonus konten terbaik bulanan (juara 1 sampai 3)
  };

  /* ============ Helper ============ */
  function L() { return window.lang === "en" ? "en" : "id"; }
  function T(id, en) { return L() === "en" ? en : id; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) {
    try { return Number(n).toLocaleString(L() === "en" ? "en-US" : "id-ID"); } catch (e) { return String(n); }
  }
  function safeUrl(u) { return /^https:\/\/[^\s"'<>]+$/i.test(u || "") ? u : ""; }

  /* ============ Status KYC (endpoint yang sama dengan kyc.html) ============
     Balasan: { status: "approved" | "pending" | "rejected" | lainnya = belum mulai }.
     kycRaw: null = belum dimuat / gagal dimuat (tidak diblokir), selain itu string status. */
  var kycRaw = null, kycBusy = false;
  function loadKyc() {
    if (kycBusy || typeof fetch !== "function") return;
    kycBusy = true;
    fetch("/api/me?kyc=status", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        kycBusy = false;
        if (d && typeof d === "object") { kycRaw = String(d.status || "none"); render(); }
      });
  }
  function kycState() {            // true = terverifikasi, false = belum, null = tidak diketahui
    if (kycRaw === null) return null;
    return kycRaw === "approved";
  }
  function kycLabel() {
    if (kycRaw === "approved") return T("Terverifikasi", "Verified");
    if (kycRaw === "pending") return T("Sedang diproses", "In progress");
    if (kycRaw === "rejected") return T("Ditolak", "Rejected");
    return T("Belum terverifikasi", "Not verified");
  }

  /* ============ Data referral (endpoint yang sama dengan kartu di Profil) ============ */
  var ref = null, refBusy = false;
  function loadRef() {
    if (refBusy || typeof fetch !== "function") return;
    refBusy = true;
    fetch("/api/referral", { credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: {} }; })
      .then(function (r) {
        refBusy = false;
        if (r.ok && r.d && r.d.code) { ref = r.d; render(); }
      });
  }

  /* ============ Halaman ============ */
  function render() {
    var v = document.getElementById("v-ambassador");
    if (!v) return;
    var P = '<div class="panel" style="margin:0">';
    var h = "";

    /* Pengantar */
    h += P + "<h2>" + T("Program Ambassador", "Ambassador Program") + "</h2>";
    h += "<p>" + T(
      "Bantu perkenalkan Bitworld (BTW) ke komunitas secara jujur dan bertanggung jawab. Sebagai gantinya, Anda mendapat reward berupa poin BTW dan status resmi Ambassador.",
      "Help introduce Bitworld (BTW) to the community honestly and responsibly. In return, you receive BTW points and official Ambassador status."
    ) + "</p>";
    h += "<h2 style='font-size:16px;margin-top:12px'>" + T("Siapa yang cocok", "Who it is for") + "</h2><ul class='list'>";
    (L() === "en" ? [
      "Active on Telegram, X, or Facebook and comfortable sharing information.",
      "Has a Bitworld account with a verified email.",
      "Has passed KYC (KYC status is verified).",
      "At least 18 years old.",
      "Willing to follow the program rules."
    ] : [
      "Aktif di Telegram, X, atau Facebook dan nyaman membagikan informasi.",
      "Sudah punya akun Bitworld dengan email terverifikasi.",
      "Sudah lulus KYC (status KYC terverifikasi).",
      "Berusia minimal 18 tahun.",
      "Bersedia mengikuti aturan program."
    ]).forEach(function (x) { h += "<li>" + esc(x) + "</li>"; });
    h += "</ul></div>";

    /* Progres Anda (hanya tampil jika data referral berhasil dimuat) */
    if (ref) {
      var act = Number(ref.active) || 0, cur = null, next = null;
      AMB.LEVELS.forEach(function (x) { if (act >= x.need) cur = x; });
      for (var i = 0; i < AMB.LEVELS.length; i++) { if (act < AMB.LEVELS[i].need) { next = AMB.LEVELS[i]; break; } }
      var pct = next ? Math.min(100, Math.round(act / next.need * 100)) : 100;
      h += P + "<h2>" + T("Progres Anda", "Your progress") + "</h2>";
      h += "<div class='mst'><div>" + T("Teman aktif", "Active friends") + "<b>" + num(act) + "</b></div>" +
           "<div>Level<b>" + (cur ? esc(cur.name) : "-") + "</b></div></div>";
      var kc = kycState();
      if (kc !== null) {
        h += "<p style='font-size:13px;margin:6px 0'>" + T("Status KYC: ", "KYC status: ") + "<strong style='color:" + (kc ? "#1a8a4a" : "#c0392b") + "'>" +
             kycLabel() + "</strong></p>";
      }
      h += "<div style='height:10px;border-radius:999px;background:#e4efff;overflow:hidden;margin:8px 0'><div style='height:100%;width:" + pct + "%;background:#6b5ff0'></div></div>";
      h += "<p style='font-size:13px'>" + (next
        ? T("Menuju ", "Towards ") + "<strong>" + esc(next.name) + "</strong>: " + num(act) + " / " + num(next.need)
        : T("Semua level sudah tercapai.", "All levels reached.")) + "</p>";
      h += "<p class='muted' style='font-size:12px'>" + T(
        "Angka diambil dari menu Profil. Reward tetap diverifikasi admin setiap bulan.",
        "Numbers come from the Profile menu. Rewards are still verified by an admin every month."
      ) + "</p></div>";
    }

    /* Reward */
    var total = AMB.LEVELS.reduce(function (a, x) { return a + x.bonus; }, 0);
    h += P + "<h2>Reward</h2>";
    h += "<p class='muted' style='font-size:12.5px'>" + T(
      "Referral aktif = teman yang mendaftar lewat link undangan Anda dan terhitung sebagai \"Teman aktif\" di menu Profil.",
      "Active referral = a friend who signed up with your invite link and is counted as an \"Active friend\" in the Profile menu."
    ) + "</p>";
    var th = "text-align:left;font-size:11px;font-weight:700;color:var(--muted);padding:6px 4px;text-transform:uppercase;letter-spacing:.5px";
    h += "<table style='margin:6px 0'><tr><th style='" + th + "'>Level</th><th style='" + th + "'>" + T("Referral aktif", "Active referrals") + "</th><th style='" + th + ";text-align:right'>Bonus</th></tr>";
    AMB.LEVELS.forEach(function (x) {
      h += "<tr><td style='width:auto'><span style='color:" + esc(x.color) + "'>&#9679;</span> <strong>" + esc(x.name) + "</strong></td>" +
           "<td style='width:auto'>" + num(x.need) + "</td>" +
           "<td style='width:auto;text-align:right'><strong>" + num(x.bonus) + " BTW</strong></td></tr>";
    });
    h += "</table>";
    h += "<p style='font-size:12.5px'>" + T(
      "Bonus dibayar sekali per level dan bersifat kumulatif. Total jika mencapai Platinum: ",
      "Each bonus is paid once per level and is cumulative. Total if you reach Platinum: "
    ) + "<strong>" + num(total) + " BTW</strong>.</p>";
    h += "<h2 style='font-size:16px;margin-top:12px'>" + T("Bonus konten bulanan", "Monthly content bonus") + "</h2>";
    h += "<p style='font-size:13px'>" + T(
      "Tiga konten terbaik setiap bulan mendapat ",
      "The three best pieces of content each month receive "
    ) + "<strong>" + AMB.CONTENT_TOP.map(num).join(" / ") + " BTW</strong>.</p>";
    h += "<h2 style='font-size:16px;margin-top:12px'>" + T("Status dan fasilitas", "Status and perks") + "</h2><ul class='list'>";
    (L() === "en" ? [
      "Official Ambassador badge.",
      "Private coordination group.",
      "Ready-to-use content materials.",
      "Your name on the Ambassador list (optional, with your consent)."
    ] : [
      "Badge resmi Ambassador.",
      "Grup koordinasi khusus.",
      "Materi konten siap pakai.",
      "Nama Anda di daftar Ambassador (opsional, dengan persetujuan Anda)."
    ]).forEach(function (x) { h += "<li>" + esc(x) + "</li>"; });
    h += "</ul>";
    h += "<p class='muted' style='font-size:12px;margin-top:10px'>" + T(
      "Reward hanya diberikan kepada akun dengan status KYC terverifikasi. Reward berupa poin BTW internal yang dicatat di akun Anda. Verifikasi dan pembagian dilakukan sebulan sekali. Total kuota program " + num(AMB.POOL) + " BTW, dibagikan sampai kuota habis.",
      "Rewards are only granted to accounts with a verified KYC status. Rewards are internal BTW points recorded in your account. Verification and payout happen once a month. The total program quota is " + num(AMB.POOL) + " BTW, distributed until it runs out."
    ) + "</p></div>";

    /* Cara ikut */
    h += P + "<h2>" + T("Cara ikut", "How to join") + "</h2><ul class='list'>";
    (L() === "en" ? [
      "Make sure your Bitworld account is registered, the email is verified, and your KYC status is verified.",
      "Fill in the application form below.",
      "The team reviews your application and contacts you on Telegram.",
      "Start sharing your invite link from the Profile menu along with your content, then report your results in the group."
    ] : [
      "Pastikan akun Bitworld sudah terdaftar, email terverifikasi, dan status KYC terverifikasi.",
      "Isi formulir pendaftaran di bawah.",
      "Tim meninjau pendaftaran dan menghubungi Anda lewat Telegram.",
      "Mulai bagikan link undangan dari menu Profil beserta konten Anda, lalu laporkan hasilnya di grup."
    ]).forEach(function (x, i) { h += "<li>" + esc(x) + "</li>"; });
    h += "</ul></div>";

    /* Aturan */
    h += P + "<h2>" + T("Aturan program", "Program rules") + "</h2><ul class='list'>";
    (L() === "en" ? [
      "Do not promise price, profit, or fixed returns.",
      "Do not give investment advice or urge people to buy.",
      "Do not spam, create fake or duplicate accounts, or refer yourself.",
      "Do not claim to be the official team or an admin.",
      "Never ask anyone for a seed phrase, private key, or payment.",
      "Say you are a Bitworld Ambassador and add \"Not investment advice. DYOR.\" to promotional content.",
      "Violations mean removal from the program and cancelled rewards."
    ] : [
      "Dilarang menjanjikan harga, keuntungan, atau hasil tetap.",
      "Dilarang memberi nasihat investasi atau mengajak orang membeli.",
      "Dilarang spam, membuat akun palsu atau ganda, dan mengundang diri sendiri.",
      "Dilarang mengaku sebagai tim resmi atau admin.",
      "Jangan pernah meminta seed phrase, private key, atau pembayaran kepada siapa pun.",
      "Sebutkan bahwa Anda Ambassador Bitworld dan cantumkan \"Bukan ajakan investasi. DYOR.\" di konten promosi.",
      "Pelanggaran berarti dikeluarkan dari program dan reward dibatalkan."
    ]).forEach(function (x) { h += "<li>" + esc(x) + "</li>"; });
    h += "</ul>";
    h += "<p class='muted' style='font-size:12px;margin-top:10px'>" + T(
      "Program dapat berubah sewaktu-waktu dan diumumkan lewat kanal resmi. Bukan ajakan investasi, tidak ada janji harga atau keuntungan.",
      "The program may change at any time and changes are announced through official channels. Not investment advice, and no promise of price or profit."
    ) + "</p></div>";

    /* Tombol daftar */
    var form = safeUrl(AMB.FORM_URL);
    h += "<div class='actions' style='margin-top:2px'>";
    if (kycRaw === "pending") {
      h += "<button class='btn primary' type='button' disabled>" + T("KYC sedang diproses", "KYC in progress") + "</button>";
    } else if (kycState() === false) {
      h += "<a class='btn primary' href='kyc.html'>" + T("Selesaikan KYC dulu", "Complete KYC first") + "</a>";
    } else if (form) {
      h += "<a class='btn primary' href='" + esc(form) + "' target='_blank' rel='noopener noreferrer'>" + T("Daftar Ambassador", "Apply as Ambassador") + "</a>";
    } else {
      h += "<button class='btn primary' type='button' disabled>" + T("Formulir segera dibuka", "Form opening soon") + "</button>";
    }
    h += "<a class='btn' href='" + esc(AMB.TELEGRAM_URL) + "' target='_blank' rel='noopener noreferrer'>" + T("Tanya di Telegram", "Ask on Telegram") + "</a></div>";

    v.innerHTML = h;
  }

  /* ============ Tombol di Beranda ============ */
  function homeCta() {
    var home = document.getElementById("v-home");
    if (!home) return;
    var box = document.getElementById("homeAmb");
    if (!box) {
      box = document.createElement("div");
      box.id = "homeAmb";
      box.style.cssText = "margin-top:10px;text-align:center";
      var hs = document.getElementById("homeSocial");
      if (hs && hs.parentNode === home) hs.insertAdjacentElement("afterend", box); else home.appendChild(box);
    }
    box.innerHTML = '<button class="btn" type="button" data-go="ambassador">' +
      T("Jadi Ambassador Bitworld", "Become a Bitworld Ambassador") + "</button>";
  }

  /* ============ Tombol menu ============ */
  var btn = null, tries = 0;
  function placeBtn() {
    var host = document.getElementById("navDrawer") || document.querySelector("nav.bottom");
    if (!host) return;
    if (!btn) {
      btn = document.getElementById("n-ambassador");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.id = "n-ambassador";
        btn.setAttribute("data-go", "ambassador");
      }
    }
    btn.textContent = "Ambassador";
    if (btn.parentNode !== host) host.appendChild(btn);
  }

  /* ============ Pasang ============ */
  function init() {
    var main = document.querySelector("main");
    if (!main || !window.VIEWS || typeof window.VIEWS !== "object") {
      if (window.console) console.warn("ambassador.js: struktur halaman tidak dikenali, menu tidak dipasang.");
      return;
    }
    var st = document.createElement("style");
    st.textContent = ":where(#n-ambassador){font:inherit;font-weight:600;cursor:pointer;padding:10px 12px;border:1px solid rgba(88,76,214,.14);border-radius:12px;background:#f1f7ff;color:#5b5f86}";
    document.head.appendChild(st);

    var v = document.getElementById("v-ambassador");
    if (!v) {
      v = document.createElement("section");
      v.className = "view";
      v.id = "v-ambassador";
      main.appendChild(v);
    }
    window.VIEWS.ambassador = "v-ambassador";

    render();
    homeCta();
    placeBtn();
    loadRef();
    loadKyc();

    var iv = setInterval(function () { placeBtn(); if (++tries > 40) clearInterval(iv); }, 500);
    document.addEventListener("click", function (e) {
      setTimeout(placeBtn, 60);
      var t = e.target && e.target.closest ? e.target.closest("[data-go]") : null;
      if (t && t.getAttribute("data-go") === "ambassador") setTimeout(function () { loadRef(); loadKyc(); }, 300);
    });
    ["lang-id", "lang-en"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", function () { setTimeout(function () { render(); homeCta(); }, 0); });
    });

    if (location.hash === "#ambassador" && typeof window.go === "function") window.go("ambassador");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
