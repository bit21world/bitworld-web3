const { sql, send, jsonOnly, getIp, limit, sendVerifyMail } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!(await limit("resend:ip:" + getIp(req), 10, 60)) || !(await limit("resend:" + email, 3, 60)))
      return send(res, 429, { error: "rate_limited" });
    const rows = await sql`select id, email, name, email_verified from bw_users where email = ${email}`;
    if (rows.length && !rows[0].email_verified) {
      try { await sendVerifyMail(rows[0]); } catch (e) { console.error("Gagal kirim email:", e); }
    }
    send(res, 200, { ok: true }); // jawaban selalu sama agar email tidak bisa ditebak
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
