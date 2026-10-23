const { send, clearSession, jsonOnly } = require("./_lib");
module.exports = async (req, res) => {
  if (!jsonOnly(req, res)) return;
  clearSession(res);
  send(res, 200, { ok: true });
};
