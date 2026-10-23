hereconst crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

// Ambil URL Database dari Environment Variables Vercel
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

/* Config Constants */
const HOURLY_RATE = 0.004;
const DAILY_TOTAL = 0.096;
const SESSION_MS = 24 * 60 * 60 * 1000; // 24 Jam
const COOKIE = "btw_sess";
const USER_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

/* Setup Tables Otomatis jika Belum Ada */
let ready = null;
function setup() {
  if (!sql) throw new Error("DATABASE_URL / POSTGRES_URL belum diisi di Vercel Settings");
  if (!ready) {
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS bw_users (
        id BIGSERIAL PRIMARY KEY, 
        username TEXT UNIQUE NOT NULL, 
        name TEXT NOT NULL, 
        wallet TEXT, 
        pass_salt TEXT NOT NULL, 
        pass_hash TEXT NOT NULL, 
        balance NUMERIC(20,6) NOT NULL DEFAULT 0,
        mine_start TIMESTAMPTZ,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS bw_sessions (
        token_hash TEXT PRIMARY KEY, 
        user_id BIGINT NOT NULL REFERENCES bw_users(id) ON DELETE CASCADE, 
        expires_at TIMESTAMPTZ NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS bw_mining_log (
        id BIGSERIAL PRIMARY KEY, 
        user_id BIGINT NOT NULL REFERENCES bw_users(id) ON DELETE CASCADE, 
        amount NUMERIC(20,6) NOT NULL, 
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS bw_kyc (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES bw_users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        birth_date DATE NOT NULL,
        country TEXT NOT NULL,
        id_number_enc TEXT NOT NULL,
        id_last4 TEXT NOT NULL,
        ktp_enc TEXT NOT NULL,
        selfie_enc TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reject_reason TEXT,
        reviewed_by BIGINT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS bw_transfers (
        id BIGSERIAL PRIMARY KEY,
        from_id BIGINT NOT NULL REFERENCES bw_users(id),
        to_id BIGINT NOT NULL REFERENCES bw_users(id),
        amount NUMERIC(20,6) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    )().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/* Helpers */
function hashPassword(pw, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString("hex"))))
  );
}
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|; )" + COOKIE + "=([^;]+)"));
  return m ? m[1] : null;
}
function setCookie(res, token) {
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
}
function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
async function currentUser(req) {
  const t = readCookie(req);
  if (!t) return null;
  const rows = await sql`SELECT u.* FROM bw_sessions s JOIN bw_users u ON u.id = s.user_id
                         WHERE s.token_hash = ${sha256(t)} AND s.expires_at > now()`;
  return rows[0] || null;
}
function userJson(u) {
  return { id: u.id, username: u.username, name: u.name, wallet: u.wallet || "", is_admin: !!u.is_admin, balance: Number(u.balance || 0) };
}
async function openSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await sql`INSERT INTO bw_sessions (token_hash, user_id, expires_at)
            VALUES (${sha256(token)}, ${userId}, now() + interval '30 days')`;
  setCookie(res, token);
}

/* HANDLERS */
async function register(req, res) {
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().replace(/^@+/, "");
  const password = String(req.body?.password || "");
  const wallet = String(req.body?.wallet || "").trim();

  if (!name || !USER_RE.test(username) || password.length < 8) return res.status(400).json({ error: "invalid_input" });

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await hashPassword(password, salt);
  try {
    const rows = await sql`INSERT INTO bw_users (username, name, wallet, pass_salt, pass_hash)
                           VALUES (${username}, ${name}, ${wallet || null}, ${salt}, ${hash}) RETURNING *`;
    await openSession(res, rows[0].id);
    return res.status(201).json({ user: userJson(rows[0]) });
  } catch (err) {
    if (err && err.code === "23505") return res.status(409).json({ error: "username_taken" });
    throw err;
  }
}

async function login(req, res) {
  const input = String(req.body?.username || req.body?.email || "").trim().replace(/^@+/, "");
  const password = String(req.body?.password || "");

  const users = await sql`SELECT * FROM bw_users WHERE LOWER(username) = LOWER(${input}) OR LOWER(name) = LOWER(${input}) LIMIT 1`;
  const u = users[0];

  let ok = false;
  if (u && u.pass_salt && u.pass_hash) {
    const hash = await hashPassword(password, u.pass_salt);
    ok = crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(u.pass_hash, "hex"));
  }

  if (!ok) return res.status(401).json({ error: "bad_credentials" });
  await openSession(res, u.id);
  return res.json({ user: userJson(u) });
}

async function logout(req, res) {
  const t = readCookie(req);
  if (t) await sql`DELETE FROM bw_sessions WHERE token_hash = ${sha256(t)}`;
  clearCookie(res);
  return res.json({ ok: true });
}

async function status(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: "not_logged_in" });

  let mineStart = u.mine_start ? new Date(u.mine_start) : null;
  let active = false;
  let currentUnclaimed = 0;

  if (mineStart) {
    const elapsedMs = new Date() - mineStart;
    if (elapsedMs < SESSION_MS) {
      active = true;
      const hours = elapsedMs / (1000 * 60 * 60);
      currentUnclaimed = Math.min(DAILY_TOTAL, hours * HOURLY_RATE);
    }
  }

  const kycRow = await sql`SELECT status FROM bw_kyc WHERE user_id = ${u.id} ORDER BY id DESC LIMIT 1`;

  return res.json({
    user: userJson(u),
    balance: Number(u.balance || 0),
    kyc: kycRow[0]?.status || "none",
    mining: {
      active,
      mine_start: mineStart,
      hourly_rate: HOURLY_RATE,
      unclaimed: Number(currentUnclaimed.toFixed(6)),
      duration_ms: SESSION_MS
    },
    pool: { rate: HOURLY_RATE, display_rate: "0.004 BTW / jam", total: 10500000, phase: 1 }
  });
}

/* MAIN EXPORT */
module.exports = async (req, res) => {
  try {
    await setup();
    const action = String(req.query?.a || req.body?.a || "");

    if (action === "register") return await register(req, res);
    if (action === "login") return await login(req, res);
    if (action === "logout") return await logout(req, res);
    if (action === "status" || req.url.includes("/api/profile")) return await status(req, res);

    return res.status(404).json({ error: "action_not_found" });
  } catch (err) {
    console.error("BITWORLD_API_ERROR:", err);
    return res.status(500).json({ error: "server_error", message: err.message });
  }
};
