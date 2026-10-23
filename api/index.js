const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // 1. Set Header CORS
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

  // 2. Cek Koneksi Database
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ 
      success: false, 
      message: "Database connection string missing in Environment Variables." 
    });
  }

  try {
    const sql = neon(dbUrl);
    
    // Test query sederhana ke Neon
    const testResult = await sql`SELECT NOW()`;
    
    return res.status(200).json({
      success: true,
      message: "API Bitworld Berhasil Terhubung ke Database Neon!",
      timestamp: testResult[0].now
    });

  } catch (error) {
    console.error("Database Connection Error:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal terhubung ke database Neon.",
      error: error.message
    });
  }
};
