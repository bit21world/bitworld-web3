const { sql, send, getUid, settle, limit } = require("./_lib");

const REQUIRE_KYC_FOR_TRANSFER = true; // ubah ke false jika transfer tidak perlu KYC

const maskEmail = (e) => e.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

module.exports = async (req, res) => {
  try {
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "not_logged_in" });
    const post = req.method === "POST";
    if (post && !(req.headers["content-type"] || "").includes("application/json")) return send(res, 415, { error: "invalid_input" });
    const q = post ? (req.body || {}) : req.query || {};
    const a = String(q.a || "");
    await settle(uid);
    const me = (await sql`select id, email, balance, is_admin,
      kyc_status as kyc from bw_users where id = ${uid}`)[0];
    if (!me) return send(res, 401, { error: "not_logged_in" });
    const kycStatus = me.kyc || "none";
    /* ---------- POOL MINING ---------- */
    if (a === "pool") {
      const r = await sql`select total, used from bw_pool where id = 1`;
      const total = r.length ? Number(r[0].total) : 10500000;
      const used = r.length ? Number(r[0].used) : 0;
      return send(res, 200, { total, used, remaining: Math.max(0, total - used), percent: total ? Math.min(100, used / total * 100) : 0 });
    }

    /* ---------- TUGAS (hadiah dari pool mining) ---------- */
    if (a === "tasks" || (a === "task_claim" && post)) {
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
          (select count(*)::int from bw_users where id = ${uid} and kyc_status = 'approved') as kyc,
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

    /* ---------- WALLET ---------- */
    if (a === "wallet") {
      const h = await sql`
        select 'mining' as type, amount, created_at, null::text as other from bw_mining_log where user_id = ${uid}
        union all select 'out', t.amount, t.created_at, u.email from bw_transfers t join bw_users u on u.id = t.to_id where t.from_id = ${uid}
        union all select 'in', t.amount, t.created_at, u.email from bw_transfers t join bw_users u on u.id = t.from_id where t.to_id = ${uid}
        order by created_at desc limit 30`;
      return send(res, 200, { balance: Number(me.balance), kyc: kycStatus,
        history: h.map((x) => ({ type: x.type, amount: Number(x.amount), at: x.created_at, other: x.other ? maskEmail(x.other) : null })) });
    }
    if (a === "lookup" && post) {
      if (!(await limit("lookup:" + uid, 30, 10))) return send(res, 429, { error: "rate_limited" });
      const email = clean(q.email, 200).toLowerCase();
      if (email === me.email) return send(res, 400, { error: "self" });
      const r = await sql`select email, name from bw_users where email = ${email} and email_verified = true`;
      if (!r.length) return send(res, 404, { error: "not_found" });
      return send(res, 200, { found: true, label: maskEmail(r[0].email) + " (" + String(r[0].name || "").split(" ")[0] + ")" });
    }
    if (a === "transfer" && post) {
      if (REQUIRE_KYC_FOR_TRANSFER && kycStatus !== "approved") return send(res, 403, { error: "kyc_required" });
      if (!(await limit("tx:" + uid, 20, 60))) return send(res, 429, { error: "rate_limited" });
      const amount = Math.round(Number(q.amount) * 1e6) / 1e6;
      if (!isFinite(amount) || amount < 0.001 || amount > 1e9) return send(res, 400, { error: "invalid_input" });
      const email = clean(q.email, 200).toLowerCase();
      if (email === me.email) return send(res, 400, { error: "self" });
      const to = await sql`select id from bw_users where email = ${email} and email_verified = true`;
      if (!to.length) return send(res, 404, { error: "not_found" });
      const r = await sql`
        with src as (update bw_users set balance = balance - ${amount}::numeric where id = ${uid} and balance >= ${amount}::numeric returning id),
        dst as (update bw_users set balance = balance + ${amount}::numeric where id = ${to[0].id} and exists (select 1 from src) returning id),
        ins as (insert into bw_transfers (from_id, to_id, amount) select ${uid}, ${to[0].id}, ${amount}::numeric where exists (select 1 from dst) returning id)
        select (select count(*) from dst)::int as ok`;
      if (!r[0].ok) return send(res, 400, { error: "insufficient" });
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "invalid_input" });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
