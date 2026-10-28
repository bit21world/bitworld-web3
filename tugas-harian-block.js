    /* ---------- TUGAS HARIAN (reset tiap hari, hadiah dari pool mining) ---------- */
    if (a === "daily" || (a === "daily_claim" && post)) {
      // Ubah angka reward di sini. Semua tugas harian bisa diklaim 1x per hari (hari mengikuti WIB).
      const DAILY = {
        xlike:   { reward: 0.02 },  // suka, repost, komentar di X
        xpost:   { reward: 0.02 },  // posting tentang Bitworld di X
        fbpost:  { reward: 0.02 },  // posting tentang Bitworld di Facebook
        tgshare: { reward: 0.02 }   // bagikan ke komunitas Telegram publik
      };
      const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      if (a === "daily") {
        const dn = await sql`select task_key from bw_task_done where user_id = ${uid} and task_key like ${"d:%:" + day}`;
        const dset = new Set(dn.map((x) => x.task_key.split(":")[1]));
        return send(res, 200, { day, tasks: Object.keys(DAILY).map((k) => ({ key: k, reward: DAILY[k].reward, done: dset.has(k) })) });
      }
      const dkey = String(q.key || "");
      const dt = DAILY[dkey];
      if (!dt) return send(res, 400, { error: "invalid_input" });
      if (!(await limit("daily:" + uid, 20, 60))) return send(res, 429, { error: "rate_limited" });
      // Anti akun palsu: harus sudah menyelesaikan minimal 1 sesi mining.
      const mn = await sql`select count(*)::int as n from bw_mining_log where user_id = ${uid}`;
      if (mn[0].n < 1) return send(res, 400, { error: "mine_first" });
      const tk = "d:" + dkey + ":" + day;
      const dr = await sql`
        with ins as (
          insert into bw_task_done (user_id, task_key, reward)
          select ${uid}, ${tk}, ${dt.reward}::numeric
          where exists (select 1 from bw_pool where id = 1 and used + ${dt.reward}::numeric <= total)
          on conflict do nothing returning 1),
        pool as (update bw_pool set used = used + ${dt.reward}::numeric
                 where id = 1 and exists (select 1 from ins) returning 1),
        upd as (update bw_users set balance = balance + ${dt.reward}::numeric
                where id = ${uid} and exists (select 1 from pool) returning 1)
        select (select count(*) from ins)::int as ok`;
      if (!dr[0].ok) {
        const dd = await sql`select 1 from bw_task_done where user_id = ${uid} and task_key = ${tk}`;
        return send(res, 409, { error: dd.length ? "already_done" : "pool_empty" });
      }
      return send(res, 200, { ok: true, reward: dt.reward });
    }
