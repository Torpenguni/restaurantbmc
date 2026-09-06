#!/usr/bin/env python3
"""สร้าง kb.js — ดัชนีบทความ Torpenguin สำหรับใช้แนะนำระหว่างกรอก Canvas

อ่านจาก ~/Documents/torpenguin-astro/src/content/post/*.md
ไม่ได้ copy เนื้อหาบทความมา เก็บแค่ชื่อเรื่อง หมวด แท็ก และ slug
เพื่อให้ไฟล์เล็กพอโหลดในเบราว์เซอร์ และเนื้อหายังอยู่ที่ torpenguin.com ที่เดียว

ใช้: python3 scripts/build-kb.py
"""
import glob, json, os, re, sys

SRC = os.path.expanduser('~/Documents/torpenguin-astro/src/content/post')
OUT = os.path.join(os.path.dirname(__file__), '..', 'kb.js')
SITE = 'https://torpenguin.com/'

# แท็ก/หมวด -> ช่องใน Canvas ที่บทความนั้นน่าจะช่วยได้
TAG_BLOCK = {
    'cs': ['เปิดร้านอาหาร', 'แนวคิด', 'การตลาด', 'marketing', 'การตลาดร้านอาหาร'],
    'vp': ['แนวคิด', 'กรณีศึกษา', 'case-studies', 'branding', 'การตลาดร้านอาหาร'],
    'ch': ['marketing', 'การตลาด', 'การตลาดร้านอาหาร', 'delivery'],
    'cr': ['marketing', 'การตลาด', 'การตลาดร้านอาหาร', 'service'],
    'rs': ['cost', 'การเงินการบัญชี', 'feasibility'],
    'kr': ['systems', 'การจัดการ', 'team', 'การจัดการพนักงาน'],
    'ka': ['systems', 'การจัดการ', 'การบริหารจัดการวัตถุดิบ'],
    'kp': ['การบริหารจัดการวัตถุดิบ', 'systems', 'แฟรนไชส์'],
    'co': ['cost', 'การเงินการบัญชี', 'การบริหารจัดการวัตถุดิบ', 'feasibility'],
}
CAT_BLOCK = {'feasibility': ['cs', 'rs', 'co'], 'case-studies': ['vp', 'cs'], 'how-to': []}

# คำที่ใช้จับคู่ชื่อบทความกับสิ่งที่ผู้ใช้พิมพ์
# ภาษาไทยตัดคำไม่ได้ จึงใช้รายการคำที่คัดเองแทนการ tokenize
TERMS = [
    'เดลิเวอรี', 'แฟรนไชส์', 'ต้นทุน', 'ทำเล', 'พนักงาน', 'ราคา', 'คาเฟ่', 'กาแฟ',
    'เมนู', 'วัตถุดิบ', 'ลูกค้า', 'สาขา', 'แบรนด์', 'การตลาด', 'ขายดี', 'กำไร',
    'ขาดทุน', 'คู่แข่ง', 'รีวิว', 'โปรโมชั่น', 'สมาชิก', 'จัดเลี้ยง', 'ครัวกลาง',
    'ซัพพลายเออร์', 'สต็อก', 'ของเสีย', 'บุฟเฟต์', 'ชานม', 'เบเกอรี', 'ปิ้งย่าง',
    'ห้าง', 'ปั๊ม', 'ออนไลน์', 'LINE', 'ไลน์', 'GP', 'POS', 'SOP', 'คืนทุน', 'ลงทุน',
]

def main():
    if not os.path.isdir(SRC):
        sys.exit('ไม่พบโฟลเดอร์บทความ: ' + SRC)
    items = []
    for p in sorted(glob.glob(os.path.join(SRC, '*.md'))):
        s = open(p, encoding='utf-8').read()
        if not s.startswith('---'):
            continue
        fm = s[3:s.find('---', 3)]
        title = re.search(r'^title:\s*"?(.+?)"?\s*$', fm, re.M)
        cat   = re.search(r'^category:\s*"?([^"\n]+)"?', fm, re.M)
        tags  = re.search(r'^tags:\s*\[([^\]]*)\]', fm, re.M)
        if not title:
            continue
        title = title.group(1).strip()
        cat = cat.group(1).strip() if cat else ''
        tg = [t.strip().strip('"\'') for t in tags.group(1).split(',')] if tags else []
        tg = [t for t in tg if t]

        blocks = set(CAT_BLOCK.get(cat, []))
        for b, want in TAG_BLOCK.items():
            if any(t in want for t in tg):
                blocks.add(b)
        if not blocks:
            continue                       # ไม่รู้ว่าช่วยช่องไหน ไม่ต้องเก็บ

        terms = [t for t in TERMS if t.lower() in title.lower()]
        items.append({
            's': os.path.basename(p)[:-3],
            't': title,
            'c': cat,
            'b': sorted(blocks),
            'k': terms,
        })

    js = ('/* kb.js — ดัชนีบทความ Torpenguin สร้างด้วย scripts/build-kb.py\n'
          '   อย่าแก้ไฟล์นี้ด้วยมือ แก้ที่สคริปต์แล้วสร้างใหม่\n'
          '   เก็บแค่ชื่อเรื่องกับ slug เนื้อหาอยู่ที่ torpenguin.com ที่เดียว */\n'
          'window.BMC_KB = { site: ' + json.dumps(SITE) + ', items: '
          + json.dumps(items, ensure_ascii=False, separators=(',', ':')) + ' };\n')
    open(OUT, 'w', encoding='utf-8').write(js)

    from collections import Counter
    per = Counter()
    for it in items:
        for b in it['b']:
            per[b] += 1
    print(f'เขียน kb.js  {len(items)} บทความ  {os.path.getsize(OUT)/1024:.0f} KB')
    print('  ต่อช่อง:', dict(per))

if __name__ == '__main__':
    main()
