# -*- coding: utf-8 -*-
"""
apply_held_icons.py —— 把持有物图标写进 itemprice.md 的两张表

只动「### 属性强化道具」到「> [!rule] 持有物与招式」之间的内容，
按首列的道具名匹配，在名字前插一个 <img class="item-icon">。
重复跑是安全的（已经带 <img> 的行会跳过）。

「防具护垫」在 52poke 上没有背包图，字典里没有它，脚本会跳过那一行。
"""

import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "itemprice.md")

# 本作译名 → 文件名 slug（和 fetch_held_items_52poke.py 里的 slug 对齐）
SLUGS = {
    "黑带": "black-belt", "黑色眼镜": "black-glasses", "木炭": "charcoal",
    "龙之牙": "dragon-fang", "妖精之羽": "fairy-feather", "硬石头": "hard-stone",
    "磁铁": "magnet", "金属膜": "metal-coat", "奇迹种子": "miracle-seed",
    "神秘水滴": "mystic-water", "不融冰": "never-melt-ice", "毒针": "poison-barb",
    "锐利鸟嘴": "sharp-beak", "丝绸围巾": "silk-scarf", "银粉": "silver-powder",
    "柔软沙子": "soft-sand", "咒符": "spell-tag", "弯曲的汤匙": "twisted-spoon",
    "气球": "air-balloon", "护身金币": "amulet-coin", "气势披带": "focus-sash",
    "厚底靴": "heavy-duty-boots", "黑色铁球": "iron-ball", "王者之证": "kings-rock",
    "大葱": "leek", "吃剩的东西": "leftovers", "生命宝珠": "life-orb",
    "电气球": "light-ball", "机变骰子": "loaded-dice", "幸运拳套": "lucky-punch",
    "光粉": "bright-powder", "讲究头带": "choice-band", "讲究围巾": "choice-scarf",
    "讲究眼镜": "choice-specs", "清净坠饰": "clear-amulet", "红线": "destiny-knot",
    "逃脱按键": "eject-button", "进化奇石": "eviolite", "达人带": "expert-belt",
    "火焰宝珠": "flame-orb", "防尘护目镜": "safety-goggles", "附着针": "sticky-barb",
    "粗骨头": "thick-club", "爽喉喷雾": "throat-spray", "剧毒宝珠": "toxic-orb",
    "雨伞": "utility-umbrella", "弱点保险": "weakness-policy",
    "白色香草": "white-herb", "广角镜": "wide-lens", "对焦镜": "zoom-lens",
    "节拍器": "metronome", "强力香草": "power-herb", "力量负重": "power-weight",
    "先制之爪": "quick-claw", "锐利之爪": "razor-claw", "锐利之牙": "razor-fang",
    "红牌": "red-card", "标靶": "ring-target", "凸凸头盔": "rocky-helmet",
}


def main():
    s = io.open(P, encoding="utf-8").read()
    a = s.index("### 属性强化道具")
    b = s.index("> [!rule] 持有物与招式")
    head, body, tail = s[:a], s[a:b], s[b:]

    done = skipped = 0
    out = []
    for line in body.split("\n"):
        if line.startswith("| ") and "<img" not in line:
            cell = line[2:].split(" |")[0].strip()
            slug = SLUGS.get(cell)
            if slug:
                img = ('<img class="item-icon" width="18" height="18" '
                       'src="assets/img/item-%s.webp" alt="%s">' % (slug, cell))
                line = "| " + img + line[2:]
                done += 1
            elif cell and not set(cell) <= set("-: "):
                skipped += 1
        out.append(line)

    io.open(P, "w", encoding="utf-8", newline="\n").write(head + "\n".join(out) + tail)
    print("插入图标 %d 行，未匹配 %d 行" % (done, skipped))


if __name__ == "__main__":
    main()
