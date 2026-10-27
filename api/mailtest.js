// ENDPOINT TES SEMENTARA - hapus file ini setelah masalah email selesai.
// Buka: https://bitworld-web3-phi.vercel.app/api/mailtest?k=bw-test-2026&to=EMAIL_TUJUAN
// Tanpa &to= hanya menampilkan info konfigurasi (tidak mengirim email).
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const q = req.query || {};
  if (q.k !== "bw-test-2026") return res.status(403).send(JSON.stringify({ error: "forbidden" }));

  const key = String(process.env.BREVO_API_KEY || "").trim();
  const rawFrom = String(process.env.MAIL_FROM || "").trim().replace(/^["']+|["']+$/g, "");
  let sender = null;
  const m = rawFrom.match(/^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/);
  if (m) sender = { name: m[1].trim().replace(/["']/g, "") || "Bitworld", email: m[2].trim() };
  else if (/^[^<>\s]+@[^<>\s]+$/.test(rawFrom)) sender = { name: "Bitworld", email: rawFrom };

  const out = {
    info: {
      vercel_env: process.env.VERCEL_ENV || null,
      deployment: process.env.VERCEL_URL || null,
      git_commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
      git_message: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      has_BREVO_API_KEY: !!key,
      brevo_key_prefix: key ? key.slice(0, 8) : null,
      brevo_key_length: key.length,
      has_RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      has_MAIL_FROM: !!rawFrom,
      sender_parsed: sender,
      SITE_URL: process.env.SITE_URL || "(tidak diisi, memakai bawaan)"
    }
  };

  const to = String(q.to || "").trim();
  if (!to) return res.status(200).send(JSON.stringify(out, null, 2));
  if (!key) { out.result = "BREVO_API_KEY tidak terbaca oleh deployment ini"; return res.status(200).send(JSON.stringify(out, null, 2)); }
  if (!sender) { out.result = "MAIL_FROM tidak valid / kosong"; return res.status(200).send(JSON.stringify(out, null, 2)); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { out.result = "parameter to bukan email yang valid"; return res.status(200).send(JSON.stringify(out, null, 2)); }

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender, to: [{ email: to }], subject: "Tes email Bitworld",
        htmlContent: "<p>Ini email tes dari Bitworld. Jika Anda menerimanya, pengiriman via Brevo sudah berfungsi.</p>"
      })
    });
    out.brevo_status = r.status;
    out.brevo_response = await r.text();
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  }
  res.status(200).send(JSON.stringify(out, null, 2));
};
