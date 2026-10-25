const crypto = require("crypto");
const { sql, send, getUid, jsonOnly } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "login" });

    await sql`insert into kyc (user_id) values (${uid}) on conflict (user_id) do nothing`;
    const k = await sql`select status from kyc where user_id = ${uid}`;
    if (k[0].status === "approved") return send(res, 200, { status: "approved" });

    const path = `/resources/accessTokens?userId=${encodeURIComponent(uid)}&levelName=${encodeURIComponent(process.env.SUMSUB_LEVEL)}`;
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = crypto.createHmac("sha256", process.env.SUMSUB_SECRET)
      .update(ts + "POST" + path).digest("hex");

    const r = await fetch("https://api.sumsub.com" + path, {
      method: "POST",
      headers: {
        "X-App-Token": process.env.SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": sig,
        "X-App-Access-Ts": ts
      }
    });
    const d = await r.json();
    if (!r.ok) { console.error(d); return send(res, 502, { error: "sumsub" }); }
    send(res, 200, { token: d.token, status: k[0].status });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
