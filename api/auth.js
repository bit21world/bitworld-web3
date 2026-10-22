import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Hanya terima method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ success: false, message: 'DATABASE_URL belum dipasang di Vercel' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // 1. Buat tabel users secara otomatis jika belum ada di database Neon
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Cek apakah user sudah ada
    const existingUsers = await sql`
      SELECT * FROM users WHERE username = ${username} LIMIT 1;
    `;

    if (existingUsers.length > 0) {
      const user = existingUsers[0];
      // Cek password sederhananya
      if (user.password === password) {
        return res.status(200).json({
          success: true,
          message: 'Login berhasil!',
          user: { id: user.id, username: user.username }
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Password salah!'
        });
      }
    } else {
      // 3. Jika user belum ada, otomatis daftarkan (Register)
      const newUser = await sql`
        INSERT INTO users (username, password)
        VALUES (${username}, ${password})
        RETURNING id, username;
      `;

      return res.status(200).json({
        success: true,
        message: 'Akun baru berhasil dibuat & login!',
        user: newUser[0]
      });
    }

  } catch (error) {
    console.error('Auth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Database Error: ' + (error.message || 'Gagal terhubung ke database')
    });
  }
}
