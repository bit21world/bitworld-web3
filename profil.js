(function () {
  var g = function (id) { return document.getElementById(id); };
  var T = function (a, b) { return window.lang === "en" ? b : a; };
  var me = null;

  var nav = document.querySelector("nav.bottom");
  var btn = document.createElement("button");
  btn.type = "button"; btn.id = "n-profile"; btn.setAttribute("data-go", "profile");
  nav.insertBefore(btn, g("n-mine").nextSibling);

  var sec = document.createElement("section");
  sec.className = "view"; sec.id = "v-profile";
  sec.innerHTML = '<div class="panel fm" id="profBody"></div>';
  document.querySelector("main").appendChild(sec);
  VIEWS.profile = "v-profile";

  function api(path, body) {
    var post = body !== undefined;
    return fetch("/api/" + path, {
      method: post ? "POST" : "GET", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: post ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, data: d }; });
    }).catch(function () { return { ok: false, data: { error: "network" } }; });
  }

  function msg(text, ok) {
    var e = g("pMsg"); if (!e) return;
    e.textContent = text; e.className = "fmsg " + (ok ? "ok" : "err");
  }
  function errText(c) {
    if (c === "invalid_wallet") return T("Alamat wallet tidak valid. Harus diawali 0x dan 42 karakter.", "Invalid wallet address. It must start with 0x and be 42 characters.");
    if (c === "wallet_taken") return T("Alamat wallet ini sudah dipakai akun lain.", "This wallet is already used by another account.");
    if (c === "unauthorized") return T("Sesi habis. Silakan masuk lagi.", "Session expired. Please log in again.");
    if (c === "rate_limited") return T("Terlalu banyak percobaan. Coba lagi nanti.", "Too many attempts. Try again later.");
    if (c === "network") return T("Koneksi bermasalah.", "Connection problem.");
    return T("Terjadi kesalahan di server. Coba lagi.", "Server error. Try again.");
  }

  function render() {
    btn.textContent = T("Profil", "Profile");
    var b = g("profBody"); if (!b) return;
    if (!me) {
      b.innerHTML = '<h2>' + T("Profil", "Profile") + '</h2><p class="sub">' +
        T("Masuk dulu untuk melihat profil.", "Log in to view your profile.") +
        '</p><button class="btn primary" type="button" id="pGo">' + T("Masuk / Daftar", "Log in / Sign up") + '</button>';
      g("pGo").onclick = function () { go("auth"); };
      return;
    }
    b.innerHTML =
      '<h2>' + T("Profil", "Profile") + '</h2><p class="sub" id="pWho"></p>' +
      '<div class="mst"><div>' + T("Saldo poin", "Points") + '<b id="pBal"></b></div>' +
      '<div>Wallet<b id="pStat"></b></div></div>' +
      '<label for="pWallet">' + T("Alamat wallet BSC (BEP-20)", "BSC wallet address (BEP-20)") + '</label>' +
      '<input id="pWallet" placeholder="0x..." autocomplete="off" autocapitalize="off" spellcheck="false">' +
      '<button class="btn primary" type="button" id="pSave">' + T("Simpan Wallet", "Save Wallet") + '</button>' +
      '<div class="fmsg" id="pMsg"></div><div class="lnk" id="pLink"></div>' +
      '<p class="note">' + T("Jangan pernah memasukkan seed phrase atau private key. Cukup alamat publik (0x...).", "Never enter your seed phrase or private key. Only the public address (0x...).") + '</p>' +
      '<button class="btn" type="button" id="pOut">' + T("Keluar", "Log out") + '</button>';
    g("pWho").textContent = (me.name ? me.name + " \u2022 " : "") + me.email;
    g("pBal").textContent = Number(me.balance || 0).toLocaleString("id-ID", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
    g("pStat").textContent = me.wallet ? T("Tersimpan", "Saved") : T("Belum diisi", "Not set");
    if (me.wallet) {
      g("pWallet").value = me.wallet;
      var a = document.createElement("a");
      a.href = "https://bscscan.com/address/" + me.wallet;
      a.target = "_blank"; a.rel = "noopener noreferrer";
      a.textContent = T("Lihat di BscScan", "View on BscScan");
      g("pLink").appendChild(a);
    }
    g("pSave").onclick = save;
    g("pOut").onclick = function () { api("logout", {}).then(function () { location.reload(); }); };
  }

  function save() {
    var w = g("pWallet").value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(w)) return msg(errText("invalid_wallet"));
    g("pSave").disabled = true;
    api("wallet", { wallet: w }).then(function (r) {
      if (g("pSave")) g("pSave").disabled = false;
      if (!r.ok) return msg(errText(r.data.error));
      me.wallet = r.data.wallet || w.toLowerCase();
      render();
      msg(T("Wallet tersimpan.", "Wallet saved."), true);
    });
  }

  function load() {
    return api("me").then(function (r) {
      me = (r.ok && r.data.user) ? r.data.user : null;
      render();
    });
  }

  var _go = go;
  go = function (n) {
    _go(n);
    if (n === "profile") load();
  };
  ["lang-id", "lang-en"].forEach(function (id) { g(id).addEventListener("click", render); });
  render();
})();
