module.exports = async (req, res) => {
  // 1. Header CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Cek Variabel Environment
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(200).json({
      success: false,
      status: "ENV_MISSING",
      message: "Variabel POSTGRES_URL / DATABASE_URL belum terbaca di Vercel."
    });
  }

  // 3. Panggil Modul Neon secara aman
  try {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(dbUrl);
    
    // Test Query ke Neon
    const testResult = await sql`SELECT NOW()`;

    return res.status(200).json({
      success: true,
      status: "CONNECTED",
      message: "API Bitworld Berhasil Terhubung ke Database Neon Postgres!",
      serverTime: testResult[0].now
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      status: "DB_CONNECTION_ERROR",
      message: "Gagal terhubung ke Database Neon.",
      detailError: error.message
    });
  }
};
