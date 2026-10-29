#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_system_art.py —— 从原书 PDF 抠「组件级」美术素材

产出（全部 128×128 透明 webp，放进 assets/img/）：
    die-1 … die-6      六面骰骰面（《3.0系统详解》p.34「Rolling the Dice」）
                       原书是菱形旋转的橄榄灰骰子 + 白点，用来做骰池组件
    league-mark        宝可梦联盟徽标（《3.0介绍+世界观》p.15）
                       一个精灵球 + 图钉组成的「P」，原书是浅灰线稿压深灰底，
                       这里按亮度抠成「白色线条 + 透明底」，方便用 CSS 换色

为什么要单独抠这两样：
    骰子 / 联盟徽标在原书里是**矢量线稿**，直接当整图裁下来会带着深色底，
    放进纸色页面就是一块黑砖。骰子用「换背景图为 1×1 透明」拿纯 alpha；
    徽标是白线压深灰，只能按亮度做键控（luma key）。

用法：
    python _dev/extract_system_art.py
需要：pymupdf、Pillow（在 ~/.workbuddy-ai/binaries/python/envs/default 里）
"""

import io
import os

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "img")

SYS_PDF = os.path.join(ROOT, "3.0系统详解（22-37）.pdf")
WORLD_PDF = os.path.join(ROOT, "3.0介绍+世界观（1-19）.pdf")
CHAR_PDF = os.path.join(ROOT, "3.0创建角色（40-50）.pdf")

CANVAS = 128
CONTENT = 112          # 与 ch-* 一致：整图长边 112px


def save_webp(img, name, canvas=CANVAS, content=CONTENT):
    """把任意尺寸的 RGBA 图缩放到统一画布，长边对齐 content 像素。"""
    bbox = img.split()[-1].getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    scale = content / max(w, h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(img, ((canvas - img.width) // 2, (canvas - img.height) // 2), img)
    path = os.path.join(OUT, name + ".webp")
    out.save(path, "WEBP", quality=92, method=6)
    print(f"  {name}.webp  {out.width}×{out.height}  {os.path.getsize(path)}B")


# ---------------------------------------------------------------- 骰子

DICE_X = [93.2, 116.1, 139.2, 162.5, 185.7, 208.4]   # p.34 六个骰子的左上角 x
DICE_Y0, DICE_SIDE = 162.9, 22.2


def extract_dice():
    doc = pymupdf.open(SYS_PDF)
    page = doc[13]

    # 页面背景是一整张纸纹位图，换成 1×1 全透明 PNG，
    # 剩下的矢量骰子直接带 alpha 渲染出来，边缘干净。
    bg = [im for im in page.get_images(full=True)][0][0]
    px = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 1, 1), 0)
    px.set_rect(px.irect, (255, 255, 255, 0))
    page.replace_image(bg, stream=px.tobytes("png"))

    for i, x in enumerate(DICE_X, 1):
        clip = pymupdf.Rect(x - 0.6, DICE_Y0 - 0.6,
                            x + DICE_SIDE + 0.6, DICE_Y0 + DICE_SIDE + 0.6)
        pix = page.get_pixmap(dpi=900, clip=clip, alpha=True)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")
        save_webp(img, f"die-{i}")


# ---------------------------------------------------------------- 联盟徽标

MARK_CLIP = pymupdf.Rect(14, 24, 126, 136)


def extract_league_mark():
    doc = pymupdf.open(WORLD_PDF)
    page = doc[15]
    pix = page.get_pixmap(dpi=800, clip=MARK_CLIP)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

    # 亮度键控：底色实测 luma≈67，线稿 luma≈202（400dpi 下量出来的，
    # 不是拍脑袋的 #4d4d4f —— 那层深灰上还压了一道叠色）。
    # alpha 按「底色 → 线色」线性映射，线稿顶端正好吃满 255，
    # 再把低值截掉，避免底色噪点留下半透明的脏边。
    px = img.load()
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    op = out.load()
    bg_luma, line_luma = 67.0, 202.0
    span = line_luma - bg_luma
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            a = (luma - bg_luma) / span
            a = 0.0 if a < 0.08 else min(1.0, a)
            op[x, y] = (255, 255, 255, int(a * 255))
    save_webp(out, "league-mark", content=112)


# ---------------------------------------------------------------- 最初的伙伴

STARTER_CLIP = pymupdf.Rect(432, 520, 477, 565)


def extract_starter_mark():
    """《3.0创建角色》p.50 的「最初的伙伴」标记。

    它是一枚**实心剪影球**（深灰圆盘 + 一道白缝 + 白色圆环），
    不是彩色精灵球，也不是 ball-starter 那种线稿。
    页面背景是纸纹位图，这里改用亮度键控：纸色透明、深灰保留。
    """
    doc = pymupdf.open(CHAR_PDF)
    page = doc[3]
    pix = page.get_pixmap(dpi=900, clip=STARTER_CLIP)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

    paper_luma, ink_luma = 232.0, 66.0
    out = Image.new("RGBA", img.size, (65, 64, 66, 0))
    ip, op = img.load(), out.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = ip[x, y]
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            a = (paper_luma - luma) / (paper_luma - ink_luma)
            a = 0.0 if a < 0.12 else min(1.0, a)
            op[x, y] = (65, 64, 66, int(a * 255))

    save_webp(out, "icon-starter")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("骰面：")
    extract_dice()
    print("联盟徽标：")
    extract_league_mark()
    print("最初的伙伴标记：")
    extract_starter_mark()
    print("完成。")
