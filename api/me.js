const { sql, send, getUid, RATE, HOURS } = require("./_lib");

// Mengembalikan data akun yang sedang login (dipakai tampilan untuk status login & mining).
module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 200, { user: null });
    const r = await sql`select email, name, balance, mine_start, is_admin, wallet, now() as server_now from bw_users where id = ${uid}`;
    if (!r.length) return send(res, 200, { user: null });
    const u = r[0];
    send(res, 200, { user: {
      email: u.email, name: u.name, balance: Number(u.balance),
      mine_start: u.mine_start, server_now: u.server_now,
      rate: RATE, session_hours: HOURS, is_admin: !!u.is_admin,
      wallet: u.wallet || null
    } });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
