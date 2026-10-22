import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

const POOL_TOTAL = 10500000;
const PHASE_SIZE = POOL_TOTAL / 4;
const RATES = [0.12, 0.06, 0.03, 0.015];
const SESSION_MS = 24 * 60 * 60 * 1000;
const COOKIE = 'btw_sess';
const USER_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/* KYC */
const DOC_RE = /^[A-Za-z0-9 .\-]{5,32}$/;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const IMG_MAX = 1500000; // karakter data URL per foto (~1.1 MB)

/* ---------- Tabel database (dibuat otomatis) ---------- */
let ready = null;
function setup() {
  if (!ready) ready = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, wallet TEXT, pass_salt TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS pool (id INT PRIMARY KEY, claimed NUMERIC(30,8) NOT NULL DEFAULT 0)`;
    await sql`INSERT INTO pool (id, claimed) VALUES (1, 0) ON CONFLICT (id) DO NOTHING`;
    await sql`CREATE TABLE IF NOT EXISTS mining_sessions (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day DATE NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), end_at TIMESTAMPTZ NOT NULL, claimed_at TIMESTAMPTZ, reward NUMERIC(30,8), phase INT, UNIQUE (user_id, day))`;
    await sql`CREATE TABLE IF NOT EXISTS kyc_submissions (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, full_name TEXT NOT NULL, doc_number TEXT NOT NULL, doc_image TEXT NOT NULL, selfie_image TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', note TEXT, submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ)`;
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
  const rows = await sql`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                         WHERE s.token_hash = ${sha256(t)} AND s.expires_at > now()`;
  return rows[0] || null;
}
function userJson(u) {
  return { id: u.id, username: u.username, name: u.name, wallet: u.wallet || '', joined: u.created_at };
}
function phaseOf(claimed) { return Math.min(3, Math.floor(Number(claimed) / PHASE_SIZE)); }
async function openSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (${sha256(token)}, ${userId}, now() + interval '30 days')`;
  setCookie(res, token);
}

/* Admin: kunci rahasia dari environment variable ADMIN_KEY (min. 12 karakter) */
function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  if (!key || key.length < 12) return false;
  const got = String(req.headers['x-admin-key'] || '');
  return crypto.timingSafeEqual(Buffer.from(sha256(got), 'hex'), Buffer.from(sha256(key), 'hex'));
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
    const rows = await sql`INSERT INTO users (username, name, wallet, pass_salt, pass_hash)
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
  const user = (await sql`SELECT * FROM users WHERE username = ${username}`)[0];
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
  if (t) await sql`DELETE FROM sessions WHERE token_hash = ${sha256(t)}`;
  clearCookie(res);
  return res.json({ ok: true });
}

async function me(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  return res.json({ user: userJson(u) });
}

/* ---------- KYC ---------- */
async function kycStatus(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  const r = (await sql`SELECT status, note, submitted_at, reviewed_at FROM kyc_submissions WHERE user_id = ${u.id}`)[0];
  if (!r) return res.json({ status: 'none' });
  return res.json({ status: r.status, note: r.note || '', submitted_at: r.submitted_at, reviewed_at: r.reviewed_at });
}

async function kycSubmit(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  const fullName = String(req.body?.fullName || '').trim();
  const docNumber = String(req.body?.docNumber || '').trim();
  const docImage = String(req.body?.docImage || '');
  const selfieImage = String(req.body?.selfieImage || '');

  if (fullName.length < 3 || fullName.length > 80) return res.status(400).json({ error: 'name_invalid' });
  if (!DOC_RE.test(docNumber)) return res.status(400).json({ error: 'doc_invalid' });
  if (docImage.length > IMG_MAX || !IMG_RE.test(docImage)) return res.status(400).json({ error: 'doc_image_invalid' });
  if (selfieImage.length > IMG_MAX || !IMG_RE.test(selfieImage)) return res.status(400).json({ error: 'selfie_image_invalid' });

  const rows = await sql`INSERT INTO kyc_submissions (user_id, full_name, doc_number, doc_image, selfie_image)
                         VALUES (${u.id}, ${fullName}, ${docNumber}, ${docImage}, ${selfieImage})
                         ON CONFLICT (user_id) DO UPDATE SET
                           full_name = EXCLUDED.full_name, doc_number = EXCLUDED.doc_number,
                           doc_image = EXCLUDED.doc_image, selfie_image = EXCLUDED.selfie_image,
                           status = 'pending', note = NULL, submitted_at = now(), reviewed_at = NULL
                         WHERE kyc_submissions.status = 'rejected'
                         RETURNING id`;
  if (!rows.length) {
    const ex = (await sql`SELECT status FROM kyc_submissions WHERE user_id = ${u.id}`)[0];
    return res.status(409).json({ error: ex && ex.status === 'verified' ? 'already_verified' : 'already_pending' });
  }
  return res.status(201).json({ status: 'pending' });
}

