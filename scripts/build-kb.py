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
#
# คำเดียวกันอาจหมายคนละเรื่องขึ้นกับว่าอยู่ช่องไหน เช่น "พนักงาน"
# ในช่องกลุ่มลูกค้าหมายถึงพนักงานออฟฟิศที่มากิน แต่ในช่องทรัพยากร
# หมายถึงลูกจ้างของร้าน จึงต้องกำหนดว่าคำไหนใช้ได้กับช่องไหน
# '*' = ใช้ได้ทุกช่อง
TERMS = {
    'เดลิเวอรี': ['ch', 'co', 'rs', 'kp'],
    'แฟรนไชส์': ['rs', 'kp', 'vp'],
    'ต้นทุน':   ['co', 'rs', 'kr'],
    'ทำเล':     ['kr', 'ch', 'cs'],
    'พนักงาน':  ['kr', 'ka', 'co'],
    'ราคา':     ['rs', 'vp', 'co'],
    'คาเฟ่':    ['*'],
    'กาแฟ':     ['*'],
    'เมนู':     ['vp', 'rs', 'ka'],
    'วัตถุดิบ':  ['co', 'kp', 'ka'],
    'ลูกค้า':    ['cs', 'vp', 'cr', 'ch'],
    'สาขา':     ['kr', 'ka', 'rs'],
    'แบรนด์':   ['vp', 'cr'],
    'การตลาด':  ['ch', 'cr', 'vp'],
    'กำไร':     ['co', 'rs'],
    'ขาดทุน':   ['co', 'rs'],
    'คู่แข่ง':    ['vp', 'cs'],
    'รีวิว':     ['cr', 'ch'],
    'โปรโมชั่น': ['ch', 'cr', 'rs'],
    'สมาชิก':   ['cr', 'rs'],
    'จัดเลี้ยง':  ['rs', 'ch'],
    'ครัวกลาง': ['kr', 'ka', 'co'],
    'ซัพพลายเออร์': ['kp', 'co'],
    'สต็อก':    ['ka', 'co'],
    'ของเสีย':  ['co', 'ka'],
    'บุฟเฟต์':   ['rs', 'vp'],
    'ชานม':     ['*'],
    'เบเกอรี':   ['*'],
    'ปิ้งย่าง':   ['*'],
    'ห้าง':      ['ch', 'kr', 'co'],
    'ปั๊ม':       ['ch', 'kr'],
    'ออนไลน์':  ['ch', 'cr'],
    'ไลน์':      ['ch', 'cr'],
    'GP':       ['co', 'ch', 'rs'],
    'POS':      ['ka', 'kr'],
    'SOP':      ['ka', 'kr'],
    'คืนทุน':    ['co', 'rs'],
    'ลงทุน':    ['co', 'kr'],
}

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
        if title and title.group(1).strip() in ('|', '|-', '>', '>-'):
            # YAML block scalar — ชื่อเรื่องอยู่บรรทัดถัดไปแบบย่อหน้า
            blk = re.search(r'^title:\s*[|>]-?\s*\n((?:[ \t]+.*\n?)+)', fm, re.M)
            title = re.match(r'(.*)', ' '.join(blk.group(1).split())) if blk else None
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

        # เก็บคำเป็น "คำ|ช่องที่ใช้ได้" เพื่อให้ฝั่งเบราว์เซอร์กรองตามช่องได้
        terms = []
        for w, wb in TERMS.items():
            if w.lower() in title.lower():
                terms.append(w + '|' + ('*' if '*' in wb else ''.join(wb)))
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
