const { sql, send, jsonOnly, getIp, limit, sendResetMail } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const email = String((req.body || {}).email || "").trim().toLowerCase();
    if (!(await limit("forgot:ip:" + getIp(req), 10, 60)) || !(await limit("forgot:" + email, 3, 60)))
      return send(res, 429, { error: "rate_limited" });
    const rows = await sql`select id, email, name from users where email = ${email}`;
    if (rows.length) {
      try { await sendResetMail(rows[0]); } catch (e) { console.error("Gagal kirim email:", e); }
    }
    send(res, 200, { ok: true }); // jawaban selalu sama agar email tidak bisa ditebak
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
