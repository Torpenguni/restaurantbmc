/* เข้าห้องเรียนด้วยรหัสที่ครูแจก กับชื่อของตัวเอง
   ไม่มีรหัสผ่านโดยตั้งใจ นักเรียนลืมรหัสผ่านกันแน่ ๆ และของที่กรอกไม่ใช่ความลับ
   สิ่งที่ต้องกันคือคนนอกที่ไม่รู้รหัสห้อง และคนในห้องที่พิมพ์ชื่อชนกัน */
const { q, init } = require('./_db.js');
const { sign } = require('./_auth.js');

const clean = (x) => String(x ?? '').trim().replace(/\s+/g, ' ');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!process.env.BMC_DATABASE_URL || !process.env.BMC_SECRET) {
    return res.status(503).json({ error: 'unconfigured' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const code = clean(body?.code).toUpperCase();
  const name = clean(body?.name);
  if (!code || !name) return res.status(400).json({ error: 'ต้องกรอกรหัสห้องและชื่อ' });
  if (name.length > 60) return res.status(400).json({ error: 'ชื่อยาวเกินไป' });

  try {
    await init();
    const room = (await q(`select * from bmc_room where code = $1`, [code])).rows[0];
    if (!room) return res.status(404).json({ error: 'ไม่พบรหัสห้องนี้ ลองตรวจตัวสะกดอีกครั้ง' });
    if (room.expires_at && new Date(room.expires_at) < new Date()) {
      return res.status(410).json({ error: 'รหัสห้องนี้หมดอายุแล้ว' });
    }

    /* คนที่เข้ามาแล้วกลับมาอีกครั้ง ต้องได้งานเดิม ไม่ใช่ถูกนับเป็นคนใหม่
       เทียบชื่อแบบไม่สนตัวพิมพ์ใหญ่เล็กและช่องว่างซ้ำ */
    let user = (await q(
      `select * from bmc_user where room_code = $1 and lower(name) = lower($2)`,
      [code, name])).rows[0];

    /* ชื่อซ้ำเป็นจุดอ่อนเดียวที่เหลือของการเข้าห้องด้วยชื่อ
       ถ้าคนที่สองพิมพ์ชื่อตรงกับคนแรก เขาจะเปิดงานของคนแรกและเขียนทับทันที
       แยกเองไม่ได้ว่าเป็นคนเดิมกลับมาหรือคนใหม่ที่ชื่อซ้ำ จึงต้องถาม
       คนเดิมกดยืนยันผ่านได้ทันที คนใหม่จะรู้ตัวว่าต้องเติมนามสกุลหรือเลขที่ */
    if (user && !body?.confirmExisting) {
      return res.status(409).json({
        error: 'มีชื่อนี้ในห้องอยู่แล้ว',
        needConfirm: true,
        hint: 'ถ้านี่คือคุณเองที่กลับมาทำต่อ กดยืนยันได้เลย '
            + 'ถ้าเป็นคนละคน ให้เติมนามสกุลหรือเลขที่ต่อท้ายชื่อ แล้วลองอีกครั้ง',
      });
    }

    if (!user) {
      if (room.max_uses != null && room.used_count >= room.max_uses) {
        return res.status(409).json({ error: 'ห้องนี้เต็มแล้ว แจ้งครูเพื่อขอเพิ่มที่นั่ง' });
      }
      user = (await q(
        `insert into bmc_user (room_code, name) values ($1,$2) returning *`, [code, name])).rows[0];
      await q(`update bmc_room set used_count = used_count + 1 where code = $1`, [code]);
      await q(`insert into bmc_canvas (user_id, data) values ($1,'{}') on conflict (user_id) do nothing`,
        [user.id]);
    } else {
      await q(`update bmc_user set last_seen_at = now() where id = $1`, [user.id]);
    }

    res.json({
      token: sign({ uid: String(user.id), room: code, name: user.name }),
      name: user.name, room: room.label,
      returning: !!user.created_at && Date.now() - new Date(user.created_at).getTime() > 60000,
    });
  } catch (e) {
    console.error('join', e);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองอีกครั้ง' });
  }
};
