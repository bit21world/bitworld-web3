import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { action, username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ success: false, message: 'DATABASE_URL belum dipasang di Vercel' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Otomatis buat tabel users jika belum ada di database Neon
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        kyc_status VARCHAR(50) DEFAULT 'UNVERIFIED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    if (action === 'register') {
      const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Username sudah terdaftar' });
      }

      const newUser = await sql`
        INSERT INTO users (username, password, kyc_status)
        VALUES (${username}, ${password}, 'UNVERIFIED')
        RETURNING id, username, kyc_status;
      `;

      return res.status(200).json({
        success: true,
        message: 'Pendaftaran berhasil',
        user: newUser[0]
      });
    }

    // PROSES LOGIN
    const users = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;

    if (users.length === 0) {
      // Jika user belum ada, otomatis daftarkan akun baru agar mudah dites
      const autoReg = await sql`
        INSERT INTO users (username, password, kyc_status)
        VALUES (${username}, ${password}, 'UNVERIFIED')
        RETURNING id, username, kyc_status;
      `;
      return res.status(200).json({
        success: true,
        message: 'Akun baru berhasil dibuat & otomatis masuk',
        user: autoReg[0]
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      user: users[0]
    });

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
}
