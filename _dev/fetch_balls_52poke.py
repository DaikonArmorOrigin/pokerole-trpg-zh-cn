#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fetch_balls_52poke.py — 从 52poke 抓原作的精灵球图标

规则书里没收录的球，PDF 里没有矢量图可抠。手绘过一版，和原作差得太远，
改用 52poke 的 ZA 版背包图标（160×160 RGBA，透明底），再统一缩到 128。

取图走 MediaWiki 的 API 而不是猜缩略图地址：`thumb/<hash>/<hash>/` 那串
哈希是文件内容的 MD5，猜不出来；API 直接返回原图 URL。

用法：
    python _dev/fetch_balls_52poke.py
"""

import os
import json
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(ROOT, '_dev', 'tmp', 'balls')

API = 'https://wiki.52poke.com/api.php'
HDR = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                   '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'),
    'Referer': 'https://wiki.52poke.com/',
}

# 文件名 slug → 52poke 上的文件名（不带 File: 前缀）
BALLS = {
    'poke':     'Bag_精灵球_ZA_Sprite.png',
    'great':    'Bag_超级球_ZA_Sprite.png',
    'ultra':    'Bag_高级球_ZA_Sprite.png',
    'master':   'Bag_大师球_ZA_Sprite.png',
    'safari':   'Bag_狩猎球_ZA_Sprite.png',
    'level':    'Bag_等级球_ZA_Sprite.png',
    'moon':     'Bag_月亮球_ZA_Sprite.png',
    'lure':     'Bag_诱饵球_ZA_Sprite.png',
    'friend':   'Bag_友友球_ZA_Sprite.png',
    'love':     'Bag_甜蜜球_ZA_Sprite.png',
    'fast':     'Bag_速度球_ZA_Sprite.png',
    'heavy':    'Bag_沉重球_ZA_Sprite.png',
    'park':     'Bag_公园球_SV_Sprite.png',
    'premier':  'Bag_纪念球_ZA_Sprite.png',
    'repeat':   'Bag_重复球_ZA_Sprite.png',
    'timer':    'Bag_计时球_ZA_Sprite.png',
    'nest':     'Bag_巢穴球_ZA_Sprite.png',
    'net':      'Bag_捕网球_ZA_Sprite.png',
    'dive':     'Bag_潜水球_ZA_Sprite.png',
    'luxury':   'Bag_豪华球_ZA_Sprite.png',
    'heal':     'Bag_治愈球_ZA_Sprite.png',
    'quick':    'Bag_先机球_ZA_Sprite.png',
    'dusk':     'Bag_黑暗球_ZA_Sprite.png',
    'cherish':  'Bag_贵重球_ZA_Sprite.png',
    'sport':    'Bag_竞赛球_ZA_Sprite.png',
    'dream':    'Bag_梦境球_ZA_Sprite.png',
    'beast':    'Bag_究极球_ZA_Sprite.png',

    # —— 第八世代 / 洗翠（《传说 阿尔宙斯》）——
    # 这批只有 LA 版的背包图，没有 ZA 版；尺寸 100×100，归一化后会统一到 128。
    'feather':      'Bag_飞羽球_LA_Sprite.png',
    'wing':         'Bag_飞翼球_LA_Sprite.png',
    'jet':          'Bag_飞梭球_LA_Sprite.png',
    'heavy-hisui':  'Bag_沉重球_LA_Sprite.png',      # 洗翠沉重球，和 ZA 那枚现代沉重球不是同一个
    'superheavy':   'Bag_超重球_LA_Sprite.png',
    'gigaton':      'Bag_巨重球_LA_Sprite.png',
    'origin':       'Bag_起源球_LA_Sprite.png',
    'strange':      'Bag_奇异球_LA_Sprite.png',
}


def api_urls(names):
    """一次问一批，返回 {文件名: 原图 url}。"""
    titles = '|'.join('File:' + n for n in names)
    q = urllib.parse.urlencode({
        'action': 'query', 'titles': titles, 'prop': 'imageinfo',
        'iiprop': 'url', 'format': 'json',
    })
    raw = urllib.request.urlopen(urllib.request.Request(API + '?' + q, headers=HDR),
                                 timeout=30).read()
    data = json.loads(raw.decode('utf-8'))
    out = {}
    for page in data.get('query', {}).get('pages', {}).values():
        info = page.get('imageinfo')
        if not info:
            continue
        # 返回的 title 把下划线换成了空格，这里再换回来
        key = page['title'].replace('File:', '').replace(' ', '_')
        out[key] = info[0]['url']
    return out


def main():
    os.makedirs(TMP, exist_ok=True)
    names = list(BALLS.values())
    urls = {}
    for i in range(0, len(names), 20):
        urls.update(api_urls(names[i:i + 20]))
        time.sleep(0.4)

    for slug, fname in BALLS.items():
        url = urls.get(fname)
        if not url:
            print('%-8s 没有拿到地址' % slug)
            continue
        dst = os.path.join(TMP, slug + '.png')
        if os.path.exists(dst) and os.path.getsize(dst) > 1000:
            print('%-8s 已存在，跳过' % slug)
            continue
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers=HDR),
                                          timeout=30).read()
            open(dst, 'wb').write(data)
            print('%-8s %5d B' % (slug, len(data)))
        except Exception as e:
            print('%-8s 下载失败 %s' % (slug, e))
        time.sleep(0.25)


if __name__ == '__main__':
    main()
