/* Bitworld - kartu Pool Mining (Komunitas 10.500.000 BTW) + info Halving.
   Data dari /api/app?a=pool (harus login). Ditaruh di dalam panel Mining (#mineBody) dan Token (#tokenBody).
   Warna mengikuti tema aplikasi (variabel CSS --card, --fg, --muted, --line, --accent). */
(function () {
  if (window.__btwPoolUi) return;
  window.__btwPoolUi = true;

  var data = null;
  var timer = null;

  /* sel = panel tujuan (kartu ditaruh di dalamnya, paling bawah).
     texts = cadangan untuk versi tampilan lain: kartu ditaruh setelah kartu yang memuat teks itu. */
  var ANCHORS = [
    { id: 'btw-pool-mining', sel: '#mnBody', texts: ['Durasi sesi', 'Session length', 'Session duration'] },
    { id: 'btw-pool-token', sel: '#tokenBody', texts: ['Tokenomics'] }
  ];

  function isEn() {
    if (typeof window.lang === 'string') return window.lang === 'en';
    return (document.documentElement.lang || '').toLowerCase().indexOf('en') === 0;
  }
  function nf(n, d) { return Number(n || 0).toLocaleString(isEn() ? 'en-US' : 'id-ID', { maximumFractionDigits: d == null ? 2 : d }); }
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

  function row(l, v, valStyle) {
    return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;font-size:14px"><span data-k="' + l + '" style="color:var(--muted,#6b6f9a)"></span><b data-k="' + v + '"' + (valStyle ? ' style="' + valStyle + '"' : '') + '></b></div>';
  }

  function build(id) {
    var wrap = document.createElement('div');
    wrap.id = id;
    wrap.style.cssText = 'background:var(--card,#fff);border:1px solid var(--line,rgba(0,0,0,.08));border-radius:16px;padding:16px 18px;margin:14px auto 0;width:100%;max-width:460px;box-sizing:border-box;text-align:left;font-family:inherit;color:var(--fg,#1f2040)';
    wrap.innerHTML =
      '<div data-k="title" style="font-weight:700;font-size:16px;margin-bottom:10px"></div>' +
      '<div style="height:10px;border-radius:999px;background:var(--line,#e3e5f8);overflow:hidden">' +
        '<div data-k="bar" style="height:100%;width:0%;border-radius:999px;background:var(--accent,#f5b82e);transition:width .6s"></div></div>' +
      '<div data-k="pct" style="margin:8px 0 10px;font-size:12px;color:var(--muted,#6b6f9a)"></div>' +
      row('l1', 'v1') + row('l2', 'v2') + row('l3', 'v3', 'color:var(--accent,#d4a006)') +
      '<div data-k="hv" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#e3e5f8)">' +
        '<div data-k="htitle" style="font-weight:700;font-size:14px;margin-bottom:4px"></div>' +
        row('l4', 'v4') + row('l5', 'v5') + row('l6', 'v6') +
      '</div>';
    return wrap;
  }

  function fill(wrap) {
    if (!data) return;
    var en = isEn();
    function s(k, t) { var e = wrap.querySelector('[data-k="' + k + '"]'); if (e) e.textContent = t; }
    s('title', en ? 'Community Mining Pool' : 'Pool Mining Komunitas');
    s('l1', 'Total pool');
    s('l2', en ? 'Distributed' : 'Sudah dibagikan');
    s('l3', en ? 'Remaining' : 'Sisa pool');
    s('v1', nf(data.total, 0) + ' BTW');
    s('v2', nf(data.used, 4) + ' BTW');
    s('v3', nf(data.remaining, 4) + ' BTW');
    var p = Number(data.percent) || 0;
    s('pct', nf(p, 4) + '% ' + (en ? 'distributed' : 'terpakai'));
    var bar = wrap.querySelector('[data-k="bar"]');
    if (bar) bar.style.width = Math.max(p, p > 0 ? 1 : 0) + '%';

    /* Halving: tampil hanya jika server mengirim data.halving */
    var h = data.halving;
    var hv = wrap.querySelector('[data-k="hv"]');
    if (hv) hv.style.display = h ? 'block' : 'none';
    if (h) {
      s('htitle', 'Halving');
      s('l4', en ? 'Mining era' : 'Era mining');
      s('v4', h.era + ' / ' + h.eras);
      s('l5', en ? 'Current rate' : 'Rate saat ini');
      s('v5', nf(h.rate, 4) + ' BTW / ' + (en ? 'hr' : 'jam'));
      s('l6', en ? 'Next halving in' : 'Halving berikutnya');
      s('v6', h.untilNext == null ? (en ? 'Final era' : 'Era terakhir') : nf(h.untilNext, 0) + ' BTW');
    }
  }

  function ensure() {
    if (!data) return;
    ANCHORS.forEach(function (a) {
      var existing = document.getElementById(a.id);
      var host = a.sel ? document.querySelector(a.sel) : null;

      if (host && visible(host)) {
        if (existing && host.contains(existing)) { fill(existing); return; }
        if (existing) existing.remove();
        var w = build(a.id);
        host.appendChild(w);
        fill(w);
        return;
      }
      if (host) return; /* panel ada tapi sedang tersembunyi */

      /* cadangan: tampilan tanpa panel tersebut */
      if (existing && visible(existing)) { fill(existing); return; }
      if (existing) existing.remove();
      var leaf = findLeaf(a.texts || []);
      if (!leaf) return;
      var card = cardOf(leaf);
      if (!card || !card.parentNode) return;
      var w2 = build(a.id);
      card.parentNode.insertBefore(w2, card.nextSibling);
      fill(w2);
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
