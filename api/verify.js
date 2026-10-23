const { sql, send, setSession, jsonOnly, getIp, limit, consumeToken } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    if (!(await limit("verify:" + getIp(req), 20, 15))) return send(res, 429, { error: "rate_limited" });
    const token = String((req.body || {}).token || "");
    const uid = token ? await consumeToken(token, "verify") : null;
    if (!uid) return send(res, 400, { error: "token_invalid" });
    await sql`update users set email_verified = true where id = ${uid}`;
    setSession(res, uid); // langsung masuk setelah verifikasi
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
