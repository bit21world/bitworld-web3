import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.a || '';

  try {
    // 1. Submit KYC oleh User
    if (req.method === 'POST' && action === 'submit') {
      const { user_id, username, name, id_number } = req.body;
      if (!user_id || !name || !id_number) {
        return res.status(400).json({ error: 'Data KYC tidak lengkap' });
      }

      // Cek apakah sudah pernah submit
      const existing = await sql`SELECT * FROM kyc WHERE user_id = ${user_id}`;
      if (existing.length > 0) {
        await sql`UPDATE kyc SET fullname = ${name}, id_number = ${id_number}, status = 'pending' WHERE user_id = ${user_id}`;
      } else {
        await sql`INSERT INTO kyc (user_id, username, fullname, id_number, status) VALUES (${user_id}, ${username || ''}, ${name}, ${id_number}, 'pending')`;
      }

      return res.json({ ok: true, message: 'KYC berhasil dikirim dan menunggu verifikasi owner.' });
    }

    // 2. Cek Status KYC oleh User
    if (req.method === 'GET' && action === 'status') {
      const userId = req.query.user_id;
      if (!userId) return res.json({ status: 'none' });

      const resKyc = await sql`SELECT status FROM kyc WHERE user_id = ${userId}`;
      if (resKyc.length === 0) return res.json({ status: 'none' });
      return res.json({ status: resKyc[0].status });
    }

    // 3. Khusus Owner: Lihat Semua List Pengajuan KYC
    if (req.method === 'GET' && action === 'admin_list') {
      const list = await sql`SELECT * FROM kyc ORDER BY id DESC`;
      return res.json({ ok: true, list });
    }

    // 4. Khusus Owner: Approve atau Reject KYC
    if (req.method === 'POST' && action === 'admin_action') {
      const { kyc_id, status } = req.body; // status: 'approved' atau 'rejected'
      if (!kyc_id || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Aksi tidak valid' });
      }

      await sql`UPDATE kyc SET status = ${status} WHERE id = ${kyc_id}`;
      return res.json({ ok: true, message: `KYC berhasil diubah menjadi ${status}` });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
}
