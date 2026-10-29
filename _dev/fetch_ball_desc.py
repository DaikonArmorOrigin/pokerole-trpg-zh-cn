#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fetch_ball_desc.py — 抓每个精灵球在 52poke 上的「包包信息」

规则书里对球的描述偏机制（「越黑越强：在洞窟中 +4」），
官方那句「有点温柔的球……」反而更有味道。这里把官方描述抓下来，
网页上球名下面挂一行小字，机制说明仍然留在「效果」列。

取的是**该球首次出现世代**的那一条（`包包信息框` 的第一条，
wiki 里本来就按世代排好序）。

用法：
    python _dev/fetch_ball_desc.py      # 输出 _dev/tmp/ball_desc.json
"""

import os
import re
import json
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_dev', 'tmp', 'ball_desc.json')

API = 'https://wiki.52poke.com/api.php'
HDR = {
    'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                   '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'),
    'Referer': 'https://wiki.52poke.com/',
}

BALLS = {
    'poke': '精灵球', 'great': '超级球', 'ultra': '高级球', 'master': '大师球',
    'safari': '狩猎球', 'level': '等级球', 'moon': '月亮球', 'lure': '诱饵球',
    'friend': '友友球', 'love': '甜蜜球', 'fast': '速度球', 'heavy': '沉重球',
    'park': '公园球', 'premier': '纪念球', 'repeat': '重复球', 'timer': '计时球',
    'nest': '巢穴球', 'net': '捕网球', 'dive': '潜水球', 'luxury': '豪华球',
    'heal': '治愈球', 'quick': '先机球', 'dusk': '黑暗球', 'cherish': '贵重球',
    'sport': '竞赛球', 'dream': '梦境球', 'beast': '究极球',
}


def api(params):
    q = urllib.parse.urlencode(params)
    raw = urllib.request.urlopen(urllib.request.Request(API + '?' + q, headers=HDR),
                                 timeout=30).read()
    return json.loads(raw.decode('utf-8'))


def find_page(name):
    """道具页统一叫「XX（道具）」，先精确找，找不到再搜索。"""
    for cand in (name + '（道具）', name):
        d = api({'action': 'query', 'titles': cand, 'format': 'json', 'formatversion': '2'})
        pages = d.get('query', {}).get('pages', [])
        if pages and 'missing' not in pages[0]:
            return pages[0]['title']
    d = api({'action': 'query', 'list': 'search', 'srsearch': name + ' 道具',
             'format': 'json', 'srlimit': '5'})
    for hit in d.get('query', {}).get('search', []):
        if hit['title'].startswith(name):
            return hit['title']
    return None


def wikitext(title):
    d = api({'action': 'query', 'prop': 'revisions', 'rvprop': 'content',
             'rvslots': 'main', 'titles': title, 'format': 'json', 'formatversion': '2'})
    pages = d.get('query', {}).get('pages', [])
    if not pages:
        return ''
    revs = pages[0].get('revisions') or []
    return revs[0]['slots']['main']['content'] if revs else ''


def clean(s):
    """去掉 wiki 标记：语言变体模板取简体、去掉内链 / 模板 / HTML。"""
    s = re.sub(r'-\{(?:zh-hans|zh-cn):(.*?);zh-hant:.*?\}-', r'\1', s)
    s = re.sub(r'\{\{tt\|([^|}]*)\|[^}]*\}\}', r'\1', s)      # {{tt|150|注释}}
    s = re.sub(r'\{\{[^{}]*\}\}', '', s)                          # {{sup/5|B}} 之类
    s = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&mdash;', '—').replace('&nbsp;', ' ')
    s = s.replace('ＨＰ', 'HP').replace('ＰＰ', 'PP')
    return s.strip()


def first_desc(wt):
    """取「包包信息」里第一条（= 首次出现的世代）的描述。"""
    m = re.search(r'==\s*包包信息\s*==(.*?)(?:\n==[^=]|\Z)', wt, re.S)
    block = m.group(1) if m else wt
    for line in block.split('\n'):
        line = line.strip()
        if not line.startswith('{{包包信息框|'):
            continue
        # {{包包信息框|世代|版本|名称|分类|描述|价格|售价}}
        # 注意描述在第 6 个参数（index 5），不是第 5 个
        parts = line.strip('{}').split('|')
        if len(parts) < 6:
            continue
        desc = clean(parts[5])
        if not desc or desc in ('—', '-', ''):
            continue            # 第一世代的球常常没写描述，往下找
        return desc, parts[1].strip(), parts[2].strip()
    return None, None, None


if __name__ == '__main__':
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    result = {}
    for slug, name in BALLS.items():
        try:
            page = find_page(name)
            if not page:
                print('%-8s 找不到页面' % slug)
                continue
            desc, gen, ver = first_desc(wikitext(page))
            if desc:
                result[slug] = {'name': name, 'page': page, 'gen': gen,
                                'ver': ver, 'desc': desc}
                print('%-8s [%s %s] %s' % (slug, gen, ver, desc))
            else:
                print('%-8s 没有包包信息' % slug)
        except Exception as e:
            print('%-8s 出错 %s' % (slug, e))
        time.sleep(0.3)
    json.dump(result, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n写入', OUT, len(result), '条')
