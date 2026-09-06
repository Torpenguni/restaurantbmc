/* ตรวจ Canvas ด้วย AI — Vercel Serverless Function
 *
 * ทำงานเฉพาะตอนผู้ใช้กดปุ่มขอเอง ไม่ได้เรียกอัตโนมัติ
 * เพราะการกดปุ่มคือจุดเดียวที่ข้อมูลออกจากเครื่องผู้ใช้
 *
 * ต้องตั้ง environment variable บน Vercel:
 *   ANTHROPIC_API_KEY   (บังคับ)
 *   BMC_MODEL           (ไม่ใส่ก็ได้ ค่าเริ่มต้น claude-haiku-4-5-20251001)
 */

const MODEL      = process.env.BMC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_BODY   = 12000;   // ตัวอักษร — canvas ที่กรอกเต็มยาวราว 3-4 พัน
const MAX_OUTPUT = 1200;    // เพดาน token ขาออก กันบิลบานปลาย
const WINDOW_MS  = 60000;
const PER_WINDOW = 4;

/* ตัวจำกัดอัตราแบบง่าย เก็บในหน่วยความจำของ instance
   serverless สร้าง instance ใหม่ได้เรื่อย ๆ อันนี้จึงเป็นลูกระนาด
   ไม่ใช่กำแพง ถ้าต้องการของจริงต้องต่อ Vercel KV หรือ Upstash
   ด่านที่กันเงินได้จริงคือ spend limit ในคอนโซล Anthropic */
const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 2000) hits.clear();
  return arr.length > PER_WINDOW;
}

const SYSTEM = `คุณคือที่ปรึกษาธุรกิจร้านอาหารในไทย อ่าน Business Model Canvas ที่เจ้าของร้านกรอกมา แล้วให้ความเห็นแบบคนที่เคยเปิดร้านจริง

กรอบที่ใช้ตัดสิน
- กลุ่มลูกค้าต้องเจาะจงจนนึกภาพคนคนนั้นออก คำว่า "ทุกคน" ใช้ไม่ได้
- คุณค่าคือ "จุดซื้อ" ของลูกค้า ไม่ใช่ "จุดขาย" ของเรา คำว่าอร่อย สะอาด บริการดี ทุกร้านพูดได้ จึงไม่ใช่คุณค่า
- ความสัมพันธ์ต้องตอบว่าเป็น "แบบไหน" ไม่ใช่ "วิธีการ"
- ทุกช่องต้องเชื่อมกัน 9 ช่องที่เต็ม ไม่เท่ากับ 9 ช่องที่เข้ากัน
- ต้นทุนวัตถุดิบบวกค่าแรงไม่ควรเกิน 60-65% ของยอดขาย
- เกณฑ์ปกติ วัตถุดิบ 30-35% ค่าแรง 15-20% ค่าเช่า 10-15% กำไร 15-20%

วิธีตอบ
- ภาษาไทย พูดกับเจ้าของร้านตรง ๆ ไม่ใช้ศัพท์ที่ปรึกษา
- ชี้จุดที่อ่อนจริง ไม่ต้องชม ไม่ต้องสรุปซ้ำสิ่งที่เขาเขียน
- ทุกข้อต้องบอกด้วยว่าให้ไปทำอะไรต่อ
- ถ้าข้อมูลไม่พอจะตัดสิน ให้บอกว่าขาดอะไร อย่าเดา
- สูงสุด 5 ข้อ เรียงจากเรื่องที่กระทบเงินมากที่สุดก่อน

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON
{"items":[{"block":"cs|vp|ch|cr|rs|kr|ka|kp|co|all","level":"warn|note","title":"ประโยคเดียวว่าปัญหาคืออะไร","note":"อธิบายและบอกว่าให้ทำอะไรต่อ"}]}`;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  // กันการเรียกจากที่อื่น ไม่ใช่ระบบยืนยันตัวตน แค่กันการยิงเล่น
  const origin = req.headers.origin || '';
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|[^/]*restaurantbmc[^/]*)/.test(origin))
    return res.status(403).json({ error: 'origin' });

  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(503).json({ error: 'unconfigured' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return res.status(429).json({ error: 'rate' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || typeof body.canvas !== 'string')
    return res.status(400).json({ error: 'bad-body' });

  const canvas = body.canvas.slice(0, MAX_BODY);
  if (canvas.trim().length < 60)
    return res.status(400).json({ error: 'too-short' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT,
        system: SYSTEM,
        // prefill ด้วย { บังคับให้โมเดลต่อ JSON เลย
        // ไม่งั้นบางครั้งมันใส่ ```json ครอบ หรือเกริ่นก่อน แล้วแปลงไม่ได้
        messages: [
          { role: 'user', content: canvas },
          { role: 'assistant', content: '{' }
        ]
      })
    });

    if (!r.ok) {
      // ไม่ส่งข้อความ error จากต้นทางกลับไป อาจมีรายละเอียดบัญชีติดมา
      return res.status(502).json({ error: 'upstream', status: r.status });
    }

    const data = await r.json();
    let text = (data.content || []).map(c => c.text || '').join('');
    text = '{' + text;                                  // คืน { ที่ prefill ไป
    text = text.replace(/```(?:json)?/g, '').trim();    // เผื่อยังมี fence ติดมา

    let out = null;
    // ตัดท้ายทีละตัวจนกว่าจะ parse ได้ กันกรณีโมเดลพูดต่อหลังปิดวงเล็บ
    const end = text.lastIndexOf('}');
    for (let i = end; i > 0 && !out; i = text.lastIndexOf('}', i - 1)) {
      try { out = JSON.parse(text.slice(0, i + 1)); } catch (e) { /* ลองตัวถัดไป */ }
    }
    if (!out) return res.status(502).json({ error: 'parse' });
    const items = Array.isArray(out.items) ? out.items.slice(0, 5) : [];

    return res.status(200).json({
      items: items.map(i => ({
        block: String(i.block || 'all').slice(0, 4),
        level: i.level === 'warn' ? 'warn' : 'note',
        title: String(i.title || '').slice(0, 200),
        note:  String(i.note  || '').slice(0, 700)
      })),
      model: MODEL
    });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};
