# -*- coding: utf-8 -*-
"""
strip_number_spaces.py —— 去掉数字两侧多余的空格（2026-10-29 组里定的排版规则）

规则：**除非在加粗里，数字前后不加空格。**
    人类与生俱来的基础能力为 1   →  人类与生俱来的基础能力为1
    可用 5 次                    →  可用5次
    **4、5、6 各算一个成功**     →  原样保留（加粗里要留呼吸位）

只处理根目录的正文 .md，不动 `_dev/` 里的开发文档。
"""

import io
import re

import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CJK = r"\u4e00-\u9fa5，。、；：！？（）「」『』【】《》—…·"

# 中文（或全角标点）与数字之间的单个空格
PAT = re.compile(r"(?<=[%s]) (?=\d)|(?<=\d) (?=[%s])" % (CJK, CJK))

# 加粗片段先抠出来保护起来
BOLD = re.compile(r"\*\*[^*\n]+\*\*")

FILES = [
    "00-introduction.md", "01-marvelous-world.md", "02-system-explained.md",
    "03-character-creation.md", "05-catching.md", "06-training.md",
    "dice.md", "gm-screen.md", "icons.md", "itemprice.md", "typechart.md",
    "appendix-glossary.md", "README.md",
]


def strip_outside_bold(text):
    saved = []

    def stash(m):
        saved.append(m.group(0))
        return "\x00%d\x00" % (len(saved) - 1)

    masked = BOLD.sub(stash, text)
    masked = PAT.sub("", masked)
    return re.sub(r"\x00(\d+)\x00", lambda m: saved[int(m.group(1))], masked)


def main():
    total = 0
    for f in FILES:
        p = ROOT + "/" + f
        try:
            s = io.open(p, encoding="utf-8").read()
        except FileNotFoundError:
            continue
        new = strip_outside_bold(s)
        n = len(PAT.findall(BOLD.sub("", s)))
        if new != s:
            io.open(p, "w", encoding="utf-8", newline="\n").write(new)
            total += n
            print("%-28s 去空格 %3d 处" % (f, n))
    print("合计", total)


if __name__ == "__main__":
    main()
