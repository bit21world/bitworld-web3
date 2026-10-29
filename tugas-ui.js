/* BTW-TUGAS-VERSI 4 (menu & halaman Tugas sendiri, bahasa ikut tombol ID/EN, muat lebih cepat)  */
/* Bitworld - kartu "Tugas & Hadiah" (tugas sekali klaim + tugas harian).
   Data: /api/app?a=tasks, /api/app?a=daily (GET) dan POST {a:"task_claim"|"daily_claim", key}. Harus login. */
(function () {
  if (window.__btwTugasUi) return;
  window.__btwTugasUi = true;

  var CARD_ID = 'btw-tugas';
  var tasks = null, daily = null;
  var opened = {};
  var busy = {};
  var timer = null;
  var msg = '';
  var loading = false, loadedOnce = false, lastLoad = 0, retries = 0;
  var MAX_RETRY = 4;
  var CACHE_KEY = 'btw_tugas_cache_v1', CACHE_TTL = 30 * 60 * 1000;
  /* Cache per tab (sessionStorage): kartu langsung tampil dari data terakhir, lalu diperbarui dari server. */
  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.t < CACHE_TTL) { tasks = c.tasks || null; daily = c.daily || null; }
    } catch (e) {}
  }
  function writeCache() {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), tasks: tasks, daily: daily })); } catch (e) {}
  }
  function clearCache() { try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {} }

  var ORIGIN = location.origin;
  var SHARE_TEXT = 'Saya menambang BTW di Bitworld. Gabung sekarang! #Bitworld #BTW';
  var LINKS = {
    tg: 'https://t.me/bitworld_btw',
    x: 'https://x.com/bitworld_btw',
    fb: 'https://www.facebook.com/share/1FKuR8i7rT/',
    /* tugas harian */
    xlike: 'https://x.com/bitworld_btw',   /* ganti dengan link postingan resmi yang ingin di-suka/repost */
    xpost: 'https://x.com/intent/post?text=' + encodeURIComponent(SHARE_TEXT) + '&url=' + encodeURIComponent(ORIGIN),
    fbpost: 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(ORIGIN),
    tgshare: 'https://t.me/share/url?url=' + encodeURIComponent(ORIGIN) + '&text=' + encodeURIComponent(SHARE_TEXT)
  };
  var TITLES = {
    tg: ['Gabung Telegram Bitworld', 'Join the Bitworld Telegram'],
    x: ['Ikuti X (Twitter) Bitworld', 'Follow Bitworld on X'],
    fb: ['Ikuti Facebook Bitworld', 'Follow Bitworld on Facebook'],
    ref3: ['Undang 3 teman aktif', 'Invite 3 active friends'],
    kyc: ['Selesaikan verifikasi KYC', 'Complete KYC verification'],
    mine7: ['Selesaikan 7 sesi mining', 'Complete 7 mining sessions'],
    xlike: ['Suka, repost, dan komentari di X', 'Like, repost and comment on X'],
    xpost: ['Posting tentang Bitworld di X', 'Post about Bitworld on X'],
    fbpost: ['Posting tentang Bitworld di Facebook', 'Post about Bitworld on Facebook'],
    tgshare: ['Bagikan ke komunitas Telegram publik', 'Share to a public Telegram community']
  };
  var ERR = {
    not_met: ['Syarat tugas belum terpenuhi.', 'Requirement not met yet.'],
    mine_first: ['Selesaikan 1 sesi mining dulu, lalu klaim.', 'Finish 1 mining session first, then claim.'],
    already_done: ['Tugas ini sudah diklaim.', 'Already claimed.'],
    pool_empty: ['Pool hadiah sudah habis.', 'The reward pool is empty.'],
    rate_limited: ['Terlalu cepat, coba sebentar lagi.', 'Too fast, try again shortly.'],
    not_logged_in: ['Silakan login dulu.', 'Please log in first.']
  };

  function failed() { return !tasks && !daily && loadedOnce && retries >= MAX_RETRY && !loading; }
  function en() { return typeof window.lang === 'string' ? window.lang === 'en' : false; }
  function tx(pair) { return en() ? pair[1] : pair[0]; }
  function nf(n) { return Number(n || 0).toLocaleString(en() ? 'en-US' : 'id-ID', { maximumFractionDigits: 4 }); }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  function getJson(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function load() {
    if (loading) return Promise.resolve();
    loading = true; lastLoad = Date.now();
    return Promise.all([getJson('/api/app?a=tasks'), getJson('/api/app?a=daily')]).then(function (x) {
      loading = false; loadedOnce = true;
      if (x[0] && x[0].tasks) tasks = x[0].tasks;
      if (x[1] && x[1].tasks) daily = x[1].tasks;
      if (tasks || daily) { retries = 0; writeCache(); }
      else if (retries < MAX_RETRY) { retries++; setTimeout(load, retries * 2000); }
      render();
    });
  }

  function claim(key, isDaily) {
    var bk = (isDaily ? 'd:' : 't:') + key;
    if (busy[bk]) return;
    busy[bk] = true; msg = ''; render();
    fetch('/api/app', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: isDaily ? 'daily_claim' : 'task_claim', key: key })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        busy[bk] = false;
        if (x.ok) {
          msg = (en() ? 'Reward added: +' : 'Hadiah masuk: +') + nf(x.j.reward) + ' BTW';
        } else {
          var e = ERR[x.j && x.j.error];
          msg = e ? tx(e) : (en() ? 'Failed (' : 'Gagal (') + ((x.j && x.j.error) || 'error') + ')';
        }
        load();
      }).catch(function () { busy[bk] = false; msg = en() ? 'Connection problem.' : 'Koneksi bermasalah.'; render(); });
  }

  function btn(label, enabled, onclick) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.disabled = !enabled;
    b.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;cursor:' + (enabled ? 'pointer' : 'default') +
      ';background:' + (enabled ? '#6b5ff0' : '#e8e9f8') + ';color:' + (enabled ? '#fff' : '#9a9fc0');
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }

  function rowFor(t, isDaily) {
    var bk = (isDaily ? 'd:' : 't:') + t.key;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #eceefc';
    var left = document.createElement('div'); left.style.cssText = 'min-width:0;flex:1';
    var title = document.createElement('div'); title.style.cssText = 'font-size:14px;font-weight:600;color:#12142e'; title.textContent = tx(TITLES[t.key] || [t.key, t.key]);
    var sub = document.createElement('div'); sub.style.cssText = 'font-size:12px;color:#8a8fb0;margin-top:2px';
    sub.textContent = '+' + nf(t.reward) + ' BTW' + (!isDaily && t.kind === 'auto' && t.target > 1 ? '  •  ' + t.progress + '/' + t.target : '');
    left.appendChild(title); left.appendChild(sub);
    row.appendChild(left);

    var right = document.createElement('div'); right.style.cssText = 'display:flex;gap:6px;flex-shrink:0';
    var needsOpen = isDaily || t.kind === 'link';
    if (t.done) {
      right.appendChild(btn(en() ? 'Done ✓' : 'Selesai ✓', false));
    } else if (needsOpen) {
      var waited = opened[bk] && (Date.now() - opened[bk] >= 8000);
      right.appendChild(btn(en() ? 'Open' : 'Buka', true, function () {
        window.open(LINKS[t.key], '_blank', 'noopener');
        opened[bk] = Date.now();
        render(); setTimeout(render, 8200);
      }));
      right.appendChild(btn(busy[bk] ? '…' : (en() ? 'Claim' : 'Klaim'), !!waited && !busy[bk], function () { claim(t.key, isDaily); }));
    } else {
      right.appendChild(btn(busy[bk] ? '…' : (en() ? 'Claim' : 'Klaim'), t.progress >= t.target && !busy[bk], function () { claim(t.key, false); }));
    }
    row.appendChild(right);
    return row;
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.id = CARD_ID;
    wrap.style.cssText = 'background:#fff;border-radius:22px;padding:16px 18px;margin:14px auto 0;width:100%;box-sizing:border-box;text-align:left;font-family:inherit;color:#1b1d3a;box-shadow:0 6px 20px rgba(60,60,140,.08)';
    return wrap;
  }

  function heading(text, note) {
    var f = document.createDocumentFragment();
    var h = document.createElement('div'); h.style.cssText = 'font-weight:700;font-size:16px;margin:2px 0 4px;color:#12142e'; h.textContent = text; f.appendChild(h);
    if (note) { var p = document.createElement('div'); p.style.cssText = 'font-size:12px;color:#8a8fb0;margin-bottom:6px'; p.textContent = note; f.appendChild(p); }
    return f;
  }

  function fillCard(wrap) {
    wrap.textContent = '';
    if (failed()) {
      wrap.appendChild(heading(en() ? 'Tasks could not be loaded' : 'Tugas belum bisa dimuat', en() ? 'Log in first, or try again.' : 'Masuk dulu, atau coba lagi.'));
      var rowb = document.createElement('div'); rowb.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
      rowb.appendChild(btn(en() ? 'Log in / Sign up' : 'Masuk / Daftar', true, function () { if (typeof go === 'function') go('auth'); }));
      rowb.appendChild(btn(en() ? 'Try again' : 'Coba lagi', true, function () { retries = 0; load(); render(); }));
      wrap.appendChild(rowb);
      return;
    }
    if (!tasks && !daily) {
      wrap.appendChild(heading(en() ? 'Loading tasks…' : 'Memuat tugas…', en() ? 'Please wait a moment.' : 'Mohon tunggu sebentar.'));
      return;
    }
    if (daily && daily.length) {
      wrap.appendChild(heading(en() ? 'Daily tasks' : 'Tugas harian',
        en() ? 'Resets every day. Rewards come from the community pool.' : 'Direset setiap hari. Hadiah diambil dari pool komunitas.'));
      daily.forEach(function (t) { wrap.appendChild(rowFor(t, true)); });
    }
    if (tasks && tasks.length) {
      var h = heading(en() ? 'Tasks & Rewards' : 'Tugas & Hadiah',
        en() ? 'Each task can be claimed once.' : 'Setiap tugas hanya bisa diklaim sekali.');
      var box = document.createElement('div'); box.style.cssText = 'margin-top:14px'; box.appendChild(h); wrap.appendChild(box);
      tasks.forEach(function (t) { wrap.appendChild(rowFor(t, false)); });
    }
    var m = document.createElement('div'); m.style.cssText = 'font-size:12px;min-height:16px;margin-top:8px;color:#5b52e8'; m.textContent = msg; wrap.appendChild(m);
  }

  /* Kartu dipasang di halaman Tugas (#tgBody) yang dibuat oleh setupTab(). */
  function place() {
    var el = document.getElementById('tgBody');
    return el && visible(el) ? { el: el, mode: 'append' } : null;
  }
  function placed(pl) {
    var card = document.getElementById(CARD_ID);
    if (!card) return false;
    return pl.mode === 'append' ? pl.el.contains(card) : card.previousElementSibling === pl.el;
  }

  function render() {
    if (failed()) clearCache();
    var pl = place();
    if (!pl) return;
    var card = document.getElementById(CARD_ID);
    if (!placed(pl)) {
      if (card) card.remove();
      card = build();
      if (pl.mode === 'append') pl.el.appendChild(card);
      else pl.el.parentNode.insertBefore(card, pl.el.nextSibling);
    }
    fillCard(card);
  }
  function ensure() {
    var pl = place();
    if (pl && !placed(pl)) render();
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(ensure, 300); }

  /* ---------- Menu & halaman "Tugas" ---------- */
  function labelNav() { var b = document.getElementById('n-tugas'); if (b) b.textContent = en() ? 'Tasks' : 'Tugas'; }
  function setupTab() {
    if (document.getElementById('n-tugas')) return;
    var nav = document.querySelector('nav.bottom'), main = document.querySelector('main');
    if (!nav || !main) return;
    var st = document.createElement('style');
    st.textContent =
      'html nav.bottom{grid-template-columns:repeat(5,minmax(0,1fr)) minmax(0,1.35fr)!important;gap:3px!important;padding:8px 5px!important}' +
      '@media (max-width:340px){html nav.bottom button{font-size:9.5px!important}}' +
      'html nav.bottom button{font-size:10.5px!important;padding:10px 0!important;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis}' +
      '#v-tugas{background:#f4f5fb;color:#1b1d3a;justify-content:flex-start}' +
      '.tg-wrap{width:100%;max-width:520px;margin:0 auto;padding-bottom:28px}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'n-tugas'; b.setAttribute('data-go', 'tugas');
    var after = document.getElementById('n-mine');
    nav.insertBefore(b, after ? after.nextSibling : nav.firstChild);
    var v = document.createElement('section');
    v.className = 'view'; v.id = 'v-tugas';
    v.innerHTML = '<div class="tg-wrap" id="tgBody"></div>';
    main.appendChild(v);
    if (typeof VIEWS === 'object') VIEWS.tugas = 'v-tugas';
    labelNav();
    if (typeof go === 'function') {
      var _go = go;
      go = function (n) {
        _go.apply(this, arguments);
        if (n === 'tugas') {
          render();
          if (!loading && Date.now() - lastLoad > 20000) { retries = 0; load(); }
        }
      };
      if (location.hash === '#tugas') go('tugas');
    }
  }

  function start() {
    setupTab();
    readCache();
    if (tasks || daily) render();   /* tampil seketika dari cache */
    load();
    setInterval(load, 60000);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true });
    document.addEventListener('click', function (e) {
      schedule();
      if (e.target && e.target.closest && e.target.closest('#pOut')) { clearCache(); tasks = daily = null; }
      var l = e.target && e.target.closest ? e.target.closest('#lang-id, #lang-en') : null;
      if (l) setTimeout(function () { labelNav(); render(); }, 0);
      if (!tasks && !daily && !loading && Date.now() - lastLoad > 3000) { retries = 0; load(); }
    }, true);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !loading && Date.now() - lastLoad > 3000) load();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
