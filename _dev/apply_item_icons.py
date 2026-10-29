#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_item_icons.py —— 给 itemprice.md 的道具表格行补上图标

图标由 extract_item_icons.py 生成，文件名是 item-<英文名 slug>.webp。
这里只做一件事：扫每张表的第一列，认出英文名 → 算 slug → 文件在就插一张 <img>。

  加入 __pycache__ 里已有的行不重复插（已经带 <img 的跳过），
  所以脚本可以反复跑，不会插两层。

【用法】python _dev/apply_item_icons.py [--dry]
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD = os.path.join(ROOT, 'itemprice.md')
IMG = os.path.join(ROOT, 'assets', 'img')

# 英文名 → slug 的特例（slugify 之后对不上的）
OVERRIDE = {
    'Leaf Stone': 'leaf-stone',
}

CJK = re.compile(r'[\u4e00-\u9fff·（）()0-9\s]+')
EN = re.compile(r"[A-Za-zéÉ][A-Za-z0-9éÉ'’\-&\. ]*$")


def slugify(name):
    s = name.lower()
    s = s.replace('é', 'e').replace('’', '').replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def split_cell(cell):
    """把「中文 English Name」拆成 (中文, 英文)。拆不出英文就返回 None。"""
    cell = cell.strip()
    m = EN.search(cell)
    if not m:
        return None
    en = m.group(0).strip()
    zh = cell[:m.start()].strip()
    if not zh or len(en) < 2:
        return None
    return zh, en


def main():
    dry = '--dry' in sys.argv
    lines = open(MD, encoding='utf-8').read().split('\n')
    out, used, missed = [], [], []

    for line in lines:
        if not line.startswith('|') or '<img' in line:
            out.append(line)
            continue
        cells = line.split('|')
        if len(cells) < 4:
            out.append(line)
            continue
        parsed = split_cell(cells[1])
        if not parsed:
            out.append(line)
            continue
        zh, en = parsed
        slug = OVERRIDE.get(en, slugify(en))
        path = os.path.join(IMG, 'item-%s.webp' % slug)
        if not os.path.exists(path):
            missed.append((zh, en, slug))
            out.append(line)
            continue
        cells[1] = ' <img class="item-icon" width="18" height="18" ' \
                   'src="assets/img/item-%s.webp" alt="%s">%s ' % (slug, zh, zh + ' ' + en)
        out.append('|'.join(cells))
        used.append((zh, en, slug))

    print('插入 %d 行，跳过 %d 行' % (len(used), len(missed)))
    for zh, en, slug in used:
        print('  ✓ %-14s %-34s item-%s.webp' % (zh, en, slug))
    if missed:
        print('--- 没有图标文件（持有物那几张表本来就没图标）---')
        for zh, en, slug in missed:
            print('  · %-14s %-30s → item-%s.webp 不存在' % (zh, en, slug))

    if not dry:
        open(MD, 'w', encoding='utf-8').write('\n'.join(out))
        print('已写入', MD)


if __name__ == '__main__':
    main()
