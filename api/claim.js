const lib = require("./_lib");
const { sql, send, getUid, jsonOnly, RATE, HOURS } = lib;

// Bonus referral. Bila REF_BONUS / REF_MAX belum diekspor oleh _lib.js, nilainya 0 (tanpa bonus, mining tetap normal).
const REF_BONUS = Number(lib.REF_BONUS) || 0;
const REF_MAX = Number(lib.REF_MAX) || 0;
const REF_MIN_SESSIONS = Number(lib.REF_MIN_SESSIONS) || 3;

// Memulai sesi mining 24 jam. Satu query atomik: tidak bisa dimulai dua kali / dicurangi.
// Poin sesi sebelumnya (RATE x HOURS x (1 + bonus referral)) dimasukkan ke saldo saat sesi baru dimulai;
// poin sesi yang sedang berjalan dihitung otomatis di /api/me.
module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const rows = await sql`
      with old as (select id, mine_start from bw_users where id = ${uid} for update),
      ref as (select count(*)::int as n from bw_referrals where referrer_id = ${uid} and status = 'active'),
      calc as (select ${RATE}::numeric * ${HOURS}::numeric * (1 + least(ref.n, ${REF_MAX}::int) * ${REF_BONUS}::numeric) as amt from ref)
      update bw_users u set
        balance = u.balance + case when old.mine_start is not null then calc.amt else 0 end,
        mine_start = now()
      from old, calc
      where u.id = old.id
        and (old.mine_start is null or now() >= old.mine_start + make_interval(hours => ${HOURS}::int))
      returning u.balance, u.mine_start, (old.mine_start is not null) as settled, calc.amt as amt`;
    if (!rows.length) return send(res, 429, { error: "cooldown" });
    if (rows[0].settled) {
      await sql`insert into bw_mining_log (user_id, amount) values (${uid}, ${rows[0].amt})`;
      // Teman yang diundang menjadi "active" setelah REF_MIN_SESSIONS sesi mining selesai.
      // Gagal di sini tidak boleh menggagalkan klaim.
      try {
        const c = await sql`select count(*)::int as n from bw_mining_log where user_id = ${uid}`;
        if (c[0].n >= REF_MIN_SESSIONS) {
          await sql`update bw_referrals set status = 'active' where referred_id = ${uid} and status = 'pending'`;
        }
      } catch (e) { console.error("referral activate:", e); }
    }
    send(res, 200, { ok: true });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
