#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_ball_icons_items.py —— 从《3.0携带物品和道具（116-129）.pdf》p.122 抠精灵球

【为什么不用圆蒙版】
  早期版本用正圆蒙版去底，那套是给「捕捉」那册的球用的（球摆在彩色表格里）。
  这一册的球画在浅灰行底上，圆蒙版会把旧式球顶上的旋钮切掉、圆心还会对不准。
  现在统一用【透明底渲染 + 四边泛洪 + alpha 包围盒裁切】。

【三个坑】
  1. 泛洪要能「穿过透明像素」，否则边缘本来透明的图根本起不了泛洪；
  2. 上一行的粉色表头会被裁进来，按「整行 80% 同一颜色」判定为残留色条清掉；
  3. 旧式球顶上有旋钮，top 要给到 8.5pt，其余 2.0pt 就够。

【黑暗球是源文件画坏的】
  p.122 上那枚黑暗球右边缘是一条**直线**，球被裁掉一块（不是抠图问题，PDF 里就是这样）。
  只能镜像左半边补回来——球体本身左右对称，补完看不出痕迹。

【统一尺寸】
  各球按 bbox 各自缩放到 128 会让大的显小、小的显大。
  改成**按宽度归一到 104px**（所有球体在书上都是 21.2pt，宽度一致），
  再居中放进 128×128 画布，视觉大小就齐了。

【用法】python _dev/extract_ball_icons_items.py
"""

import io
import os
from collections import Counter, deque

import numpy as np
import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0携带物品和道具（116-129）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')
PAGE = 6              # p.122「Customized Pokéballs」
DPI = 700
BALL_W = 104          # 球体归一化后的宽度
CANVAS = 128

# (输出名, 列, y, 顶部额外留白)
# 列 'L' = 左表（普通球，x≈22），'R' = 右表（定制球，x≈317）
BALLS = [
    ('ball-poke',   'L', 496, 2.0),
    ('ball-great',  'L', 568, 2.0),
    ('ball-ultra',  'L', 640, 2.0),
    ('ball-dusk',   'R', 213, 2.0),
    ('ball-fast',   'R', 287, 2.0),
    ('ball-heavy',  'R', 359, 2.0),
    ('ball-luxury', 'R', 431, 2.0),
    ('ball-quick',  'R', 503, 2.0),
    ('ball-old',    'R', 574, 8.5),   # 顶上有旋钮
    ('ball-master', 'R', 641, 2.0),
]
COL_X = {'L': 22, 'R': 317}

# 源文件右边缘被切平的球，需要镜像左半边补全
MIRROR_FIX = {'ball-dusk'}


def transparent_png():
    buf = io.BytesIO()
    Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(buf, 'PNG')
    return buf.getvalue()


def flood_background(im, tol=24):
    w, h = im.size
    px = im.load()
    border = []
    for x in range(w):
        border += [px[x, 0], px[x, h - 1]]
    for y in range(h):
        border += [px[0, y], px[w - 1, y]]
    opaque = [c[:3] for c in border if c[3] > 200]
    if not opaque:
        return im
    panel = Counter(opaque).most_common(1)[0][0]

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y * w + x]:
                seen[y * w + x] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        if a <= 40:
            pass
        elif (abs(r - panel[0]) <= tol and abs(g - panel[1]) <= tol
              and abs(b - panel[2]) <= tol):
            px[x, y] = (0, 0, 0, 0)
        else:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                seen[ny * w + nx] = 1
                q.append((nx, ny))
    return im


def strip_bars(im):
    w, h = im.size
    px = im.load()
    for y in list(range(0, 30)) + list(range(h - 30, h)):
        if not (0 <= y < h):
            continue
        cols = [px[x, y][:3] for x in range(w) if px[x, y][3] > 200]
        if not cols:
            continue
        color, cnt = Counter(cols).most_common(1)[0]
        # 只认「有彩色或偏暗」的整行色条。球的白色下腹也占满整行，
        # 但那不是色条，误删会把球压扁。
        if max(color) - min(color) < 25 and min(color) > 200:
            continue
        if cnt > 0.8 * w:
            for x in range(w):
                px[x, y] = (0, 0, 0, 0)
    return im


def mirror_repair(im):
    """球体右半边被裁掉时，以圆心为轴把左半边镜像过去。"""
    a = np.array(im)
    al = a[:, :, 3]
    cols = (al > 60).sum(axis=0)
    rows = (al > 60).sum(axis=1)
    nz = np.nonzero(cols)[0]
    nr = np.nonzero(rows)[0]
    if len(nz) == 0 or len(nr) == 0:
        return im

    diameter = nr.max() - nr.min() + 1     # 圆的高度就是直径
    left = nz.min()
    cx = left + diameter / 2.0
    want_right = int(round(left + diameter - 1))
    if want_right <= nz.max() + 2:          # 本来就是个圆，不用补
        return im

    w, h = im.size
    out = np.zeros((h, want_right + 1, 4), dtype=np.uint8)
    out[:, :min(w, want_right + 1)] = a[:, :min(w, want_right + 1)]
    for x in range(int(cx) + 1, want_right + 1):
        sx = int(round(2 * cx - x))
        if 0 <= sx < w:
            out[:, x] = a[:, sx]
    return Image.fromarray(out, 'RGBA')


def keep_largest(im):
    """只保留最大的连通块——裁切框边缘常带进表格竖线、字母碎片。"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    best = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or px[x0, y0][3] <= 60:
                continue
            comp = []
            q = deque([(x0, y0)])
            seen[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]
                            and px[nx, ny][3] > 60):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    keep = bytearray(w * h)
    for x, y in best:
        keep[y * w + x] = 1
    for y in range(h):
        for x in range(w):
            if not keep[y * w + x]:
                px[x, y] = (0, 0, 0, 0)
    return im


def main():
    doc = pymupdf.open(PDF)
    page = doc[PAGE]
    for im in page.get_images(full=True):
        if doc.extract_image(im[0])['width'] > 1000:
            page.replace_image(im[0], stream=transparent_png())
            break

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    for name, col, y, top in BALLS:
        x = COL_X[col]
        # 所有球体在书上都是 21.2pt，圆心在 (x+10.6, y+10.6)。
        # 用**同一个 32×32pt 的裁切框**套住圆心，输出再统一缩放——
        # 这样球体像素大小完全一致。之前按外接框归一，
        # 大师球两侧有凸起、旧式球顶上有旋钮，外框更大，球体就被缩小了。
        cx, cy = x + 10.6, y + 10.6
        clip = pymupdf.Rect(cx - 16, cy - 16, cx + 16, cy + 16)
        pix = page.get_pixmap(dpi=DPI, clip=clip, alpha=True)
        im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')

        im = strip_bars(flood_background(flood_background(im)))
        im = keep_largest(im)
        if name in MIRROR_FIX:
            im = mirror_repair(im)

        path = os.path.join(OUT_DIR, name + '.webp')
        im.resize((CANVAS, CANVAS), Image.LANCZOS).save(path, 'WEBP', quality=92, method=6)

        size = os.path.getsize(path)
        total += size
        print('%-14s %5d B' % (name, size))
    print('合计 %.1f KB' % (total / 1024.0))


if __name__ == '__main__':
    main()
