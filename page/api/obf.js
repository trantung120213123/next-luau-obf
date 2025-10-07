// pages/api/obf.js
const { obfuscate } = require('../../lib/luau-obf');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { code, threshold = 3, preserve = [], pack = false, junkCount = 6, junkLevel = 2, oneLine = false } = req.body || {};
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Missing code' });

  try {
    const { code: obf, map } = obfuscate(code, {
      threshold: Number(threshold),
      preserve: Array.isArray(preserve) ? preserve : (String(preserve).split(',').map(s=>s.trim()).filter(Boolean)),
      pack: !!pack,
      junkCount: Number(junkCount),
      junkLevel: Number(junkLevel),
      oneLine: !!oneLine
    });
    return res.status(200).json({ obf, map });
  } catch (err) {
    console.error('obf err', err);
    return res.status(500).json({ error: 'Obfuscation failed' });
  }
}
