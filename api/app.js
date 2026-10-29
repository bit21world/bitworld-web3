const { sql, send, getUid, settle, limit } = require("./_lib");

const REQUIRE_KYC_FOR_TRANSFER = true; // ubah ke false jika transfer tidak perlu KYC

const maskEmail = (e) => e.replace(/^(.{1,2}).*(@.*)$/, "$1***$2");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

/* ---------- BUKTI TUGAS HARIAN ---------- */
const OFFICIAL_X = "bitworld_btw";            // akun resmi: postingannya tidak dihitung sebagai bukti
const KEYWORD = /bitworld|#btw\b/i;            // kata yang harus ada di isi postingan (cek otomatis)
const FB_KEEP = ["id", "story_fbid", "fbid", "v", "set"]; // parameter Facebook yang menentukan postingan

// Mengembalikan { key, canon } atau null. key = identitas unik tautan (untuk cek sekali pakai).
function normProof(kind, raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 300) return null;
  if (kind === "x") {
    const m = s.match(/^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[\/?#]\S*)?$/i);
    if (!m || m[1].toLowerCase() === OFFICIAL_X) return null;
    return { key: "x:" + m[2], canon: "https://x.com/" + m[1] + "/status/" + m[2] };
  }
  if (kind === "tg") {
    const m = s.match(/^https:\/\/t\.me\/([A-Za-z0-9_]{4,32})\/(\d+)(?:\?\S*)?$/i);
    if (!m) return null;
    const h = m[1].toLowerCase();
    return { key: "tg:" + h + "/" + m[2], canon: "https://t.me/" + h + "/" + m[2] };
  }
  if (kind === "fb") {
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
    if (host !== "facebook.com" && host !== "fb.com" && host !== "fb.watch") return null;
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    if (path.length < 6) return null;
    const keep = FB_KEEP.filter((k) => u.searchParams.has(k)).sort().map((k) => k + "=" + u.searchParams.get(k)).join("&");
    const key = "fb:" + (host === "fb.watch" ? "fb.watch" : "facebook.com") + path + (keep ? "?" + keep : "");
    return { key: key.slice(0, 300), canon: s };
  }
  return null;
}

const fetchT = (u) => fetch(u, { signal: AbortSignal.timeout(4000), headers: { "user-agent": "Mozilla/5.0 (compatible; BitworldCheck/1.0)" } });

// "ok" = tautan nyata dan isinya cocok, "fail" = jelas salah, "unknown" = tidak bisa dicek (jaringan/pembatasan)
async function verifyProof(kind, np) {
  try {
    if (kind === "x") {
      const r = await fetchT("https://publish.twitter.com/oembed?omit_script=1&url=" + encodeURIComponent(np.canon));
      if (r.status === 404 || r.status === 403) return "fail";
      if (!r.ok) return "unknown";
      const j = await r.json();
      return KEYWORD.test(String(j.html || "")) ? "ok" : "fail";
    }
    if (kind === "tg") {
      const r = await fetchT(np.canon + "?embed=1&mode=tme");
      if (!r.ok) return "unknown";
      const h = await r.text();
      const m = h.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      return m && KEYWORD.test(m[1]) ? "ok" : "fail";
    }
  } catch (e) { return "unknown"; }
  return "unknown";
}

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
      // proof: jenis tautan bukti. auto: true = dicek otomatis lalu hadiah langsung cair;
      // auto: false = bukti masuk antrean, hadiah cair setelah disetujui admin.
      const DAILY = {
        xlike:   { reward: 0.02, proof: "x",  auto: false },  // suka, repost, komentar di X (isi komentar tidak bisa dicek otomatis)
        xpost:   { reward: 0.02, proof: "x",  auto: true  },  // posting tentang Bitworld di X
        fbpost:  { reward: 0.02, proof: "fb", auto: false },  // posting tentang Bitworld di Facebook (ditinjau manual)
        tgshare: { reward: 0.02, proof: "tg", auto: true  }   // bagikan ke komunitas Telegram publik
      };
      const day = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
      if (a === "daily") {
        const dn = await sql`select task_key from bw_task_done where user_id = ${uid} and task_key like ${"d:%:" + day}`;
        const dset = new Set(dn.map((x) => x.task_key.split(":")[1]));
        const pn = await sql`select task_key from bw_proofs where user_id = ${uid} and status = 'pending' and task_key like ${"d:%:" + day}`;
        const pset = new Set(pn.map((x) => x.task_key.split(":")[1]));
        return send(res, 200, { day, tasks: Object.keys(DAILY).map((k) => ({ key: k, reward: DAILY[k].reward, done: dset.has(k), pending: pset.has(k) })) });
      }
      const dkey = String(q.key || "");
      const dt = DAILY[dkey];
      if (!dt) return send(res, 400, { error: "invalid_input" });
      if (!(await limit("daily:" + uid, 20, 60))) return send(res, 429, { error: "rate_limited" });
      // Anti akun palsu: harus sudah menyelesaikan minimal 1 sesi mining.
      const mn = await sql`select count(*)::int as n from bw_mining_log where user_id = ${uid}`;
      if (mn[0].n < 1) return send(res, 400, { error: "mine_first" });
      const tk = "d:" + dkey + ":" + day;

      // Bukti wajib, formatnya diperiksa ulang di server.
      const rawProof = clean(q.proof, 300);
      if (!rawProof) return send(res, 400, { error: "proof_required" });
      const np = normProof(dt.proof, rawProof);
      if (!np) return send(res, 400, { error: "invalid_proof" });

      // Cek cepat sebelum memakai tautan.
      const dn0 = await sql`select 1 from bw_task_done where user_id = ${uid} and task_key = ${tk}`;
      if (dn0.length) return send(res, 409, { error: "already_done" });
      const pd0 = await sql`select 1 from bw_proofs where user_id = ${uid} and task_key = ${tk} and status = 'pending'`;
      if (pd0.length) return send(res, 409, { error: "pending" });
      const us0 = await sql`select 1 from bw_proofs where url_key = ${np.key}`;
      if (us0.length) return send(res, 409, { error: "proof_used" });
      if (!(await limit("proofchk:" + uid, 10, 60))) return send(res, 429, { error: "rate_limited" });

      // Cek isi tautan (hanya untuk tugas yang bisa dicek otomatis).
      let v = "unknown";
      if (dt.auto) v = await verifyProof(dt.proof, np);
      if (v === "fail") return send(res, 400, { error: "invalid_proof" });

      if (v === "ok") {
        // Tautan terpakai + hadiah cair dalam satu perintah atomik.
        const dr = await sql`
          with prf as (
            insert into bw_proofs (user_id, task_key, url_key, url, status, reward, reviewed_at)
            select ${uid}, ${tk}, ${np.key}, ${rawProof}, 'approved', ${dt.reward}::numeric, now()
            where not exists (select 1 from bw_task_done where user_id = ${uid} and task_key = ${tk})
              and exists (select 1 from bw_pool where id = 1 and used + ${dt.reward}::numeric <= total)
            on conflict do nothing returning 1),
          ins as (
            insert into bw_task_done (user_id, task_key, reward)
            select ${uid}, ${tk}, ${dt.reward}::numeric where exists (select 1 from prf)
            on conflict do nothing returning 1),
          pool as (update bw_pool set used = used + ${dt.reward}::numeric
                   where id = 1 and exists (select 1 from ins) returning 1),
          upd as (update bw_users set balance = balance + ${dt.reward}::numeric
                  where id = ${uid} and exists (select 1 from pool) returning 1)
          select (select count(*) from ins)::int as ok`;
        if (!dr[0].ok) {
          const us1 = await sql`select 1 from bw_proofs where url_key = ${np.key}`;
          if (us1.length) return send(res, 409, { error: "proof_used" });
          const dd = await sql`select 1 from bw_task_done where user_id = ${uid} and task_key = ${tk}`;
          return send(res, 409, { error: dd.length ? "already_done" : "pool_empty" });
        }
        return send(res, 200, { ok: true, reward: dt.reward });
      }

      // Tidak bisa dicek otomatis (Facebook, "suka/repost/komentar", atau pengecekan gagal): masuk antrean admin.
      const pr = await sql`
        insert into bw_proofs (user_id, task_key, url_key, url, status, reward)
        values (${uid}, ${tk}, ${np.key}, ${rawProof}, 'pending', ${dt.reward}::numeric)
        on conflict do nothing returning id`;
      if (!pr.length) {
        const us2 = await sql`select 1 from bw_proofs where url_key = ${np.key}`;
        return send(res, 409, { error: us2.length ? "proof_used" : "pending" });
      }
      return send(res, 409, { error: "pending" });
    }

    /* ---------- TINJAUAN BUKTI (khusus admin) ---------- */
    if (a === "proofs") {
      if (!me.is_admin) return send(res, 403, { error: "forbidden" });
      const r = await sql`select p.id, p.task_key, p.url, p.reward, p.created_at, u.email
        from bw_proofs p join bw_users u on u.id = p.user_id
        where p.status = 'pending' order by p.created_at asc limit 100`;
      return send(res, 200, { proofs: r.map((x) => ({ id: x.id, task: x.task_key, url: x.url, reward: Number(x.reward), at: x.created_at, user: x.email })) });
    }
    if (a === "proof_review" && post) {
      if (!me.is_admin) return send(res, 403, { error: "forbidden" });
      const pid = Number(q.id);
      if (!Number.isInteger(pid) || pid < 1) return send(res, 400, { error: "invalid_input" });
      if (q.approve === true || q.approve === "true") {
        const r = await sql`
          with ap as (
            update bw_proofs set status = 'approved', reviewed_at = now()
            where id = ${pid} and status = 'pending'
              and exists (select 1 from bw_pool where id = 1 and used + bw_proofs.reward <= total)
            returning user_id, task_key, reward),
          ins as (
            insert into bw_task_done (user_id, task_key, reward)
            select user_id, task_key, reward from ap
            on conflict do nothing returning user_id, reward),
          pool as (update bw_pool set used = used + (select coalesce(sum(reward), 0) from ins)
                   where id = 1 and exists (select 1 from ins) returning 1),
          upd as (update bw_users set balance = balance + ins.reward
                  from ins where bw_users.id = ins.user_id and exists (select 1 from pool) returning 1)
          select (select count(*) from ap)::int as ok`;
        if (!r[0].ok) return send(res, 409, { error: "not_pending_or_pool_empty" });
        return send(res, 200, { ok: true });
      }
      const r = await sql`update bw_proofs set status = 'rejected', reviewed_at = now()
        where id = ${pid} and status = 'pending' returning id`;
      if (!r.length) return send(res, 409, { error: "not_pending_or_pool_empty" });
      return send(res, 200, { ok: true });
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
