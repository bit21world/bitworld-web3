import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

/* Config Constants */
const HOURLY_RATE = 0.004;
const DAILY_TOTAL = 0.096;
const SESSION_MS = 24 * 60 * 60 * 1000; // 24 Jam
const COOKIE = 'btw_sess';
const USER_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const REQUIRE_KYC_FOR_TRANSFER = false;

/* Setup Tables */
let ready = null;
function setup() {
  if (!ready) ready = (async () => {
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
  })().catch(err => { ready = null; throw err; });
  return ready;
}

/* Helpers */
function hashPassword(pw, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))))
  );
}
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}
function setCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`);
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
async function currentUser(req) {
  const t = readCookie(req);
  if (!t) return null;
  const rows = await sql`SELECT u.* FROM bw_sessions s JOIN bw_users u ON u.id = s.user_id
                         WHERE s.token_hash = ${sha256(t)} AND s.expires_at > now()`;
  return rows[0] || null;
}
function userJson(u) {
  return { id: u.id, username: u.username, name: u.name, wallet: u.wallet || '', is_admin: !!u.is_admin, balance: Number(u.balance || 0) };
}
async function openSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await sql`INSERT INTO bw_sessions (token_hash, user_id, expires_at)
            VALUES (${sha256(token)}, ${userId}, now() + interval '30 days')`;
  setCookie(res, token);
}

/* Encryption for KYC */
function kycKey() {
  const s = process.env.KYC_SECRET || 'bitworld_default_secret_key_2026_safe';
  return crypto.createHash('sha256').update(s).digest();
}
function enc(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', kycKey(), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function dec(b64) {
  const b = Buffer.from(b64, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', kycKey(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}

/* --- HANDLERS --- */

// AUTH
async function register(req, res) {
  const name = String(req.body?.name || '').trim();
  const username = String(req.body?.username || '').trim().replace(/^@+/, '');
  const password = String(req.body?.password || '');
  const wallet = String(req.body?.wallet || '').trim();

  if (!name || !USER_RE.test(username) || password.length < 8) return res.status(400).json({ error: 'invalid_input' });

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await hashPassword(password, salt);
  try {
    const rows = await sql`INSERT INTO bw_users (username, name, wallet, pass_salt, pass_hash)
                           VALUES (${username}, ${name}, ${wallet || null}, ${salt}, ${hash}) RETURNING *`;
    await openSession(res, rows[0].id);
    return res.status(201).json({ user: userJson(rows[0]) });
  } catch (err) {
    if (err && err.code === '23505') return res.status(409).json({ error: 'username_taken' });
    throw err;
  }
}

async function login(req, res) {
  const input = String(req.body?.username || req.body?.email || '').trim().replace(/^@+/, '');
  const password = String(req.body?.password || '');

  const users = await sql`SELECT * FROM bw_users WHERE LOWER(username) = LOWER(${input}) OR LOWER(name) = LOWER(${input}) LIMIT 1`;
  const u = users[0];

  let ok = false;
  if (u && u.pass_salt && u.pass_hash) {
    const hash = await hashPassword(password, u.pass_salt);
    ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pass_hash, 'hex'));
  }

  if (!ok) return res.status(401).json({ error: 'bad_credentials' });
  await openSession(res, u.id);
  return res.json({ user: userJson(u) });
}

async function logout(req, res) {
  const t = readCookie(req);
  if (t) await sql`DELETE FROM bw_sessions WHERE token_hash = ${sha256(t)}`;
  clearCookie(res);
  return res.json({ ok: true });
}

// MINING
async function status(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

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
    kyc: kycRow[0]?.status || 'none',
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

async function start(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  if (u.mine_start && (new Date() - new Date(u.mine_start)) < SESSION_MS) {
    return res.status(409).json({ error: 'session_already_active' });
  }

  const now = new Date();
  await sql`UPDATE bw_users SET mine_start = ${now.toISOString()} WHERE id = ${u.id}`;
  return res.json({ ok: true, mine_start: now });
}

async function claim(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  if (!u.mine_start || (new Date() - new Date(u.mine_start)) < SESSION_MS) {
    return res.status(400).json({ error: 'session_not_finished' });
  }

  await sql.transaction([
    sql`UPDATE bw_users SET balance = balance + ${DAILY_TOTAL}, mine_start = NULL WHERE id = ${u.id}`,
    sql`INSERT INTO bw_mining_log (user_id, amount) VALUES (${u.id}, ${DAILY_TOTAL})`
  ]);

  return res.json({ ok: true, claimed_amount: DAILY_TOTAL });
}

// WALLET & TRANSFER
async function wallet(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  const history = await sql`
    SELECT 'mining' as type, amount, created_at, null as other FROM bw_mining_log WHERE user_id = ${u.id}
    UNION ALL SELECT 'out', t.amount, t.created_at, u2.username FROM bw_transfers t JOIN bw_users u2 ON u2.id = t.to_id WHERE t.from_id = ${u.id}
    UNION ALL SELECT 'in', t.amount, t.created_at, u2.username FROM bw_transfers t JOIN bw_users u2 ON u2.id = t.from_id WHERE t.to_id = ${u.id}
    ORDER BY created_at DESC LIMIT 30`;

  return res.json({ balance: Number(u.balance), history });
}

async function transfer(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  const amount = Number(req.body?.amount);
  const targetUsername = String(req.body?.username || '').trim();

  if (!amount || amount <= 0 || !targetUsername) return res.status(400).json({ error: 'invalid_input' });

  const target = (await sql`SELECT id FROM bw_users WHERE LOWER(username) = LOWER(${targetUsername})`)[0];
  if (!target) return res.status(404).json({ error: 'user_not_found' });
  if (target.id === u.id) return res.status(400).json({ error: 'cannot_transfer_self' });

  const r = await sql`
    WITH src AS (UPDATE bw_users SET balance = balance - ${amount} WHERE id = ${u.id} AND balance >= ${amount} RETURNING id),
    dst AS (UPDATE bw_users SET balance = balance + ${amount} WHERE id = ${target.id} AND EXISTS (SELECT 1 FROM src) RETURNING id),
    ins AS (INSERT INTO bw_transfers (from_id, to_id, amount) SELECT ${u.id}, ${target.id}, ${amount} WHERE EXISTS (SELECT 1 FROM dst) RETURNING id)
    SELECT (SELECT COUNT(*) FROM dst)::int as ok`;

  if (!r[0]?.ok) return res.status(400).json({ error: 'insufficient_balance' });
  return res.json({ ok: true });
}

// MAIN ROUTER
export default async function handler(req, res) {
  try {
    await setup();
    const action = String(req.query?.a || req.body?.a || '');

    if (action === 'register') return await register(req, res);
    if (action === 'login') return await login(req, res);
    if (action === 'logout') return await logout(req, res);
    if (action === 'status' || req.url.includes('/api/profile')) return await status(req, res);
    if (action === 'start') return await start(req, res);
    if (action === 'claim') return await claim(req, res);
    if (action === 'wallet') return await wallet(req, res);
    if (action === 'transfer') return await transfer(req, res);

    return res.status(404).json({ error: 'action_not_found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
}
