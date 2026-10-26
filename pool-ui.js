/* Bitworld - tampilan Pool Mining (Komunitas 10.500.000 BTW).
   Mengambil data dari /api/app?a=pool (harus login) dan menaruh kartu di tab Mining & Token. */
(function () {
  if (window.__btwPoolUi) return;
  window.__btwPoolUi = true;

  var data = null;
  var timer = null;

  var ANCHORS = [
    { id: 'btw-pool-mining', texts: ['Durasi sesi', 'Session duration'] },
    { id: 'btw-pool-token', texts: ['Tokenomics'] }
  ];

  function isEn() {
    if (typeof window.lang === 'string') return window.lang === 'en';
    return (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  }
  function nf(n, d) { return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: d == null ? 2 : d }); }

  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  function findLeaf(texts) {
    var all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n.children.length) continue;
      var t = (n.textContent || '').trim();
      if (texts.indexOf(t) !== -1 && visible(n)) return n;
    }
    return null;
  }

  function cardOf(leaf) {
    var n = leaf;
    for (var i = 0; i < 9 && n && n !== document.body; i++) {
      var cs = getComputedStyle(n);
      var r = parseFloat(cs.borderTopLeftRadius) || 0;
      var bg = cs.backgroundColor;
      if (r >= 16 && bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return n;
      n = n.parentElement;
    }
    return null;
  }

  function build(id) {
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.style.cssText = 'background:#fff;border-radius:28px;padding:20px 22px;margin:16px 0;box-shadow:0 8px 24px rgba(99,102,241,.10);font-family:inherit;color:#1f2040';
    wrap.innerHTML =
      '<div data-k="title" style="font-weight:800;font-size:18px;margin-bottom:12px"></div>' +
      '<div style="height:12px;border-radius:999px;background:#e3e5f8;overflow:hidden">' +
        '<div data-k="bar" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#f5b82e,#d4a006);transition:width .6s"></div></div>' +
      '<div data-k="pct" style="margin:8px 0 12px;font-size:13px;color:#6b6f9a"></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span data-k="l1" style="color:#6b6f9a"></span><b data-k="v1"></b></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span data-k="l2" style="color:#6b6f9a"></span><b data-k="v2"></b></div>' +
      '<div style="display:flex;justify-content:space-between;padding:6px 0"><span data-k="l3" style="color:#6b6f9a"></span><b data-k="v3" style="color:#d4a006"></b></div>';
    return wrap;
  }

  function fill(wrap) {
    if (!data) return;
    var en = isEn();
    function s(k, t) { var e = wrap.querySelector('[data-k="' + k + '"]'); if (e) e.textContent = t; }
    s('title', en ? 'Community Mining Pool' : 'Pool Mining Komunitas');
    s('l1', en ? 'Total pool' : 'Total pool');
    s('l2', en ? 'Distributed' : 'Sudah dibagikan');
    s('l3', en ? 'Remaining' : 'Sisa pool');
    s('v1', nf(data.total, 0) + ' BTW');
    s('v2', nf(data.used, 4) + ' BTW');
    s('v3', nf(data.remaining, 4) + ' BTW');
    var p = Number(data.percent) || 0;
    s('pct', nf(p, 4) + '% ' + (en ? 'distributed' : 'terpakai'));
    var bar = wrap.querySelector('[data-k="bar"]');
    if (bar) bar.style.width = Math.max(p, p > 0 ? 1 : 0) + '%';
  }

  function ensure() {
    if (!data) return;
    ANCHORS.forEach(function (a) {
      var existing = document.getElementById(a.id);
      if (existing && visible(existing)) { fill(existing); return; }
      if (existing) existing.remove();
      var leaf = findLeaf(a.texts);
      if (!leaf) return;
      var card = cardOf(leaf);
      if (!card || !card.parentNode) return;
      var w = build(a.id);
      card.parentNode.insertBefore(w, card.nextSibling);
      fill(w);
    });
  }

  function load() {
    fetch('/api/app?a=pool', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && typeof j.total !== 'undefined') { data = j; ensure(); } })
      .catch(function () {});
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(ensure, 300); }

  function start() {
    load();
    setInterval(load, 60000);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true });
    document.addEventListener('click', schedule, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
