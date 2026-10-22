/* Bitworld auth layer: tombol Login/Daftar + proteksi Ambassador & Mining.
   Memanggil API yang sudah ada: /api?a=register|login|logout|me */
(function () {
  var PROTECTED = /^[^a-z]*(ambassador|mining)\s*$/i;
  var user = null;

  function api(action, method, body) {
    return fetch('/api?a=' + action, {
      method: method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        return { ok: r.ok, status: r.status, data: j };
      });
    });
  }

  function pickUser(d) {
    if (!d) return null;
    var u = d.user || d;
    return u && (u.username || u.name) ? u : null;
  }

  /* ---------- Gaya ---------- */
  var css = document.createElement('style');
  css.textContent =
    '#au-btn{position:fixed;right:12px;bottom:64px;z-index:9998;padding:10px 18px;border:0;border-radius:999px;' +
    'background:#f5b82e;color:#1a1a1a;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}' +
    '#au-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
    '#au-ov.on{display:flex}' +
    '#au-box{width:100%;max-width:360px;background:#12275f;color:#fff;border-radius:16px;padding:20px;font:15px system-ui,sans-serif;' +
    'box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
    '#au-box h3{margin:0 0 12px;font-size:20px;color:#f5b82e}' +
    '#au-box input{width:100%;box-sizing:border-box;margin:6px 0;padding:11px 12px;border-radius:10px;border:1px solid #3b5bb5;' +
    'background:#0b1a45;color:#fff;font-size:15px}' +
    '#au-box .row{display:flex;gap:8px;margin-top:10px}' +
    '#au-box button{flex:1;padding:11px;border:0;border-radius:10px;font:600 15px system-ui;cursor:pointer}' +
    '#au-go{background:#f5b82e;color:#1a1a1a}#au-x{background:#2a428c;color:#fff}' +
    '#au-sw{margin-top:10px;font-size:13px;color:#9db7ff;cursor:pointer;text-align:center;text-decoration:underline}' +
    '#au-msg{min-height:18px;margin-top:8px;font-size:13px;color:#ff8f8f}';
  document.head.appendChild(css);

  /* ---------- Elemen ---------- */
  var btn = document.createElement('button');
  btn.id = 'au-btn';
  document.body.appendChild(btn);

  var ov = document.createElement('div');
  ov.id = 'au-ov';
  ov.innerHTML =
    '<div id="au-box"><h3 id="au-title"></h3>' +
    '<input id="au-name" placeholder="Nama lengkap" autocomplete="name">' +
    '<input id="au-user" placeholder="Username (3-24 huruf/angka)" autocomplete="username" autocapitalize="none">' +
    '<input id="au-wal" placeholder="Alamat wallet 0x... (opsional)" autocapitalize="none">' +
    '<input id="au-pw" type="password" placeholder="Password (min. 8 karakter)" autocomplete="current-password">' +
    '<div id="au-msg"></div>' +
    '<div class="row"><button id="au-x">Tutup</button><button id="au-go">Masuk</button></div>' +
    '<div id="au-sw"></div></div>';
  document.body.appendChild(ov);

  var mode = 'login';
  function $(id) { return document.getElementById(id); }

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

  function openModal(m) { mode = m || 'login'; render(); ov.classList.add('on'); }
  function closeModal() { ov.classList.remove('on'); }

  function refreshBtn() {
    btn.textContent = user ? ('Keluar (' + (user.username || user.name) + ')') : 'Login / Daftar';
  }

  var ERR = {
    username_taken: 'Username sudah dipakai.',
    invalid_username: 'Username harus 3-24 karakter: huruf, angka, _ . -',
    invalid_wallet: 'Format wallet tidak valid (0x + 40 karakter).',
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
    msg.style.color = '#9db7ff';
    msg.textContent = 'Memproses...';
    api(mode, 'POST', body).then(function (r) {
      if (!r.ok) {
        msg.style.color = '#ff8f8f';
        var code = r.data && r.data.error;
        msg.textContent = ERR[code] || ('Gagal: ' + (code || r.status));
        return;
      }
      user = pickUser(r.data) || { username: body.username };
      refreshBtn();
      closeModal();
      $('au-pw').value = '';
      if (pending) { var p = pending; pending = null; p(); }
    }).catch(function () {
      msg.style.color = '#ff8f8f';
      msg.textContent = 'Tidak bisa terhubung ke server.';
    });
  }

  /* ---------- Event ---------- */
  var pending = null;

  btn.addEventListener('click', function () {
    if (user) {
      api('logout', 'POST').then(function () { user = null; refreshBtn(); });
    } else {
      openModal('login');
    }
  });
  $('au-x').addEventListener('click', function () { pending = null; closeModal(); });
  $('au-go').addEventListener('click', submit);
  $('au-sw').addEventListener('click', function () { mode = mode === 'login' ? 'register' : 'login'; render(); });
  $('au-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

  /* Proteksi: cegah klik Ambassador / Mining kalau belum login */
  document.addEventListener('click', function (e) {
    if (user || e.target.closest('#au-ov') || e.target.closest('#au-btn')) return;
    var el = e.target.closest('a,button,[role="button"],[onclick],li');
    if (!el) return;
    var label = (el.innerText || el.textContent || '').trim();
    if (!PROTECTED.test(label)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    pending = function () { el.click(); };
    openModal('login');
  }, true);

  /* ---------- Mulai: cek sesi yang sudah ada ---------- */
  refreshBtn();
  api('me', 'GET').then(function (r) {
    if (r.ok) { user = pickUser(r.data); refreshBtn(); }
  }).catch(function () {});
})();
