import { Pool } from 'pg';

// Inisialisasi koneksi ke Database PostgreSQL (Neon / Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Hanya menerima method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { wallet_address, action } = req.body;

  if (!wallet_address) {
    return res.status(400).json({ success: false, message: "Wallet address wajib diisi!" });
  }

  try {
    // -------------------------------------------------------------
    // FITUR 1: Aksi "START" - Memulai Sesi Mining Baru
    // -------------------------------------------------------------
    if (action === 'start') {
      // 1. Cek apakah pengguna masih memiliki sesi mining yang sedang AKTIF
      const activeCheck = await pool.query(
        "SELECT * FROM mining_sessions WHERE wallet_address = $1 AND status = 'active'",
        [wallet_address]
      );

      if (activeCheck.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Sesi mining kamu masih berjalan!" 
        });
      }

      // 2. Buat sesi baru (Durasi: 24 Jam, Rate: 0.004 BTW/jam, Total Reward: 0.096 BTW)
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // Waktu sekarang + 24 jam

      await pool.query(
        `INSERT INTO mining_sessions (wallet_address, start_time, end_time, reward_rate, total_reward, status)
         VALUES ($1, $2, $3, 0.004, 0.096, 'active')`,
        [wallet_address, startTime, endTime]
      );

      return res.status(200).json({
        success: true,
        message: "Sesi mining Bitworld berhasil dimulai!",
        start_time: startTime,
        end_time: endTime
      });
    }

    // -------------------------------------------------------------
    // FITUR 2: Aksi "CLAIM_POOL" - Klaim Hasil Poin Sesi Mining
    // -------------------------------------------------------------
    else if (action === 'claim_pool') {
      const now = new Date();

      // 1. Cari sesi mining aktif yang durasinya SUDAH HABIS (end_time <= waktu sekarang)
      const sessionQuery = await pool.query(
        "SELECT * FROM mining_sessions WHERE wallet_address = $1 AND status = 'active' AND end_time <= $2",
        [wallet_address, now]
      );

      if (sessionQuery.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Belum ada sesi mining yang selesai ditagih atau waktu belum habis!"
        });
      }

      const session = sessionQuery.rows[0];

      // 2. Update status sesi mining menjadi 'claimed'
      await pool.query(
        "UPDATE mining_sessions SET status = 'claimed' WHERE id = $1", 
        [session.id]
      );

      // 3. Tambahkan poin hasil mining ke saldo internal user di database
      await pool.query(
        "UPDATE users SET internal_points = internal_points + $1 WHERE wallet_address = $2",
        [session.total_reward, wallet_address]
      );

      return res.status(200).json({
        success: true,
        message: `Berhasil mengklaim ${session.total_reward} BTW Poin Internal!`,
        reward_added: session.total_reward
      });
    }

    // Jika parameter action tidak dikenali
    else {
      return res.status(400).json({ success: false, message: "Aksi tidak valid! Gunakan 'start' atau 'claim_pool'." });
    }

  } catch (error) {
    console.error("Mining API Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
