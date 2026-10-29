#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
extract_scene_art.py — 从原书 PDF 页脚提取「场景插画」条幅

原书几乎每页底部都压着一条横向场景插画（小镇、树林、水塘……），
是全书最显眼的装饰元素。这里把它抠出来，去底成透明 webp，
供网页做章节结尾装饰。

用法：
    python _dev/extract_scene_art.py

坐标按「页面高度百分比」给，换 PDF 只改 PAGES 表即可。

三步：
  1. 按 top_frac 裁出页面底部一条 —— 这个比例是逐页量的，取「正文最后
     一行」与「插画顶边」之间的空隙；切早了会把正文抠进来，切晚了削屋顶。
  2. 四角泛洪去底（原书纸底是均匀米色，阈值 26 够吃掉纸纹）。
  3. 抹掉页脚角上的页码方块 —— 那是印刷页码（40 / 41 / 26），
     放到网页上就成了穿帮，按已知的橙色/青色实心方块找出来清成透明。
"""

import os
import pymupdf
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img')

# (源 PDF, 页码 0 基, 裁切起点占页高比例, 输出文件名, 页码方块位置 left/right)
PAGES = [
    ('3.0创建角色（40-50）.pdf', 0, 0.752, 'scene-town',   'left'),   # 大木研究所 · 小镇街景
    ('3.0创建角色（40-50）.pdf', 1, 0.755, 'scene-forest', 'right'),  # 双大树 + 皮卡丘
    ('3.0介绍+世界观（1-19）.pdf', 10, 0.715, 'scene-autumn', 'right'),  # 秋日林道
    ('3.0介绍+世界观（1-19）.pdf', 13, 0.713, 'scene-market', 'left'),  # 友好商店 · 宝可梦中心
]

DPI = 220
FLOOD_TOL = 26


def erase_page_number(img, corner):
    """页码方块是实心色块（橙 / 青 / 红，各册不同）＋白字，永远贴在页脚左下或
       右下角。找到包围盒后**按行做左右邻居插值**填掉，而不是清成透明——
       有的页码压在建筑底座上，直接抠透明会留下一个白洞。"""
    if not corner:
        return img
    w, h = img.size
    px = img.load()
    band_y0 = int(h * 0.80)
    xs = range(0, int(w * 0.16)) if corner == 'left' else range(int(w * 0.84), w)

    def is_badge(c):
        r, g, b, a = c
        if a < 200:
            return False
        return ((abs(r - 240) < 45 and abs(g - 160) < 55 and abs(b - 60) < 55) or
                (abs(r - 40) < 40 and abs(g - 153) < 40 and abs(b - 193) < 40) or
                (abs(r - 214) < 40 and abs(g - 58) < 45 and abs(b - 47) < 45))

    hits = [(x, y) for y in range(band_y0, h) for x in xs if is_badge(px[x, y])]
    if len(hits) < 400:
        return img

    x0 = max(0, min(p[0] for p in hits) - 4)
    x1 = min(w - 1, max(p[0] for p in hits) + 4)
    y0 = max(0, min(p[1] for p in hits) - 4)
    y1 = min(h - 1, max(p[1] for p in hits) + 4)

    for y in range(y0, y1 + 1):
        left = px[max(0, x0 - 1), y]
        right = px[min(w - 1, x1 + 1), y]
        span = x1 - x0 + 1
        for i, x in enumerate(range(x0, x1 + 1)):
            t = (i + 1) / (span + 1)
            px[x, y] = tuple(int(left[k] * (1 - t) + right[k] * t) for k in range(4))
    return img


def cut(path, page_no, top_frac, name, corner):
    doc = pymupdf.open(os.path.join(ROOT, path))
    page = doc[page_no]
    r = page.rect
    clip = pymupdf.Rect(0, r.height * top_frac, r.width, r.height)
    pix = page.get_pixmap(dpi=DPI, clip=clip)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples).convert('RGBA')

    # 四角泛洪：把与页面纸底连通的那一片标成透明
    sentinel = (255, 0, 255)
    work = img.convert('RGB')
    w, h = work.size
    for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(work, c, sentinel, thresh=FLOOD_TOL)
        except Exception:
            pass

    src = work.load()
    dst = img.load()
    for y in range(h):
        for x in range(w):
            if src[x, y] == sentinel:
                dst[x, y] = (0, 0, 0, 0)

    img = erase_page_number(img, corner)

    bbox = img.getbbox()
    if bbox:
        img = img.crop((0, max(0, bbox[1] - 4), w, min(h, bbox[3] + 4)))

    path_out = os.path.join(OUT, name + '.webp')
    img.save(path_out, 'WEBP', quality=88, method=6)
    print(f'{name}.webp  {img.width}x{img.height}  {os.path.getsize(path_out)//1024} KB')


if __name__ == '__main__':
    for p in PAGES:
        cut(*p)
