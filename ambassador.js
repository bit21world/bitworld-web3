/* Program Ambassador Bitworld: menu + halaman (add-on).
   Pasang: upload file ini ke folder yang sama dengan index.html, lalu tambahkan
   <script src="/ambassador.js"></script> tepat di bawah baris <script src="/tema.js"></script>.
   Angka poin, reward, dan link formulir bisa diubah di bagian PENGATURAN di bawah. */
(function () {
  "use strict";

  /* ============ PENGATURAN: ubah di sini ============ */
  var AMB = {
    FORM_URL: "https://forms.gle/uteqzkg5WP4BeoNW8",   // link Google Form (harus diawali https://)
    TELEGRAM_URL: "https://t.me/Bitworld_Official",
    POOL: 50000,                                        // kuota total reward program (BTW)
    CUTOFF_DAY: 23,                                     // batas tanggal laporan poin setiap bulan

    /* Poin per aktivitas */
    POINTS: [
      { id: "Post dengan gambar atau video",       en: "Post with image or video",        pts: 3 },
      { id: "Video pendek",                         en: "Short video",                     pts: 5 },
      { id: "Video panjang",                        en: "Long video",                      pts: 8 },
      { id: "Livestream atau AMA",                  en: "Livestream or AMA",               pts: 20 },
      { id: "Event offline",                        en: "Offline event",                   pts: 50 }
    ],

    /* Tabel reward bulanan: poin minimal -> BTW. Urutkan dari kecil ke besar. */
    REWARDS: [
      { pts: 200,   btw: 10 },
      { pts: 400,   btw: 25 },
      { pts: 800,   btw: 50 },
      { pts: 1600,  btw: 100 },
      { pts: 3200,  btw: 200 },
      { pts: 6400,  btw: 400 },
      { pts: 12800, btw: 800 }
    ],

    /* Tier ditempatkan manual oleh tim (3 = awal, 1 = tertinggi) */
    TIERS: [
      { name: "Tier 3", color: "#8f9bb3" },
      { name: "Tier 2", color: "#d9a400" },
      { name: "Tier 1", color: "#6b5ff0" }
    ]
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

  /* ============ Halaman ============ */
  function render() {
    var v = document.getElementById("v-ambassador");
    if (!v) return;
    var P = '<div class="panel" style="margin:0">';
    var h = "";
    var th = "text-align:left;font-size:11px;font-weight:700;color:var(--muted);padding:6px 4px;text-transform:uppercase;letter-spacing:.5px";
    function li(arr) { var s = ""; arr.forEach(function (x) { s += "<li>" + esc(x) + "</li>"; }); return s; }

    /* Pengantar */
    h += P + "<h2>" + T("Program Ambassador", "Ambassador Program") + "</h2>";
    h += "<p>" + T(
      "Bantu perkenalkan Bitworld (BTW) ke komunitas secara jujur dan bertanggung jawab lewat konten buatan Anda sendiri. Setiap konten dan kegiatan menghasilkan poin. Poin dihitung setiap bulan lalu diubah menjadi reward BTW.",
      "Help introduce Bitworld (BTW) to the community honestly and responsibly through your own content. Every piece of content and activity earns points. Points are counted each month and converted into BTW rewards."
    ) + "</p>";
    h += "<h2 style='font-size:16px;margin-top:12px'>" + T("Siapa yang cocok", "Who it is for") + "</h2><ul class='list'>";
    h += li(L() === "en" ? [
      "Active on Telegram, X, Facebook, YouTube, or TikTok and comfortable creating content.",
      "Has a Bitworld account with a verified email.",
      "Has passed KYC (KYC status is verified).",
      "At least 18 years old.",
      "Willing to follow the program rules."
    ] : [
      "Aktif di Telegram, X, Facebook, YouTube, atau TikTok dan nyaman membuat konten.",
      "Sudah punya akun Bitworld dengan email terverifikasi.",
      "Sudah lulus KYC (status KYC terverifikasi).",
      "Berusia minimal 18 tahun.",
      "Bersedia mengikuti aturan program."
    ]);
    h += "</ul>";
    var kc = kycState();
    if (kc !== null) {
      h += "<p style='font-size:13px;margin:8px 0 0'>" + T("Status KYC Anda: ", "Your KYC status: ") +
           "<strong style='color:" + (kc ? "#1a8a4a" : "#c0392b") + "'>" + kycLabel() + "</strong></p>";
    }
    h += "</div>";

    /* Poin */
    h += P + "<h2>" + T("Cara mendapat poin", "How to earn points") + "</h2>";
    h += "<table style='margin:6px 0'><tr><th style='" + th + "'>" + T("Aktivitas", "Activity") + "</th><th style='" + th + ";text-align:right'>" + T("Poin", "Points") + "</th></tr>";
    AMB.POINTS.forEach(function (x) {
      h += "<tr><td style='width:auto'>" + esc(L() === "en" ? x.en : x.id) + "</td>" +
           "<td style='width:auto;text-align:right'><strong>" + num(x.pts) + "</strong></td></tr>";
    });
    h += "</table>";
    h += "<p style='font-size:12.5px'>" + T(
      "Konten dengan jumlah view atau like yang tinggi bisa mendapat poin tambahan dari tim. Besarnya ditentukan tim saat verifikasi.",
      "Content with high views or likes can receive extra points from the team. The amount is decided during verification."
    ) + "</p>";
    h += "<p class='muted' style='font-size:12px'>" + T(
      "Poin dihitung per bulan. Batas pelaporan setiap bulan adalah tanggal " + AMB.CUTOFF_DAY + ". Semua poin diverifikasi manual oleh admin.",
      "Points are counted monthly. The reporting deadline each month is the " + AMB.CUTOFF_DAY + "th. All points are verified manually by an admin."
    ) + "</p></div>";

    /* Reward */
    var top = AMB.REWARDS[AMB.REWARDS.length - 1];
    h += P + "<h2>Reward</h2>";
    h += "<p style='font-size:13px'>" + T(
      "Total poin Anda dalam satu bulan menentukan reward BTW untuk bulan itu. Poin tidak dibawa ke bulan berikutnya.",
      "Your total points in one month decide the BTW reward for that month. Points do not carry over to the next month."
    ) + "</p>";
    h += "<table style='margin:6px 0'><tr><th style='" + th + "'>" + T("Poin bulanan", "Monthly points") + "</th><th style='" + th + ";text-align:right'>Reward</th></tr>";
    AMB.REWARDS.forEach(function (x) {
      h += "<tr><td style='width:auto'>" + num(x.pts) + "+</td>" +
           "<td style='width:auto;text-align:right'><strong>" + num(x.btw) + " BTW</strong></td></tr>";
    });
    h += "</table>";
    h += "<p style='font-size:12.5px'>" + T(
      "Reward tertinggi per bulan adalah " + num(top.btw) + " BTW. Jika total poin di bawah " + num(AMB.REWARDS[0].pts) + ", belum ada reward bulan itu.",
      "The highest monthly reward is " + num(top.btw) + " BTW. If your total is below " + num(AMB.REWARDS[0].pts) + " points, there is no reward that month."
    ) + "</p>";
    h += "<p class='muted' style='font-size:12px;margin-top:10px'>" + T(
      "Reward hanya diberikan kepada akun dengan status KYC terverifikasi. Reward berupa poin BTW internal yang dicatat di akun Anda. Total kuota program " + num(AMB.POOL) + " BTW, dibagikan sampai kuota habis.",
      "Rewards are only granted to accounts with a verified KYC status. Rewards are internal BTW points recorded in your account. The total program quota is " + num(AMB.POOL) + " BTW, distributed until it runs out."
    ) + "</p></div>";

    /* Tier */
    h += P + "<h2>Tier</h2>";
    h += "<p style='font-size:13px'>" + T(
      "Ada tiga tier. Penempatan dilakukan oleh tim, bukan otomatis dari jumlah poin atau referral. Tim menilai hal berikut:",
      "There are three tiers. Placement is done by the team, not automatically from points or referrals. The team looks at:"
    ) + "</p><ul class='list'>";
    h += li(L() === "en" ? [
      "Network growth.",
      "Quality and consistency of content.",
      "Commitment to the program.",
      "Presence and help in the community."
    ] : [
      "Pertumbuhan jaringan.",
      "Kualitas dan konsistensi konten.",
      "Komitmen terhadap program.",
      "Kehadiran dan bantuan di komunitas."
    ]);
    h += "</ul><p style='font-size:13px;margin:8px 0'>";
    AMB.TIERS.forEach(function (x, i) {
      h += (i ? " &rarr; " : "") + "<span style='color:" + esc(x.color) + "'>&#9679;</span> <strong>" + esc(x.name) + "</strong>";
    });
    h += "</p>";
    h += "<p class='muted' style='font-size:12px'>" + T(
      "Tier 3 adalah tingkat awal dan Tier 1 yang tertinggi. Tim dapat menaikkan atau menurunkan tier sesuai penilaian bulanan.",
      "Tier 3 is the starting level and Tier 1 is the highest. The team may move you up or down based on the monthly review."
    ) + "</p>";
    h += "<h2 style='font-size:16px;margin-top:12px'>" + T("Status dan fasilitas", "Status and perks") + "</h2><ul class='list'>";
    h += li(L() === "en" ? [
      "Official Ambassador badge.",
      "Private coordination group.",
      "Ready-to-use content materials.",
      "Your name on the Ambassador list (optional, with your consent)."
    ] : [
      "Badge resmi Ambassador.",
      "Grup koordinasi khusus.",
      "Materi konten siap pakai.",
      "Nama Anda di daftar Ambassador (opsional, dengan persetujuan Anda)."
    ]);
    h += "</ul></div>";

    /* Cara ikut */
    h += P + "<h2>" + T("Cara ikut", "How to join") + "</h2><ul class='list'>";
    h += li(L() === "en" ? [
      "Make sure your Bitworld account is registered, the email is verified, and your KYC status is verified.",
      "Fill in the application form below.",
      "The team reviews your application and contacts you on Telegram.",
      "Create content, keep the links, and report them in the group before the monthly deadline."
    ] : [
      "Pastikan akun Bitworld sudah terdaftar, email terverifikasi, dan status KYC terverifikasi.",
      "Isi formulir pendaftaran di bawah.",
      "Tim meninjau pendaftaran dan menghubungi Anda lewat Telegram.",
      "Buat konten, simpan link-nya, lalu laporkan di grup sebelum batas waktu bulanan."
    ]);
    h += "</ul></div>";

    /* Aturan */
    h += P + "<h2>" + T("Aturan program", "Program rules") + "</h2><ul class='list'>";
    h += li(L() === "en" ? [
      "Content must be your own. Reposting other people's content does not count.",
      "Duplicate content (the same content posted again) is counted once.",
      "Low-effort or careless videos are not counted.",
      "Do not manipulate likes, views, or followers (bots, paid engagement, fake accounts).",
      "Do not promise price, profit, or fixed returns.",
      "Do not give investment advice or urge people to buy.",
      "Do not spam, create fake or duplicate accounts, or refer yourself.",
      "Do not claim to be the official team or an admin.",
      "Never ask anyone for a seed phrase, private key, or payment.",
      "Say you are a Bitworld Ambassador and add \"Not investment advice. DYOR.\" to promotional content.",
      "Violations mean points are reduced or reset, or you are removed from the program and rewards are cancelled."
    ] : [
      "Konten harus buatan sendiri. Repost konten orang lain tidak dihitung.",
      "Konten ganda (konten yang sama diunggah ulang) hanya dihitung sekali.",
      "Video asal-asalan tidak dihitung.",
      "Dilarang memanipulasi like, view, atau followers (bot, interaksi berbayar, akun palsu).",
      "Dilarang menjanjikan harga, keuntungan, atau hasil tetap.",
      "Dilarang memberi nasihat investasi atau mengajak orang membeli.",
      "Dilarang spam, membuat akun palsu atau ganda, dan mengundang diri sendiri.",
      "Dilarang mengaku sebagai tim resmi atau admin.",
      "Jangan pernah meminta seed phrase, private key, atau pembayaran kepada siapa pun.",
      "Sebutkan bahwa Anda Ambassador Bitworld dan cantumkan \"Bukan ajakan investasi. DYOR.\" di konten promosi.",
      "Pelanggaran berarti poin dikurangi atau direset, atau Anda dikeluarkan dari program dan reward dibatalkan."
    ]);
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
    loadKyc();

    var iv = setInterval(function () { placeBtn(); if (++tries > 40) clearInterval(iv); }, 500);
    document.addEventListener("click", function (e) {
      setTimeout(placeBtn, 60);
      var t = e.target && e.target.closest ? e.target.closest("[data-go]") : null;
      if (t && t.getAttribute("data-go") === "ambassador") setTimeout(loadKyc, 300);
    });
    ["lang-id", "lang-en"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", function () { setTimeout(function () { render(); homeCta(); }, 0); });
    });

    if (location.hash === "#ambassador" && typeof window.go === "function") window.go("ambassador");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
