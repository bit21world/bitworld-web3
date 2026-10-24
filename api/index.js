const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.KYC_SECRET || 'bitworld_secret_key_2026_super_safe';

function getDb() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Database URL (POSTGRES_URL/DATABASE_URL) belum terpasang di Vercel Settings.");
  return neon(dbUrl);
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = getDb();

    // Buat tabel bw_users jika belum ada
    await sql`
      CREATE TABLE IF NOT EXISTS bw_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        wallet_address VARCHAR(255),
        kyc_status VARCHAR(50) DEFAULT 'unverified',
        balance NUMERIC(18, 6) DEFAULT 0,
        last_mined_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Normalisasi URL Path
    const rawPath = req.url.split('?')[0];
    const path = rawPath.toLowerCase();

    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    // HANDLER REGISTER (Mendukung semua kemungkinan URL endpoint)
    if (req.method === 'POST' && (path.includes('register') || path.includes('signup'))) {
      const { email, password, name, username } = body;
      const userEmail = email || username;

      if (!userEmail || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const existing = await sql`SELECT id FROM bw_users WHERE email = ${userEmail}`;
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await sql`
        INSERT INTO bw_users (email, password, name) 
        VALUES (${userEmail}, ${hashedPassword}, ${name || ''}) 
        RETURNING id, email, name, balance, kyc_status
      `;

      const token = jwt.sign({ userId: newUser[0].id, email: newUser[0].email }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(200).json({
        success: true,
        message: 'Registrasi berhasil!',
        token,
        user: newUser[0]
      });
    }

    // HANDLER LOGIN (Mendukung semua kemungkinan URL endpoint)
    if (req.method === 'POST' && (path.includes('login') || path.includes('signin'))) {
      const { email, password, username } = body;
      const userEmail = email || username;

      if (!userEmail || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const users = await sql`SELECT * FROM bw_users WHERE email = ${userEmail}`;
      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'Email atau password salah.' });
      }

      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ success: false, message: 'Email atau password salah.' });
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      return res.status(200).json({
        success: true,
        message: 'Login berhasil!',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          balance: user.balance,
          kyc_status: user.kyc_status
        }
      });
    }

    // Fallback jika memanggil URL /api biasa
    return res.status(200).json({
      success: true,
      message: "Bitworld API Vercel Serverless Ready",
      path: path
    });

  } catch (error) {
    console.error("Backend Error Log:", error);
    // Kembalikan pesan error asli agar frontend mengetahui detail masalahnya secara pasti
    return res.status(400).json({
      success: false,
      message: `Error Server: ${error.message}`
    });
  }
};
