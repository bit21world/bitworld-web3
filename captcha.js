(function () {
  var TS_SITEKEY = "0x4AAAAAAFjzAz_TOIjrcnA5";
  if (!TS_SITEKEY || TS_SITEKEY.indexOf("ISI_") === 0) return;

  var g = function (id) { return document.getElementById(id); };
  var T = function (a, b) { return window.lang === "en" ? b : a; };
  var tsToken = "", tsWidget = null, capFail = false;
  var PATHS = ["/api/login", "/api/register", "/api/forgot"];

  function resetWidget() {
    tsToken = "";
    try { if (window.turnstile && tsWidget !== null) window.turnstile.reset(tsWidget); } catch (e) {}
  }

  /* tempel token ke permintaan daftar/masuk/lupa password */
  var _fetch = window.fetch;
  window.fetch = function (url, opts) {
    try {
      var u = typeof url === "string" ? url : (url && url.url) || "";
      if (opts && opts.method === "POST" && opts.body && PATHS.indexOf(u.split("?")[0]) > -1) {
        /* widget sudah tampil tapi belum diselesaikan: tolak di sisi klien,
           jangan menghabiskan jatah rate limit server dengan permintaan yang pasti gagal */
        if (tsWidget !== null && g("tsBox") && !tsToken) {
          capFail = true;
          return Promise.resolve(new Response(JSON.stringify({ error: "captcha" }),
            { status: 400, headers: { "Content-Type": "application/json" } }));
        }
        var body = JSON.parse(opts.body);
        body.turnstile = tsToken;
        var o2 = Object.assign({}, opts, { body: JSON.stringify(body) });
        return _fetch.call(window, url, o2).then(function (r) {
          return r.clone().json().then(function (d) {
            if (d && d.error === "captcha") capFail = true;
            resetWidget();
            return r;
          }).catch(function () { resetWidget(); return r; });
        });
      }
    } catch (e) {}
    return _fetch.apply(window, arguments);
  };

  /* tampilkan widget di form masuk/daftar/lupa password.
     - hanya saat halaman akun terlihat (widget di area tersembunyi bisa salah ukuran / tantangan tak terlihat)
     - tidak di form password baru (/api/reset tidak memakai captcha, jadi widget di sana sia-sia) */
  function mount() {
    var v = g("v-auth");
    if (v && !v.classList.contains("active")) return;
    var form = g("aForm"), fb = g("fBtn");
    if (!form || !fb || !g("fEmail") || g("tsBox") || !window.turnstile) return;
    if (tsWidget !== null) { try { window.turnstile.remove(tsWidget); } catch (e) {} tsWidget = null; }
    var box = document.createElement("div");
    box.id = "tsBox";
    box.style.cssText = "margin-top:14px;min-height:65px";
    fb.parentNode.insertBefore(box, fb);
    tsToken = "";
    tsWidget = window.turnstile.render(box, {
      sitekey: TS_SITEKEY, theme: "dark", size: "flexible",
      callback: function (t) { tsToken = t; },
      "expired-callback": function () { tsToken = ""; },
      "error-callback": function () { tsToken = ""; }
    });
  }

  var s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true; s.defer = true; s.onload = mount;
  document.head.appendChild(s);

  var ab = g("authBody"), av = g("v-auth");
  if (ab) new MutationObserver(mount).observe(ab, { childList: true, subtree: true });
  if (av) new MutationObserver(mount).observe(av, { attributes: true, attributeFilter: ["class"] });

  /* pesan yang jelas kalau verifikasi gagal (hanya memantau panel akun, bukan seluruh halaman) */
  if (ab) new MutationObserver(function () {
    if (!capFail) return;
    var m = g("fmsg");
    if (!m || !m.classList.contains("err")) return;
    capFail = false;
    m.textContent = T("Selesaikan verifikasi \"Saya manusia\" dulu, lalu coba lagi.", "Please complete the human verification, then try again.");
  }).observe(ab, { childList: true, attributes: true, characterData: true, subtree: true });
})();
