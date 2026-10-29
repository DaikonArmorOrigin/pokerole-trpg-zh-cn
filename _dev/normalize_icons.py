#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
normalize_icons.py — 把章节标记（ch-*）统一成同一套画布规格

问题：这套图标是分几批从不同 PDF 页面抠的，每批的「内容占画布比例」不一样——
章节标记球占到 88%，精灵球只占 66%。同样写 `height: 1.15em`，
看上去就差了三成，标题左侧的球一大一小。

做法：全部重采样成 128×128 画布、**内容居中且长边占 112px（87.5%）**。
网页那边再按这个比例定尺寸，标题 / 侧栏 / 面包屑 / 行内四处就一样大了。

精灵球（ball-*）不归这里管，见 `_dev/normalize_balls.py`——
那套要按「球身」而不是整图对齐，否则旧式球的旋钮、究极球的翼会把球身挤小。

用法：
    python _dev/normalize_icons.py
"""

import os
import pymupdf
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')

CANVAS = 128          # 画布边长
FILL = 0.875          # 内容长边占画布的比例
TARGET = int(CANVAS * FILL)

# 目录页上黑暗球的位置（pt），实测量出来的
DUSK_SRC = ('3.0介绍+世界观（1-19）.pdf', 5, pymupdf.Rect(27, 632.5, 57.5, 661.5))
DUSK_BG = [(109, 196, 154),    # 目录页章节色带的绿
           (231, 229, 218)]    # 裁切框万一溢出条带，露出来的纸色也一起清


def flood_cut(img, tol=30):
    """四角泛洪去底。原书的图标都画在纯色块上，泛洪够用。"""
    sentinel = (255, 0, 255)
    work = img.convert('RGB')
    w, h = work.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(work, corner, sentinel, thresh=tol)
        except Exception:
            pass
    src, dst = work.load(), img.load()
    for y in range(h):
        for x in range(w):
            if src[x, y] == sentinel:
                dst[x, y] = (0, 0, 0, 0)
    return img


def cut_by_color(img, bgs, tol=48):
    """按颜色去底，只清掉「与图像边缘连通」的那部分。

    比四角泛洪可靠：裁切框的四角可能落在两种背景上（纸色 + 色带绿），
    泛洪从角上出发只能吃掉其中一种，剩下的会留在图里。
    这里先把「接近 bg_rgb」的像素全找出来，再用逐轮膨胀筛出与边缘连通的部分。
    """
    a = np.array(img).astype(int)
    bg = np.zeros(a.shape[:2], dtype=bool)
    for c in bgs:
        bg |= np.abs(a[:, :, :3] - np.array(c)).max(axis=2) < tol

    seed = np.zeros_like(bg)
    seed[0, :] = bg[0, :]
    seed[-1, :] = bg[-1, :]
    seed[:, 0] = bg[:, 0]
    seed[:, -1] = bg[:, -1]

    def dilate(m):
        out = m.copy()
        out[1:, :] |= m[:-1, :]
        out[:-1, :] |= m[1:, :]
        out[:, 1:] |= m[:, :-1]
        out[:, :-1] |= m[:, 1:]
        return out

    while True:
        grown = dilate(seed) & bg
        if grown.sum() == seed.sum():
            break
        seed = grown

    a[:, :, 3] = np.where(seed, 0, a[:, :, 3])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def fit_canvas(im):
    """裁到内容边界，等比缩放到 TARGET，居中贴到 CANVAS×CANVAS。"""
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = TARGET / max(w, h)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2))
    return out


def rebuild_dusk():
    """从目录页重抠黑暗球（旧的镜像补全把圆补成了椭圆）。"""
    name, page_no, clip = DUSK_SRC
    doc = pymupdf.open(os.path.join(ROOT, name))
    pix = doc[page_no].get_pixmap(dpi=600, clip=clip)
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('RGBA')
    im = cut_by_color(im, DUSK_BG)
    im = fit_canvas(im)
    path = os.path.join(IMG, 'ball-dusk.webp')
    im.save(path, 'WEBP', quality=92, method=6)
    print('ball-dusk     重抠  %d B' % os.path.getsize(path))


def normalize(name):
    path = os.path.join(IMG, name + '.webp')
    im = Image.open(path).convert('RGBA')
    im = fit_canvas(im)
    im.save(path, 'WEBP', quality=92, method=6)
    return os.path.getsize(path)


if __name__ == '__main__':
    rebuild_dusk()

    # 只管章节标记（ch-*）。精灵球走 _dev/normalize_balls.py，
    # 那边是按「球身」归一化的，这里再跑一遍会把球身尺寸冲掉。
    names = sorted(
        os.path.splitext(f)[0]
        for f in os.listdir(IMG)
        if f.endswith('.webp') and f.startswith('ch-')
    )
    total = 0
    for n in names:
        if n == 'ball-dusk':
            continue          # 上面已经重做过
        size = normalize(n)
        total += size
        print('%-14s %5d B' % (n, size))
    print('其余 %d 个，合计 %.1f KB' % (len(names) - 1, total / 1024.0))
