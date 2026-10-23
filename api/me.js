const { sql, send, getUid } = require("./_lib");
module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const rows = await sql`select email, name, balance, streak, last_claim from bw_users where id = ${uid}`;
    if (!rows.length) return send(res, 401, { error: "not_logged_in" });
    const u = rows[0];
    send(res, 200, { user: { email: u.email, name: u.name, balance: Number(u.balance), streak: u.streak, last_claim: u.last_claim } });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
