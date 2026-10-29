#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_item_icons.py —— 从《3.0携带物品和道具（116-129）.pdf》抠道具小图标

【为什么上一版全错】
  上一版拿「名字 bbox 左边固定 50pt 的窗口」硬裁，然后四边泛洪去底。三个致命伤：
    1. 窗口高度按名字 bbox 走，可图标比名字高（喷雾瓶会顶出上下各 5pt），
       裁出来的图被切头去脚，或者把上一行/下一行带进来。
    2. 泛洪只吃「边框上最多的颜色」，遇到浅灰行底 + 粉色表头就吃不干净，
       于是留下一堆灰竖条、粉方块。
    3. 表格竖线、相邻字母也算「内容」，最大连通块经常选到那根竖线。

【这一版怎么做的】
  1. 先把整页背景位图换成 1×1 透明 PNG —— 纸纹、行底色、表头色一起消失，
     只剩矢量图和文字层。这是交接-02 里记的核心技巧，道具册同样适用。
  2. 图标是**矢量路径**，用 get_drawings() 取叶子级矩形（<45pt）再按 1.8pt 间隙聚类。
     少数几枚（如叶之石）在源文件里是 41×49 的小位图，用 get_image_info() 兜住。
  3. 锚点不再靠固定窗口：以「每行第一个 ≥14pt 的 BlissfulThinking span」为道具名，
     向左找「右边缘离名字左边缘 ≤14pt」的簇 —— 那个簇就是图标。
     字体是天然的判别器：道具名用 BlissfulThinking，章节小标题用 TrebuchetMS-Bold，
     靠它就能把「Revive 章节标题 / Revive 道具」这类同名冲突分开。
  4. 只渲染簇 bbox 外扩 1pt 的范围，alpha=True。**但 alpha 不够**：
     p0 的「新手必备」是粉色矢量色块，p10 的 TM 表头也是，色块会跟着进画面。
     所以再补一道「从四边泛洪吃底色」——现在底是纯色，比上一版吃纸纹稳得多。

