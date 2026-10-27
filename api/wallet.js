const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { verifyMessage, getAddress } = require("ethers");
const { sql, send, getUid, jsonOnly, limit } = require("./_lib");

// Pesan yang ditandatangani user di MetaMask (gratis, bukan transaksi)
const msgFor = (nonce) =>
  "Hubungkan wallet ke Bitworld.\n\nNonce: " + nonce +
  "\n\nTanda tangan ini gratis dan tidak mengirim transaksi apa pun.";

module.exports = async (req, res) => {
  try {
    if (!jsonOnly(req, res)) return;
    const uid = getUid(req);
    if (!uid) return send(res, 401, { error: "unauthorized" });
    if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET belum diisi di Vercel");
    const b = req.body || {};
    const action = String(b.action || "");

    // Langkah 1: minta pesan + tantangan (berlaku 10 menit)
    if (action === "nonce") {
      if (!(await limit("walletn:" + uid, 20, 60))) return send(res, 429, { error: "rate_limited" });
      const nonce = crypto.randomBytes(16).toString("hex");
      const challenge = jwt.sign({ u: String(uid), p: "wallet", n: nonce }, process.env.JWT_SECRET, { expiresIn: 600 });
      return send(res, 200, { message: msgFor(nonce), challenge });
    }

    // Langkah 2: verifikasi tanda tangan lalu simpan alamat
    if (action === "link") {
      if (!(await limit("wallet:" + uid, 10, 60))) return send(res, 429, { error: "rate_limited" });
      let c;
      try { c = jwt.verify(String(b.challenge || ""), process.env.JWT_SECRET); }
      catch (e) { return send(res, 400, { error: "invalid_challenge" }); }
      if (c.p !== "wallet" || c.u !== String(uid)) return send(res, 400, { error: "invalid_challenge" });

      let addr, signer;
      try {
        addr = getAddress(String(b.address || "").trim());
        signer = verifyMessage(msgFor(c.n), String(b.signature || ""));
      } catch (e) { return send(res, 400, { error: "invalid_signature" }); }
      if (signer !== addr) return send(res, 400, { error: "invalid_signature" });

      try {
        await sql`update bw_users set wallet = ${addr.toLowerCase()} where id = ${uid}`;
      } catch (e) {
        if (String(e.message || e).includes("duplicate")) return send(res, 409, { error: "wallet_taken" });
        throw e;
      }
      return send(res, 200, { ok: true, wallet: addr.toLowerCase() });
    }

    send(res, 400, { error: "invalid_input" });
  } catch (e) { console.error(e); send(res, 500, { error: "server" }); }
};
