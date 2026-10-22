/* Bitworld auth layer v2: login/daftar, proteksi Ambassador & Mining,
   profil pengguna, saldo mining, dan perbaikan posisi tampilan. */
(function () {
  var FIX_LAYOUT = true; // ubah ke false kalau mau mematikan perbaikan posisi tampilan
  var PROTECTED = /^[^a-z]*(ambassador|mining)\s*$/i;
  var user = null, prof = null, mode = 'login', pending = null;

  function $(id) { return document.getElementById(id); }
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in (props || {})) e[k] = props[k];
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function fmt(n) { return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 }); }
  function fdate(d) {
    try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return '-'; }
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

  /* ---------- Gaya ---------- */
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
    '.au-lb{font-size:12px;color:#9db7ff;margin-top:10px}';
  document.head.appendChild(css);

  /* ---------- Tombol utama ---------- */
  var btn = el('button', { id: 'au-btn' });
  document.body.appendChild(btn);

  /* ---------- Modal login/daftar ---------- */
  var ov = el('div', { className: 'au-ov', id: 'au-ov' });
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

  /* ---------- Modal profil ---------- */
  var pv = el('div', { className: 'au-ov', id: 'au-pf' });
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
    '<div class="au-lb">Riwayat klaim terakhir</div><div class="au-hist" id="pf-hist"></div>' +
    '<div class="row"><button class="au-sec" id="pf-x">Tutup</button><button class="au-dng" id="pf-out">Keluar</button></div></div>';
  document.body.appendChild(pv);

  /* ---------- Tampilan tombol & profil ---------- */
  function refreshBtn() {
    if (!user) { btn.textContent = 'Login / Daftar'; return; }
    var nm = (prof && prof.user && prof.user.username) || user.username || user.name;
    btn.textContent = '\uD83D\uDC64 ' + nm + (prof ? ' \u00B7 ' + fmt(prof.balance) + ' BTW' : '');
  }

  function fillProfile() {
    if (!prof) return;
    $('pf-bal').textContent = fmt(prof.balance);
    $('pf-user').textContent = prof.user.username || '-';
    $('pf-join').textContent = prof.user.created_at ? fdate(prof.user.created_at) : '-';
    $('pf-ses').textContent = prof.sessions;
    var act = '-';
    if (prof.active) {
      var left = new Date(prof.active.end_at) - new Date();
      act = left > 0 ? 'Berjalan' : 'Siap diklaim';
    }
    $('pf-act').textContent = act;
    $('pf-name').value = prof.user.name || '';
    $('pf-wal').value = prof.user.wallet || '';
    var h = $('pf-hist');
    h.innerHTML = '';
    if (!prof.history.length) h.appendChild(el('div', {}, [el('span', { textContent: 'Belum ada klaim.' })]));
    prof.history.forEach(function (x) {
      h.appendChild(el('div', {}, [el('span', { textContent: fdate(x.day || x.claimed_at) }), el('b', { textContent: '+' + fmt(x.reward) + ' BTW' })]));
    });
  }

  function loadProfile() {
    return call('/api/profile', 'GET').then(function (r) {
      if (r.ok && r.data && r.data.user) { prof = r.data; fillProfile(); }
      refreshBtn();
    }).catch(function () {});
  }

  /* ---------- Login / daftar ---------- */
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

  var ERR = {
    username_taken: 'Username sudah dipakai.',
    invalid_username: 'Username harus 3-24 karakter: huruf, angka, _ . -',
    invalid_wallet: 'Format wallet tidak valid (0x + 40 karakter).',
    invalid_name: 'Nama wajib diisi (maks. 60 karakter).',
    invalid_credentials: 'Username atau password salah.',
    server_error: 'Terjadi kesalahan server. Coba lagi.'
  };

  function submit() {
    var msg = $('au-msg');
    var body = { username: $('au-user').value.trim(), password: $('au-pw').value };
    if (body.password.length < 8) { msg.textContent = 'Password minimal 8 karakter.'; return; }
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
      if (pending) { var p = pending; pending = null; p(); }
    }).catch(function () { msg.style.color = '#ff8f8f'; msg.textContent = 'Tidak bisa terhubung ke server.'; });
  }

  function logout() {
    api('logout', 'POST').then(function () {
      user = null; prof = null; pv.classList.remove('on'); refreshBtn();
    });
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

  /* ---------- Event ---------- */
  btn.addEventListener('click', function () {
    if (!user) return openLogin('login');
    $('pf-msg').textContent = '';
    fillProfile();
    pv.classList.add('on');
    loadProfile();
  });
  $('au-x').addEventListener('click', function () { pending = null; closeLogin(); });
  $('au-go').addEventListener('click', submit);
  $('au-sw').addEventListener('click', function () { mode = mode === 'login' ? 'register' : 'login'; render(); });
  $('au-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  $('pf-x').addEventListener('click', function () { pv.classList.remove('on'); });
  $('pf-out').addEventListener('click', logout);
  $('pf-save').addEventListener('click', saveProfile);

  /* Proteksi menu Ambassador / Mining */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.au-ov') || e.target.closest('#au-btn')) return;
    if (user) {
      // Perbarui saldo sesaat setelah pengguna menekan tombol di situs (mis. klaim mining)
      setTimeout(loadProfile, 1800);
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

  /* ---------- Perbaikan posisi: konten terlalu turun dari menu ---------- */
  var fixTimer = null;
  function fixLayout() {
    if (!FIX_LAYOUT) return;
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
  document.addEventListener('click', scheduleFix);
  window.addEventListener('resize', scheduleFix);
  window.addEventListener('load', scheduleFix);
  scheduleFix();

  /* ---------- Mulai: cek sesi yang sudah ada ---------- */
  refreshBtn();
  api('me', 'GET').then(function (r) {
    if (r.ok) { user = pickUser(r.data); refreshBtn(); if (user) loadProfile(); }
  }).catch(function () {});
})();
