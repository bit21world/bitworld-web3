/* Bitworld - kartu "Tugas & Hadiah" di dalam panel Mining.
   Data: /api/app?a=tasks (GET) dan /api/app (POST {a:"task_claim", key}). Harus login. */
(function () {
  if (window.__btwTugasUi) return;
  window.__btwTugasUi = true;

  var CARD_ID = 'btw-tugas';
  var tasks = null;
  var opened = {};      // key -> waktu tombol "Buka" ditekan
  var busy = {};
  var timer = null;
  var msg = '';

  var LINKS = {
    tg: 'https://t.me/bitworld_btw',
    x: 'https://x.com/bitworld_btw',
    fb: 'https://www.facebook.com/share/1FKuR8i7rT/'
  };
  var TITLES = {
    tg: ['Gabung Telegram Bitworld', 'Join the Bitworld Telegram'],
    x: ['Ikuti X (Twitter) Bitworld', 'Follow Bitworld on X'],
    fb: ['Ikuti Facebook Bitworld', 'Follow Bitworld on Facebook'],
    ref3: ['Undang 3 teman aktif', 'Invite 3 active friends'],
    kyc: ['Selesaikan verifikasi KYC', 'Complete KYC verification'],
    mine7: ['Selesaikan 7 sesi mining', 'Complete 7 mining sessions']
  };
  var ERR = {
    not_met: ['Syarat tugas belum terpenuhi.', 'Requirement not met yet.'],
    mine_first: ['Selesaikan 1 sesi mining dulu, lalu klaim.', 'Finish 1 mining session first, then claim.'],
    already_done: ['Tugas ini sudah diklaim.', 'Already claimed.'],
    pool_empty: ['Pool hadiah sudah habis.', 'The reward pool is empty.'],
    rate_limited: ['Terlalu cepat, coba sebentar lagi.', 'Too fast, try again shortly.'],
    not_logged_in: ['Silakan login dulu.', 'Please log in first.']
  };

  function en() { return typeof window.lang === 'string' ? window.lang === 'en' : false; }
  function tx(pair) { return en() ? pair[1] : pair[0]; }
  function nf(n) { return Number(n || 0).toLocaleString(en() ? 'en-US' : 'id-ID', { maximumFractionDigits: 4 }); }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }

  function load() {
    return fetch('/api/app?a=tasks', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.tasks) { tasks = j.tasks; render(); } })
      .catch(function () {});
  }

  function claim(key) {
    if (busy[key]) return;
    busy[key] = true; msg = ''; render();
    fetch('/api/app', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 'task_claim', key: key })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        busy[key] = false;
        if (x.ok) {
          msg = (en() ? 'Reward added: +' : 'Hadiah masuk: +') + nf(x.j.reward) + ' BTW';
          // segarkan saldo di aplikasi dengan membuka ulang tab Mining
          var b = document.querySelector('[data-go="mine"]'); if (b) b.click();
        } else {
          var e = ERR[x.j && x.j.error];
          msg = e ? tx(e) : (en() ? 'Failed (' : 'Gagal (') + ((x.j && x.j.error) || 'error') + ')';
        }
        load().then(render);
      }).catch(function () { busy[key] = false; msg = en() ? 'Connection problem.' : 'Koneksi bermasalah.'; render(); });
  }

  function btn(label, enabled, onclick) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.disabled = !enabled;
    b.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;cursor:' + (enabled ? 'pointer' : 'default') +
      ';background:' + (enabled ? 'var(--accent,#f5b82e)' : 'var(--line,rgba(255,255,255,.1))') + ';color:' + (enabled ? '#1a1400' : 'var(--muted,#8a94a8)');
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }

  function rowFor(t) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line,rgba(255,255,255,.1))';
    var left = document.createElement('div'); left.style.cssText = 'min-width:0;flex:1';
    var title = document.createElement('div'); title.style.cssText = 'font-size:14px;font-weight:600'; title.textContent = tx(TITLES[t.key] || [t.key, t.key]);
    var sub = document.createElement('div'); sub.style.cssText = 'font-size:12px;color:var(--muted,#8a94a8);margin-top:2px';
    sub.textContent = '+' + nf(t.reward) + ' BTW' + (t.kind === 'auto' && t.target > 1 ? '  •  ' + t.progress + '/' + t.target : '');
    left.appendChild(title); left.appendChild(sub);
    row.appendChild(left);

    var right = document.createElement('div'); right.style.cssText = 'display:flex;gap:6px;flex-shrink:0';
    if (t.done) {
      right.appendChild(btn(en() ? 'Done ✓' : 'Selesai ✓', false));
    } else if (t.kind === 'link') {
      var waited = opened[t.key] && (Date.now() - opened[t.key] >= 8000);
      right.appendChild(btn(en() ? 'Open' : 'Buka', true, function () {
        window.open(LINKS[t.key], '_blank', 'noopener');
        opened[t.key] = Date.now();
        render(); setTimeout(render, 8200);
      }));
      right.appendChild(btn(busy[t.key] ? '…' : (en() ? 'Claim' : 'Klaim'), !!waited && !busy[t.key], function () { claim(t.key); }));
    } else {
      right.appendChild(btn(busy[t.key] ? '…' : (en() ? 'Claim' : 'Klaim'), t.progress >= t.target && !busy[t.key], function () { claim(t.key); }));
    }
    row.appendChild(right);
    return row;
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.id = CARD_ID;
    wrap.style.cssText = 'background:var(--card,#fff);border:1px solid var(--line,rgba(0,0,0,.08));border-radius:16px;padding:16px 18px;margin:14px auto 0;width:100%;max-width:460px;box-sizing:border-box;text-align:left;font-family:inherit;color:var(--fg,#1f2040)';
    return wrap;
  }

  function fillCard(wrap) {
    wrap.textContent = '';
    var h = document.createElement('div'); h.style.cssText = 'font-weight:700;font-size:16px;margin-bottom:4px';
    h.textContent = en() ? 'Tasks & Rewards' : 'Tugas & Hadiah'; wrap.appendChild(h);
    var p = document.createElement('div'); p.style.cssText = 'font-size:12px;color:var(--muted,#8a94a8);margin-bottom:6px';
    p.textContent = en() ? 'Each task can be claimed once. Rewards come from the community pool.' : 'Setiap tugas hanya bisa diklaim sekali. Hadiah diambil dari pool komunitas.';
    wrap.appendChild(p);
    (tasks || []).forEach(function (t) { wrap.appendChild(rowFor(t)); });
    var m = document.createElement('div'); m.style.cssText = 'font-size:12px;min-height:16px;margin-top:8px;color:var(--accent,#d4a006)'; m.textContent = msg; wrap.appendChild(m);
  }

  function render() {
    if (!tasks) return;
    var host = document.querySelector('#mineBody');
    if (!host || !visible(host)) return;
    var card = document.getElementById(CARD_ID);
    if (!card || !host.contains(card)) { if (card) card.remove(); card = build(); host.appendChild(card); }
    fillCard(card);
  }

  function ensure() {
    var host = document.querySelector('#mineBody');
    if (!host || !visible(host) || !tasks) return;
    var card = document.getElementById(CARD_ID);
    if (!card || !host.contains(card)) render();
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
