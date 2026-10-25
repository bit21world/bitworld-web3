const { sql, send, getUid, REF_BONUS, REF_MAX } = require("./_lib");

module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const me = (await sql`select referral_code from bw_users where id = ${uid}`)[0];
    if (!me) return send(res, 401, { error: "not_logged_in" });
    const st = (await sql`select
        count(*) filter (where status = 'active')::int as active,
        count(*) filter (where status = 'pending')::int as pending
      from bw_referrals where referrer_id = ${uid}`)[0];
    send(res, 200, {
      code: me.referral_code,
      active: st.active,
      pending: st.pending,
      bonus_percent: Math.round(Math.min(st.active, REF_MAX) * REF_BONUS * 100),
      max_friends: REF_MAX
    });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
