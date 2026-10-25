const crypto = require("crypto");
const { sql } = require("./_lib");

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
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
};

module.exports.config = { api: { bodyParser: false } };
