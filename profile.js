import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
const COOKIE = 'btw_sess';
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const POOL_TOTAL = 10500000;
const PHASE_SIZE = POOL_TOTAL / 4;
const RATES = [0.12, 0.06, 0.03, 0.015];

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + COOKIE + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

async function currentUser(req) {
  const t = readCookie(req);
  if (!t) return null;
  const rows = await sql`
    SELECT u.id, u.username, u.name, u.wallet, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(t)} AND s.expires_at > now()`;
  return rows[0] || null;
}

async function summary(u) {
  const agg = (await sql`
    SELECT COALESCE(SUM(reward), 0) AS balance, COUNT(*) AS sessions
    FROM mining_sessions WHERE user_id = ${u.id} AND claimed_at IS NOT NULL`)[0];
  const history = await sql`
    SELECT day, reward, claimed_at FROM mining_sessions
    WHERE user_id = ${u.id} AND claimed_at IS NOT NULL
    ORDER BY claimed_at DESC LIMIT 10`;
  const open = (await sql`
    SELECT started_at, end_at FROM mining_sessions
    WHERE user_id = ${u.id} AND claimed_at IS NULL
    ORDER BY started_at DESC LIMIT 1`)[0] || null;
  const poolRow = (await sql`SELECT claimed FROM pool WHERE id = 1`)[0];
  const poolClaimed = poolRow ? Number(poolRow.claimed) : 0;
  const phase = Math.min(3, Math.floor(poolClaimed / PHASE_SIZE));
  const todayRow = (await sql`
    SELECT 1 FROM mining_sessions
    WHERE user_id = ${u.id} AND day = (now() AT TIME ZONE 'UTC')::date`)[0];
  return {
    pool: {
      claimed: poolClaimed,
      total: POOL_TOTAL,
      percent: (poolClaimed / POOL_TOTAL) * 100,
      phase: phase + 1,
      rate: RATES[phase]
    },
    today_done: !!todayRow,
    user: {
      username: u.username,
      name: u.name,
      wallet: u.wallet,
      created_at: u.created_at
    },
    balance: Number(agg.balance),
    sessions: Number(agg.sessions),
    history: history.map(h => ({ day: h.day, reward: Number(h.reward), claimed_at: h.claimed_at })),
    active: open
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const u = await currentUser(req);
    if (!u) return res.status(401).json({ error: 'not_logged_in' });

    if (req.method === 'GET') {
      return res.json(await summary(u));
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      body = body || {};
      const name = String(body.name || '').trim();
      const wallet = String(body.wallet || '').trim();
      if (name.length < 1 || name.length > 60) return res.status(400).json({ error: 'invalid_name' });
      if (wallet && !WALLET_RE.test(wallet)) return res.status(400).json({ error: 'invalid_wallet' });
      await sql`UPDATE users SET name = ${name}, wallet = ${wallet || null} WHERE id = ${u.id}`;
      const fresh = { ...u, name, wallet: wallet || null };
      return res.json(await summary(fresh));
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
}
