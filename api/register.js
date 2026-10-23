const bcrypt = require("bcryptjs");
const { sql, send, jsonOnly, getIp, limit, sendVerifyMail } = require("./_lib");

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    const pw = String(b.password || "");

    if (!name || !email || pw.length < 8) {
      return send(res, 400, { error: "invalid_input" });
    }

    if (!(await limit("register:" + getIp(req), 5, 60))) {
      return send(res, 429, { error: "rate_limited" });
    }

    const check = await sql`select id from users where email = ${email}`;
    if (check.length) {
      return send(res, 400, { error: "email_exists" });
    }

    const passwordHash = await bcrypt.hash(pw, 10);
    
    // Menyimpan ke kolom 'password' sesuai tabel database Neon Anda
    const rows = await sql`
      insert into users (name, email, password, email_verified)
      values (${name}, ${email}, ${passwordHash}, false)
      returning id, name, email, email_verified
    `;

    const user = rows[0];
    await sendVerifyMail(user);

    send(res, 200, { ok: true, message: "registered" });
  } catch (e) {
    console.error("Register error:", e);
    send(res, 500, { error: "server" });
  }
};
