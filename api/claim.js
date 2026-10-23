const { sql, send, getUid, jsonOnly } = require("./_lib");

// Satu query atomik: cek cooldown 24 jam + tambah saldo. Tidak bisa di-spam/curang.
module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const rows = await sql`
      update bw_users set
        streak  = case when last_claim is not null and now() < last_claim + interval '48 hours' then streak + 1 else 1 end,
        balance = balance + 10 + least((case when last_claim is not null and now() < last_claim + interval '48 hours' then streak + 1 else 1 end) - 1, 10),
        last_claim = now()
      where id = ${uid} and (last_claim is null or now() >= last_claim + interval '24 hours')
      returning balance, streak, 10 + least(streak - 1, 10) as reward`;
    if (!rows.length) return send(res, 429, { error: "cooldown" });
    await sql`insert into bw_mining_log (user_id, amount) values (${uid}, ${rows[0].reward})`;
    send(res, 200, { reward: rows[0].reward, streak: rows[0].streak, balance: Number(rows[0].balance) });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