【输出】assets/img/item-<slug>.webp，96×96 画布，内容归一化到 84px
【用法】python _dev/extract_item_icons.py [--montage]
"""

import io
import os
import re
import sys
from collections import Counter, deque

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, '3.0携带物品和道具（116-129）.pdf')
OUT_DIR = os.path.join(ROOT, 'assets', 'img')
TMP = os.environ.get('TEMP', '/tmp')

DPI = 600
CANVAS = 96          # 输出画布
CONTENT = 84         # 内容最大边
PAD = 1.0            # 渲染时簇外边距（pt）—— 留够泛洪的起步空间
GAP_MAX = 14         # 图标右边缘到名字左边缘的最大间距（pt）
MIN_SIDE = 5         # 簇最小边（pt）—— 防狼喷雾是 7pt 宽的细长罐
MAX_SIDE = 46

# 道具名专用字体。章节小标题是 TrebuchetMS-Bold，靠这个就能区分同名冲突
NAME_FONT = 'BlissfulThinking'

# 精灵球已经有 ball-* 一套（见 extract_ball_icons_items.py），这里不重复抠
SKIP = {
    'Pokéball', 'Greatball', 'Ultraball', 'Dusk Ball', 'Fast Ball',
    'Heavy Ball', 'Luxury Ball', 'Quick Ball', 'Old Pokéball', 'Master Ball',
}

# 名字被拆成两个 span 的个别项
ALIAS = {'Leaf': 'Leaf Stone'}

# 表头 / 单元格里的大字号杂项
STOP = {
    'Item', 'Price', 'Effect', 'Size', 'Rarity', 'Seal Potency', 'Seal',
    'Potency', 'Catch', 'Name', 'Power', 'Move’s', 'Held Item',
}


def slugify(name):
    s = name.lower()
    s = s.replace('é', 'e').replace('’', '').replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s


def merge(rects, gap=1.8):
    """把相互靠近（间隙 < gap）的矩形并成一个簇。"""
    out = [pymupdf.Rect(r) for r in rects]
    changed = True
    while changed:
        changed = False
        for i in range(len(out)):
            for j in range(i + 1, len(out)):
                a, b = out[i], out[j]
                if not (a.x1 < b.x0 - gap or a.x0 > b.x1 + gap
                        or a.y1 < b.y0 - gap or a.y0 > b.y1 + gap):
                    out[i] = a | b
                    out.pop(j)
                    changed = True
                    break
            if changed:
                break
    return out


def candidate_names(page):
    """每行第一个 ≥14pt 的 BlissfulThinking span —— 道具名永远在一行开头。"""
    out = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0:
            continue
        for line in b['lines']:
            for s in line['spans']:
                t = s['text'].strip()
                if not t or s['size'] < 14:
                    continue
                if s['font'].split('+')[-1] != NAME_FONT:
                    break             # 章节小标题/正文，不是道具行
                out.append((ALIAS.get(t, t), s['bbox']))
                break                 # 一行只看第一个
    return out


def pick_icon(name, bbox, leaves, small_imgs):
    """在名字左侧找图标；返回 (rect, 来源)。找不到返回 (None, None)。"""
    x0, y0, x1, y1 = bbox
    win = pymupdf.Rect(x0 - 55, y0 - 12, x0 - 1, y1 + 12)

    # 1) 源文件里本来就是位图的那几枚
    for rect in small_imgs:
        if (rect.x1 <= x0 and rect.x0 >= win.x0
                and rect.y0 >= win.y0 and rect.y1 <= win.y1
                and rect.x1 >= x0 - GAP_MAX):
            return pymupdf.Rect(rect), 'raster'

    # 2) 矢量簇
    sel = [r for r in leaves
           if r.x0 >= win.x0 and r.x1 <= win.x1
           and r.y0 >= win.y0 and r.y1 <= win.y1]
    cands = []
    for m in merge(sel):
        if m.width < MIN_SIDE or m.height < MIN_SIDE:
            continue
        if m.width > MAX_SIDE or m.height > MAX_SIDE:
            continue
        if x0 - m.x1 > GAP_MAX or x0 - m.x1 < -2:
            continue
        # 图标应当和名字大致同一行：中心偏差别超过一个行高
        if abs((m.y0 + m.y1) / 2 - (y0 + y1) / 2) > 14:
            continue
        cands.append(m)
    if not cands:
        return None, None
    return max(cands, key=lambda r: r.get_area()), 'vector'


def flood_backdrop(im, tol=16):
    """从四边泛洪，把底板色吃掉。

    背景位图已经换成透明了，但**矢量色块**还在：p0 的粉色「新手必备」框、
    p10 的表头条、每张表的浅灰行底，都是矢量矩形，会跟着进画面。

    底色不能只取一个：行底是 219 灰，行与行之间的缝是 240 灰，四个角经常落在
    浅的那层，只吃一种就会留下一整块灰底。所以把边框上**所有占比够大**的颜色
    都当候选，逐个泛洪；按占比从大到小排，先吃大块的。

    安全阀：万一某个候选其实是图标自身的颜色（图标顶到裁剪框边缘了），
    那一次泛洪会把图标也吃掉 —— 所以每吃一种都量一下剩余不透明比例，
    低于 10% 就判为误吃，退回上一版。
    """
    w, h = im.size
    total = w * h

    # 边框取样：外圈 2px
    border = []
    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            border.append(im.getpixel((x, y)))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            border.append(im.getpixel((x, y)))

    counts = Counter(c[:3] for c in border if c[3] > 200)
    if not counts:
        return im

    panels = []
    for color, n in counts.most_common():
        if n < len(border) * 0.02:          # 边框上零星出现的，多半是图标
            break
        if any(all(abs(color[i] - p[i]) <= tol for i in range(3)) for p in panels):
            continue
        panels.append(color)

    base = im
    for panel in panels:
        trial = base.copy()
        px = trial.load()
        for _ in range(2):
            seen = bytearray(w * h)
            q = deque()
            for x in range(w):
                for y in (0, h - 1):
                    q.append((x, y))
                    seen[y * w + x] = 1
            for y in range(h):
                for x in (0, w - 1):
                    if not seen[y * w + x]:
                        seen[y * w + x] = 1
                        q.append((x, y))
            while q:
                x, y = q.popleft()
                r, g, b, a = px[x, y]
                if a > 40:
                    if (abs(r - panel[0]) > tol or abs(g - panel[1]) > tol
                            or abs(b - panel[2]) > tol):
                        continue
                    px[x, y] = (0, 0, 0, 0)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
        alpha = trial.split()[3]
        opaque = sum(alpha.histogram()[41:])
        if opaque > total * 0.10:
            base = trial
    return base


def render(page, rect):
    clip = pymupdf.Rect(rect.x0 - PAD, rect.y0 - PAD, rect.x1 + PAD, rect.y1 + PAD)
    pix = page.get_pixmap(dpi=DPI, clip=clip, alpha=True)
    im = Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
    return flood_backdrop(im)


def drop_specks(im, min_px=40):
    """抹掉孤立小碎点（表格线残留、抗锯齿孤点），保留所有成形的块。"""
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or px[x0, y0][3] <= 40:
                continue
            comp, q = [], deque([(x0, y0)])
            seen[y0 * w + x0] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1),
                               (1, 1), (1, -1), (-1, 1), (-1, -1)):
                    nx, ny = x + dx, y + dy
                    if (0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]
                            and px[nx, ny][3] > 40):
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(comp)
    if not comps:
        return None
    keep = max(len(c) for c in comps)
    for comp in comps:
        # 比主块小 1/200 且不足 min_px 的，一律当碎点
        if len(comp) < min_px and len(comp) < keep / 200:
            for x, y in comp:
                px[x, y] = (0, 0, 0, 0)
    return im.split()[3].getbbox()


def normalize(im, box):
    im = im.crop(box)
    w, h = im.size
    scale = CONTENT / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    im = im.resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - nw) // 2, (CANVAS - nh) // 2))
    return out


def main():
    doc = pymupdf.open(PDF)

    blank = io.BytesIO()
    Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save(blank, 'PNG')
    transparent = blank.getvalue()

    made, missed, seen = [], [], {}

    for pno in range(doc.page_count):
        page = doc[pno]

        # 整页纸纹位图 → 透明（只换大图，别动图标那种小图）
        small_imgs = []
        for info in page.get_image_info(xrefs=True):
            r = pymupdf.Rect(info['bbox'])
            if r.width > 300:
                page.replace_image(info['xref'], stream=transparent)
            elif r.width < 80 and r.height < 80:
                small_imgs.append(r)

        leaves = [d['rect'] for d in page.get_drawings()
                  if 0.4 < d['rect'].width < MAX_SIDE
                  and 0.4 < d['rect'].height < MAX_SIDE]

        for name, bbox in candidate_names(page):
            if name in STOP or name in SKIP:
                continue
            if re.fullmatch(r'[\d,.]+( Units| dice\*?| or more)?|\d+ - \d+', name):
                continue
            if len(name) < 3:
                continue
            slug = slugify(name)
            if not slug or slug in seen:      # 同一道具在不同页重复出现时取第一次
                continue

            rect, kind = pick_icon(name, bbox, leaves, small_imgs)
            if rect is None:
                missed.append((pno, name))
                continue

            im = render(page, rect)
            box = drop_specks(im)
            if box is None:
                missed.append((pno, name))
                continue
            icon = normalize(im, box)

            # 太扁/太窄的簇基本是表格残片
            w, h = box[2] - box[0], box[3] - box[1]
            if w < 30 or h < 30:
                missed.append((pno, name))
                continue

            seen[slug] = True
            path = os.path.join(OUT_DIR, 'item-%s.webp' % slug)
            icon.save(path, 'WEBP', quality=92)
            made.append((slug, name, pno, kind, rect))

    print('导出 %d 个，未识别 %d 个' % (len(made), len(missed)))
    for slug, name, pno, kind, rect in made:
        print('  ✓ item-%-26s p%-2d %-30s %4.1fx%-4.1f %s'
              % (slug + '.webp', pno, name[:30], rect.width, rect.height, kind))
    print('--- 未识别（多半是章节小标题、价格、单位）---')
    for pno, name in missed:
        print('  · p%d %s' % (pno, name))

    if '--montage' in sys.argv:
        cols, cell = 8, 108
        rows = (len(made) + cols - 1) // cols
        sheet = Image.new('RGBA', (cols * cell, rows * cell), (248, 248, 248, 255))
        from PIL import ImageDraw
        d = ImageDraw.Draw(sheet)
        for i, (slug, name, *_rest) in enumerate(made):
            im = Image.open(os.path.join(OUT_DIR, 'item-%s.webp' % slug))
            x, y = (i % cols) * cell + 6, (i // cols) * cell + 6
            sheet.paste(im, (x, y), im)
            d.text((x, y + 96), slug[:16], fill=(20, 20, 20, 255))
        path = os.path.join(TMP, 'item-montage.png')
        sheet.save(path)
        print('拼版:', path)


if __name__ == '__main__':
    main()
