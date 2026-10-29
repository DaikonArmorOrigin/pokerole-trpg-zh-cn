#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_ball_tables.py — 生成《道具与精灵球价格》里的三张球表

三件事一起做：
1. 去掉英文名（面向中文读者，中文名后面跟一串英文只是噪音）；
2. 球名下面挂一行官方的「包包信息」（`_dev/fetch_ball_desc.py` 抓的）；
3. 译名按 52poke 校正（重量球→沉重球、珍惜球→贵重球）。

规则书原文里那些纯描述性的句子（「老型号，如今是收藏品」）已经被官方说明替掉，
只保留机制部分（「在洞窟中 +4，在夜间 +5」）。

用法：
    python _dev/build_ball_tables.py     # 直接改写 itemprice.md 的球表段
"""

import io
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESC = json.load(open(os.path.join(ROOT, '_dev', 'tmp', 'ball_desc.json'), encoding='utf-8'))

ICON = '<img class="ball-icon" width="18" height="18" src="assets/img/ball-%s.webp" alt="%s">'

# (slug, 中文名, 封印强度, 价格, 效果)
SHOP = [
    ('poke',  '精灵球', '4 颗骰', '200',   '——'),
    ('great', '超级球', '6 颗骰', '600',   '——'),
    ('ultra', '高级球', '8 颗骰', '1,200', '——'),
    ('heal',  '治愈球', '4 颗骰', '300',   '收服后 HP 回满，异常状态一并解除。'),
]

# (slug, 中文名, 稀有度, 封印强度, 效果)
CUSTOM = [
    ('dusk',    '黑暗球',     '少见',   '4 颗骰*', '在洞窟中 +4，在夜间 +5。'),
    ('fast',    '速度球',     '少见',   '视情况',  '封印强度等于目标宝可梦的敏捷值，最多 9 颗骰。'),
    ('heavy',   '沉重球',     '少见',   '4 颗骰*', '目标每重 25kg（50 磅）+1 颗骰，最多加 5 颗。'),
    ('luxury',  '豪华球',     '极稀有', '4 颗骰',  '用它收服的宝可梦，幸福度 +1。'),
    ('quick',   '先机球',     '少见',   '9 颗骰*', '战斗第 1 轮 9 颗骰，之后每过一轮 -2。'),
    ('old',     '旧式精灵球', '稀有',   '3 颗骰',  '老型号，如今是收藏品。'),
    ('master',  '大师球',     '极稀有', '必定收服', '传闻中封印力最强的球，但没人真正见过它出手。'),
]

EXTRA = [
    ('timer',   '计时球', '少见',   '4 颗骰*', '越拖越准：战斗第 1 轮 4 颗骰，之后每过一轮 +1，最多 9 颗。'),
    ('repeat',  '重复球', '少见',   '4 颗骰*', '认熟脸：目标种类在图鉴里已有记录时 +3 颗骰。'),
    ('nest',    '巢穴球', '少见',   '4 颗骰*', '专挑弱的：目标等级每比你低 1 级 +1 颗骰，最多 +4。'),
    ('level',   '等级球', '稀有',   '4 颗骰*', '以大欺小：目标等级每低于你 5 级 +1 颗骰，最多 +4。'),
    ('net',     '捕网球', '少见',   '4 颗骰*', '目标带水或虫属性时 +4 颗骰。'),
    ('dive',    '潜水球', '少见',   '4 颗骰*', '在水下或贴着水面战斗时 +4 颗骰。'),
    ('lure',    '诱饵球', '少见',   '4 颗骰*', '对用钓竿钓上来的宝可梦 +4 颗骰。'),
    ('moon',    '月亮球', '稀有',   '4 颗骰*', '对靠月之石进化的种类 +4 颗骰。'),
    ('love',    '甜蜜球', '稀有',   '4 颗骰*', '目标与你的宝可梦性别相反时 +4 颗骰。'),
    ('friend',  '友友球', '稀有',   '4 颗骰',  '收服后幸福度 +2，比豪华球更管用。'),
    ('premier', '纪念球', '稀有',   '4 颗骰',  '纯纪念，没有任何加成。'),
    ('safari',  '狩猎球', '极稀有', '6 颗骰',  '狩猎区专用，园外不流通；能不能带出来全看本事。'),
    ('sport',   '竞赛球', '极稀有', '6 颗骰',  '捕虫大赛专用，赛后统一回收，带不出来。'),
    ('dream',   '梦境球', '极稀有', '4 颗骰*', '对已经睡着的宝可梦 +5 颗骰。'),
    ('beast',   '究极球', '极稀有', '6 颗骰*', '对异界来客（究极异兽）+6 颗骰；对普通宝可梦 -2 颗，最少 1 颗。'),
]


def name_cell(slug, cn, rare=None):
    """球名（稀有度）+ 下面一行官方说明。旧式球没有官方说明，就不挂。"""
    d = DESC.get(slug, {}).get('desc')
    html = ICON % (slug, cn) + cn
    if rare:
        html += '（%s）' % rare          # 稀有度跟着球名，别跑到说明后面去
    if d:
        html += '<br><span class="ball-note">%s</span>' % d
    return html


def shop_table():
    out = ['| 精灵球 | 封印强度 | 价格 | 效果 |', '|------|:---:|--------:|------|']
    for slug, cn, power, price, effect in SHOP:
        out.append('| %s | %s | %s | %s |' % (name_cell(slug, cn), power, price, effect))
    return '\n'.join(out)


def custom_table():
    out = ['| 精灵球 | 封印强度 | 效果 |', '|------|:---:|------|']
    for slug, cn, rare, power, effect in CUSTOM:
        out.append('| %s | %s | %s |' % (name_cell(slug, cn, rare), power, effect))
    return '\n'.join(out)


def extra_table():
    out = ['| 精灵球 | 封印强度 | 效果 |', '|------|:---:|------|']
    for slug, cn, rare, power, effect in EXTRA:
        out.append('| %s | %s | %s |' % (name_cell(slug, cn, rare), power, effect))
    return '\n'.join(out)


def main():
    p = os.path.join(ROOT, 'itemprice.md')
    s = io.open(p, encoding='utf-8').read()

    start = s.index('### 商店在售的精灵球')
    end = s.index('## 宝可梦养护')
    old = s[start:end]

    new = """### 商店在售的精灵球

%s

> [!tip] 怎么用精灵球
>
> 封印强度的具体用法见[收服宝可梦](05-catching.md)。

### 定制球（非卖品）

定制球不出售，但备齐材料、通过**制作技能**检定后可以自己做。带 `*` 的是基础值，实际强度看说明；括号里是稀有度。

%s

> [!note] 还可以自己造
> 书里只列了冰山一角。定制球的效果千差万别，欢迎自己设计。

### 补充球（汉化组 DIY）

下面这批球原作里有、原书没收录，由汉化组按原作的特性补写。
效果一律折算成本作的「封印强度」框架，**数值只在本规则书内有效**，和电子游戏里的倍率不是一回事。

%s

> [!tip] 想自己再加一个
> 照这个套路写就行：**基础 4 颗骰，特效最多 +4 颗**，条件越窄可以给得越狠
> （「性别相反」这种一条就够 +4）。超过 9 颗骰的球基本等于大师球，别乱给。

---

""" % (shop_table(), custom_table(), extra_table())

    s = s[:start] + new + s[end:]
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已重写 itemprice.md 的球表段（%d → %d 字节）' % (len(old), len(new)))


if __name__ == '__main__':
    main()
