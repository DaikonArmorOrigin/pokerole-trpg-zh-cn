#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_move_icons.py —— 从《3.0战斗（52-93）.pdf》抠出招式/战斗相关的图标

【关键技巧：把整页背景图换成透明】
  这一册的图标全是矢量，但都画在一张整页的纸纹位图上（xref 1628）。
  直接截图会连纸纹一起带走；用 `page.replace_image()` 把那张背景图
  替换成 1×1 透明 PNG，再 `get_pixmap(alpha=True)` 渲染，
  图标就自带透明底了——不用再做泛洪去底，边缘也是矢量的原样。

【不收进来的东西】
  增益/减益徽章（Strength ↑1、Accuracy ↓2 这类）是**参数化组件**：
  属性名 + 箭头 + 数字的组合太多，逐张抠图没意义，交给 CSS 组件
  （见 _dev/图标调用表.md 的说明）。

【输出】assets/img/mv-*.webp、bf-*.webp（128×128，透明底）

【用法】python _dev/extract_move_icons.py
"""

import io
import os

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0战斗（52-93）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')

DPI = 500
SIZE = 128

# (输出名, 页码索引, 图标左上角 x, y, 中文名)
ICONS = [
    # —— 招式的「属性」标记（p.80）——
    ('mv-bite.webp',        28, 21, 170, '咬类招式'),
    ('mv-cutter.webp',      28, 21, 226, '斩击类招式'),
    ('mv-fist.webp',        28, 21, 282, '拳类招式'),
    ('mv-projectile.webp',  28, 21, 335, '弹射类招式'),
    ('mv-wind.webp',        28, 21, 387, '风类招式'),
    ('mv-recharge.webp',    28, 140, 580, '需要充能'),
    ('mv-never-miss.webp',  28, 433, 137, '不会失手'),
    ('mv-ongoing.webp',     28, 431, 317, '持续伤害'),
    ('mv-out-of-range.webp', 28, 431, 621, '脱离范围'),
    # —— 招式的「效果」标记（p.81）——
    ('mv-powder.webp',      29, 143, 115, '粉末类招式'),
    ('mv-rampage.webp',     29, 143, 320, '乱击招式'),
    ('mv-ranged.webp',      29, 436, 153, '远程招式'),
    ('mv-reaction.webp',    29, 416, 370, '反应动作'),
    ('mv-late-reaction.webp', 29, 456, 370, '延迟反应'),
    ('mv-recoil.webp',      29, 438, 507, '反作用力伤害'),
    ('mv-set-damage.webp',  29, 319, 668, '固定伤害'),
    # —— 其它（p.75 / p.91）——
    ('mv-blocking.webp',    23, 532, 426, '阻挡'),
    ('bf-duration.webp',    39, 250, 622, '持续时间'),
    ('bf-no-evasion.webp',  39, 259, 148, '不可闪避'),
    ('bf-no-evasion-clash.webp', 39, 550, 624, '不可闪避／冲抵'),
    ('bf-no-items.webp',    39, 510, 624, '禁用道具'),
    ('bf-change-type.webp', 39, 203, 622, '属性变更'),
]


def transparent_png():
    buf = io.BytesIO()
    Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(buf, 'PNG')
    return buf.getvalue()


def find_rect(page, x, y):
    """按左上角找那块矢量图形的真实包围盒。

    同一位置可能叠着好几层路径（底色块、图标本体、文字框），
    挑**尺寸最接近 38pt 见方**的那一个，图标本体才不会被带偏。
    """
    best = None
    best_score = 1e9
    for g in page.get_drawings():
        r = g['rect']
        if abs(r.x0 - x) <= 2.5 and abs(r.y0 - y) <= 2.5 and 28 < r.width < 50:
            score = abs(r.width - 38) + abs(r.height - 38)
            if score < best_score:
                best_score = score
                best = r
    return best or pymupdf.Rect(x, y, x + 38, y + 38)


def main():
    doc = pymupdf.open(PDF)
    os.makedirs(OUT_DIR, exist_ok=True)

    # 每页先把整页背景图换成透明（只做一次）
    cleared = set()
    for _, pno, _, _, _ in ICONS:
        if pno in cleared:
            continue
        page = doc[pno]
        for im in page.get_images(full=True):
            if doc.extract_image(im[0])['width'] > 1000:
                page.replace_image(im[0], stream=transparent_png())
                break
        cleared.add(pno)

    total = 0
    for name, pno, x, y, label in ICONS:
        page = doc[pno]
        r = find_rect(page, x, y)
        pad = 0.2
        clip = pymupdf.Rect(r.x0 - pad, r.y0 - pad, r.x1 + pad, r.y1 + pad)
        pix = page.get_pixmap(dpi=DPI, clip=clip, alpha=True)
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')

        # 等比放进 SIZE 的方框，四周留一点白
        side = max(im.size)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
        canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)

        path = os.path.join(OUT_DIR, name)
        canvas.save(path, 'WEBP', quality=92, method=6)
        size = os.path.getsize(path)
        total += size
        print('%-26s %-12s %5d B' % (name, label, size))
    print('合计 %.1f KB' % (total / 1024.0))


if __name__ == '__main__':
    main()
