const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.KYC_SECRET || 'bitworld_secret_key_2026_super_safe';

function getDb() {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Database URL missing");
  return neon(dbUrl);
}

// Inisialisasi Tabel Postgres
async function initTables(sql) {
  try {
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
  } catch (err) {
    console.error("Init Table Error:", err);
  }
}

module.exports = async (req, res) => {
  // 1. CORS Headers
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
    await initTables(sql);

    // Parsing URL path
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/^\/api/, '') || '/';

    // Helper Body Parser
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    // --- ROUTE HANDLERS ---

    // 1. REGISTER
    if ((pathname === '/register' || pathname === '/auth/register') && req.method === 'POST') {
      const { email, password, name } = body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const existing = await sql`SELECT id FROM bw_users WHERE email = ${email}`;
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await sql`
        INSERT INTO bw_users (email, password, name) 
        VALUES (${email}, ${hashedPassword}, ${name || ''}) 
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

    // 2. LOGIN
    if ((pathname === '/login' || pathname === '/auth/login' || pathname === '/') && req.method === 'POST') {
      const { email, password } = body || {};
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }

      const users = await sql`SELECT * FROM bw_users WHERE email = ${email}`;
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
          kyc_status: user.kyc_status,
          wallet_address: user.wallet_address,
          last_mined_at: user.last_mined_at
        }
      });
    }

    // 3. MINING (CLAIM / START)
    if (pathname === '/mining' && req.method === 'POST') {
      const { email } = body || {};
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email tidak ditemukan.' });
      }

      const users = await sql`SELECT * FROM bw_users WHERE email = ${email}`;
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      const user = users[0];
      const now = new Date();
      const lastMined = user.last_mined_at ? new Date(user.last_mined_at) : null;

      // Rate mining 0.004 BTW / session (6 jam)
      const reward = 0.024; // 0.004 * 6 jam

      if (lastMined && (now - lastMined) < 6 * 60 * 60 * 1000) {
        const remainingMinutes = Math.ceil((6 * 60 * 60 * 1000 - (now - lastMined)) / (60 * 1000));
        return res.status(400).json({
          success: false,
          message: `Sesi mining masih berjalan. Tunggu ${remainingMinutes} menit lagi.`
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
        message: 'Mining berhasil diklaim!',
        balance: newBalance,
        last_mined_at: now
      });
    }

    // Default Fallback Route
    return res.status(200).json({
      success: true,
      message: 'Bitworld API Online',
      path: pathname
    });

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan di server.",
      error: error.message
    });
  }
};
