import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Jalankan migrasi langsung jika parameter ?a=migrate dipanggil
    if (req.query && req.query.a === 'migrate') {
      try {
        await sql`ALTER TABLE users ALTER COLUMN name DROP NOT NULL`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(30) UNIQUE`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)`;
        return res.json({ ok: true, message: 'Migration success!' });
      } catch (err) {
        return res.json({ ok: true, message: 'Already migrated or handled', details: err.message });
      }
    }

    return res.json({ ok: true, message: 'Profile API is running smoothly' });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
}
