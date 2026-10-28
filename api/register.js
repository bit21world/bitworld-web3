const bcrypt = require("bcryptjs");
const { sql, send, jsonOnly, getIp, limit } = require("./_lib");

module.exports = async (req, res) => {
  try {
    // Statistik publik: GET /api/register?stats=1 (hanya angka agregat)
    if (req.method === "GET" && req.query && req.query.stats) {
      const s = await sql`
        select count(*)::int as total,
               count(*) filter (where mine_start > now() - interval '24 hours')::int as active
        from bw_users`;
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return send(res, 200, { total: s[0].total, active: s[0].active });
    }

    if (!jsonOnly(req, res)) return;
    if (!(await limit("reg:" + getIp(req), 5, 60))) return send(res, 429, { error: "rate_limited" });

    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim().slice(0, 80);
    const pw = String(b.password || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200 || !name) {
      return send(res, 400, { error: "invalid_input" });
    }
    if (pw.length < 8 || pw.length > 72) {
      return send(res, 400, { error: "weak_password" });
    }

    const hash = await bcrypt.hash(pw, 10);

    // Verifikasi email dinonaktifkan: akun langsung aktif agar user baru bisa langsung masuk.
    // Keamanan hadiah/penarikan bertumpu pada KYC, bukan pada email.
    const rows = await sql`
      insert into bw_users (email, name, password_hash, email_verified)
      values (${email}, ${name}, ${hash}, true)
      on conflict (email) do nothing
      returning id
    `;

    if (!rows.length) return send(res, 409, { error: "email_taken" });

    send(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "server" });
  }
};
