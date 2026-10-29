#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_ball_icons.py —— 从原书 PDF 里抠出「精灵球」图标

【为什么要写这个脚本】
  原书里的球图标是**矢量图**，但它们画在彩色表格行和米色纸底上，
  直接截图会连着一块底色。这里按两种方式把底去掉：

  · circle —— 球本身是正圆，套一个圆形蒙版，半径向内收 0.35pt，
              正好落在最外圈黑描边上，不会留彩色毛边。绝大多数球用这个。
  · flood  —— 少数球的图形超出了圆（UB 球的金色翼片），
              改用「从四角泛洪吃掉浅色底」：只吃低饱和的高亮像素，
              球内被黑描边围住的白色区域吃不到，所以安全。

  抠完再羽化边缘、缩到 128×128 存 webp，白底深底都不露边。

【输出】assets/img/ball-*.webp

【用法】python _dev/extract_ball_icons.py
        依赖 pymupdf、Pillow
"""

import io
import os
from collections import deque

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0捕捉（96-102）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')

DPI = 700
SIZE = 128
INSET_PT = 0.35     # 圆形蒙版向内收
FEATHER_PT = 0.12   # 羽化，换算成像素用

# 坐标全部取自 PDF 的矢量图形包围盒（pt）
# (文件名, 页码索引, (x0, y0, x1, y1), 蒙版方式, 说明, 额外留白pt)
ICONS = [
    ('ball-starter.webp', 3, (28.3, 264.9, 49.7, 286.3), 'circle', '入门级（白球）', 1.2),
    ('ball-poke.webp',    2, (31.2, 567.4, 53.2, 589.4), 'circle', '精灵球', 1.2),
    ('ball-great.webp',   2, (30.5, 595.4, 52.4, 617.3), 'circle', '超级球', 1.2),
    ('ball-ultra.webp',   2, (29.8, 623.3, 51.8, 645.2), 'circle', '高级球', 1.2),
    ('ball-custom.webp',  2, (31.1, 652.4, 52.3, 673.7), 'circle', '定制球／专家级', 1.2),
    ('ball-cherish.webp', 2, (310.6, 324.7, 332.2, 346.3), 'circle', '珍惜球／精英级', 1.2),
    ('ball-luxury.webp',  2, (310.6, 381.0, 332.1, 402.4), 'circle', '豪华球', 1.2),
    ('ball-ub.webp',      2, (312.0, 436.5, 334.2, 458.6), 'flood', 'UB球', 2.6),
    ('ball-dynamax.webp', 2, (310.6, 492.7, 332.6, 514.7), 'circle', '极巨球', 1.2),
    ('ball-master.webp',  2, (310.6, 548.7, 332.1, 570.1), 'circle', '大师球', 1.2),
]


def render(page, rect, margin_pt=1.5):
    clip = pymupdf.Rect(rect[0] - margin_pt, rect[1] - margin_pt,
                        rect[2] + margin_pt, rect[3] + margin_pt)
    pix = page.get_pixmap(dpi=DPI, clip=clip)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
    return im, clip


def circle_mask(im, clip, rect):
    """正圆蒙版：半径略小于黑描边外沿。"""
    scale = DPI / 72.0
    cx = ((rect[0] + rect[2]) / 2.0 - clip.x0) * scale
    cy = ((rect[1] + rect[3]) / 2.0 - clip.y0) * scale
    r = ((rect[2] - rect[0] + rect[3] - rect[1]) / 4.0 - INSET_PT) * scale

    ss = 4
    big = Image.new('L', (im.width * ss, im.height * ss), 0)
    ImageDraw.Draw(big).ellipse(
        [cx * ss - r * ss, cy * ss - r * ss, cx * ss + r * ss, cy * ss + r * ss], fill=255)
    mask = big.resize(im.size, Image.LANCZOS)
    return mask.filter(ImageFilter.GaussianBlur(FEATHER_PT * scale))


def flood_mask(im):
    """从四角泛洪，吃掉低饱和的浅色底；球内的白色被描边围住，吃不到。"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for s in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append(s)
        seen[s[1] * w + s[0]] = 1
    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        sat = max(r, g, b) - min(r, g, b)
        if lum < 200 or sat > 45:
            continue
        px[x, y] = (255, 255, 255, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                q.append((nx, ny))

    mask = im.getchannel('A')
    # 向内收 0.3pt 再羽化，去掉抗锯齿留下的米色边
    erode = max(1, int(0.3 * DPI / 72.0)) * 2 + 1
    mask = mask.filter(ImageFilter.MinFilter(erode))
    return mask.filter(ImageFilter.GaussianBlur(0.12 * DPI / 72.0))


def cut(page, rect, mode, extra):
    im, clip = render(page, rect)
    im.putalpha(circle_mask(im, clip, rect) if mode == 'circle' else flood_mask(im))

    scale = DPI / 72.0
    cx = ((rect[0] + rect[2]) / 2.0 - clip.x0) * scale
    cy = ((rect[1] + rect[3]) / 2.0 - clip.y0) * scale
    # 统一留白：球的直径保持一致，带外扩翼片的（UB 球）只是方框放大
    half = (max(rect[2] - rect[0], rect[3] - rect[1]) / 2.0 + extra) * scale
    im = im.crop((round(cx - half), round(cy - half),
                  round(cx + half), round(cy + half)))
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    doc = pymupdf.open(PDF)
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for name, pno, rect, mode, label, extra in ICONS:
        im = cut(doc[pno], rect, mode, extra)
        path = os.path.join(OUT_DIR, name)
        im.save(path, 'WEBP', quality=92, method=6)
        size = os.path.getsize(path)
        total += size
        print('%-20s %-14s %5d B' % (name, label, size))
    print('合计 %.1f KB' % (total / 1024.0))


if __name__ == '__main__':
    main()
