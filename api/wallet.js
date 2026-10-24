const { sql, send, getUid, jsonOnly, limit } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "unauthorized" });
    const w = String((req.body || {}).wallet || "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(w)) return send(res, 400, { error: "invalid_wallet" });
    if (!(await limit("wallet:" + uid, 10, 60))) return send(res, 429, { error: "rate_limited" });
    try {
      await sql`update bw_users set wallet = ${w.toLowerCase()} where id = ${uid}`;
    } catch (e) {
      if (String(e.message || e).includes("duplicate")) return send(res, 409, { error: "wallet_taken" });
      throw e;
    }
    send(res, 200, { ok: true, wallet: w.toLowerCase() });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
