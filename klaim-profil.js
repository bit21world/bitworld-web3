/* BTW-KLAIM-PROFIL v1 - kartu "Klaim ke Dompet" dipasang di halaman Profil (#profBody), di atas bagian KYC.
   File ini dimuat SEBELUM tugas-ui.js, sehingga kartu klaim lama di halaman Tugas otomatis tidak aktif.
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
    email_required: ['Verifikasi email Anda dulu.', 'Verify your email first.'],
    not_enough_days: ['Hari mining belum cukup untuk klaim pertama.', 'Not enough mining days yet for your first claim.'],
    claim_cooldown: ['Klaim hanya bisa sekali dalam 7 hari.', 'You can claim once every 7 days.'],
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

  /* ---------- tampilan (gelap, menyatu dengan halaman Profil) ---------- */
  function styleBtn(b, on) {
    b.disabled = !on;
    b.style.cssText = 'border:0;border-radius:12px;padding:12px 14px;font:inherit;font-size:15px;font-weight:700;width:100%;cursor:' + (on ? 'pointer' : 'default') +
      ';background:' + (on ? '#f0b90b' : 'rgba(255,255,255,.1)') + ';color:' + (on ? '#111' : 'rgba(255,255,255,.45)');
  }
  function build() {
    var c = document.createElement('div'); c.id = CARD;
    c.style.cssText = 'margin:22px 0 0;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);text-align:left;color:var(--fg,#e8ebf2)';
    return c;
  }
  function line(txt, css) { var d = document.createElement('div'); d.style.cssText = css; d.textContent = txt; return d; }
  function fill(c) {
    c.textContent = '';
    c.appendChild(line(tx(['Klaim ke Dompet', 'Claim to Wallet']), 'font-size:18px;font-weight:700;color:#fff'));
    c.appendChild(line(tx(['Tarik saldo BTW ke dompet BSC Anda. Biaya gas sedikit BNB.', 'Withdraw your BTW balance to your BSC wallet. Gas needs a little BNB.']), 'font-size:12px;color:var(--muted,#8a93a6);margin:2px 0 12px'));
    c.appendChild(line(tx(['Saldo: ', 'Balance: ']) + nf(st.balance) + ' BTW', 'font-size:15px;font-weight:600;margin-bottom:4px'));
    var need = Number(st.mineNeed || 0), have = Number(st.mineDays || 0);
    if (need > 0) c.appendChild(line(tx(['Hari mining: ', 'Mining days: ']) + Math.min(have, need) + '/' + need, 'font-size:13px;font-weight:600;color:' + (have >= need ? '#86efac' : 'var(--muted,#8a93a6)') + ';margin-bottom:4px'));
    c.appendChild(line(st.wallet ? tx(['Dompet: ', 'Wallet: ']) + short(st.wallet) : tx(['Dompet belum terhubung.', 'No wallet linked yet.']), 'font-size:13px;color:var(--muted,#8a93a6);margin-bottom:12px'));

    var b;
    if (!st.wallet) {
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : tx(['Hubungkan Dompet', 'Connect Wallet']);
      styleBtn(b, !busy); b.addEventListener('click', connect);
    } else if (st.voucher) {
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : tx(['Selesaikan Klaim', 'Finish Claim']);
      styleBtn(b, !busy); b.addEventListener('click', claim);
    } else {
      var daysOk = have >= need;
      var can = st.kyc === 'approved' && daysOk && st.balance >= st.min && !busy;
      var label = st.kyc !== 'approved' ? tx(['Selesaikan KYC untuk klaim', 'Complete KYC to claim'])
        : !daysOk ? tx(['Mining ', 'Mine ']) + need + tx([' hari dulu (', ' days first (']) + have + '/' + need + ')'
        : st.balance < st.min ? tx(['Minimal klaim ', 'Minimum claim ']) + nf(st.min) + ' BTW'
        : tx(['Klaim ', 'Claim ']) + nf(Math.min(st.balance, st.max)) + ' BTW';
      b = document.createElement('button'); b.type = 'button'; b.textContent = busy ? '…' : label;
      styleBtn(b, can); b.addEventListener('click', claim);
    }
    c.appendChild(b);
    c.appendChild(line(msg, 'font-size:12px;min-height:16px;margin-top:8px;color:#f0b90b'));
  }

  /* Kartu disisipkan di #profBody, tepat sebelum judul "KYC" (cadangan: sebelum tombol Keluar, atau di akhir). */
  function slot(pb) {
    var hs = pb.querySelectorAll('h2');
    for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim().toUpperCase() === 'KYC') return hs[i];
    return document.getElementById('pOut');
  }
  function render() {
    if (!st) return;
    var pb = document.getElementById('profBody');
    if (!pb || !visible(pb)) return;
    var c = document.getElementById(CARD);
    var sig = JSON.stringify([st, msg, busy, en()]);
    if (c && pb.contains(c) && c.getAttribute('data-sig') === sig) return;   /* tidak berubah: jangan gambar ulang (cegah loop observer) */
    if (!c || !pb.contains(c)) {
      if (c) c.remove();
      c = build();
      var ref = slot(pb);
      if (ref) pb.insertBefore(c, ref); else pb.appendChild(c);
    }
    c.setAttribute('data-sig', sig);
    fill(c);
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      /* dompet baru saja dihubungkan lewat bagian Wallet di Profil: segarkan status klaim */
      var pw = document.getElementById('pWallet');
      var walletChanged = !!(st && pw && pw.value && (!st.wallet || pw.value.toLowerCase() !== String(st.wallet).toLowerCase()));
      if (!st || Date.now() - lastLoad > 20000 || (walletChanged && Date.now() - lastLoad > 3000)) load(); else render();
    }, 300);
  }

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
