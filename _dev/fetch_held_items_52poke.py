# -*- coding: utf-8 -*-
"""
fetch_held_items_52poke.py —— 从 52poke 抓「持有物」的背包图标

原书那两张持有物表本来就没有图标。2026-10-29 组里要求补上，于是走和精灵球
一样的路子：MediaWiki API 取原图 → 统一归一化 → 存成 assets/img/item-<slug>.webp，
再交给 apply_held_icons.py 写进 itemprice.md。

取图优先级：SV > ZA > BDSP > Champions > Pokopia > 无后缀版。
同一个道具往往有好几代版本，优先选 160px 的现代版；如果首选那张只有 30px，
就退而求其次挑一张够大的。

注意几件道具在 52poke 上的**官方条目名和本作译名不一样**，这里用官方名去查文件：
    咒符 → 咒术之符      护身金币 → 护符金币
    幸运拳套 → 吉利拳    雨伞 → 万能伞
「防具护垫」在 52poke 上没有背包图，跳过（表格里就它没有图标）。

用法：
    python _dev/fetch_held_items_52poke.py
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
TMP = os.path.join(ROOT, "_dev", "tmp", "items")

API = "https://wiki.52poke.com/api.php"
HDR = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
    "Referer": "https://wiki.52poke.com/",
}

CANVAS = 96
CONTENT = 84          # 和已有 item-* 一致：96 画布，内容 84px
GAMES = ["SV", "ZA", "BDSP", "Champions", "Pokopia"]

# (本作译名, 52poke 条目名, 文件名 slug)
ITEMS = [
    # —— 属性强化 18 件 ——
    ("黑带", "黑带", "black-belt"),
    ("黑色眼镜", "黑色眼镜", "black-glasses"),
    ("木炭", "木炭", "charcoal"),
    ("龙之牙", "龙之牙", "dragon-fang"),
    ("妖精之羽", "妖精之羽", "fairy-feather"),
    ("硬石头", "硬石头", "hard-stone"),
    ("磁铁", "磁铁", "magnet"),
    ("金属膜", "金属膜", "metal-coat"),
    ("奇迹种子", "奇迹种子", "miracle-seed"),
    ("神秘水滴", "神秘水滴", "mystic-water"),
    ("不融冰", "不融冰", "never-melt-ice"),
    ("毒针", "毒针", "poison-barb"),
    ("锐利鸟嘴", "锐利鸟嘴", "sharp-beak"),
    ("丝绸围巾", "丝绸围巾", "silk-scarf"),
    ("银粉", "银粉", "silver-powder"),
    ("柔软沙子", "柔软沙子", "soft-sand"),
    ("咒符", "咒术之符", "spell-tag"),
    ("弯曲的汤匙", "弯曲的汤匙", "twisted-spoon"),
    # —— 其它 42 件 ——
    ("气球", "气球", "air-balloon"),
    ("护身金币", "护符金币", "amulet-coin"),
    ("气势披带", "气势披带", "focus-sash"),
    ("厚底靴", "厚底靴", "heavy-duty-boots"),
    ("黑色铁球", "黑色铁球", "iron-ball"),
    ("王者之证", "王者之证", "kings-rock"),
    ("大葱", "大葱", "leek"),
    ("吃剩的东西", "吃剩的东西", "leftovers"),
    ("生命宝珠", "生命宝珠", "life-orb"),
    ("电气球", "电气球", "light-ball"),
    ("机变骰子", "机变骰子", "loaded-dice"),
    ("幸运拳套", "吉利拳", "lucky-punch"),
    ("光粉", "光粉", "bright-powder"),
    ("讲究头带", "讲究头带", "choice-band"),
    ("讲究围巾", "讲究围巾", "choice-scarf"),
    ("讲究眼镜", "讲究眼镜", "choice-specs"),
    ("清净坠饰", "清净坠饰", "clear-amulet"),
    ("红线", "红线", "destiny-knot"),
    ("逃脱按键", "逃脱按键", "eject-button"),
    ("进化奇石", "进化奇石", "eviolite"),
    ("达人带", "达人带", "expert-belt"),
    ("火焰宝珠", "火焰宝珠", "flame-orb"),
    ("防尘护目镜", "防尘护目镜", "safety-goggles"),
    ("附着针", "附着针", "sticky-barb"),
    ("粗骨头", "粗骨头", "thick-club"),
    ("爽喉喷雾", "爽喉喷雾", "throat-spray"),
    ("剧毒宝珠", "剧毒宝珠", "toxic-orb"),
    ("雨伞", "万能伞", "utility-umbrella"),
    ("弱点保险", "弱点保险", "weakness-policy"),
    ("白色香草", "白色香草", "white-herb"),
    ("广角镜", "广角镜", "wide-lens"),
    ("对焦镜", "对焦镜", "zoom-lens"),
    ("节拍器", "节拍器", "metronome"),
    ("强力香草", "强力香草", "power-herb"),
    ("力量负重", "力量负重", "power-weight"),
    ("防具护垫", "部位护具", "protective-pads"),  # 官中译名是「部位护具」
    ("先制之爪", "先制之爪", "quick-claw"),
    ("锐利之爪", "锐利之爪", "razor-claw"),
    ("锐利之牙", "锐利之牙", "razor-fang"),
    ("红牌", "红牌", "red-card"),
    ("标靶", "标靶", "ring-target"),
    ("凸凸头盔", "凸凸头盔", "rocky-helmet"),
]


def api(params):
    params.setdefault("format", "json")
    url = API + "?" + urllib.parse.urlencode(params)
    raw = urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=30).read()
    return json.loads(raw.decode("utf-8"))


def candidates(wiki_name):
    """列出这个道具在 52poke 上的所有背包图文件名。"""
    out = []
    for g in GAMES:
        out.append("Bag_%s_%s_Sprite.png" % (wiki_name, g))
    out.append("Bag_%s_Sprite.png" % wiki_name)
    return out


def pick(name_to_url):
    """在候选里挑一张：优先 160px 的现代版，其次按 SV>ZA>BDSP>… 的顺序。"""
    best = None
    for fname, (url, w, h) in name_to_url.items():
        for rank, g in enumerate(GAMES):
            if "_%s_" % g in fname:
                style = rank
                break
        else:
            style = len(GAMES)
        score = (1 if w >= 100 else 0, -style, w)
        if best is None or score > best[0]:
            best = (score, fname, url)
    return best


def normalize(im):
    """缩到 96 画布、内容 84px，居中对齐 —— 和 extract_item_icons.py 的规格一致。"""
    bbox = im.split()[-1].getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    scale = CONTENT / max(w, h)
    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    out.paste(im, ((CANVAS - im.width) // 2, (CANVAS - im.height) // 2), im)
    return out


def main():
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(IMG, exist_ok=True)

    # 1) 先把所有候选文件名问一遍地址和尺寸
    all_names = []
    for _, wiki, _ in ITEMS:
        if wiki:
            all_names.extend(candidates(wiki))

    info = {}
    for i in range(0, len(all_names), 40):
        batch = all_names[i:i + 40]
        d = api({"action": "query",
                 "titles": "|".join("File:" + n for n in batch),
                 "prop": "imageinfo", "iiprop": "url|size"})
        for p in d.get("query", {}).get("pages", {}).values():
            ii = p.get("imageinfo")
            if not ii:
                continue
            key = p["title"].replace("File:", "").replace(" ", "_")
            info[key] = (ii[0]["url"], ii[0]["width"], ii[0]["height"])
        time.sleep(0.3)

    # 2) 逐个挑图、下载、归一化
    miss = []
    for zh, wiki, slug in ITEMS:
        if not wiki:
            miss.append((zh, "52poke 无此图"))
            continue
        cand = {n: info[n] for n in candidates(wiki) if n in info}
        if not cand:
            miss.append((zh, "没有候选文件"))
            continue
        dst = os.path.join(IMG, "item-%s.webp" % slug)
        if os.path.exists(dst) and os.path.getsize(dst) > 500 and "--force" not in sys.argv:
            continue                      # 已经有图就跳过，省得每次重下 60 个
        _, fname, url = pick(cand)
        data = urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=30).read()
        src = os.path.join(TMP, slug + ".png")
        open(src, "wb").write(data)
        out = normalize(Image.open(src).convert("RGBA"))
        out.save(dst, "WEBP", quality=92, method=6)
        print("%-12s %-34s %5dB" % (zh, fname, os.path.getsize(dst)))
        time.sleep(0.2)

    if miss:
        print("\n没拿到图的：")
        for zh, why in miss:
            print("  ", zh, why)


if __name__ == "__main__":
    main()
