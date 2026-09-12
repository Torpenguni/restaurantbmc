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
const MAX_OUTPUT = 2400;    // เพดาน token ขาออก กันบิลบานปลาย
                            // ไทยกิน token ต่อตัวอักษรมากกว่าอังกฤษหลายเท่า
                            // 1200 ทำให้คำตอบ 5 ข้อถูกตัดกลางจน JSON ไม่ปิด
const WINDOW_MS  = 60000;
const PER_WINDOW = 60;   /* ปุ่มรายช่องมี 9 ปุ่ม คนกรอกคนเดียวจะกดถี่กว่าปุ่มรวมอยู่แล้ว
                            และเวลาเอาไปใช้ในห้องเรียน นักเรียนทั้งห้องต่อ WiFi เดียวกัน
                            ทุกคนจึงออกมาเป็น IP เดียว 12 ครั้งต่อนาทีหมดตั้งแต่คนที่สอง
                            ด่านที่กันค่าใช้จ่ายได้จริงคือ spend limit ในคอนโซล Anthropic
                            ตัวนี้มีไว้กันสคริปต์ยิงรัว ไม่ใช่กันคนใช้งานตามปกติ */

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
- ทุกข้อต้องอ้างตัวเลขหรือคำที่เขากรอกมาจริง ห้ามให้คำแนะนำลอย ๆ
  ที่เอาไปใช้กับร้านไหนก็ได้ เช่นห้ามพูดแค่ว่า "ทำ CRM ผ่าน LINE"
  ต้องบอกว่าทำกับลูกค้ากลุ่มไหน วัดผลจากตัวเลขไหน
- ทุกข้อต้องบอกว่าให้ไปทำอะไรต่อ และทำได้ภายในกี่วัน
- ถ้าข้อมูลไม่พอจะตัดสิน ให้บอกว่าขาดอะไร อย่าเดา
- level ใช้ urgent เมื่อไม่แก้แล้วเสียเงินทุกวัน · should เมื่อควรแก้แต่ยังไม่เลือดไหล · option เมื่อเป็นทางเลือกให้ลอง
- สูงสุด 4 ข้อ เรียงจากเรื่องที่กระทบเงินมากที่สุดก่อน
- แต่ละข้อ note ไม่เกิน 2 ประโยค

ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON
{"items":[{"block":"cs|vp|ch|cr|rs|kr|ka|kp|co|all","level":"urgent|should|option","title":"ประโยคเดียวว่าปัญหาคืออะไร","note":"อธิบายและบอกว่าให้ทำอะไรต่อ"}]}`;


const SYSTEM_BLOCK = `คุณคือที่ปรึกษาธุรกิจร้านอาหารในไทย เจ้าของร้านกำลังกรอก Business Model Canvas อยู่ช่องหนึ่ง และกดขอความช่วยเหลือเฉพาะช่องนั้น

คุณจะได้รับ ชื่อช่อง · มาตรฐานของช่องนั้น · หลุมพรางที่พบบ่อย · สิ่งที่เขาเขียนไว้ตอนนี้ · และบริบทกลุ่มลูกค้า

วิธีตอบ
- ภาษาไทย พูดกับเจ้าของร้านตรง ๆ ไม่ใช้ศัพท์ที่ปรึกษา
- ask: คำถาม 1-2 ข้อที่ทำให้คำตอบเขาคมขึ้น ถามสิ่งที่ยังไม่มีในคำตอบเท่านั้น ห้ามถามสิ่งที่เขาตอบไปแล้ว
- fix: ชี้จุดที่ยังอ่อนของสิ่งที่เขาเขียน 1 ประโยค ถ้าเขียนดีอยู่แล้วให้บอกว่าดีตรงไหนและต่อยอดยังไง
- draft: ตัวอย่างข้อความที่เขาเอาไปใช้ได้เลย เขียนในน้ำเสียงเจ้าของร้าน ไม่เกิน 2 บรรทัด
  ต้องอ้างอิงบริบทกลุ่มลูกค้าที่ได้รับ ห้ามเขียนกว้าง ๆ ที่ใช้กับร้านไหนก็ได้
  ถ้าช่องยังว่าง ให้ร่างจากบริบทกลุ่มลูกค้า ถ้ามีข้อความแล้วให้เขียนเวอร์ชันที่คมขึ้น
- ถ้าข้อมูลไม่พอจะร่าง ให้ draft เป็นค่าว่าง แล้วบอกใน fix ว่าขาดอะไร

ตอบเป็น JSON เท่านั้น
{"ask":["คำถามที่ 1","คำถามที่ 2"],"fix":"ประโยคเดียว","draft":"ข้อความที่เอาไปใช้ได้"}`;

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

  const isBlock = body.mode === 'block';
  const canvas = body.canvas.slice(0, MAX_BODY);
  // โหมดรายช่องส่งข้อมูลน้อยกว่ามาก เกณฑ์ความยาวขั้นต่ำจึงต้องต่ำกว่า
  // ไม่งั้นกดขอความช่วยเหลือตอนช่องยังว่างไม่ได้ ซึ่งเป็นตอนที่ต้องการที่สุด
  if (canvas.trim().length < (isBlock ? 12 : 60))
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
        max_tokens: isBlock ? 700 : MAX_OUTPUT,
        system: isBlock ? SYSTEM_BLOCK : SYSTEM,
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
    // ถ้าโดนตัดกลางเพราะชน max_tokens ให้ปิดวงเล็บที่ค้างแล้วลองอีกที
    if (!out && data.stop_reason === 'max_tokens') {
      const cut = text.lastIndexOf('},');
      if (cut > 0) {
        try { out = JSON.parse(text.slice(0, cut + 1) + ']}'); } catch (e) { /* ยอมแพ้ */ }
      }
    }
    if (!out)
      return res.status(502).json({
        error: data.stop_reason === 'max_tokens' ? 'truncated' : 'parse',
        stop: data.stop_reason || null
      });
    if (isBlock) {
      return res.status(200).json({
        ask: (Array.isArray(out.ask) ? out.ask : []).slice(0, 2).map(x => String(x).slice(0, 180)),
        fix: String(out.fix || '').slice(0, 400),
        draft: String(out.draft || '').slice(0, 400),
        model: MODEL
      });
    }

    const items = Array.isArray(out.items) ? out.items.slice(0, 4) : [];

    return res.status(200).json({
      items: items.map(i => ({
        block: String(i.block || 'all').slice(0, 4),
        level: ['urgent','should','option'].indexOf(i.level) >= 0 ? i.level : 'should',
        title: String(i.title || '').slice(0, 200),
        note:  String(i.note  || '').slice(0, 700)
      })),
      model: MODEL
    });
  } catch (e) {
    return res.status(502).json({ error: 'network' });
  }
};
