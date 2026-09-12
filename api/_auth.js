/* บัตรผ่านแบบเซ็นด้วย HMAC ไม่ใช้ไลบรารีภายนอก
   เนื้อหาที่ต้องพกมีแค่ user id กับชื่อห้อง ไม่มีอะไรเป็นความลับ
   ที่ต้องกันคือการแก้ id เพื่อไปเปิดงานของคนอื่น ลายเซ็นจึงพอ */
const crypto = require('node:crypto');

const b64 = (x) => Buffer.from(x).toString('base64url');
const unb64 = (x) => Buffer.from(x, 'base64url').toString();

function secret() {
  const s = process.env.BMC_SECRET;
  if (!s) throw new Error('ยังไม่ได้ตั้ง BMC_SECRET');
  return s;
}
function sign(payload) {
  const body = b64(JSON.stringify({ ...payload, iat: Date.now() }));
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  /* เทียบแบบเวลาคงที่ การเทียบด้วย === เปิดช่องให้เดาลายเซ็นทีละตัวอักษรได้ */
  if (mac.length !== want.length ||
      !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(unb64(body));
    if (!p.uid) return null;
    // อายุ 120 วัน พอครอบหนึ่งภาคเรียน ไม่ต้องให้เด็กเข้าระบบใหม่กลางเทอม
    if (Date.now() - (p.iat || 0) > 120 * 86400000) return null;
    return p;
  } catch (e) { return null; }
}
function userOf(req) {
  const h = req.headers.authorization || '';
  return verify(h.replace(/^Bearer /, ''));
}
/* หน้าครูใช้กุญแจจาก env ตรง ๆ ไม่มีบัญชีครูในฐานข้อมูล
   ครูมีคนเดียวหรือสองคน การทำระบบบัญชีให้จึงยังไม่คุ้ม */
function isTeacher(req) {
  const key = process.env.BMC_ADMIN_KEY;
  if (!key) return false;
  const given = (req.headers['x-admin-key'] || '').toString();
  return given.length === key.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(key));
}
module.exports = { sign, verify, userOf, isTeacher };
