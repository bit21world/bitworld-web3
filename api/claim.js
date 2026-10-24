const { sql, send, getUid, jsonOnly, RATE, HOURS } = require("./_lib");

// Memulai sesi mining 24 jam. Satu query atomik: tidak bisa dimulai dua kali / dicurangi.
// Poin sesi sebelumnya (RATE x HOURS) dimasukkan ke saldo saat sesi baru dimulai;
// poin sesi yang sedang berjalan dihitung otomatis di /api/me.
module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const rows = await sql`
      with old as (select id, mine_start from bw_users where id = ${uid} for update)
      update bw_users u set
        balance = u.balance + case when old.mine_start is not null then ${RATE}::numeric * ${HOURS}::numeric else 0 end,
        mine_start = now()
      from old
      where u.id = old.id
        and (old.mine_start is null or now() >= old.mine_start + make_interval(hours => ${HOURS}::int))
      returning u.balance, u.mine_start, (old.mine_start is not null) as settled`;
    if (!rows.length) return send(res, 429, { error: "cooldown" });
    if (rows[0].settled) {
      await sql`insert into bw_mining_log (user_id, amount) values (${uid}, ${RATE * HOURS})`;
    }
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
