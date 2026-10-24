// Contoh endpoint backend Node.js / Vercel Serverless Function untuk KYC
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fullName, idNumber, walletAddress, hashID, status } = req.body;

    if (!fullName || !idNumber || !walletAddress || !hashID) {
      return res.status(400).json({ error: 'Data formulir tidak lengkap!' });
    }

    // TODO: Masukkan kode koneksi database SQL Anda di sini (contoh menggunakan pg/Neon)
    // Contoh query SQL:
    // const query = `INSERT INTO bitworld_kyc (full_name, id_number, wallet_address, hash_id, status) VALUES ($1, $2, $3, $4, $5)`;
    // await db.query(query, [fullName, idNumber, walletAddress, hashID, status]);

    console.log("Data KYC diterima dari:", fullName, "dengan Hash:", hashID);

    return res.status(200).json({ 
      success: true, 
      message: 'Data KYC berhasil disimpan ke database SQL!',
      hashID: hashID 
    });

  } catch (error) {
    console.error('Database Error:', error);
    return res.status(500).json({ error: 'Gagal memproses database server.' });
  }
}
