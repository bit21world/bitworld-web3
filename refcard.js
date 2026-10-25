/* Kartu Referral di halaman Profil (tidak mengubah profil.js) */
(function () {
  var g = function (id) { return document.getElementById(id); };
  var T = function (a, b) { return window.lang === "en" ? b : a; };
  var data = null, fail = false, loadedAt = 0, busy = false;

  function load() {
    if (busy) return; busy = true;
    fetch("/api/referral", { credentials: "same-origin" })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: {} }; })
      .then(function (r) {
        busy = false;
        if (r.ok && r.d && r.d.code) { data = r.d; fail = false; loadedAt = Date.now(); }
        else if (!data) fail = true;
        render();
      });
  }

  function render() {
    var out = g("pOut"); if (!out) return;
    var box = g("refBox");
    if (!box) {
      box = document.createElement("div"); box.id = "refBox";
      out.parentNode.insertBefore(box, out);
    }
    var head = '<h2 style="margin-top:22px">Referral</h2><p class="sub">' +
      T("Ajak teman lewat link ini. Bonus mining bertambah untuk setiap teman yang aktif.",
        "Invite friends with this link. Mining bonus grows for every active friend.") + '</p>';
    if (!data) {
      box.innerHTML = head + '<p class="sub">' + (fail ? T("Data referral belum bisa dimuat.", "Referral data could not be loaded.") : T("Memuat...", "Loading...")) + '</p>';
      return;
    }
    var code = String(data.code || "").replace(/[^A-Za-z0-9]/g, "");
    var link = location.origin + "/?ref=" + code;
    box.innerHTML = head +
      '<label for="refLink">' + T("Link undanganmu", "Your invite link") + '</label>' +
      '<input id="refLink" type="text" readonly style="opacity:1" value="' + link + '">' +
      '<button class="btn primary" type="button" id="refCopy" style="margin-top:10px">' + T("Salin Link", "Copy Link") + '</button>' +
      '<div class="mst" style="margin-top:14px">' +
      '<div>' + T("Teman aktif", "Active friends") + '<b>' + data.active + ' / ' + data.max_friends + '</b></div>' +
      '<div>Pending<b>' + data.pending + '</b></div></div>' +
      '<p class="note" style="margin-top:10px">' + T("Bonus mining saat ini: ", "Current mining bonus: ") + '+' + data.bonus_percent + '%</p>';
    g("refCopy").onclick = function () {
      var inp = g("refLink");
      var ok = function () { if (window.toast) toast(T("Link disalin", "Link copied")); };
      function fb() { inp.select(); try { document.execCommand("copy"); ok(); } catch (x) {} }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(ok, fb);
      else fb();
    };
  }

  var body = g("profBody");
  if (!body) return;
  /* profil.js menggambar ulang isi profil berkali-kali; sisipkan lagi kartu bila hilang */
  new MutationObserver(function () {
    if (g("pOut") && !g("refBox")) {
      render();
      if (!data || Date.now() - loadedAt > 30000) load();
    }
  }).observe(body, { childList: true });
  if (g("pOut")) { render(); load(); }
})();
