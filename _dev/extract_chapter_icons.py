#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_chapter_icons.py —— 从原书目录页抠出「章节球图标」

【这是什么】
  原书 Table of Contents（PDF 第 6–7 页）里，每一章的标题都压在一条彩色横条上，
  横条左端是一枚球形徽记——每个章节的球都不一样，颜色跟着章节走。
  本站侧栏原来用的是 🏛️ / 🌌 这类 emoji，换成这套球以后就和原书对上了。

【怎么抠】
  和 extract_ball_icons.py 同一套路：球是正圆，套圆形蒙版、半径内收 0.35pt，
  正好压在黑色外圈上，横条的底色就被切干净了。
  球的圆心靠「黑色填充、约 21.4pt 见方」这个特征在横条左侧自动找。

【输出】assets/img/ch-*.webp（128×128，透明底）

【用法】python _dev/extract_chapter_icons.py
"""

import io
import os
from collections import deque

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0介绍+世界观（1-19）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')

DPI = 600
SIZE = 128
INSET_PT = 0.35

# (输出名, 页码索引, 横条左上角 x, 横条 y0, 横条 y1, 中文说明, 蒙版方式)
# circle = 正圆蒙版（球是正圆，最简单也最干净）
# bar    = 吃掉横条底色（宝可梦特性那枚是「带软木塞的烧瓶」，瓶塞探出圆外，
#          用圆蒙版会把塞子切掉，所以改成在横条范围内泛洪去底）
CHAPTERS = [
    ('ch-00-intro.webp',    5, 18.8, 83.9, 112.0, '引言', 'circle'),
    ('ch-01-world.webp',    5, 19.8, 120.2, 148.1, '不可思议的宝可梦世界', 'circle'),
    ('ch-02-system.webp',   5, 18.4, 252.6, 280.6, '系统详解', 'circle'),
    ('ch-03-character.webp', 5, 20.2, 488.3, 516.4, '角色创建', 'circle'),
    ('ch-04-battles.webp',  5, 18.4, 632.7, 660.6, '宝可梦对战', 'circle'),
    ('ch-05-catching.webp', 5, 311.0, 83.9, 111.8, '收服宝可梦', 'circle'),
    ('ch-06-training.webp', 5, 311.2, 215.0, 243.0, '训练宝可梦', 'circle'),
    ('ch-07-items.webp',    5, 311.0, 413.2, 441.1, '旅途道具', 'circle'),
    ('ch-08-pokedex.webp',  5, 311.0, 531.5, 559.4, '宝可梦图鉴', 'circle'),
    ('ch-09-moves.webp',    5, 311.4, 749.9, 777.8, '宝可梦招式', 'circle'),
    ('ch-10-abilities.webp', 6, 23.3, 259.4, 287.3, '宝可梦特性', 'bar'),
    ('ch-11-gm.webp',       6, 22.9, 369.2, 397.2, '游戏主持人', 'circle'),
    ('ch-12-spirit.webp',   6, 23.6, 702.3, 730.3, '冠军之魂', 'circle'),
    # 终章寄语在原书目录里就没有图标（横条是纯色），所以不生成
]


def find_ball(page, bar_x, bar_y0, bar_y1):
    """在横条左端找那枚球。

    大多数球的圆心靠「约 21.4pt 见方、实心填充」的矢量路径能直接认出来；
    但招式那一章的球是深红描边、最终章干脆是黑色横条上挖出来的白球，
    这两类找不到独立路径，就按其它章节量出来的固定偏移兜底：
    球比横条左边多进 9.6pt、比横条顶部低 3.8pt，直径 21.4pt。
    """
    for g in page.get_drawings():
        r = g['rect']
        if (19 < r.width < 24 and 19 < r.height < 24
                and r.x0 > bar_x + 2 and r.x0 < bar_x + 40
                and bar_y0 - 1 <= r.y0 <= bar_y1):
            return r
    x0 = bar_x + 9.6
    y0 = bar_y0 + 3.8
    return pymupdf.Rect(x0, y0, x0 + 21.4, y0 + 21.4)


def cut(page, rect):
    clip = pymupdf.Rect(rect.x0 - 1.2, rect.y0 - 1.2, rect.x1 + 1.2, rect.y1 + 1.2)
    pix = page.get_pixmap(dpi=DPI, clip=clip)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')

    scale = DPI / 72.0
    cx = ((rect.x0 + rect.x1) / 2.0 - clip.x0) * scale
    cy = ((rect.y0 + rect.y1) / 2.0 - clip.y0) * scale
    radius = ((rect.width + rect.height) / 4.0 - INSET_PT) * scale

    ss = 4
    big = Image.new('L', (im.width * ss, im.height * ss), 0)
    ImageDraw.Draw(big).ellipse(
        [cx * ss - radius * ss, cy * ss - radius * ss,
         cx * ss + radius * ss, cy * ss + radius * ss], fill=255)
    mask = big.resize(im.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    im.putalpha(mask)

    half = (max(rect.width, rect.height) / 2.0 + 1.2) * scale
    im = im.crop((round(cx - half), round(cy - half),
                  round(cx + half), round(cy + half)))
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def cut_from_bar(page, bar_x, bar_y0, bar_y1):
    """吃掉横条底色。给「瓶塞探出圆外」的图标用。"""
    clip = pymupdf.Rect(bar_x + 0.7, bar_y0, bar_x + 38, bar_y1)
    pix = page.get_pixmap(dpi=DPI, clip=clip)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
    w, h = im.size
    px = im.load()

    # 种子色取横条内部（四角是圆角，会取到纸色）
    br, bg, bb, _ = px[w - 3, h // 2]

    q = deque()
    seen = bytearray(w * h)
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y)); seen[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x]:
                q.append((x, y)); seen[y * w + x] = 1

    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        if abs(r - br) <= 30 and abs(g - bg) <= 30 and abs(b - bb) <= 30:
            px[x, y] = (255, 255, 255, 0)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))

    # 圆角处会残留四个纸色小三角，按连通块面积丢掉
    a = im.getchannel('A').load()
    seen = bytearray(w * h)
    comps = []
    for y in range(h):
        for x in range(w):
            if a[x, y] < 40 or seen[y * w + x]:
                continue
            qq = deque([(x, y)]); seen[y * w + x] = 1; comp = []
            while qq:
                cx, cy = qq.popleft(); comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if (0 <= nx < w and 0 <= ny < h
                            and not seen[ny * w + nx] and a[nx, ny] >= 40):
                        seen[ny * w + nx] = 1
                        qq.append((nx, ny))
            comps.append(comp)
    biggest = max(len(c) for c in comps)
    keep = bytearray(w * h)
    for comp in comps:
        if len(comp) >= biggest * 0.15:
            for x, y in comp:
                keep[y * w + x] = 1
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                px[x, y] = (255, 255, 255, 0)

    bbox = im.getchannel('A').getbbox()
    if bbox:
        im = im.crop(bbox)

    pad = int(round(SIZE * 0.06))
    w2 = max(1, int(round(im.width * SIZE / float(im.height))))
    im = im.resize((w2, SIZE), Image.LANCZOS)
    canvas = Image.new('RGBA', (w2 + pad * 2, SIZE + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    return canvas


def main():
    doc = pymupdf.open(PDF)
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for name, pno, bx, by0, by1, label, mode in CHAPTERS:
        if mode == 'bar':
            im = cut_from_bar(doc[pno], bx, by0, by1)
        else:
            im = cut(doc[pno], find_ball(doc[pno], bx, by0, by1))
        path = os.path.join(OUT_DIR, name)
        im.save(path, 'WEBP', quality=92, method=6)
        size = os.path.getsize(path)
        total += size
        print('%-22s %-12s %3dx%-3d %5d B' % (name, label, im.width, im.height, size))
    print('合计 %.1f KB' % (total / 1024.0))


if __name__ == '__main__':
    main()
