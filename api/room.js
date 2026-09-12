/* หน้าของครู สร้างรหัสห้องและดูงานของทั้งห้อง
   ยืนยันตัวด้วยกุญแจใน env ไม่มีบัญชีครูในฐานข้อมูล เพราะครูมีคนเดียวหรือสองคน */
const { q, init } = require('./_db.js');
const { isTeacher } = require('./_auth.js');

/* ตัดตัวที่อ่านผิดกันบ่อยออก O กับ 0, I กับ 1, S กับ 5
   ครูต้องเขียนรหัสนี้บนกระดานแล้วเด็กพิมพ์ตาม ตัวที่กำกวมทำให้เข้าห้องไม่ได้เปล่า ๆ */
const ALPHA = 'ABCDEFGHJKLMNPQRTUVWXY2346789';
function newCode() {
  const b = require('node:crypto').randomBytes(6);
  return Array.from(b, (x) => ALPHA[x % ALPHA.length]).join('');
}

module.exports = async (req, res) => {
  if (!process.env.BMC_DATABASE_URL) return res.status(503).json({ error: 'unconfigured' });
  if (!isTeacher(req)) return res.status(401).json({ error: 'ต้องใส่กุญแจของครู' });
  try {
    await init();

    if (req.method === 'GET') {
      const rooms = (await q(
        `select r.*, (select count(*)::int from bmc_user u where u.room_code = r.code) as students
           from bmc_room r order by r.created_at desc`)).rows;
      const code = (req.query?.code || '').toString().toUpperCase();
      if (!code) return res.json({ rooms });
      /* จำนวนช่องที่กรอกแล้ว นับจาก jsonb ตรง ๆ ไม่ต้องดึงข้อมูลทั้งก้อนมาที่หน้าเว็บ
         ห้องหนึ่งมีสี่สิบคน ถ้าส่งผังเต็มทุกคนจะหนักเป็นเมกะไบต์ */
      const students = (await q(
        `select u.id, u.name, u.created_at, u.last_seen_at,
                c.title, c.updated_at,
                coalesce((select count(*) from jsonb_each_text(coalesce(c.data->'blocks','{}'::jsonb)) kv
                           where btrim(kv.value) <> ''), 0)::int as filled
           from bmc_user u left join bmc_canvas c on c.user_id = u.id
          where u.room_code = $1 order by u.name`, [code])).rows;
      return res.json({ students });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      const label = String(body?.label ?? '').trim().slice(0, 80);
      if (!label) return res.status(400).json({ error: 'ตั้งชื่อห้องก่อน' });
      const max = Number(body?.maxUses);
      const days = Number(body?.days);
      let code = newCode();
      for (let i = 0; i < 5; i++) {
        const dup = (await q(`select 1 from bmc_room where code = $1`, [code])).rowCount;
        if (!dup) break;
        code = newCode();
      }
      const row = (await q(
        `insert into bmc_room (code, label, max_uses, expires_at)
         values ($1,$2,$3,$4) returning *`,
        [code, label,
         Number.isFinite(max) && max > 0 ? Math.round(max) : null,
         Number.isFinite(days) && days > 0
           ? new Date(Date.now() + days * 86400000).toISOString() : null])).rows[0];
      return res.status(201).json(row);
    }

    /* ดูผังของนักเรียนคนหนึ่ง ใช้ตอนครูอยากอ่านงานจริง ไม่ใช่แค่ดูว่ากรอกไปกี่ช่อง */
    if (req.method === 'PATCH') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
      const id = Number(body?.userId);
      if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad-body' });
      const row = (await q(
        `select u.name, c.data, c.updated_at from bmc_user u
           left join bmc_canvas c on c.user_id = u.id where u.id = $1`, [id])).rows[0];
      if (!row) return res.status(404).json({ error: 'ไม่พบนักเรียนคนนี้' });
      return res.json(row);
    }
    res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error('room', e);
    res.status(500).json({ error: 'ระบบขัดข้อง' });
  }
};
