import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { fullName, docNumber, docImage, selfieImage } = req.body;

    if (!fullName || !docNumber || !docImage || !selfieImage) {
      return res.status(400).json({ success: false, message: 'Semua data dan foto KYC wajib diisi' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ success: false, message: 'DATABASE_URL belum dipasang di Vercel' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Bikin tabel kyc_submissions jika belum ada
    await sql`
      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        doc_number VARCHAR(100) NOT NULL,
        doc_image TEXT NOT NULL,
        selfie_image TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      INSERT INTO kyc_submissions (full_name, doc_number, doc_image, selfie_image, status)
      VALUES (${fullName}, ${docNumber}, ${docImage}, ${selfieImage}, 'PENDING');
    `;

    return res.status(200).json({
      success: true,
      message: 'Pengajuan KYC berhasil dikirim'
    });

  } catch (error) {
    console.error('KYC Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server Error' });
  }
}
