const crypto = require("crypto");
const { sql, send, getUid, settle, limit } = require("./_lib");

const REQUIRE_KYC_FOR_TRANSFER = true; // ubah ke false jika transfer tidak perlu KYC
const MAX_IMG = 1400000;               // batas panjang base64 per foto (~1 MB)

// Enkripsi AES-256-GCM untuk data KYC (kunci dari env KYC_SECRET)
function key() {
  const s = process.env.KYC_SECRET;
  if (!s || s.length < 24) throw new Error("KYC_SECRET belum diisi (min. 24 karakter)");
  return crypto.createHash("sha256").update(s).digest();
}
function enc(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
function dec(b64) {
  const b = Buffer.from(b64, "base64"), d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}
function jpeg(s) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ""));
  if (!m || m[1].length > MAX_IMG) return null;
  const b = Buffer.from(m[1], "base64");
  return b[0] === 0xff && b[1] === 0xd8 ? b : null;
}
const maskEmail = (e) => e.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const post = req.method === "POST";
    if (post && !(req.headers["content-type"] || "").includes("application/json")) return send(res, 415, { error: "invalid_input" });
    const q = post ? (req.body || {}) : req.query || {};
    const a = String(q.a || "");
    await settle(uid);
    const me = (await sql`select id, email, balance, is_admin,
      (select status from bw_kyc k where k.user_id = ${uid} order by k.id desc limit 1) as kyc from bw_users where id = ${uid}`)[0];
    if (!me) return send(res, 401, { error: "not_logged_in" });
    const kycStatus = me.kyc || "none";
    /* ---------- POOL MINING ---------- */
    if (a === "pool") {
      const r = await sql`select total, used from bw_pool where id = 1`;
      const total = r.length ? Number(r[0].total) : 10500000;
      const used = r.length ? Number(r[0].used) : 0;
      return send(res, 200, { total, used, remaining: Math.max(0, total - used), percent: total ? Math.min(100, used / total * 100) : 0 });
      }
    /* ---------- WALLET ---------- */
    if (a === "wallet") {
      const h = await sql`
        select 'mining' as type, amount, created_at, null::text as other from bw_mining_log where user_id = ${uid}
        union all select 'out', t.amount, t.created_at, u.email from bw_transfers t join bw_users u on u.id = t.to_id where t.from_id = ${uid}
        union all select 'in', t.amount, t.created_at, u.email from bw_transfers t join bw_users u on u.id = t.from_id where t.to_id = ${uid}
        order by created_at desc limit 30`;
      return send(res, 200, { balance: Number(me.balance), kyc: kycStatus,
        history: h.map((x) => ({ type: x.type, amount: Number(x.amount), at: x.created_at, other: x.other ? maskEmail(x.other) : null })) });
    }
    if (a === "lookup" && post) {
      if (!(await limit("lookup:" + uid, 30, 10))) return send(res, 429, { error: "rate_limited" });
      const email = clean(q.email, 200).toLowerCase();
      if (email === me.email) return send(res, 400, { error: "self" });
      const r = await sql`select email, name from bw_users where email = ${email} and email_verified = true`;
      if (!r.length) return send(res, 404, { error: "not_found" });
      return send(res, 200, { found: true, label: maskEmail(r[0].email) + " (" + String(r[0].name || "").split(" ")[0] + ")" });
    }
    if (a === "transfer" && post) {
      if (REQUIRE_KYC_FOR_TRANSFER && kycStatus !== "approved") return send(res, 403, { error: "kyc_required" });
      if (!(await limit("tx:" + uid, 20, 60))) return send(res, 429, { error: "rate_limited" });
      const amount = Math.round(Number(q.amount) * 1e6) / 1e6;
      if (!isFinite(amount) || amount < 0.001 || amount > 1e9) return send(res, 400, { error: "invalid_input" });
      const email = clean(q.email, 200).toLowerCase();
      if (email === me.email) return send(res, 400, { error: "self" });
      const to = await sql`select id from bw_users where email = ${email} and email_verified = true`;
      if (!to.length) return send(res, 404, { error: "not_found" });
      const r = await sql`
        with src as (update bw_users set balance = balance - ${amount}::numeric where id = ${uid} and balance >= ${amount}::numeric returning id),
        dst as (update bw_users set balance = balance + ${amount}::numeric where id = ${to[0].id} and exists (select 1 from src) returning id),
        ins as (insert into bw_transfers (from_id, to_id, amount) select ${uid}, ${to[0].id}, ${amount}::numeric where exists (select 1 from dst) returning id)
        select (select count(*) from dst)::int as ok`;
      if (!r[0].ok) return send(res, 400, { error: "insufficient" });
      return send(res, 200, { ok: true });
    }

    /* ---------- KYC (pengguna) ---------- */
    if (a === "kyc") {
      const r = await sql`select status, full_name, reject_reason, created_at from bw_kyc where user_id = ${uid} order by id desc limit 1`;
      return send(res, 200, r.length ? r[0] : { status: "none" });
    }
    if (a === "kyc_submit" && post) {
      if (kycStatus === "pending" || kycStatus === "approved") return send(res, 400, { error: "kyc_pending" });
      if (!(await limit("kyc:" + uid, 5, 1440))) return send(res, 429, { error: "rate_limited" });
      const name = clean(q.full_name, 100), country = clean(q.country, 60), idn = clean(q.id_number, 32);
      const bd = String(q.birth_date || "");
      const ktp = jpeg(q.ktp), selfie = jpeg(q.selfie);
      const age = (Date.now() - new Date(bd).getTime()) / 31557600000;
      if (q.consent !== true || name.length < 2 || country.length < 2 || !/^[A-Za-z0-9.\-]{6,32}$/.test(idn) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(bd) || !(age >= 18 && age < 110) || !ktp || !selfie) return send(res, 400, { error: "invalid_input" });
      await sql`insert into bw_kyc (user_id, full_name, birth_date, country, id_number_enc, id_last4, ktp_enc, selfie_enc)
                values (${uid}, ${name}, ${bd}, ${country}, ${enc(Buffer.from(idn))}, ${idn.slice(-4)}, ${enc(ktp)}, ${enc(selfie)})`;
      return send(res, 200, { ok: true });
    }

    /* ---------- KYC (admin) ---------- */
    if (a.startsWith("kyc_") && a !== "kyc_submit") {
      if (!me.is_admin) return send(res, 403, { error: "forbidden" });
      if (a === "kyc_list") {
        const st = ["pending", "approved", "rejected"].includes(q.status) ? q.status : "pending";
        const r = await sql`select k.id, k.full_name, k.country, k.created_at, u.email from bw_kyc k join bw_users u on u.id = k.user_id
                            where k.status = ${st} order by k.id desc limit 50`;
        return send(res, 200, { list: r });
      }
      if (a === "kyc_view") {
        const r = await sql`select k.*, u.email from bw_kyc k join bw_users u on u.id = k.user_id where k.id = ${Number(q.id) || 0}`;
        if (!r.length) return send(res, 404, { error: "not_found" });
        const k = r[0];
        return send(res, 200, { id: k.id, status: k.status, email: k.email, full_name: k.full_name, birth_date: String(k.birth_date).slice(0, 10),
          country: k.country, id_number: dec(k.id_number_enc).toString(), ktp: dec(k.ktp_enc).toString("base64"), selfie: dec(k.selfie_enc).toString("base64") });
      }
      if (a === "kyc_review" && post) {
        const ok = q.decision === "approved", reason = clean(q.reason, 200);
        if (!ok && q.decision !== "rejected") return send(res, 400, { error: "invalid_input" });
        const r = await sql`update bw_kyc set status = ${q.decision}, reject_reason = ${ok ? null : reason}, reviewed_by = ${uid}, reviewed_at = now()
                            where id = ${Number(q.id) || 0} and status = 'pending' returning id`;
        return r.length ? send(res, 200, { ok: true }) : send(res, 400, { error: "invalid_input" });
      }
    }
    send(res, 400, { error: "invalid_input" });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
