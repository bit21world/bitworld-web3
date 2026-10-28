    /* ---------- TUGAS (hadiah dari pool mining) ---------- */
    if (a === "tasks" || (a === "task_claim" && post)) {
      // Ubah angka reward di sini. "link" = tugas sosial (jujur-sistem), "auto" = dicek otomatis oleh server.
      const TASKS = {
        tg:    { reward: 0.05, kind: "link" },
        x:     { reward: 0.05, kind: "link" },
        fb:    { reward: 0.05, kind: "link" },
        ref3:  { reward: 0.3,  kind: "auto", target: 3 },
        kyc:   { reward: 0.5,  kind: "auto", target: 1 },
        mine7: { reward: 0.2,  kind: "auto", target: 7 }
      };
      const prog = async () => {
        const r = await sql`select
          (select count(*)::int from bw_referrals where referrer_id = ${uid} and status = 'active') as ref,
          (select count(*)::int from bw_kyc where user_id = ${uid} and status = 'approved') as kyc,
          (select count(*)::int from bw_mining_log where user_id = ${uid}) as mine`;
        return { ref3: r[0].ref, kyc: r[0].kyc, mine7: r[0].mine, mine: r[0].mine };
      };
      if (a === "tasks") {
        const done = await sql`select task_key from bw_task_done where user_id = ${uid}`;
        const dset = new Set(done.map((x) => x.task_key));
        const p = await prog();
        return send(res, 200, { tasks: Object.keys(TASKS).map((k) => ({
          key: k, reward: TASKS[k].reward, kind: TASKS[k].kind, target: TASKS[k].target || 1,
          progress: TASKS[k].kind === "auto" ? Math.min(p[k], TASKS[k].target) : 0, done: dset.has(k)
        })) });
      }
      const key = String(q.key || "");
      const t = TASKS[key];
      if (!t) return send(res, 400, { error: "invalid_input" });
      if (!(await limit("task:" + uid, 30, 60))) return send(res, 429, { error: "rate_limited" });
      const p = await prog();
      if (t.kind === "auto" && p[key] < t.target) return send(res, 400, { error: "not_met" });
      // Tugas sosial baru bisa diklaim setelah akun menyelesaikan minimal 1 sesi mining (anti akun palsu).
      if (t.kind === "link" && p.mine < 1) return send(res, 400, { error: "mine_first" });
      const r = await sql`
        with ins as (
          insert into bw_task_done (user_id, task_key, reward)
          select ${uid}, ${key}, ${t.reward}::numeric
          where exists (select 1 from bw_pool where id = 1 and used + ${t.reward}::numeric <= total)
          on conflict do nothing returning 1),
        pool as (update bw_pool set used = used + ${t.reward}::numeric
                 where id = 1 and exists (select 1 from ins) returning 1),
        upd as (update bw_users set balance = balance + ${t.reward}::numeric
                where id = ${uid} and exists (select 1 from pool) returning 1)
        select (select count(*) from ins)::int as ok`;
      if (!r[0].ok) {
        const d = await sql`select 1 from bw_task_done where user_id = ${uid} and task_key = ${key}`;
        return send(res, 409, { error: d.length ? "already_done" : "pool_empty" });
      }
      return send(res, 200, { ok: true, reward: t.reward });
    }
