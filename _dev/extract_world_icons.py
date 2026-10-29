#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_world_icons.py —— 从《3.0介绍+世界观（1-19）.pdf》里抠出
第一章要用的两类素材：

  1. 反派组织徽记 + 劲敌头像（原书 p.17–19，共 10 个）
  2. 跨页世界地图（原书 p.12–13，左右两页拼成一张）

【图标为什么要这么处理】
  这些徽记**不是矢量图**（和精灵球不同），是嵌在页面里的小位图，
  而且直接画在米色纸底上。所以做法是：
    · 从四角泛洪，吃掉和底色相近的像素 → 透明
    · 再按连通块面积过滤，去掉零散杂点（呐喊队上方那几个红点就是这么去掉的）
    · 星星徽记本身由好几块组成，所以不能只留最大块，要按比例留
  注意：泛洪只走「和底色相近」的像素，徽记内部被描边围住的浅色区域碰不到，
  所以浅蓝的水舰队徽记、浅金的星星都能完整保留。

【地图为什么要拼】
  原书把地图排成一个跨页，左页一张 1068×954、右页一张 1022×954，
  两张都是 2 px/pt，交界处重叠 2pt（=4px），拼起来就是完整的一张。
  右页里那条竖线是原书两个地图面板之间的分隔，不是拼接痕迹，保留。

【输出】assets/img/team-*.webp / rival.webp / world-map.webp

【用法】python _dev/extract_world_icons.py
"""

import io
import os
from collections import deque

import numpy as np
import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0介绍+世界观（1-19）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')

DPI = 600          # 图标渲染精度
ICON_H = 128       # 输出高度（宽度按比例）
ICON_PAD = 0.06    # 四周留白比例

# (文件名, 页码索引, 裁切框 pt, 说明)
ICONS = [
    ('team-rocket.webp',   16, (20, 286, 54, 326), '火箭队'),
    ('team-aqua.webp',     16, (310, 92, 350, 136), '海洋队'),
    ('team-magma.webp',    16, (447, 92, 491, 136), '熔岩队'),
    ('team-galactic.webp', 16, (301, 392, 337, 434), '银河队'),
    ('team-plasma.webp',   17, (14, 88, 46, 130), '等离子队'),
    ('team-skull.webp',    17, (307, 85, 348, 133), '骷髅队'),
    ('team-flare.webp',    17, (19, 405, 54, 452), '闪焰队'),
    ('team-yell.webp',     17, (307, 416, 349, 453), '呐喊队'),
    ('team-star.webp',     18, (19, 84, 62, 129), '天星队'),
    ('rival.webp',         18, (19, 407, 62, 444), '劲敌'),
]

MAP_DPI = 288                 # 地图渲染精度：4 px/pt，放大看字也够
# 地图跨 p.12–13，两页各渲染一半，在页边对齐拼接
MAP_L = (11, (79, 531, 612, 1008))
MAP_R = (12, (0, 531, 510, 1008))
MAP_SEAM_STRIP = 170          # 量底色时从接缝两侧各取多宽


def drop_background(im, tol=26):
    """从四角泛洪，把和底色相近的像素变透明。"""
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    br = sum(c[0] for c in corners) / 4.0
    bg = sum(c[1] for c in corners) / 4.0
    bb = sum(c[2] for c in corners) / 4.0

    seen = bytearray(w * h)
    q = deque()
    for s in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append(s)
        seen[s[1] * w + s[0]] = 1
    while q:
        x, y = q.popleft()
        r, g, b, _ = px[x, y]
        if abs(r - br) <= tol and abs(g - bg) <= tol and abs(b - bb) <= tol:
            px[x, y] = (255, 255, 255, 0)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                    seen[ny * w + nx] = 1
                    q.append((nx, ny))


def drop_specks(im, ratio=0.12):
    """丢掉面积不到最大连通块 12% 的碎点（星形徽记本身分几块，所以按比例留）。"""
    w, h = im.size
    a = im.getchannel('A').load()
    seen = bytearray(w * h)
    comps = []
    for y in range(h):
        for x in range(w):
            if a[x, y] < 40 or seen[y * w + x]:
                continue
            q = deque([(x, y)])
            seen[y * w + x] = 1
            comp = []
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if (0 <= nx < w and 0 <= ny < h
                            and not seen[ny * w + nx] and a[nx, ny] >= 40):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(comp)
    if not comps:
        return
    biggest = max(len(c) for c in comps)
    keep = bytearray(w * h)
    for comp in comps:
        if len(comp) >= biggest * ratio:
            for x, y in comp:
                keep[y * w + x] = 1
    px = im.load()
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                px[x, y] = (255, 255, 255, 0)


def render_region(doc, pno, box):
    pix = doc[pno].get_pixmap(dpi=MAP_DPI, clip=pymupdf.Rect(*box))
    return Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB')


def cut_icon(doc, pno, box):
    pix = doc[pno].get_pixmap(dpi=DPI, clip=pymupdf.Rect(*box))
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
    drop_background(im)
    drop_specks(im)

    bbox = im.getchannel('A').getbbox()
    if bbox:
        im = im.crop(bbox)

    # 等比缩到 ICON_H 高，四周留一点白
    pad = int(round(ICON_H * ICON_PAD))
    w = max(1, int(round(im.width * ICON_H / float(im.height))))
    im = im.resize((w, ICON_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (w + pad * 2, ICON_H + pad * 2), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad), im)
    return canvas


def build_map(doc):
    """渲染跨页地图并把两半拼起来。

    必须**渲染页面**而不是直接抽内嵌位图：地区名（KANTO / SINNOH / GALAR…）
    是 PDF 的文字层，画在位图上面，直接抽图会把字全丢掉。

    两页的底纸色调本来就略有差异（原书导出时就不一致），直接拼会留一条竖带，
    所以量出接缝两侧的底色中位数，把右半整体对齐到左半——几个色阶的偏移
    对地图配色看不出来，但接缝就没了。
    """
    left = render_region(doc, *MAP_L)
    right = render_region(doc, *MAP_R)

    def bg(im, strip):
        a = np.asarray(im.crop(strip), dtype=np.int16)
        return np.median(a.reshape(-1, 3), axis=0)

    w, h = left.size
    off = bg(left, (w - MAP_SEAM_STRIP, 0, w, h)) - bg(right, (0, 0, MAP_SEAM_STRIP, h))
    arr = np.asarray(right, dtype=np.int16) + off.astype(np.int16)
    right = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    canvas = Image.new('RGB', (left.width + right.width, left.height), (255, 255, 255))
    canvas.paste(left, (0, 0))
    canvas.paste(right, (left.width, 0))
    return canvas


def main():
    doc = pymupdf.open(PDF)
    os.makedirs(OUT_DIR, exist_ok=True)

    for name, pno, box, label in ICONS:
        im = cut_icon(doc, pno, box)
        path = os.path.join(OUT_DIR, name)
        im.save(path, 'WEBP', quality=92, method=6)
        print('%-20s %-8s %3dx%-3d %5d B' % (name, label, im.width, im.height,
                                             os.path.getsize(path)))

    m = build_map(doc)
    path = os.path.join(OUT_DIR, 'world-map.webp')
    m.save(path, 'WEBP', quality=86, method=6)
    print('%-20s %-8s %3dx%-3d %5d B' % ('world-map.webp', '世界地图',
                                         m.width, m.height, os.path.getsize(path)))


if __name__ == '__main__':
    main()
