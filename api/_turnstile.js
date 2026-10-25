const { send, getIp } = require("./_lib");

let warned = false;

// Cek token Cloudflare Turnstile. Mengembalikan true jika lolos.
async function checkTurnstile(req, res) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    // Belum dipasang: tidak memblokir, tapi beri peringatan di log agar tidak terlewat di production.
    if (!warned) { warned = true; console.warn("TURNSTILE_SECRET belum diatur: captcha dinonaktifkan."); }
    return true;
  }
  const token = String((req.body || {}).turnstile || "");
  if (!token) { send(res, 400, { error: "captcha" }); return false; }

  const params = new URLSearchParams({ secret, response: token });
  const ip = getIp(req);
  if (ip) params.set("remoteip", ip);

  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, 5000); // jangan menggantung bila Cloudflare lambat
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: ctrl.signal
    });
    const d = await r.json();
    if (d && d.success) return true;
    console.warn("Turnstile ditolak:", d && d["error-codes"]);
    send(res, 400, { error: "captcha" });
  } catch (e) {
    console.error("Turnstile error:", e);
    send(res, 503, { error: "server" }); // gangguan di sisi kita/Cloudflare, bukan salah pengguna
  } finally {
    clearTimeout(timer);
  }
  return false;
}

module.exports = { checkTurnstile };
