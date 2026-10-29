# -*- coding: utf-8 -*-
"""
fetch_specialty_info.py —— 抓各地特产的「包包说明」和价格

方法照搬 fetch_ball_desc.py：`prop=revisions` 取 wikitext（这条接口不用登录，
正文页虽然被 Cloudflare 挡，但 API 能拿到源码），再从 `{{包包信息框|…}}` 里
按位置取「描述」和「价格」。模板参数顺序：
    世代|版本|名称|分类|描述|价格|售价
取**首次出现世代**那一条，价格也用它那一代的（标「当地购买价」）。

用法：
    python _dev/fetch_specialty_info.py      # 输出 _dev/tmp/specialty.json
"""

import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "_dev", "tmp", "specialty.json")

API = "https://wiki.52poke.com/api.php"
HDR = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
    "Referer": "https://wiki.52poke.com/",
}

NAMES = ["深灰米果", "愤怒馒头", "釜炎仙贝", "森之羊羹", "飞云冰淇淋",
         "密阿雷格雷派饼", "娑罗沙布蕾", "大马拉萨达", "祝庆玛芬",
         "蔓莓果", "蕉香果", "凰梨果"]


def api(params, retry=4):
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    for i in range(retry):
        try:
            raw = urllib.request.urlopen(urllib.request.Request(url, headers=HDR),
                                         timeout=30).read()
            return json.loads(raw.decode("utf-8"))
        except Exception:
            if i == retry - 1:
                raise
            time.sleep(1.5 * (i + 1))


def find_page(name):
    for cand in (name + "（道具）", name):
        d = api({"action": "query", "titles": cand})
        pages = d.get("query", {}).get("pages", [])
        if pages and "missing" not in pages[0]:
            return pages[0]["title"]
    return None


def wikitext(title):
    d = api({"action": "query", "prop": "revisions", "rvprop": "content",
             "rvslots": "main", "titles": title})
    pages = d.get("query", {}).get("pages", [])
    revs = (pages[0].get("revisions") or []) if pages else []
    return revs[0]["slots"]["main"]["content"] if revs else ""


def clean(s):
    s = re.sub(r"-\{(?:zh-hans|zh-cn):(.*?);zh-hant:.*?\}-", r"\1", s)
    s = re.sub(r"\{\{tt\|([^|}]*)\|[^}]*\}\}", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&mdash;", "—").replace("&nbsp;", " ")
          .replace("ＨＰ", "HP").replace("ＰＰ", "PP"))
    return s.strip()


def parse(wt):
    """返回 [(世代, 版本, 描述, 价格)]，按出现顺序。"""
    m = re.search(r"==\s*包包信息\s*==(.*?)(?:\n==[^=]|\Z)", wt, re.S)
    block = m.group(1) if m else wt
    out = []
    for line in block.split("\n"):
        line = line.strip()
        if not line.startswith("{{包包信息框|"):
            continue
        parts = line.strip("{}").split("|")
        if len(parts) < 6:
            continue
        desc = clean(parts[5])
        price = clean(parts[6]) if len(parts) > 6 else ""
        out.append((parts[1].strip(), parts[2].strip(), desc, price))
    return out


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    result = {}
    for name in NAMES:
        try:
            page = find_page(name)
            if not page:
                print("%-8s 找不到页面" % name)
                continue
            rows = parse(wikitext(page))
            good = [r for r in rows if r[2] and r[2] not in ("—", "-", "ーーー")]
            if not good:
                print("%-8s 没有包包说明（共 %d 条模板）" % (name, len(rows)))
                continue
            gen, ver, desc, price = good[0]
            result[name] = {"page": page, "gen": gen, "ver": ver,
                            "desc": desc, "price": price, "all": rows}
            print("%-8s [%s %s] %s | 价 %s" % (name, gen, ver, desc, price))
        except Exception as e:
            print("%-8s 出错 %s" % (name, e))
        time.sleep(0.3)
    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n写入", OUT, len(result), "条")


if __name__ == "__main__":
    main()
