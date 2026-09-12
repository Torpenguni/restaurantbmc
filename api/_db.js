/* ตัวต่อฐานข้อมูล ใช้ร่วมกันทุก endpoint
   ใช้สายต่อแบบ pooled ของ Neon เพราะ serverless เปิดปิดการเชื่อมต่อถี่มาก
   สายตรงจะเต็มโควตาการเชื่อมต่อเร็วกว่าที่คิด */
const pg = require('pg');

let pool;
function db() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.BMC_DATABASE_URL,
      max: 2,                       // แต่ละ instance ใช้ไม่กี่สาย ปล่อยให้ pooler จัดการที่เหลือ
      idleTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}
async function q(text, params) { return db().query(text, params); }

/* สร้างตารางตอนเรียกครั้งแรก โปรเจกต์นี้ไม่มีระบบ migration
   และไม่คุ้มจะสร้างเพื่อสามตาราง เช็กด้วย IF NOT EXISTS ทุกครั้งจึงปลอดภัย */
let ready = false;
async function init() {
  if (ready) return;
  await q(`
    create table if not exists bmc_room (
      code        text primary key,
      label       text not null,
      max_uses    int,
      used_count  int  not null default 0,
      expires_at  timestamptz,
      created_at  timestamptz not null default now()
    );
    create table if not exists bmc_user (
      id          bigserial primary key,
      room_code   text not null references bmc_room(code) on delete cascade,
      name        text not null,
      /* ชื่อซ้ำกันในห้องเดียวไม่ได้ ไม่งั้นคนที่สองจะเข้ามาเจองานของคนแรก
         เป็นความเสี่ยงหลักของการเข้าระบบด้วยชื่อ จึงกันที่ฐานข้อมูล ไม่ใช่แค่หน้าจอ */
      unique (room_code, name),
      email       text,
      password_hash text,
      created_at  timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    );
    create table if not exists bmc_canvas (
      id          bigserial primary key,
      user_id     bigint not null references bmc_user(id) on delete cascade,
      title       text,
      data        jsonb not null default '{}',
      updated_at  timestamptz not null default now(),
      unique (user_id)
    );
  `);
  ready = true;
}
module.exports = { q, init };
