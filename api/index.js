const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.KYC_SECRET || 'bitworld_secret_key_2026_super_safe';

function getDb() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("POSTGRES_URL / DATABASE_URL belum terpasang di Vercel Settings.");
  return neon(dbUrl);
}

module.exports = async (req, res) => {
  // 1. Header CORS Lengkap
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sql = getDb();

    // Auto-create tabel bw_users jika belum ada
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

    // Normalisasi URL & Body Parsing
    const rawPath = req.url.split('?')[0].toLowerCase();
    
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    // ==========================================
    // ROUTE 1: REGISTER (/api/register, /register, dll)
    // ==========================================
    if (req.method === 'POST' && (rawPath.includes('register') || rawPath.includes('signup'))) {
      const { email, password, name, username } = body;
      const userEmail = (email || username || '').trim().toLowerCase();

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

    // ==========================================
    // ROUTE 2: LOGIN (/api/login, /login, dll)
    // ==========================================
    if (req.method === 'POST' && (rawPath.includes('login') || rawPath.includes('signin'))) {
      const { email, password, username } = body;
      const userEmail = (email || username || '').trim().toLowerCase();

      if (!userEmail || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const users = await sql`SELECT * FROM bw_users WHERE email = ${userEmail}`;
      if (users.length === 0) {
        return res.status(400).json({ success: false, message: 'Email atau password salah.' });
      }

      const user = users[0];
      const validPassword = await bcrypt.compare(password, user.password || user.password_hash);
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
          kyc_status: user.kyc_status,
          wallet_address: user.wallet_address,
          last_mined_at: user.last_mined_at
        }
      });
    }

    // ==========================================
    // ROUTE 3: LOGOUT (/api/logout, /logout)
    // ==========================================
    if (rawPath.includes('logout')) {
      return res.status(200).json({ success: true, message: 'Logout berhasil' });
    }

    // ==========================================
    // ROUTE 4: MINING (/api/mining, /mining)
    // ==========================================
    if (req.method === 'POST' && rawPath.includes('mining')) {
      const { email } = body;
      if (!email) return res.status(400).json({ success: false, message: 'Email tidak valid.' });

      const users = await sql`SELECT * FROM bw_users WHERE email = ${email}`;
      if (users.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

      const user = users[0];
      const now = new Date();
      const lastMined = user.last_mined_at ? new Date(user.last_mined_at) : null;
      const reward = 0.024; // Reward 6 jam

      if (lastMined && (now - lastMined) < 6 * 60 * 60 * 1000) {
        const remaining = Math.ceil((6 * 60 * 60 * 1000 - (now - lastMined)) / (60 * 1000));
        return res.status(400).json({
          success: false,
          message: `Sesi mining masih berjalan. Tunggu ${remaining} menit lagi.`
        });
      }

      const newBalance = parseFloat(user.balance || 0) + reward;
      await sql`
        UPDATE bw_users 
        SET balance = ${newBalance}, last_mined_at = ${now.toISOString()} 
        WHERE id = ${user.id}
      `;

      return res.status(200).json({
        success: true,
        message: 'Klaim Mining Berhasil!',
        balance: newBalance,
        last_mined_at: now
      });
    }

    // Fallback Default
    return res.status(200).json({
      success: true,
      message: 'Bitworld Single-File All-in-One API Active',
      path: rawPath
    });

  } catch (error) {
    console.error("API Root Error:", error);
    return res.status(500).json({
      success: false,
      message: `Error Server: ${error.message}`
    });
  }
};
