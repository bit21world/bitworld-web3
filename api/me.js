const { sql, send, getUid, RATE, HOURS } = require("./_lib");
module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const rows = await sql`select email, name, balance, mine_start, now() as server_now from bw_users where id = ${uid}`;
    if (!rows.length) return send(res, 401, { error: "not_logged_in" });
    const u = rows[0];
    send(res, 200, { user: {
      email: u.email, name: u.name, balance: Number(u.balance),
      mine_start: u.mine_start, server_now: u.server_now, rate: RATE, session_hours: HOURS
    } });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
