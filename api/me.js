const crypto = require("crypto");
const { sql, send, getUid, jsonOnly, RATE, HOURS } = require("./_lib");

const DIDIT = "https://verification.didit.me/v3";
const SITE = "https://bitworld-web3-phi.vercel.app";

// Memulai verifikasi KYC: membuat sesi di Didit lalu mengembalikan link-nya
async function kycStart(req, res) {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "login" });

    await sql`insert into kyc (user_id) values (${uid}) on conflict (user_id) do nothing`;
    const k = await sql`select status from kyc where user_id = ${uid}`;
    if (k[0].status === "approved") return send(res, 200, { status: "approved" });

    const r = await fetch(DIDIT + "/session/", {
      method: "POST",
      headers: { "x-api-key": process.env.DIDIT_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow_id: process.env.DIDIT_WORKFLOW_ID,
        vendor_data: String(uid),
        callback: SITE + "/kyc.html",
        callback_method: "both"
      })
    });
    const d = await r.json();
    if (!r.ok) { console.error(d); return send(res, 502, { error: "didit" }); }

    await sql`update kyc set applicant_id = ${d.session_id}, status = 'pending', updated_at = now() where user_id = ${uid}`;
    send(res, 200, { url: d.url, status: "pending" });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
}

// Menerima hasil verifikasi dari Didit (webhook)
async function kycWebhook(req, res) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const b = JSON.parse(Buffer.concat(chunks).toString() || "{}");

    const ts = String(req.headers["x-timestamp"] || "");
    const sig = String(req.headers["x-signature-simple"] || "");
    if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return res.status(401).end("old");

    const expected = crypto.createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET)
      .update([ts, b.session_id, b.status, b.webhook_type].join(":")).digest("hex");
    const a = Buffer.from(sig), e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return res.status(401).end("invalid");

    // Tombol "Uji Webhook" di Didit: tanda tangan sudah benar, tidak perlu proses lanjut
    if (req.headers["x-didit-test-webhook"] === "true") return res.status(200).end("test ok");

    // Konfirmasi hasil langsung ke Didit (tidak percaya isi webhook begitu saja)
    const r = await fetch(`${DIDIT}/session/${encodeURIComponent(b.session_id)}/decision/`, {
      headers: { "x-api-key": process.env.DIDIT_API_KEY }
    });
    if (!r.ok) return res.status(502).end("didit");
    const d = await r.json();

    const st = { Approved: "approved", Declined: "rejected" }[d.status];
    if (st && d.vendor_data) {
      await sql`update kyc set status = ${st}, updated_at = now()
                where user_id = ${d.vendor_data} and applicant_id = ${b.session_id}`;
    }
    res.status(200).end("ok");
  } catch (err) { console.error(err); res.status(500).end("server"); }
}

// Mengecek status KYC milik pengguna yang sedang login
async function kycStatus(req, res) {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "login" });
    const k = await sql`select status from kyc where user_id = ${uid}`;
    send(res, 200, { status: k.length ? k[0].status : "none" });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
}

module.exports = async (req, res) => {
  const kyc = (req.query && req.query.kyc) || "";
  if (kyc === "start") return kycStart(req, res);
  if (kyc === "webhook") return kycWebhook(req, res);
  if (kyc === "status") return kycStatus(req, res);
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
