/* BTW-TUGAS-VERSI 4 (menu & halaman Tugas sendiri, bahasa ikut tombol ID/EN, muat lebih cepat)  */
/* Bitworld - kartu "Tugas & Hadiah" (tugas sekali klaim + tugas harian).
   Data: /api/app?a=tasks, /api/app?a=daily (GET) dan POST {a:"task_claim"|"daily_claim", key}. Harus login. */
(function () {
  if (window.__btwTugasUi) return;
  window.__btwTugasUi = true;

  var CARD_ID = 'btw-tugas';
  var tasks = null, daily = null;
  var opened = {};
  var proofVal = {};
  var STATE_KEY = 'btw_tugas_state_v1';
  function saveState() { try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ o: opened, p: proofVal })); } catch (e) {} }
  function readState() {
    try { var c = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null'); if (c) { opened = c.o || {}; proofVal = c.p || {}; } } catch (e) {}
  }
  /* Tugas yang wajib melampirkan tautan postingan sebagai bukti */
  var X_RE = /^https:\/\/(www\.|mobile\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}(\/\S*)?(\?\S*)?$/i;
  var PROOF = {
    xlike:  { re: X_RE, ex: 'https://x.com/namaakun/status/1234567890' },
    xpost:  { re: X_RE, ex: 'https://x.com/namaakun/status/1234567890' },
    fbpost: { re: /^https:\/\/((www|m|web)\.)?(facebook\.com|fb\.com)\/\S{6,}$|^https:\/\/fb\.watch\/\S+$/i, ex: 'https://www.facebook.com/namaakun/posts/123456' },
    tgshare:{ re: /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/\d+(\?\S*)?$/i, ex: 'https://t.me/namagrup/123' }
  };
  function validProof(key, v) {
    v = (v || '').trim();
    return !!(PROOF[key] && v.length <= 300 && PROOF[key].re.test(v));
  }
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
    tggroup: 'https://t.me/+c_VWbTwxnlAwZTc9',
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
    tggroup: ['Gabung Grup Telegram Bitworld', 'Join the Bitworld Telegram Group'],
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
    not_logged_in: ['Silakan login dulu.', 'Please log in first.'],
    proof_required: ['Tempelkan tautan postingan Anda dulu.', 'Paste your post link first.'],
    invalid_proof: ['Tautan bukti tidak valid.', 'The proof link is not valid.'],
    proof_used: ['Tautan ini sudah pernah dipakai.', 'This link has already been used.'],
    pending: ['Bukti diterima, menunggu pengecekan.', 'Proof received, pending review.']
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

  function claim(key, isDaily, proof) {
    var bk = (isDaily ? 'd:' : 't:') + key;
    if (busy[bk]) return;
    busy[bk] = true; msg = ''; render();
    fetch('/api/app', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof ? { a: isDaily ? 'daily_claim' : 'task_claim', key: key, proof: proof } : { a: isDaily ? 'daily_claim' : 'task_claim', key: key })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        busy[bk] = false;
        if (x.ok) {
          msg = (en() ? 'Reward added: +' : 'Hadiah masuk: +') + nf(x.j.reward) + ' BTW';
          delete proofVal[bk]; delete opened[bk]; saveState();
        } else {
          var e = ERR[x.j && x.j.error];
          msg = e ? tx(e) : (en() ? 'Failed (' : 'Gagal (') + ((x.j && x.j.error) || 'error') + ')';
        }
        load();
      }).catch(function () { busy[bk] = false; msg = en() ? 'Connection problem.' : 'Koneksi bermasalah.'; render(); });
  }

  function styleBtn(b, enabled) {
    b.disabled = !enabled;
    b.style.cssText = 'border:0;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;cursor:' + (enabled ? 'pointer' : 'default') +
      ';background:' + (enabled ? '#6b5ff0' : '#e8e9f8') + ';color:' + (enabled ? '#fff' : '#9a9fc0');
  }
  function btn(label, enabled, onclick) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    styleBtn(b, enabled);
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
    var extraBox = null;
    var needsOpen = isDaily || t.kind === 'link';
    if (t.done) {
      right.appendChild(btn(en() ? 'Done ✓' : 'Selesai ✓', false));
    } else if (needsOpen) {
      var needProof = isDaily && !!PROOF[t.key];
      var waited = opened[bk] && (Date.now() - opened[bk] >= 8000);
      var canClaim = needProof ? (!!opened[bk] && validProof(t.key, proofVal[bk])) : !!waited;
      right.appendChild(btn(en() ? 'Open' : 'Buka', true, function () {
        window.open(LINKS[t.key], '_blank', 'noopener');
        opened[bk] = Date.now(); saveState();
        render(); if (!needProof) setTimeout(render, 8200);
      }));
      var cb = btn(busy[bk] ? '…' : (en() ? 'Claim' : 'Klaim'), canClaim && !busy[bk], function () {
        claim(t.key, isDaily, needProof ? (proofVal[bk] || '').trim() : undefined);
      });
      if (!needProof) right.appendChild(cb);
      if (needProof && opened[bk]) {
        row.style.flexWrap = 'wrap';
        var box = document.createElement('div'); box.style.cssText = 'flex-basis:100%;margin-top:2px';
        var lab = document.createElement('div'); lab.style.cssText = 'font-size:12px;color:#8a8fb0;margin-bottom:6px';
        lab.textContent = en() ? 'Paste the link to your post as proof, then press Send.' : 'Tempel tautan postingan Anda sebagai bukti, lalu tekan Kirim.';
        var inp = document.createElement('input');
        inp.type = 'url'; inp.inputMode = 'url'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.maxLength = 300;
        inp.placeholder = PROOF[t.key].ex; inp.value = proofVal[bk] || ''; inp.setAttribute('aria-label', lab.textContent);
        inp.style.cssText = 'flex:1;min-width:0;box-sizing:border-box;padding:10px 12px;border:1px solid #d9dcf3;border-radius:10px;font:inherit;font-size:16px;color:#12142e;background:#fff';
        var sb = btn(busy[bk] ? '…' : (en() ? 'Send' : 'Kirim'), canClaim && !busy[bk], function () {
          claim(t.key, isDaily, (proofVal[bk] || '').trim());
        });
        var line = document.createElement('div'); line.style.cssText = 'display:flex;gap:8px;align-items:center';
        line.appendChild(inp); line.appendChild(sb);
        var er = document.createElement('div'); er.style.cssText = 'font-size:12px;color:#c0392b;min-height:14px;margin-top:4px';
        inp.addEventListener('input', function () {
          proofVal[bk] = inp.value; saveState();
          var ok = validProof(t.key, inp.value);
          styleBtn(sb, ok && !busy[bk]);
          er.textContent = (!inp.value.trim() || ok) ? '' : (en() ? 'The link does not look right. Example: ' : 'Tautan belum sesuai. Contoh: ') + PROOF[t.key].ex;
        });
        box.appendChild(lab); box.appendChild(line); box.appendChild(er);
        extraBox = box;
      }
    } else {
      right.appendChild(btn(busy[bk] ? '…' : (en() ? 'Claim' : 'Klaim'), t.progress >= t.target && !busy[bk], function () { claim(t.key, false); }));
    }
    row.appendChild(right);
    if (extraBox) row.appendChild(extraBox);
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
    var ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT' && card.contains(ae)) return;   /* jangan ganggu saat mengetik */
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
    readCache(); readState();
    if (tasks || daily) render();   /* tampil seketika dari cache */
    load();
    setInterval(load, 60000);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true });
    document.addEventListener('click', function (e) {
      schedule();
      if (e.target && e.target.closest && e.target.closest('#pOut')) { clearCache(); try { sessionStorage.removeItem(STATE_KEY); } catch (e) {} tasks = daily = null; opened = {}; proofVal = {}; }
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

/* BTW-KLAIM-VERSI 1 - kartu "Klaim ke Dompet" (BSC). Dipasang di halaman Tugas (#tgBody).
   API: /api/app?a=claim_status (GET), POST {a:"wallet_link"|"claim_voucher"}. Sembunyi sendiri jika klaim belum aktif di server. */
(function () {
  if (window.__btwKlaimUi) return;
  window.__btwKlaimUi = true;

  var CARD = 'btw-klaim';
  var st = null, msg = '', busy = false, timer = null, lastLoad = 0;

  function en() { return typeof window.lang === 'string' ? window.lang === 'en' : false; }
  function tx(p) { return en() ? p[1] : p[0]; }
  function nf(n) { return Number(n || 0).toLocaleString(en() ? 'en-US' : 'id-ID', { maximumFractionDigits: 4 }); }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); }
  function short(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

  var ERR = {
    kyc_required: ['Selesaikan verifikasi KYC dulu.', 'Complete KYC verification first.'],
    wallet_required: ['Hubungkan dompet dulu.', 'Connect your wallet first.'],
    below_min: ['Saldo belum mencapai batas minimal klaim.', 'Balance is below the minimum claim.'],
    insufficient: ['Saldo tidak cukup.', 'Insufficient balance.'],
    voucher_active: ['Masih ada klaim yang belum diselesaikan.', 'You have an unfinished claim.'],
    wallet_used: ['Dompet ini sudah dipakai akun lain.', 'This wallet is already used by another account.'],
    bad_signature: ['Tanda tangan dompet tidak cocok.', 'Wallet signature does not match.'],
    rate_limited: ['Terlalu cepat, coba lagi sebentar.', 'Too fast, try again shortly.'],
    claim_not_ready: ['Klaim belum aktif.', 'Claim is not active yet.'],
    server: ['Server sedang bermasalah, coba lagi.', 'Server problem, try again.'],
    no_wallet: ['Buka situs ini di browser dompet (Trust Wallet, MetaMask, atau Binance).', 'Open this site in a wallet browser (Trust Wallet, MetaMask or Binance).'],
    rejected: ['Dibatalkan di dompet.', 'Cancelled in wallet.'],
    failed: ['Transaksi gagal. Pastikan ada BNB untuk biaya gas.', 'Transaction failed. Make sure you have BNB for gas.']
  };
  function errMsg(code) { return tx(ERR[code] || ERR.server); }

  function api(body) {
    return fetch('/api/app', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.__ok = r.ok; return j; }); })
      .catch(function () { return { __ok: false, error: 'server' }; });
  }
  function load() {
    lastLoad = Date.now();
    return fetch('/api/app?a=claim_status', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { st = j; render(); })
      .catch(function () {});
  }

  /* ---------- dompet ---------- */
  function eth() { return window.ethereum || null; }
  function hexChain() { return '0x' + Number(st.chainId).toString(16); }
  function ensureChain() {
    var e = eth();
    return e.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexChain() }] }).catch(function (err) {
      if (err && err.code === 4902) {
        var test = Number(st.chainId) === 97;
        return e.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: hexChain(), chainName: test ? 'BSC Testnet' : 'BNB Smart Chain',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: [test ? 'https://data-seed-prebsc-1-s1.binance.org:8545' : 'https://bsc-dataseed.binance.org'],
          blockExplorerUrls: [test ? 'https://testnet.bscscan.com' : 'https://bscscan.com']
        }] });
      }
      throw err;
    });
  }
  function account() { return eth().request({ method: 'eth_requestAccounts' }).then(function (a) { return a[0]; }); }
  function fail(e) {
    busy = false;
    msg = e && (e.code === 4001 || e.code === 'ACTION_REJECTED') ? errMsg('rejected') : (e && e.__code ? errMsg(e.__code) : errMsg('failed'));
    render();
  }

  function connect() {
    if (busy) return;
    if (!eth()) { msg = errMsg('no_wallet'); render(); return; }
    busy = true; msg = ''; render();
    var addr;
    account().then(function (a) {
      addr = a;
      var ts = Date.now();
      var text = 'Hubungkan dompet ke Bitworld\nAkun: ' + st.uid + '\nWaktu: ' + ts;
      return eth().request({ method: 'personal_sign', params: [text, addr] }).then(function (sig) {
        return api({ a: 'wallet_link', address: addr, ts: ts, sig: sig });
      });
    }).then(function (j) {
      busy = false;
      if (!j.__ok) { msg = errMsg(j.error); render(); return; }
      msg = tx(['Dompet terhubung.', 'Wallet connected.']);
      load();
    }).catch(fail);
  }

  function waitReceipt(hash, tries) {
    return eth().request({ method: 'eth_getTransactionReceipt', params: [hash] }).then(function (r) {
      if (r) return r;
      if (tries <= 0) return null;
      return new Promise(function (ok) { setTimeout(ok, 3000); }).then(function () { return waitReceipt(hash, tries - 1); });
    });
  }
  function sendClaim(v) {
    var from;
    return account().then(function (a) {
      from = a;
      if (st.wallet && a.toLowerCase() !== st.wallet.toLowerCase()) { var e = new Error('x'); e.__code = 'wallet_mismatch'; throw e; }
      return ensureChain();
    }).then(function () {
      return eth().request({ method: 'eth_sendTransaction', params: [{ from: from, to: st.pool, data: v.data }] });
    }).then(function (hash) {
      msg = tx(['Transaksi dikirim, menunggu konfirmasi…', 'Transaction sent, waiting for confirmation…']); render();
      return waitReceipt(hash, 40);
    }).then(function (rc) {
      busy = false;
      if (rc && rc.status === '0x0') { msg = errMsg('failed'); render(); return; }
      msg = rc ? tx(['Klaim berhasil. Token masuk ke dompet Anda.', 'Claim successful. Tokens sent to your wallet.'])
               : tx(['Transaksi masih diproses, cek lagi sebentar lagi.', 'Transaction still pending, check again shortly.']);
      load();
    });
  }
  function claim() {
    if (busy) return;
    if (!eth()) { msg = errMsg('no_wallet'); render(); return; }
    busy = true; msg = ''; render();
    var p = st.voucher ? Promise.resolve({ __ok: true, voucher: st.voucher }) : api({ a: 'claim_voucher' });
    p.then(function (j) {
      if (!j.__ok) { busy = false; msg = errMsg(j.error); render(); return; }
      return sendClaim(j.voucher);
    }).catch(function (e) {
      if (e && e.__code === 'wallet_mismatch') { busy = false; msg = tx(['Pakai dompet yang terhubung di akun: ', 'Use the wallet linked to your account: ']) + short(st.wallet); render(); load(); return; }
      fail(e); load();
    });
  }

  /* ---------- tampilan ---------- */
  function styleBtn(b, on) {
    b.disabled = !on;
    b.style.cssText = 'border:0;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;font-weight:700;width:100%;cursor:' + (on ? 'pointer' : 'default') +
      ';background:' + (on ? '#6b5ff0' : '#e8e9f8') + ';color:' + (on ? '#fff' : '#9a9fc0');
  }
  function build() {
    var c = document.createElement('div'); c.id = CARD;
    c.style.cssText = 'background:#fff;border-radius:22px;padding:16px 18px;margin:14px auto 0;width:100%;box-sizing:border-box;text-align:left;font-family:inherit;color:#1b1d3a;box-shadow:0 6px 20px rgba(60,60,140,.08)';
    return c;
  }
  function line(txt, css) { var d = document.createElement('div'); d.style.cssText = css; d.textContent = txt; return d; }
  function fill(c) {
    c.textContent = '';
    c.appendChild(line(tx(['Klaim ke Dompet', 'Claim to Wallet']), 'font-size:17px;font-weight:700;color:#12142e'));
    c.appendChild(line(tx(['Tarik saldo BTW ke dompet BSC Anda. Biaya gas sedikit BNB.', 'Withdraw your BTW balance to your BSC wallet. Gas needs a little BNB.']), 'font-size:12px;color:#8a8fb0;margin:2px 0 12px'));
    c.appendChild(line(tx(['Saldo: ', 'Balance: ']) + nf(st.balance) + ' BTW', 'font-size:15px;font-weight:600;margin-bottom:4px'));
    c.appendChild(line(st.wallet ? tx(['Dompet: ', 'Wallet: ']) + short(st.wallet) : tx(['Dompet belum terhubung.', 'No wallet linked yet.']), 'font-size:13px;color:#5d628a;margin-bottom:12px'));

    var b;
    if (!st.wallet) {
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : tx(['Hubungkan Dompet', 'Connect Wallet']);
      styleBtn(b, !busy); b.addEventListener('click', connect);
    } else if (st.voucher) {
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : tx(['Selesaikan Klaim', 'Finish Claim']);
      styleBtn(b, !busy); b.addEventListener('click', claim);
    } else {
      var can = st.kyc === 'approved' && st.balance >= st.min && !busy;
      var label = st.kyc !== 'approved' ? tx(['Selesaikan KYC untuk klaim', 'Complete KYC to claim'])
        : st.balance < st.min ? tx(['Minimal klaim ', 'Minimum claim ']) + nf(st.min) + ' BTW'
        : tx(['Klaim ', 'Claim ']) + nf(Math.min(st.balance, st.max)) + ' BTW';
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : label;
      styleBtn(b, can); b.addEventListener('click', claim);
    }
    c.appendChild(b);
    c.appendChild(line(msg, 'font-size:12px;min-height:16px;margin-top:8px;color:#5b52e8'));
  }
  function render() {
    if (!st) return;
    var host = document.getElementById('tgBody');
    if (!host || !visible(host)) return;
    var c = document.getElementById(CARD);
    var sig = JSON.stringify([st, msg, busy, en()]);
    if (c && host.contains(c) && c.getAttribute('data-sig') === sig) return;   /* tidak berubah: jangan gambar ulang (cegah loop observer) */
    if (!c || !host.contains(c)) { if (c) c.remove(); c = build(); host.appendChild(c); }
    c.setAttribute('data-sig', sig);
    fill(c);
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(function () { if (!st || Date.now() - lastLoad > 20000) load(); else render(); }, 300); }

  function start() {
    load();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', function (e) {
      var l = e.target && e.target.closest ? e.target.closest('#lang-id, #lang-en') : null;
      if (l) setTimeout(render, 0);
      schedule();
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
