const bcrypt = require("bcryptjs");
const { sql, send, jsonOnly, getIp, limit, sendVerifyMail } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    // Batas percobaan daftar per IP (dilonggarkan dari 5 menjadi 15)
    if (!(await limit("reg:" + getIp(req), 15, 60))) return send(res, 429, { error: "rate_limited" });
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim().slice(0, 80);
    const pw = String(b.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || !name) return send(res, 400, { error: "invalid_input" });
    // Cegah salah ketik umum, misalnya gmail.comf atau gmail.con
    const domain = email.split("@")[1] || "";
    if (/^gmail\./.test(domain) && domain !== "gmail.com") return send(res, 400, { error: "invalid_input" });
    if (pw.length < 8 || pw.length > 72) return send(res, 400, { error: "weak_password" });

    const hash = await bcrypt.hash(pw, 10);
    const rows = await sql`insert into bw_users (email, name, password_hash, email_verified)
                           values (${email}, ${name}, ${hash}, false)
                           on conflict (email) do nothing returning id`;
    if (!rows.length) return send(res, 409, { error: "email_taken" });

    let mailSent = true;
    try {
      const ok = await sendVerifyMail({ id: rows[0].id, email, name });
      if (ok === false) mailSent = false;
    } catch (e) {
      console.error("Gagal kirim email:", e);
      mailSent = false;
    }

    // Khusus masa pengembangan: kalau email gagal terkirim dan variabel
    // AUTO_VERIFY_ON_MAIL_FAIL bernilai "1" di Vercel, akun langsung diverifikasi.
    // Biarkan variabel ini TIDAK diisi saat situs dibuka untuk umum.
    let autoVerified = false;
    if (!mailSent && process.env.AUTO_VERIFY_ON_MAIL_FAIL === "1") {
      await sql`update bw_users set email_verified = true where id = ${rows[0].id}`;
      autoVerified = true;
    }

    send(res, 200, { ok: true, mail_sent: mailSent, auto_verified: autoVerified });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
