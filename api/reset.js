const bcrypt = require("bcryptjs");
const { sql, send, clearSession, jsonOnly, getIp, limit, consumeToken } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    if (!(await limit("reset:" + getIp(req), 10, 15))) return send(res, 429, { error: "rate_limited" });
    const b = req.body || {};
    const token = String(b.token || ""), pw = String(b.password || "");
    if (pw.length < 8 || pw.length > 72) return send(res, 400, { error: "weak_password" });
    const uid = token ? await consumeToken(token, "reset") : null;
    if (!uid) return send(res, 400, { error: "token_invalid" });
    const hash = await bcrypt.hash(pw, 10);
    await sql`update users set password_hash = ${hash}, email_verified = true where id = ${uid}`;
    clearSession(res);
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
