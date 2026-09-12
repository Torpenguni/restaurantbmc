/* อ่านและเซฟงานของคนที่เข้าระบบอยู่ หนึ่งคนหนึ่งผัง
   หน้าเว็บยังเซฟลง localStorage ต่อไปด้วย อันนี้เป็นตัวจริงที่ตามข้ามเครื่องได้
   ถ้าเน็ตหลุดหรือ API ล่ม ของในเครื่องยังอยู่ ไม่ใช่ทางเดียวที่งานจะรอด */
const { q, init } = require('./_db.js');
const { userOf } = require('./_auth.js');

const MAX = 400000;   // ตัวอักษร — ผังที่กรอกเต็มยาวราวสองหมื่น เผื่อไว้มาก

module.exports = async (req, res) => {
  if (!process.env.BMC_DATABASE_URL || !process.env.BMC_SECRET) {
    return res.status(503).json({ error: 'unconfigured' });
  }
  const u = userOf(req);
  if (!u) return res.status(401).json({ error: 'ต้องเข้าห้องก่อน' });

  try {
    await init();
    if (req.method === 'GET') {
      const row = (await q(`select data, updated_at from bmc_canvas where user_id = $1`,
        [u.uid])).rows[0];
      return res.json({ data: row?.data ?? null, updatedAt: row?.updated_at ?? null });
    }
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      const data = body?.data;
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'bad-body' });
      const text = JSON.stringify(data);
      if (text.length > MAX) return res.status(413).json({ error: 'ข้อมูลใหญ่เกินไป' });
      /* ชื่อร้านเก็บแยกไว้ที่ title ด้วย หน้าครูจะได้ไม่ต้องแกะ jsonb ทุกแถวเพื่อโชว์ชื่อ */
      const title = String(data.shop ?? '').trim().slice(0, 120) || null;
      await q(
        `insert into bmc_canvas (user_id, title, data, updated_at)
         values ($1,$2,$3::jsonb, now())
         on conflict (user_id) do update
           set title = excluded.title, data = excluded.data, updated_at = now()`,
        [u.uid, title, text]);
      await q(`update bmc_user set last_seen_at = now() where id = $1`, [u.uid]);
      return res.json({ ok: true, savedAt: new Date().toISOString() });
    }
    res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error('canvas', e);
    res.status(500).json({ error: 'ระบบขัดข้อง' });
  }
};
