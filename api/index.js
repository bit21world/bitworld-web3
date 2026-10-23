import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

const HOURLY_RATE = 0.004; // Poin per jam
const DAILY_TOTAL = 0.096; // 0.004 * 24 jam
const SESSION_MS = 24 * 60 * 60 * 1000; // 24 jam
const COOKIE = 'btw_sess';
const USER_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/* KYC Constants */
const DOC_RE = /^[A-Za-z0-9 .\-]{5,32}$/;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const IMG_MAX = 1500000;

/* ---------- Setup Tabel Base ---------- */
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
    await sql`CREATE TABLE IF NOT EXISTS bw_kyc_submissions (
      id BIGSERIAL PRIMARY KEY, 
      user_id BIGINT NOT NULL UNIQUE REFERENCES bw_users(id) ON DELETE CASCADE, 
      full_name TEXT NOT NULL, 
      doc_number TEXT NOT NULL, 
      doc_image TEXT NOT NULL, 
      selfie_image TEXT NOT NULL, 
      status TEXT NOT NULL DEFAULT 'pending', 
      note TEXT, 
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), 
      reviewed_at TIMESTAMPTZ
    )`;
  })().catch(err => { ready = null; throw err; });
  return ready;
}

/* ---------- Helper ---------- */
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
  return { id: u.id, username: u.username, name: u.name, wallet: u.wallet || '', joined: u.created_at, balance: Number(u.balance || 0) };
}
async function openSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await sql`INSERT INTO bw_sessions (token_hash, user_id, expires_at)
            VALUES (${sha256(token)}, ${userId}, now() + interval '30 days')`;
  setCookie(res, token);
}

/* ---------- Auth ---------- */
async function register(req, res) {
  const name = String(req.body?.name || '').trim();
  const username = String(req.body?.username || '').trim().replace(/^@+/, '');
  const password = String(req.body?.password || '');
  const wallet = String(req.body?.wallet || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  if (!USER_RE.test(username)) return res.status(400).json({ error: 'username_invalid' });
  if (password.length < 8) return res.status(400).json({ error: 'password_short' });
  if (wallet && !WALLET_RE.test(wallet)) return res.status(400).json({ error: 'wallet_invalid' });

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
  const username = String(req.body?.username || '').trim().replace(/^@+/, '');
  const password = String(req.body?.password || '');
  const user = (await sql`SELECT * FROM bw_users WHERE username = ${username}`)[0];
  let ok = false;
  if (user) {
    const hash = await hashPassword(password, user.pass_salt);
    ok = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.pass_hash, 'hex'));
  }
  if (!ok) return res.status(401).json({ error: 'bad_credentials' });
  await openSession(res, user.id);
  return res.json({ user: userJson(user) });
}

async function logout(req, res) {
  const t = readCookie(req);
  if (t) await sql`DELETE FROM bw_sessions WHERE token_hash = ${sha256(t)}`;
  clearCookie(res);
  return res.json({ ok: true });
}

async function me(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  return res.json({ user: userJson(u) });
}

/* ---------- Mining Logic (24-Hour Cycle) ---------- */
async function status(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  let mineStart = u.mine_start ? new Date(u.mine_start) : null;
  let active = false;
  let elapsedMs = 0;
  let currentUnclaimed = 0;

  if (mineStart) {
    const now = new Date();
    elapsedMs = now - mineStart;
    if (elapsedMs < SESSION_MS) {
      active = true;
      const hours = elapsedMs / (1000 * 60 * 60);
      currentUnclaimed = Math.min(DAILY_TOTAL, hours * HOURLY_RATE);
    }
  }

  const history = await sql`SELECT created_at, amount FROM bw_mining_log
                            WHERE user_id = ${u.id} ORDER BY created_at DESC LIMIT 20`;

  return res.json({
    user: userJson(u),
    balance: Number(u.balance || 0),
    mining: {
      active,
      mine_start: mineStart,
      hourly_rate: HOURLY_RATE,
      unclaimed: Number(currentUnclaimed.toFixed(6)),
      duration_ms: SESSION_MS
    },
    history
  });
}

async function start(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  if (u.mine_start) {
    const elapsed = new Date() - new Date(u.mine_start);
    if (elapsed < SESSION_MS) return res.status(409).json({ error: 'session_already_active' });
  }

  const now = new Date();
  await sql`UPDATE bw_users SET mine_start = ${now.toISOString()} WHERE id = ${u.id}`;
  return res.json({ ok: true, mine_start: now });
}

async function claim(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  if (!u.mine_start) return res.status(400).json({ error: 'no_active_session' });

  const now = new Date();
  const elapsedMs = now - new Date(u.mine_start);
  if (elapsedMs < SESSION_MS) return res.status(409).json({ error: 'session_not_finished' });

  const reward = DAILY_TOTAL;

  await sql.transaction([
    sql`UPDATE bw_users SET balance = balance + ${reward}, mine_start = NULL WHERE id = ${u.id}`,
    sql`INSERT INTO bw_mining_log (user_id, amount) VALUES (${u.id}, ${reward})`
  ]);

  return res.json({ ok: true, claimed_amount: reward });
}

/* ---------- Router Utama ---------- */
const ROUTES = {
  register:   { m: 'POST', fn: register },
  login:      { m: 'POST', fn: login },
  logout:     { m: 'POST', fn: logout },
  me:         { m: 'GET',  fn: me },
  status:     { m: 'GET',  fn: status },
  start:      { m: 'POST', fn: start },
  claim:      { m: 'POST', fn: claim }
};

export default async function handler(req, res) {
  try {
    await setup();
    
    if (req.url.includes('/api/profile')) {
      return await status(req, res);
    }

    const a = String(req.query?.a || '');
    const r = ROUTES[a];
    if (!r) return res.status(404).json({ error: 'unknown_route' });
    if (req.method !== r.m) return res.status(405).json({ error: 'method_not_allowed' });
    return await r.fn(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
}
