/* Menu Settings / Pengaturan (add-on): pilih bahasa, disimpan di browser. */
(function () {
  "use strict";
  var g = function (id) { return document.getElementById(id); };
  var L = function () { return window.lang === "id" ? "id" : "en"; };
  var T = function (id, en) { return L() === "id" ? id : en; };

  var main = document.querySelector("main");
  if (!main || !window.VIEWS) return;

  var st = document.createElement("style");
  st.textContent = ":where(#n-settings){font:inherit;font-weight:600;cursor:pointer;padding:10px 12px;border:1px solid rgba(88,76,214,.14);border-radius:12px;background:#f1f7ff;color:#5b5f86}" +
    ".langopt{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:10px;padding:14px 16px;font:inherit;font-weight:700;cursor:pointer;border-radius:14px;border:1.5px solid rgba(128,128,160,.35);background:transparent;color:inherit}" +
    ".langopt.on{border-color:#f5b82e;box-shadow:0 0 0 2px rgba(245,184,46,.25)}";
  document.head.appendChild(st);

  var v = document.createElement("section");
  v.className = "view"; v.id = "v-settings";
  main.appendChild(v);
  window.VIEWS.settings = "v-settings";

  function render() {
    var b = L() === "en" ? " on" : "", i = L() === "id" ? " on" : "";
    v.innerHTML = '<div class="panel" style="margin:0"><h2>' + T("Pengaturan", "Settings") + '</h2>' +
      '<p class="sub">' + T("Pilih bahasa tampilan. Pilihan disimpan di browser ini.", "Choose the display language. Your choice is saved in this browser.") + '</p>' +
      '<button type="button" class="langopt' + b + '" data-l="en"><span>English</span><span>' + (b ? "✓" : "") + '</span></button>' +
      '<button type="button" class="langopt' + i + '" data-l="id"><span>Bahasa Indonesia</span><span>' + (i ? "✓" : "") + '</span></button>' +
      '<p class="note" style="margin-top:14px">' + T("Bahasa lain akan ditambahkan nanti.", "More languages will be added later.") + '</p></div>';
    Array.prototype.forEach.call(v.querySelectorAll(".langopt"), function (el) {
      el.onclick = function () {
        var x = g("lang-" + el.getAttribute("data-l")); if (x) x.click();
      };
    });
  }

  var btn = document.createElement("button");
  btn.type = "button"; btn.id = "n-settings"; btn.setAttribute("data-go", "settings");
  function place() {
    var host = g("navDrawer") || document.querySelector("nav.bottom");
    if (!host) return;
    btn.textContent = T("Pengaturan", "Settings");
    if (btn.parentNode !== host) host.appendChild(btn);
  }
  place(); render();
  var n = 0, iv = setInterval(function () { place(); if (++n > 40) clearInterval(iv); }, 500);
  ["lang-id", "lang-en"].forEach(function (id) {
    var el = g(id);
    if (el) el.addEventListener("click", function () { setTimeout(function () { render(); place(); }, 0); });
  });
})();
