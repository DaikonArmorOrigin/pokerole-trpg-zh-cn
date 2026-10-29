#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
normalize_balls.py — 按「球身」而不是「整图」统一精灵球图标

之前按整图外接框归一化，结果旧式精灵球（顶上带旋钮）、究极球（两侧有翼）
的球身被挤小了一圈，摆在同一列里一眼就能看出来。

这里改成：先用腐蚀法量出每个图标里**最大的实心圆**（就是球身），
再把所有球身的直径统一到 BODY 像素，球心对齐画布中心。
装饰超出球身的部分（翼、旋钮）就让它自然伸出去，不参与尺寸计算。

用法：
    python _dev/normalize_balls.py            # 处理 _dev/tmp/balls 下 52poke 的图
    python _dev/normalize_balls.py --pdf      # 顺便把 PDF 抠的那几个也校一遍
"""

import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets', 'img')
TMP = os.path.join(ROOT, '_dev', 'tmp', 'balls')

CANVAS = 128
BODY = 104          # 球身直径，占画布 81%（原书那批实测 105~110，取中位）

# 52poke 的 slug → 本站文件名（个别改过名）
RENAME = {
    'beast': 'ub',      # 究极球，本作一直叫 UB 球
}


def inscribed_circle(im):
    """腐蚀法求内切圆：球身是实心圆，翼/旋钮这类细长装饰会先被腐蚀掉。"""
    a = np.array(im.convert('RGBA'))
    mask = a[:, :, 3] > 128
    r = 0
    cx = cy = 0
    while True:
        idx = np.nonzero(mask)
        if len(idx[0]) == 0:
            break
        cy = int(idx[0].mean())
        cx = int(idx[1].mean())
        m = mask.copy()
        m[1:, :] &= mask[:-1, :]
        m[:-1, :] &= mask[1:, :]
        m[:, 1:] &= mask[:, :-1]
        m[:, :-1] &= mask[:, 1:]
        if m.sum() == 0:
            break
        mask = m
        r += 1
    return cx, cy, r


def normalize(im, body=BODY, canvas=CANVAS):
    cx, cy, r = inscribed_circle(im)
    if r <= 0:
        return im.resize((canvas, canvas), Image.LANCZOS)
    scale = body / (2.0 * r)
    w, h = im.size
    big = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    ncx, ncy = cx * scale, cy * scale
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    out.paste(big, (round(canvas / 2 - ncx), round(canvas / 2 - ncy)), big)
    return out


def run_52poke():
    if not os.path.isdir(TMP):
        print('没有 _dev/tmp/balls，先跑 fetch_balls_52poke.py')
        return
    for f in sorted(os.listdir(TMP)):
        if not f.endswith('.png'):
            continue
        slug = os.path.splitext(f)[0]
        name = 'ball-' + RENAME.get(slug, slug)
        im = Image.open(os.path.join(TMP, f))
        out = normalize(im)
        dst = os.path.join(IMG, name + '.webp')
        out.save(dst, 'WEBP', quality=92, method=6)
        print('%-16s %5d B' % (name, os.path.getsize(dst)))


def run_pdf():
    """PDF 抠的那几个（52poke 没有的球 + 章节标记），从现有 128 图重新校一遍。"""
    # 只校 52poke 没有的那两个球；章节标记（ch-*）不是标准球，不参与
    names = ['ball-old', 'ball-dynamax']
    for n in names:
        p = os.path.join(IMG, n + '.webp')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        out = normalize(im)
        out.save(p, 'WEBP', quality=92, method=6)
        print('%-16s %5d B  (重新校正)' % (n, os.path.getsize(p)))


if __name__ == '__main__':
    run_52poke()
    if '--pdf' in sys.argv:
        run_pdf()
