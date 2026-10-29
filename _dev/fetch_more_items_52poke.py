# -*- coding: utf-8 -*-
"""
fetch_more_items_52poke.py —— 第二批 DIY 道具的图标（2026-10-29）

规则书没收录、但**对战有实际影响**的道具：13 件持有物 + 4 种场地种子 + 27 种树果。
和 fetch_held_items_52poke.py 同一套流程：52poke 取图 → 96 画布 / 内容 84px
→ 存成 assets/img/item-<slug>.webp。

取图优先级 SV > ZA > BDSP > 无后缀；首选小于 100px 就换大的。

用法：
    python _dev/fetch_more_items_52poke.py [--force]
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
CONTENT = 84
GAMES = ["SV", "ZA", "BDSP", "LA", "SWSH", "Dream"]

ITEMS = [
    # —— 对战强化：能力 / 回复 ——
    ("突击背心", "assault-vest"),
    ("黑色污泥", "black-sludge"),
    ("大根茎", "big-root"),
    ("贝壳之铃", "shell-bell"),
    ("拳击手套", "punching-glove"),
    ("心之水滴", "soul-dew"),
    ("金属粉", "metal-powder"),
    ("速度粉", "quick-powder"),
    ("深海之牙", "deep-sea-tooth"),
    ("深海鳞片", "deep-sea-scale"),
    ("力量头带", "muscle-band"),
    ("博识眼镜", "wise-glasses"),
    ("焦点镜", "scope-lens"),
    # —— 场地种子 ——
    ("电气种子", "electric-seed"),
    ("青草种子", "grassy-seed"),
    ("薄雾种子", "misty-seed"),
    ("精神种子", "psychic-seed"),
    # —— 抗性果（18）——
    ("巧可果", "occa-berry"),
    ("千香果", "passho-berry"),
    ("烛木果", "wacan-berry"),
    ("罗子果", "rindo-berry"),
    ("番荔果", "yache-berry"),
    ("莲蒲果", "chople-berry"),
    ("通通果", "kebia-berry"),
    ("腰木果", "shuca-berry"),
    ("棱瓜果", "coba-berry"),
    ("福禄果", "payapa-berry"),
    ("扁樱果", "tanga-berry"),
    ("草蚕果", "charti-berry"),
    ("佛柑果", "kasib-berry"),
    ("莓榴果", "haban-berry"),
    ("刺耳果", "colbur-berry"),
    ("霹霹果", "babiri-berry"),
    ("灯浆果", "chilan-berry"),
    ("洛玫果", "roseli-berry"),
    # —— 能力果（9）——
    ("枝荔果", "liechi-berry"),
    ("龙睛果", "ganlon-berry"),
    ("沙鳞果", "salac-berry"),
    ("龙火果", "petaya-berry"),
    ("杏仔果", "apicot-berry"),
    ("兰萨果", "lansat-berry"),
    ("星桃果", "starf-berry"),
    ("释陀果", "custap-berry"),
    ("奇秘果", "micle-berry"),
    # —— 第三批：喂食果 / 降能力果 / 受击果 ——
    ("蔓莓果", "razz-berry"),
    ("蕉香果", "nanab-berry"),
    ("凰梨果", "pinap-berry"),
    ("榴石果", "pomeg-berry"),
    ("藻根果", "kelpsy-berry"),
    ("比巴果", "qualot-berry"),
    ("哈密果", "hondew-berry"),
    ("萄葡果", "grepa-berry"),
    ("茄番果", "tamato-berry"),
    ("亚开果", "kee-berry"),
    ("香罗果", "maranga-berry"),
    # —— 第四批：各地特产（状态治愈）——
    ("深灰米果", "pewter-crunchies"),
    ("愤怒馒头", "rage-candy-bar"),
    ("釜炎仙贝", "lava-cookie"),
    ("森之羊羹", "old-gateau"),
    ("飞云冰淇淋", "casteliacone"),
    ("密阿雷格雷派饼", "lumiose-galette"),
    ("娑罗沙布蕾", "shalour-sable"),
    ("大马拉萨达", "malasada"),
    ("祝庆玛芬", "jubilife-muffin"),    # —— 第五批：战斗道具（消耗品）——
    ("力量强化", "x-attack"),
    ("防御强化", "x-defense"),
    ("特攻强化", "x-sp-atk"),
    ("特防强化", "x-sp-def"),
    ("速度强化", "x-speed"),
    ("命中强化", "x-accuracy"),
    ("闪避强化", "x-evasion"),
    ("要害攻击", "dire-hit"),
    ("能力防守", "guard-spec"),
    ("多重强化", "x-all-stats"),
    ("进攻药丸", "offense-pill"),
    ("防守药丸", "defense-pill"),
    ("双倍腌菜", "double-pickle"),
    ("讲究粽", "focus-zongzi"),
    ("颠倒烧", "upside-down-yaki"),
    ("极巨菇菇", "max-mushroom"),
    ("宝可尾草", "poke-toy"),
    ("胆怯球", "timid-ball"),
    ("红色玻璃哨", "red-flute"),
    ("黄色玻璃哨", "yellow-flute"),
    ("蓝色玻璃哨", "blue-flute"),    # —— 第六批：遗漏的回复道具 + 贵重道具 ——
    ("心形甜点", "sweet-heart"),
    ("卡娜莉面包", "canari-bread"),
    ("中药", "herbal-medicine"),
    ("好中药", "good-herbal-medicine"),
    ("厉害中药", "super-herbal-medicine"),
    ("金珠", "nugget"),
    ("巨大金珠", "big-nugget"),
    ("丸子珍珠", "pearl"),
    ("大珍珠", "big-pearl"),
    ("星星沙子", "stardust"),
    ("星星碎片", "star-piece"),
    ("彗星碎片", "comet-shard"),
    ("小蘑菇", "tiny-mushroom"),
    ("大蘑菇", "big-mushroom"),
    ("芳香蘑菇", "balm-mushroom"),
    ("贵重骨头", "rare-bone"),
    ("美丽之羽", "pretty-wing"),
    ("美味尾巴", "slowpoke-tail"),
    ("南国贝壳", "tropical-shell"),
    ("古代铜币", "relic-copper"),
    ("古代银币", "relic-silver"),
    ("古代金币", "relic-gold"),
    ("古代王冠", "relic-crown"),
    ("古代石像", "relic-statue"),
    ("古代手镯", "relic-band"),
    ("古代之壶", "relic-vase"),
    ("浅滩海盐", "shoal-salt"),
    ("浅滩贝壳", "shoal-shell"),
    ("海边的玻璃", "sea-glass"),
    ("弹珠", "marble"),
    ("光滑泥球", "polished-mud-ball"),
    ("粉笔石", "chalk-stone"),
    ("松掉的弹簧", "loose-spring"),
    ("金色叶子", "gold-leaf"),
    ("银色叶子", "silver-leaf"),
    ("宝可梦木娃娃", "wooden-doll"),
    ("神秘摆设", "odd-keepsake"),
    ("一边的耳环", "single-earring"),
    ("小竹笋", "bamboo-shoot-s"),
    ("大竹笋", "bamboo-shoot-l"),
]


def api(params, retry=5):
    """52poke 偶尔会掐连接（SSL EOF），这里退避重试。"""
    params.setdefault("format", "json")
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(retry):
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers=HDR),
                                         timeout=40).read()
            return json.loads(raw.decode("utf-8"))
        except Exception:
            if i == retry - 1:
                raise
            time.sleep(3 * (i + 1))


def candidates(zh):
    out = ["Bag_%s_%s_Sprite.png" % (zh, g) for g in GAMES]
    out.append("Bag_%s_Sprite.png" % zh)
    return out


def pick(cand):
    best = None
    for fname, (url, w) in cand.items():
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
    all_names = []
    for zh, _ in ITEMS:
        all_names.extend(candidates(zh))

    info = {}
    for i in range(0, len(all_names), 40):
        d = api({"action": "query",
                 "titles": "|".join("File:" + n for n in all_names[i:i + 40]),
                 "prop": "imageinfo", "iiprop": "url|size"})
        for p in d.get("query", {}).get("pages", {}).values():
            ii = p.get("imageinfo")
            if ii:
                key = p["title"].replace("File:", "").replace(" ", "_")
                info[key] = (ii[0]["url"], ii[0]["width"])
        time.sleep(0.8)

    miss = []
    for zh, slug in ITEMS:
        dst = os.path.join(IMG, "item-%s.webp" % slug)
        if os.path.exists(dst) and os.path.getsize(dst) > 500 and "--force" not in sys.argv:
            continue
        cand = {n: info[n] for n in candidates(zh) if n in info}
        if not cand:
            miss.append(zh)
            continue
        _, fname, url = pick(cand)
        data = urllib.request.urlopen(urllib.request.Request(url, headers=HDR), timeout=30).read()
        src = os.path.join(TMP, slug + ".png")
        open(src, "wb").write(data)
        normalize(Image.open(src).convert("RGBA")).save(dst, "WEBP", quality=92, method=6)
        print("%-8s %-30s %5dB" % (zh, fname, os.path.getsize(dst)))
        time.sleep(0.6)

    print("没拿到图：", miss if miss else "无")


if __name__ == "__main__":
    main()
