const crypto = require("crypto");
const { sql, send, getUid, jsonOnly, RATE, HOURS } = require("./_lib");

async function kycToken(req, res) {
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
}

async function kycWebhook(req, res) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const expected = crypto.createHmac("sha256", process.env.SUMSUB_WEBHOOK_SECRET)
      .update(raw).digest("hex");
    if ((req.headers["x-payload-digest"] || "") !== expected)
      return res.status(401).end("invalid");

    const e = JSON.parse(raw.toString());
    if (e.type === "applicantReviewed") {
      const status = e.reviewResult && e.reviewResult.reviewAnswer === "GREEN" ? "approved" : "rejected";
      await sql`update kyc set status = ${status}, applicant_id = ${e.applicantId}, updated_at = now()
                where user_id = ${e.externalUserId}`;
    }
    res.status(200).end("ok");
  } catch (err) { console.error(err); res.status(500).end("server"); }
}

module.exports = async (req, res) => {
  const kyc = (req.query && req.query.kyc) || "";
  if (kyc === "token") return kycToken(req, res);
  if (kyc === "webhook") return kycWebhook(req, res);
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

module.exports.config = { api: { bodyParser: false } };
