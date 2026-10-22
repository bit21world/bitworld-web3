/* Bitworld auth layer v2.2 (+KYC): login/daftar, proteksi Ambassador & Mining,
   profil pengguna, saldo mining, dan perbaikan posisi tampilan.
   Perbaikan v2.1:
   - UI dibuat setelah DOM siap (tidak crash walau script dimuat di <head>)
   - Error setelah login tidak lagi disamarkan jadi "kesalahan jaringan"
   - Jembatan /api/auth lebih longgar (semua /api/auth..., field username/email/user)
   - Tanggal bergabung membaca created_at atau joined
*/
(function () {
  if (window.__bitworldAuth) return;
  window.__bitworldAuth = true;

  var FIX_LAYOUT = true; // ubah ke false kalau mau mematikan perbaikan posisi tampilan
  var PROTECTED = /^[^a-z]*(ambassador|mining)\s*$/i;
  var user = null, prof = null, mode = 'login', pending = null;
  var btn = null, ov = null, pv = null, kv = null, kyc = null, minePanel = null, fixTimer = null;

  var ERR = {
    username_taken: 'Username sudah dipakai.',
    invalid_username: 'Username harus 3-24 karakter: huruf, angka, _ . -',
    invalid_wallet: 'Format wallet tidak valid (0x + 40 karakter).',
    invalid_name: 'Nama wajib diisi (maks. 60 karakter).',
    invalid_credentials: 'Username atau password salah.',
    bad_credentials: 'Username atau password salah.',
    username_invalid: 'Username harus 3-24 karakter: huruf, angka, _ . -',
    password_short: 'Password minimal 8 karakter.',
    name_required: 'Nama wajib diisi.',
    wallet_invalid: 'Format wallet tidak valid (0x + 40 karakter).',
    not_logged_in: 'Silakan login dulu.',
    unknown_route: 'Endpoint tidak ditemukan.',
    server_error: 'Terjadi kesalahan server. Coba lagi.'
  };
  var MERR = {
    daily_limit: 'Batas mining harian tercapai. Coba lagi besok.',
    not_finished: 'Sesi belum selesai.',
    claim_first: 'Klaim sesi sebelumnya dulu.',
    no_session: 'Belum ada sesi mining.',
    pool_empty: 'Pool reward sudah habis.',
    not_logged_in: 'Silakan login dulu.'
  };
  var STAGES = [['Genesis', 0.12], ['Halving I', 0.06], ['Halving II', 0.03], ['Halving III', 0.015]];

  /* ---------- Jembatan: form login bawaan situs (/api/auth) diarahkan ke API yang aman ---------- */
  var _origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : ((input && input.url) || '');
    if (!/\/api\/auth(\/|\?|$)/.test(url)) return _origFetch(input, init);
    var b = {};
    try { b = JSON.parse((init && init.body) || '{}'); } catch (e) {}
    return bridgeAuth(b);
  };

  function jres(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }

  function bridgeAuth(b) {
    var u = String(b.username || b.email || b.user || '').trim(), p = String(b.password || '');
    var registered = false;
    var act = String(b.action || '').toLowerCase();
    var first;
    if (act === 'register') {
      first = api('register', 'POST', { username: u, password: p, name: b.name || u }).then(function (r) {
        registered = !!r.ok; return r;
      });
    } else if (act === 'login') {
      first = api('login', 'POST', { username: u, password: p });
    } else {
      first = api('login', 'POST', { username: u, password: p }).then(function (r) {
        if (r.ok || r.status >= 500) return r;
        return api('register', 'POST', { username: u, password: p, name: b.name || u }).then(function (r2) {
          if (r2.ok) { registered = true; return r2; }
          if (r2.data && r2.data.error === 'username_taken') return r;
          return r2;
        });
      });
    }
    return first.then(function (r) {
      if (r.ok) {
        user = pickUser(r.data) || { username: u };
        // Update tampilan dibungkus sendiri: error di sini TIDAK boleh membuat login tampak gagal
        try { refreshBtn(); loadProfile(); loadKyc(); } catch (e) { console.error('UI update error:', e); }
        return jres({ success: true, message: registered ? 'Pendaftaran berhasil!' : 'Login berhasil!', user: { username: u } }, 200);
      }
      var c = r.data && r.data.error;
      return jres({ success: false, message: ERR[c] || ('Gagal: ' + (c || r.status)) }, r.status || 400);
    }).catch(function (e) {
      console.error('bridgeAuth error:', e);
      var detail = e && e.message ? e.message : String(e);
      return jres({ success: false, message: 'Terjadi kesalahan jaringan atau server (' + detail + ')' }, 500);
    });
  }

  /* ---------- Util ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) e[k] = props[k];
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function fmt(n) { return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 }); }
  function fmt2(n) { return Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
  function fdate(d) {
    try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return '-'; }
  }
  function dt(d) {
    try { return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '-'; }
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60);
  }

  function call(url, method, body) {
    return fetch(url, {
      method: method, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, data: j }; });
    });
  }
  function api(a, m, b) { return call('/api?a=' + a, m, b); }
  function pickUser(d) { if (!d) return null; var u = d.user || d; return u && (u.username || u.name) ? u : null; }

  /* ---------- Tampilan tombol & profil ---------- */
  function refreshBtn() {
    if (!btn) return;
    if (!user) { btn.textContent = 'Login / Daftar'; return; }
    var nm = (prof && prof.user && prof.user.username) || user.username || user.name;
    btn.textContent = '\uD83D\uDC64 ' + nm + (prof ? ' \u00B7 ' + fmt(prof.balance) + ' BTW' : '');
  }

  function fillProfile() {
    if (!prof || !prof.user || !$('pf-bal')) return;
    $('pf-bal').textContent = fmt(prof.balance);
    $('pf-user').textContent = prof.user.username || '-';
    var joined = prof.user.created_at || prof.user.joined;
    $('pf-join').textContent = joined ? fdate(joined) : '-';
    $('pf-ses').textContent = prof.sessions || 0;
    var act = '-';
    if (prof.active) {
      var left = new Date(prof.active.end_at) - new Date();
      act = left > 0 ? 'Berjalan' : 'Siap diklaim';
    } else if (prof.today_done) { act = 'Selesai'; }
    $('pf-act').textContent = act;
    $('pf-name').value = prof.user.name || '';
    $('pf-wal').value = prof.user.wallet || '';
    var h = $('pf-hist');
    h.innerHTML = '';
    var hist = prof.history || [];
    if (!hist.length) h.appendChild(el('div', {}, [el('span', { textContent: 'Belum ada klaim.' })]));
    hist.forEach(function (x) {
      h.appendChild(el('div', {}, [el('span', { textContent: fdate(x.day || x.claimed_at) }), el('b', { textContent: '+' + fmt(x.reward) + ' BTW' })]));
    });
  }

  function loadProfile() {
    return call('/api/profile', 'GET').then(function (r) {
      if (r.ok && r.data && r.data.user) { prof = r.data; fillProfile(); renderMine(); }
      refreshBtn();
    }).catch(function (e) { console.error('loadProfile error:', e); });
  }

  /* ---------- Login / daftar (modal milik auth.js) ---------- */
  function render() {
    var reg = mode === 'register';
    $('au-title').textContent = reg ? 'Daftar Akun' : 'Login';
    $('au-name').style.display = reg ? '' : 'none';
    $('au-wal').style.display = reg ? '' : 'none';
    $('au-go').textContent = reg ? 'Daftar' : 'Masuk';
    $('au-sw').textContent = reg ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar';
    $('au-pw').autocomplete = reg ? 'new-password' : 'current-password';
    $('au-msg').textContent = '';
  }
  function openLogin(m) { mode = m || 'login'; render(); ov.classList.add('on'); }
  function closeLogin() { ov.classList.remove('on'); }

  function submit() {
    var msg = $('au-msg');
    var body = { username: $('au-user').value.trim(), password: $('au-pw').value };
    if (body.password.length < 8) { msg.style.color = '#ff8f8f'; msg.textContent = 'Password minimal 8 karakter.'; return; }
    if (mode === 'register') {
      body.name = $('au-name').value.trim() || body.username;
      var w = $('au-wal').value.trim();
      if (w) body.wallet = w;
    }
    msg.style.color = '#9db7ff'; msg.textContent = 'Memproses...';
    api(mode, 'POST', body).then(function (r) {
      if (!r.ok) {
        msg.style.color = '#ff8f8f';
        var c = r.data && r.data.error;
        msg.textContent = ERR[c] || ('Gagal: ' + (c || r.status));
        return;
      }
      user = pickUser(r.data) || { username: body.username };
      $('au-pw').value = '';
      closeLogin();
      refreshBtn();
      loadProfile();
      loadKyc();
      if (pending) { var p = pending; pending = null; p(); }
    }).catch(function (e) {
      console.error('submit error:', e);
      msg.style.color = '#ff8f8f';
      msg.textContent = 'Tidak bisa terhubung ke server' + (e && e.message ? ' (' + e.message + ')' : '.');
    });
  }

  function logout() {
    api('logout', 'POST').then(function () {
      user = null; prof = null; pv.classList.remove('on'); refreshBtn();
    }).catch(function (e) { console.error('logout error:', e); });
  }

  function saveProfile() {
    var msg = $('pf-msg');
    msg.style.color = '#9db7ff'; msg.textContent = 'Menyimpan...';
    call('/api/profile', 'POST', { name: $('pf-name').value.trim(), wallet: $('pf-wal').value.trim() }).then(function (r) {
      if (!r.ok) { msg.style.color = '#ff8f8f'; msg.textContent = ERR[r.data && r.data.error] || 'Gagal menyimpan.'; return; }
      prof = r.data; fillProfile(); refreshBtn();
      msg.style.color = '#7dffa6'; msg.textContent = 'Tersimpan.';
    }).catch(function () { msg.style.color = '#ff8f8f'; msg.textContent = 'Tidak bisa terhubung ke server.'; });
  }

  /* ---------- KYC (di dalam Profil) ---------- */
  var KYC_VIEW = {
    none:     ['Belum Verifikasi', '#f5b82e', 'Isi Formulir KYC'],
    pending:  ['Menunggu Review', '#7db7ff', null],
    verified: ['Terverifikasi \u2713', '#7dffa6', null],
    rejected: ['Ditolak', '#ff8f8f', 'Kirim Ulang KYC'],
    error:    ['Gagal memuat status', '#ff8f8f', null]
  };
  var KERR = {
    not_logged_in: 'Silakan login dulu.',
    name_invalid: 'Nama lengkap harus 3-80 karakter.',
    doc_invalid: 'Nomor dokumen tidak valid (5-32 karakter, huruf/angka).',
    doc_image_invalid: 'Foto dokumen tidak valid atau terlalu besar.',
    selfie_image_invalid: 'Foto selfie tidak valid atau terlalu besar.',
    already_pending: 'KYC Anda sedang ditinjau admin.',
    already_verified: 'Akun Anda sudah terverifikasi.',
    server_error: 'Terjadi kesalahan server. Coba lagi.'
  };

  function renderKyc() {
    var b = $('kc-badge'); if (!b) return;
    var st = kyc ? kyc.status : 'error';
    var v = KYC_VIEW[st] || KYC_VIEW.none;
    b.textContent = kyc ? v[0] : 'Memuat...';
    b.style.color = kyc ? v[1] : '#9db7ff';
    var o = $('kc-open');
    if (kyc && v[2]) { o.textContent = v[2]; o.style.display = ''; } else { o.style.display = 'none'; }
    var n = $('kc-note');
    n.textContent = (st === 'rejected' && kyc.note) ? 'Alasan: ' + kyc.note : (st === 'error' && kyc.code ? 'Kode: ' + kyc.code : '');
  }

  function loadKyc() {
    if (!user) return Promise.resolve();
    return call('/api?a=kyc_status', 'GET').then(function (r) {
      kyc = (r.ok && r.data && r.data.status) ? r.data : { status: 'error', code: (r.data && r.data.error) || r.status };
      renderKyc();
    }).catch(function (e) {
      console.error('loadKyc error:', e);
      kyc = { status: 'error', code: e && e.message };
      renderKyc();
    });
  }

  function fileToDataUrl(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s2 = Math.min(1, maxSide / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s2); c.height = Math.round(img.height * s2);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca. Gunakan JPG atau PNG.')); };
      img.src = url;
    });
  }

  function openKycForm() { $('kc-msg').textContent = ''; kv.classList.add('on'); }

  function submitKyc() {
    var msg = $('kc-msg'), go = $('kc-go');
    function say(t, bad) { msg.style.color = bad ? '#ff8f8f' : '#9db7ff'; msg.textContent = t; }
    var df = $('kc-docf').files[0], sf = $('kc-selff').files[0];
    if (!df || !sf) { say('Pilih foto dokumen dan foto selfie terlebih dahulu.', true); return; }
    go.disabled = true; say('Memproses foto...');
    var body = { fullName: $('kc-name').value.trim(), docNumber: $('kc-doc').value.trim() };
    fileToDataUrl(df, 1000, 0.75).then(function (a) {
      body.docImage = a; return fileToDataUrl(sf, 900, 0.75);
    }).then(function (b2) {
      body.selfieImage = b2; say('Mengirim...');
      return call('/api?a=kyc_submit', 'POST', body);
    }).then(function (r) {
      if (r.ok) {
        kyc = { status: 'pending' }; renderKyc();
        kv.classList.remove('on');
        $('kc-docf').value = ''; $('kc-selff').value = '';
        alert('Verifikasi KYC berhasil dikirim! Menunggu review admin.');
      } else {
        var c = r.data && r.data.error;
        say(KERR[c] || ('Gagal mengirim KYC (' + (c || r.status) + ')'), true);
        if (c === 'already_pending' || c === 'already_verified') loadKyc();
      }
    }).catch(function (e) { say(e && e.message ? e.message : 'Tidak bisa terhubung ke server.', true); })
      .then(function () { go.disabled = false; });
  }

  /* ---------- Perbaikan posisi: konten terlalu turun dari menu ---------- */
  function fixLayout() {
    if (!FIX_LAYOUT || !document.body) return;
    var vh = window.innerHeight, all = document.body.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n.closest('.au-ov') || n.id === 'au-btn') continue;
      if (n.offsetHeight < vh * 0.4) continue;
      var cs = getComputedStyle(n);
      if (cs.display === 'flex' || cs.display === 'inline-flex') {
        if (cs.flexDirection.indexOf('column') === 0) {
          if (/center|space-around|space-evenly/.test(cs.justifyContent)) { n.style.justifyContent = 'flex-start'; n.style.paddingTop = '20px'; }
        } else if (cs.alignItems === 'center') { n.style.alignItems = 'flex-start'; n.style.paddingTop = '20px'; }
      } else if (cs.display === 'grid') {
        if (cs.alignContent === 'center' || cs.alignItems === 'center') { n.style.alignContent = 'start'; n.style.alignItems = 'start'; n.style.paddingTop = '20px'; }
      }
    }
  }
  function scheduleFix() { clearTimeout(fixTimer); fixTimer = setTimeout(fixLayout, 120); }

  /* ---------- Panel Mining yang terhubung ke server ---------- */
  function mineState() {
    if (!prof) return 'load';
    var a = prof.active;
    if (a) return new Date(a.end_at) <= Date.now() ? 'ready' : 'running';
    return prof.today_done ? 'done' : 'none';
  }

  function buildMine() {
    var h = '';
    h += '<div class="mrow"><div class="mlabel">Saldo tersimpan</div><div class="mlabel" id="mn-state"></div></div>';
    h += '<div class="mbal"><span id="mn-bal">0.00</span> <small>BTW</small></div>';
    h += '<div class="mbar"><div id="mn-bar" style="width:0%"></div></div>';
    h += '<div class="mrow"><span id="mn-lbl">Sesi mining</span><span id="mn-pct">0%</span></div>';
    h += '<div class="mtimer" id="mn-time">--:--:--</div>';
    h += '<div class="mbtns"><button type="button" class="btn au-pri" id="mn-start">Mulai Mining</button>' +
         '<button type="button" class="btn au-sec" id="mn-claim">Claim</button></div>';
    h += '<div class="au-msg" id="mn-msg"></div>';
    h += '<div class="mstats">' +
         '<div class="card"><div class="au-l">Total diklaim</div><div class="au-v" id="mn-tot">0.00</div></div>' +
         '<div class="card"><div class="au-l">Reward per sesi</div><div class="au-v" id="mn-rate">0.120</div></div>' +
         '<div class="card"><div class="au-l">Fase aktif</div><div class="au-v" id="mn-ph">1 / 4</div></div>' +
         '<div class="card"><div class="au-l">Pool terpakai</div><div class="au-v" id="mn-pool">0.00%</div></div></div>';
    h += '<div class="mnote">Mining tercatat di server dan tidak hilang saat halaman dimuat ulang. Satu sesi berjalan 24 jam, klaim setelah selesai. Reward belum dikirim on-chain.</div>';
    h += '<div class="mlabel" style="margin-top:10px">Roadmap halving</div><div id="mn-stages"></div>';
    h += '<div class="mlabel" style="margin-top:10px">Riwayat</div><div class="mhist" id="mn-hist" style="display:block"></div>';
    minePanel.innerHTML = h;
    $('mn-start').addEventListener('click', function () { mineAct('start'); });
    $('mn-claim').addEventListener('click', function () { mineAct('claim'); });
  }

  function mineMsg(t, bad) {
    var m = $('mn-msg'); if (!m) return;
    m.style.color = bad ? '#ff8f8f' : '#7dffa6'; m.textContent = t || '';
  }

  function mineAct(action) {
    mineMsg('Memproses...', false);
    api(action, 'POST').then(function (r) {
      if (!r.ok) {
        var c = r.data && r.data.error;
        mineMsg(MERR[c] || ('Gagal: ' + (c || r.status)), true);
      } else if (action === 'claim') {
        mineMsg('Berhasil! +' + fmt(r.data && r.data.reward) + ' BTW masuk ke saldo.', false);
      } else {
        mineMsg('Mining dimulai. Sesi berjalan 24 jam.', false);
      }
      return loadProfile();
    }).catch(function () { mineMsg('Tidak bisa terhubung ke server.', true); });
  }

  function ensureMine() {
    var old = document.querySelector('#v-mining .mpanel:not(.au-mine)');
    if (!old) return null;
    if (!user) {
      if (minePanel) { minePanel.remove(); minePanel = null; }
      old.style.display = '';
      return null;
    }
    if (old.style.display !== 'none') old.style.display = 'none';
    if (!minePanel || !minePanel.isConnected) {
      minePanel = el('div', { className: old.className + ' au-mine' });
      old.parentNode.insertBefore(minePanel, old.nextSibling);
      buildMine();
      renderMine();
    }
    return minePanel;
  }

  function renderMine() {
    if (!minePanel || !minePanel.isConnected || !$('mn-bal')) return;
    var st = mineState();
    var p = (prof && prof.pool) || { rate: 0.12, phase: 1, percent: 0 };
    $('mn-bal').textContent = fmt2(prof ? prof.balance : 0);
    $('mn-tot').textContent = fmt2(prof ? prof.balance : 0);
    $('mn-rate').textContent = Number(p.rate).toFixed(3);
    $('mn-ph').textContent = p.phase + ' / 4';
    $('mn-pool').textContent = Number(p.percent).toFixed(2) + '%';
    $('mn-state').textContent = { load: 'MEMUAT...', none: 'BELUM MULAI', running: 'MINING AKTIF', ready: 'SIAP DIKLAIM', done: 'SELESAI HARI INI' }[st];
    var s = $('mn-start'), c = $('mn-claim');
    s.disabled = st !== 'none';
    c.disabled = st !== 'ready';
    s.textContent = { load: 'Memuat...', none: 'Mulai Mining', running: 'Mining berjalan...', ready: 'Sesi selesai', done: 'Selesai hari ini' }[st];
    $('mn-lbl').textContent = st === 'running' ? 'Sesi berjalan' : (st === 'ready' ? 'Sesi selesai' : 'Sesi mining');

    var sg = $('mn-stages'); sg.innerHTML = '';
    STAGES.forEach(function (x, i) {
      var row = el('div', { className: 'mstage' + (i === p.phase - 1 ? ' on' : '') }, [
        el('div', {}, [el('div', { textContent: x[0] }), el('small', { textContent: 'Alokasi 2,625,000 BTW', style: 'opacity:.7;font-size:10px' })]),
        el('b', { textContent: x[1].toFixed(3) + ' BTW' })
      ]);
      sg.appendChild(row);
    });

    var hs = $('mn-hist'); hs.innerHTML = '';
    var rows = [];
    if (prof && prof.active) rows.push(['Sesi mining dimulai', dt(prof.active.started_at), '24 jam']);
    if (prof && prof.history) prof.history.slice(0, 6).forEach(function (x) { rows.push(['Klaim reward', dt(x.claimed_at), '+' + fmt(x.reward) + ' BTW']); });
    if (!rows.length) rows.push(['Belum ada aktivitas', '', '']);
    rows.forEach(function (x) {
      hs.appendChild(el('div', { style: 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:13px' }, [
        el('div', {}, [el('div', { textContent: x[0] }), el('small', { textContent: x[1], style: 'opacity:.65;font-size:10px' })]),
        el('b', { textContent: x[2] })
      ]));
    });
    tickMine();
  }

  function tickMine() {
    if (!minePanel || !$('mn-time')) return;
    var st = mineState();
    if (st === 'running' || st === 'ready') {
      var a = prof.active, st0 = new Date(a.started_at).getTime(), en = new Date(a.end_at).getTime();
      var left = en - Date.now();
      var pct = Math.min(100, Math.max(0, ((Date.now() - st0) / (en - st0)) * 100));
      $('mn-time').textContent = clock(left);
      $('mn-bar').style.width = pct + '%';
      $('mn-pct').textContent = Math.floor(pct) + '%';
      if (st === 'running' && left <= 0) renderMine();
    } else {
      $('mn-time').textContent = '--:--:--';
      $('mn-bar').style.width = st === 'done' ? '100%' : '0%';
      $('mn-pct').textContent = st === 'done' ? '100%' : '0%';
    }
  }

  /* ---------- Bangun UI setelah DOM siap ---------- */
  function boot() {
    if (btn) return; // sudah dibangun

    var css = el('style');
    css.textContent =
      '#au-btn{position:fixed;right:12px;bottom:64px;z-index:9998;padding:10px 16px;border:0;border-radius:999px;background:#f5b82e;color:#1a1a1a;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;max-width:80vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.au-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
      '.au-ov.on{display:flex}' +
      '.au-box{width:100%;max-width:380px;max-height:92vh;overflow-y:auto;background:#12275f;color:#fff;border-radius:16px;padding:20px;font:15px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5);box-sizing:border-box}' +
      '.au-box h3{margin:0 0 12px;font-size:20px;color:#f5b82e}' +
      '.au-box input{width:100%;box-sizing:border-box;margin:6px 0;padding:11px 12px;border-radius:10px;border:1px solid #3b5bb5;background:#0b1a45;color:#fff;font-size:15px}' +
      '.au-box .row{display:flex;gap:8px;margin-top:10px}' +
      '.au-box button{flex:1;padding:11px;border:0;border-radius:10px;font:600 15px system-ui;cursor:pointer}' +
      '.au-pri{background:#f5b82e;color:#1a1a1a}.au-sec{background:#2a428c;color:#fff}.au-dng{background:#8c2a2a;color:#fff}' +
      '.au-msg{min-height:18px;margin-top:8px;font-size:13px;color:#ff8f8f}' +
      '#au-sw{margin-top:10px;font-size:13px;color:#9db7ff;cursor:pointer;text-align:center;text-decoration:underline}' +
      '.au-bal{background:linear-gradient(135deg,#f5b82e,#ffdf8a);color:#1a1a1a;border-radius:14px;padding:14px;text-align:center;margin-bottom:12px}' +
      '.au-bal small{display:block;font-size:12px;opacity:.75}.au-bal b{font-size:30px;font-weight:800}' +
      '.au-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}' +
      '.au-card{background:#0b1a45;border-radius:10px;padding:10px;font-size:13px}.au-card small{display:block;color:#9db7ff;font-size:11px;margin-bottom:2px}' +
      '.au-card span{word-break:break-all}' +
      '.au-hist{margin:6px 0 4px;font-size:13px}.au-hist div{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #24408f}' +
      '.au-lb{font-size:12px;color:#9db7ff;margin-top:10px}' +
      '.au-box label{display:block;font-size:12px;color:#9db7ff;margin:8px 0 2px}';
    document.head.appendChild(css);

    var mcss = el('style');
    mcss.textContent =
      '.au-mine .au-l{font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.7}' +
      '.au-mine .au-v{font-size:15px;font-weight:700;margin-top:2px}' +
      '.au-mine button.btn:disabled{opacity:.45;cursor:default}' +
      '.au-mine .au-msg{min-height:16px;margin:6px 0 2px;font-size:12px}';
    document.head.appendChild(mcss);

    btn = el('button', { id: 'au-btn' });
    document.body.appendChild(btn);

    ov = el('div', { className: 'au-ov', id: 'au-ov' });
    ov.innerHTML =
      '<div class="au-box"><h3 id="au-title"></h3>' +
      '<input id="au-name" placeholder="Nama lengkap" autocomplete="name">' +
      '<input id="au-user" placeholder="Username (3-24 huruf/angka)" autocomplete="username" autocapitalize="none">' +
      '<input id="au-wal" placeholder="Alamat wallet 0x... (opsional)" autocapitalize="none">' +
      '<input id="au-pw" type="password" placeholder="Password (min. 8 karakter)">' +
      '<div class="au-msg" id="au-msg"></div>' +
      '<div class="row"><button class="au-sec" id="au-x">Tutup</button><button class="au-pri" id="au-go">Masuk</button></div>' +
      '<div id="au-sw"></div></div>';
    document.body.appendChild(ov);

    pv = el('div', { className: 'au-ov', id: 'au-pf' });
    pv.innerHTML =
      '<div class="au-box"><h3>Profil Saya</h3>' +
      '<div class="au-bal"><small>Saldo hasil mining</small><b id="pf-bal">0</b> <span>BTW</span></div>' +
      '<div class="au-grid">' +
      '<div class="au-card"><small>Username</small><span id="pf-user">-</span></div>' +
      '<div class="au-card"><small>Bergabung</small><span id="pf-join">-</span></div>' +
      '<div class="au-card"><small>Sesi selesai</small><span id="pf-ses">0</span></div>' +
      '<div class="au-card"><small>Mining hari ini</small><span id="pf-act">-</span></div></div>' +
      '<input id="pf-name" placeholder="Nama lengkap">' +
      '<input id="pf-wal" placeholder="Alamat wallet 0x... (opsional)" autocapitalize="none">' +
      '<div class="au-msg" id="pf-msg"></div>' +
      '<div class="row"><button class="au-pri" id="pf-save">Simpan</button></div>' +
      '<div class="au-lb">Verifikasi KYC</div>' +
      '<div class="au-card" style="margin-top:6px"><small>Status</small><b id="kc-badge">Memuat...</b>' +
      '<div class="au-msg" id="kc-note" style="min-height:0;margin-top:4px"></div></div>' +
      '<div class="row"><button class="au-pri" id="kc-open">Isi Formulir KYC</button></div>' +
      '<div class="au-lb">Riwayat klaim terakhir</div><div class="au-hist" id="pf-hist"></div>' +
      '<div class="row"><button class="au-sec" id="pf-x">Tutup</button><button class="au-dng" id="pf-out">Keluar</button></div></div>';
    document.body.appendChild(pv);

    kv = el('div', { className: 'au-ov', id: 'au-kyc' });
    kv.innerHTML =
      '<div class="au-box"><h3>Verifikasi Identitas (KYC)</h3>' +
      '<div style="font-size:12px;color:#9db7ff;margin-bottom:6px">Data hanya dipakai untuk verifikasi dan hanya dapat dilihat admin. Pastikan foto jelas dan tidak terpotong.</div>' +
      '<input id="kc-name" placeholder="Nama lengkap (sesuai KTP/Paspor)" maxlength="80" autocomplete="name">' +
      '<input id="kc-doc" placeholder="Nomor KTP / Paspor" maxlength="32" autocapitalize="none">' +
      '<label>Foto KTP / Paspor</label><input id="kc-docf" type="file" accept="image/*">' +
      '<label>Foto selfie sambil memegang KTP/Paspor</label><input id="kc-selff" type="file" accept="image/*">' +
      '<div class="au-msg" id="kc-msg"></div>' +
      '<div class="row"><button class="au-sec" id="kc-x">Tutup</button><button class="au-pri" id="kc-go">Kirim</button></div></div>';
    document.body.appendChild(kv);

    btn.addEventListener('click', function () {
      if (!user) return openLogin('login');
      $('pf-msg').textContent = '';
      fillProfile();
      pv.classList.add('on');
      loadProfile();
      loadKyc();
    });
    $('au-x').addEventListener('click', function () { pending = null; closeLogin(); });
    $('au-go').addEventListener('click', submit);
    $('au-sw').addEventListener('click', function () { mode = mode === 'login' ? 'register' : 'login'; render(); });
    $('au-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    $('pf-x').addEventListener('click', function () { pv.classList.remove('on'); });
    $('pf-out').addEventListener('click', logout);
    $('pf-save').addEventListener('click', saveProfile);
    $('kc-open').addEventListener('click', openKycForm);
    $('kc-x').addEventListener('click', function () { kv.classList.remove('on'); });
    $('kc-go').addEventListener('click', submitKyc);

    /* Proteksi menu Ambassador / Mining */
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      if (e.target.closest('.au-ov') || e.target.closest('#au-btn')) return;
      if (user) {
        setTimeout(loadProfile, 1800); // perbarui saldo sesaat setelah klik di situs
        return;
      }
      var t = e.target.closest('a,button,[role="button"],[onclick],li');
      if (!t) return;
      var label = (t.innerText || t.textContent || '').trim();
      if (!PROTECTED.test(label)) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      pending = function () { t.click(); };
      openLogin('login');
    }, true);

    document.addEventListener('visibilitychange', function () { if (!document.hidden && user) loadProfile(); });
    document.addEventListener('click', scheduleFix);
    window.addEventListener('resize', scheduleFix);
    window.addEventListener('load', scheduleFix);
    scheduleFix();

    setInterval(function () { try { if (ensureMine()) tickMine(); } catch (e) { console.error('mine error:', e); } }, 1000);

    /* Cek sesi yang sudah ada */
    refreshBtn();
    api('me', 'GET').then(function (r) {
      if (r.ok) { user = pickUser(r.data); refreshBtn(); if (user) { loadProfile(); loadKyc(); } }
      return call('/api/profile?a=migrate', 'GET');
    }).catch(function (e) { console.error('init error:', e); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