async function kycList(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  const status = ['pending', 'verified', 'rejected'].includes(req.query?.status) ? req.query.status : 'pending';
  const rows = await sql`SELECT k.id, k.status, k.full_name, k.doc_number, k.doc_image, k.selfie_image,
                                k.submitted_at, k.note, u.username
                         FROM kyc_submissions k JOIN users u ON u.id = k.user_id
                         WHERE k.status = ${status} ORDER BY k.submitted_at ASC LIMIT 20`;
  return res.json({ items: rows });
}

async function kycReview(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'forbidden' });
  const id = Number(req.body?.id);
  const status = String(req.body?.status || '');
  const note = String(req.body?.note || '').slice(0, 200);
  if (!Number.isInteger(id) || !['verified', 'rejected'].includes(status)) return res.status(400).json({ error: 'bad_request' });
  const rows = await sql`UPDATE kyc_submissions SET status = ${status}, note = ${note || null}, reviewed_at = now()
                         WHERE id = ${id} RETURNING id`;
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  return res.json({ ok: true });
}

/* ---------- Mining ---------- */
async function status(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });

  const claimed = Number((await sql`SELECT claimed FROM pool WHERE id = 1`)[0].claimed);
  const phase = phaseOf(claimed);
  const current = (await sql`SELECT * FROM mining_sessions WHERE user_id = ${u.id} AND claimed_at IS NULL
                             ORDER BY started_at DESC LIMIT 1`)[0] || null;
  const startedToday = (await sql`SELECT 1 FROM mining_sessions
                                  WHERE user_id = ${u.id} AND day = (now() AT TIME ZONE 'UTC')::date`).length > 0;
  const totals = (await sql`SELECT COALESCE(SUM(reward), 0) AS reward,
                                   COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) AS sessions
                            FROM mining_sessions WHERE user_id = ${u.id}`)[0];
  const history = await sql`SELECT started_at, claimed_at, reward, phase FROM mining_sessions
                            WHERE user_id = ${u.id} ORDER BY started_at DESC LIMIT 20`;

  return res.json({
    user: userJson(u),
    pool: { claimed, total: POOL_TOTAL, phase: phase + 1, rate: RATES[phase] },
    current: current ? { started_at: current.started_at, end_at: current.end_at, finished: new Date(current.end_at) <= new Date() } : null,
    started_today: startedToday,
    totals: { reward: Number(totals.reward), sessions: Number(totals.sessions) },
    history
  });
}

async function start(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  const open = await sql`SELECT 1 FROM mining_sessions WHERE user_id = ${u.id} AND claimed_at IS NULL`;
  if (open.length) return res.status(409).json({ error: 'claim_first' });
  const rows = await sql`INSERT INTO mining_sessions (user_id, day, end_at)
                         VALUES (${u.id}, (now() AT TIME ZONE 'UTC')::date,
                                 now() + (${SESSION_MS / 1000} * interval '1 second'))
                         ON CONFLICT (user_id, day) DO NOTHING RETURNING *`;
  if (!rows.length) return res.status(409).json({ error: 'daily_limit' });
  return res.status(201).json({ session: rows[0] });
}

async function claim(req, res) {
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'not_logged_in' });
  const cur = (await sql`SELECT * FROM mining_sessions WHERE user_id = ${u.id} AND claimed_at IS NULL
                         ORDER BY started_at DESC LIMIT 1`)[0];
  if (!cur) return res.status(404).json({ error: 'no_session' });
  if (new Date(cur.end_at) > new Date()) return res.status(409).json({ error: 'not_finished' });

  const claimed = Number((await sql`SELECT claimed FROM pool WHERE id = 1`)[0].claimed);
  if (claimed >= POOL_TOTAL) return res.status(409).json({ error: 'pool_empty' });
  const phase = phaseOf(claimed);
  const reward = RATES[phase];

  await sql.transaction([
    sql`UPDATE mining_sessions SET claimed_at = now(), reward = ${reward}, phase = ${phase + 1}
        WHERE id = ${cur.id} AND claimed_at IS NULL`,
    sql`UPDATE pool SET claimed = claimed + ${reward} WHERE id = 1`
  ]);
  return res.json({ reward, phase: phase + 1 });
}

/* ---------- Router: /api?a=nama_aksi ---------- */
const ROUTES = {
  register:   { m: 'POST', fn: register },
  login:      { m: 'POST', fn: login },
  logout:     { m: 'POST', fn: logout },
  me:         { m: 'GET',  fn: me },
  status:     { m: 'GET',  fn: status },
  start:      { m: 'POST', fn: start },
  claim:      { m: 'POST', fn: claim },
  kyc_status: { m: 'GET',  fn: kycStatus },
  kyc_submit: { m: 'POST', fn: kycSubmit },
  kyc_list:   { m: 'GET',  fn: kycList },
  kyc_review: { m: 'POST', fn: kycReview }
};

export default async function handler(req, res) {
  try {
    await setup();
    const r = ROUTES[String(req.query?.a || '')];
    if (!r) return res.status(404).json({ error: 'unknown_route' });
    if (req.method !== r.m) return res.status(405).json({ error: 'method_not_allowed' });
    return await r.fn(req, res);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
}
