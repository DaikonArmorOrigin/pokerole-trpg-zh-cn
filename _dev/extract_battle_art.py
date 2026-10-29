#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
extract_battle_art.py — 从《3.0战斗（52-93）》里抠插画、头像与图标

原书的插画和图标都是**矢量**的，纸纹才是位图。所以老办法照样管用：
先把整页的纸纹图换成 1×1 透明 PNG，再带 alpha 渲染，插画就自带透明底，
边缘保持矢量原样，不用泛洪去底。

英文说明文字也是矢量，会一起进画面 —— 所以 **clip 必须避开文字**，
只框住插画本身。坐标写死在下表里，换 PDF 要重新量（先渲染带网格的页面图）。

用法：
    python _dev/extract_battle_art.py
"""

import io
import os

import pymupdf
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img')
SRC = os.path.join(ROOT, '3.0战斗（52-93）.pdf')

# 页面尺寸 612 × 1008 pt，本册从原书 p.52 起
DPI = 220
ICON_DPI = 400

# 抠出来的插画（保持原比例，只裁掉透明边）
# (页码, clip(x0, y0, x1, y1), 输出名, 说明)
ART = [
    # p.71 「同一发热风，四种应对」：风速狗 + 热风
    # 只截灰面板里的一条，上边避开英文说明、下边避开四只宝可梦的图注
    (71, (26, 145, 586, 352), 'battle-heatwave', '热风 · 风速狗', False),
    # p.56 下方那张绿／红半场图：圆角、中线、中间的精灵球环、两只宝可梦剪影
    # 图注 "Your side / Foe's side" 在 y≈626，所以切到 623
    (56, (372.5, 511, 524.5, 623), 'battle-field', '对战场地 · 己方与敌方半场', 'grey'),
    # p.54 第二步左侧：皮卡丘冲向伊布。切到灰条以上，避开「Actions Used」
    (54, (28, 440, 225, 512), 'battle-duo', '皮卡丘与伊布对峙', True),
    # p.70 冲抵／闪避两张绿卡里的对决插图
    (70, (52, 517, 240, 612), 'mv-clash', '冲抵 · 皮卡丘放电对撞', 'green'),
    (70, (328, 504, 558, 602), 'mv-evade', '闪避 · 皮卡丘后跳', 'green'),
    # p.71 热风那张图里的四只宝可梦（各切在图注之上）
    (71, (40, 364, 158, 444), 'hw-zorua', '索罗亚', 'grey'),
    (71, (172, 414, 278, 491), 'hw-swablu', '青绵鸟', 'grey'),
    (71, (322, 409, 418, 490), 'hw-rockruff', '岩狗狗', 'grey'),
    (71, (482, 366, 578, 444), 'hw-sprigatito', '新叶喵', 'grey'),
    # p.60 / p.61 页脚：两张「示例插图」。切到 y=973 以下就带上了页码方块和灰边
    # 页码方块压在纸底上（纸已经透明），按 pt 给个矩形清掉即可
    (60, (0, 800, 612, 1000), 'battle-cyndaquil', '火球鼠对波克基斯', 'flood', (11, 948, 44, 1006)),
    (61, (0, 800, 612, 1000), 'battle-charizard', '喷火龙对水箭龟', 'flood', (572, 948, 604, 1006)),
]

# 头像：p.58 回合条带里那两个小脑袋。头压在彩色方块上沿，
# 所以**切到方块上沿为止**——底下那一条方块色正好被网页上的色块盖住。
HEADS = [
    (58, (51.0, 514.5, 80.5, 536.5), 'head-eevee', '伊布头像'),
    (58, (105.0, 514.0, 134.5, 536.0), 'head-pikachu', '皮卡丘头像'),
]

# 图标：原书标题下那枚小方块，统一归一化到 128×128、内容 112px
# (页码, clip, 输出名, 说明, 是否要把页底泛洪掉)
ICONS = [
    (77, (143, 139, 182, 190), 'mv-copy', '拷贝招式', True),
    (77, (429, 579, 471, 623), 'mv-hazard', '对入场宝可梦有效的招式', False),
    (78, (139, 139, 179, 180), 'mv-field', '力场护盾', False),
]


def blank_png():
    buf = io.BytesIO()
    Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(buf, 'PNG')
    return buf.getvalue()


def page_of(doc, page_no):
    """取页面，并把整页纸纹换成透明，让矢量图自带透明底。
    注意：同一个 doc 里一页只能换一次（换完再找「最大图」会找到那张 1×1），
    所以每次渲染都重开文档。"""
    page = doc[page_no - 52]
    best, best_area = None, 0
    for im in page.get_images(full=True):
        xref = im[0]
        try:
            info = doc.extract_image(xref)
        except Exception:
            continue
        area = info['width'] * info['height']
        if area > best_area:
            best_area, best = area, xref
    if best:
        page.replace_image(best, stream=blank_png())
    return page


def render(page_no, box, dpi):
    doc = pymupdf.open(SRC)
    page = page_of(doc, page_no)
    pix = page.get_pixmap(dpi=dpi, clip=pymupdf.Rect(*box), alpha=True)
    return Image.frombytes('RGBA', (pix.width, pix.height), pix.samples)


def key_out(img, thresh=18):
    """从四角泛洪，把和页面同色的那一片清成透明"""
    w, h = img.size
    work = img.convert('RGB')
    sentinel = (255, 0, 255)
    for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        try:
            ImageDraw.floodfill(work, c, sentinel, thresh=thresh)
        except Exception:
            pass
    src, dst = work.load(), img.load()
    for y in range(h):
        for x in range(w):
            if src[x, y] == sentinel:
                dst[x, y] = (0, 0, 0, 0)
    return img


def key_color(img, rgb, tol=26):
    """把某个颜色整片清成透明（不分连通块）。
    头像那种「灰色散在耳朵缝里」的情况，四角泛洪够不着，只能用这个。"""
    w, h = img.size
    px = img.load()
    tr, tg, tb = rgb
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and abs(r - tr) <= tol and abs(g - tg) <= tol and abs(b - tb) <= tol:
                px[x, y] = (0, 0, 0, 0)
    return img


def trim(img, pad=2):
    bb = img.getbbox()
    if not bb:
        return img
    x0, y0, x1, y1 = bb
    return img.crop((max(0, x0 - pad), max(0, y0 - pad),
                     min(img.width, x1 + pad), min(img.height, y1 + pad)))


def normalize(img, canvas=128, content=112):
    """和 assets/img 里其他图标一套规格：128 画布、内容长边 112"""
    img = trim(img, 0)
    scale = content / max(img.width, img.height)
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    img = img.resize((w, h), Image.LANCZOS)
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    out.paste(img, ((canvas - w) // 2, (canvas - h) // 2), img)
    return out


def save(img, name, note):
    path = os.path.join(OUT, name + '.webp')
    img.save(path, 'WEBP', quality=90, method=6)
    print('%-22s %-24s %4dx%-4d %4d KB' % (name + '.webp', note, img.width, img.height,
                                           os.path.getsize(path) // 1024))


def main():
    for job in ART:
        page_no, box, name, note, key = job[:5]
        erase = job[5] if len(job) > 5 else None
        img = render(page_no, box, DPI)
        if erase:
            # pt → 渲染像素
            k = DPI / 72.0
            x0 = int((erase[0] - box[0]) * k)
            y0 = int((erase[1] - box[1]) * k)
            x1 = int((erase[2] - box[0]) * k)
            y1 = int((erase[3] - box[1]) * k)
            px = img.load()
            # 页码压在什么底上就用旁边的像素填什么色：
            # p.60 是纸（已经透明），p.61 是灰色大楼
            fill = px[max(0, x0 - 3), max(0, y0 + 3)]
            for y in range(max(0, y0), min(img.height, y1)):
                for x in range(max(0, x0), min(img.width, x1)):
                    px[x, y] = fill
        if key == 'grey':
            img = key_color(img, (197, 197, 197), 20)
        elif key == 'green':
            img = key_color(img, (109, 196, 154), 26)
        elif key == 'flood':
            img = key_out(img, 26)
        elif key:
            img = key_out(img, 22)
        save(trim(img), name, note)

    for page_no, box, name, note in HEADS:
        img = key_color(render(page_no, box, ICON_DPI), (197, 197, 197), 26)
        save(trim(img, 1), name, note)

    for page_no, box, name, note, key in ICONS:
        img = render(page_no, box, ICON_DPI)
        if key:
            img = key_out(img)
        save(normalize(img), name, note)


if __name__ == '__main__':
    main()
