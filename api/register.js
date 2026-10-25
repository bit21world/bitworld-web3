const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sql, send, jsonOnly, getIp, limit, sendVerifyMail } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    if (!(await limit("reg:" + getIp(req), 15, 60))) return send(res, 429, { error: "rate_limited" });
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim().slice(0, 80);
    const pw = String(b.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || !name) return send(res, 400, { error: "invalid_input" });
    const domain = email.split("@")[1] || "";
    if (/^gmail\./.test(domain) && domain !== "gmail.com") return send(res, 400, { error: "invalid_input" });
    if (pw.length < 8 || pw.length > 72) return send(res, 400, { error: "weak_password" });

    const hash = await bcrypt.hash(pw, 10);
    const myCode = crypto.randomBytes(5).toString("hex").toUpperCase();
    const rows = await sql`insert into bw_users (email, name, password_hash, email_verified, referral_code)
                           values (${email}, ${name}, ${hash}, false, ${myCode})
                           on conflict (email) do nothing returning id`;
    if (!rows.length) return send(res, 409, { error: "email_taken" });

    // Referral: gagal di sini tidak boleh menggagalkan pendaftaran
    const ref = String(b.ref || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
    if (ref) {
      try {
        const r = await sql`select id from bw_users where referral_code = ${ref}`;
        if (r.length && String(r[0].id) !== String(rows[0].id)) {
          await sql`update bw_users set referred_by = ${r[0].id} where id = ${rows[0].id}`;
          await sql`insert into bw_referrals (referrer_id, referred_id) values (${r[0].id}, ${rows[0].id})
                    on conflict (referred_id) do nothing`;
        }
      } catch (e) { console.error("referral:", e); }
    }

    let mailSent = true;
    try {
      const ok = await sendVerifyMail({ id: rows[0].id, email, name });
      if (ok === false) mailSent = false;
    } catch (e) {
      console.error("Gagal kirim email:", e);
      mailSent = false;
    }

    let autoVerified = false;
    if (!mailSent && process.env.AUTO_VERIFY_ON_MAIL_FAIL === "1") {
      await sql`update bw_users set email_verified = true where id = ${rows[0].id}`;
      autoVerified = true;
    }

    send(res, 200, { ok: true, mail_sent: mailSent, auto_verified: autoVerified });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
