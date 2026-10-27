#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve.py —— 本地预览服务器（只用 Python 标准库，不联网、不装任何依赖）

【为什么需要它】
  浏览器有一条安全规定：用 file:// 打开的网页，不允许再用 fetch / XHR
  去读取同目录下的其它文件。而 docsify 恰恰是靠 fetch 去读 _sidebar.md
  和每一章的 .md 的，所以双击 index.html 一定是空白 —— 这不是代码写错，
  换成任何用 docsify / Vue / React 的站点都一样。
  解决办法只有一个：用 http:// 打开，也就是起一个本地小服务器。

【怎么用】
  方式一（推荐）：双击项目根目录下的「启动预览.bat」
  方式二：在任意目录执行  python _dev/serve.py
          想换端口：python _dev/serve.py 8080
  浏览器会自动打开；关掉这个窗口（或按 Ctrl+C）就是停止服务。

【它比 python -m http.server 多做的一点事】
  给 .md / .css / .js 加上 no-store，改完内容刷新就能看到最新版，
  不会被浏览器缓存挡住。
"""

import functools
import http.server
import os
import socket
import sys
import threading
import webbrowser

# 本脚本在 _dev/ 里，往上一层才是网站根目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRST_PORT = 8000
MAX_TRIES = 20


class PreviewHandler(http.server.SimpleHTTPRequestHandler):
    """静态文件服务器 + 开发期缓存策略。"""

    # 这些是「内容」：每次都要最新，否则改完刷新看不到
    NO_STORE = ('.md', '.html', '.htm', '.css', '.js', '.json', '.webmanifest')

    def end_headers(self):
        path = self.path.split('?')[0].split('#')[0].lower()
        if path in ('', '/') or path.endswith(self.NO_STORE):
            self.send_header('Cache-Control', 'no-store, max-age=0')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 只把 4xx / 5xx 打出来，正常请求不刷屏
        code = args[1] if len(args) > 1 else ''
        if code and not str(code).startswith('2') and not str(code).startswith('3'):
            sys.stderr.write('  [%s] %s\n' % (code, args[0] if args else ''))


def free_port(host, start, tries):
    """从 start 开始找一个没被占用的端口。"""
    for port in range(start, start + tries):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            continue
        finally:
            sock.close()
        return port
    return 0          # 0 = 交给系统随便分配一个


def main():
    host = '127.0.0.1'
    want = FIRST_PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        want = int(sys.argv[1])

    handler = functools.partial(PreviewHandler, directory=ROOT)
    httpd = http.server.ThreadingHTTPServer((host, free_port(host, want, MAX_TRIES)), handler)
    port = httpd.server_address[1]
    url = 'http://%s:%d/index.html' % (host, port)

    print('')
    print('  宝可梦 TRPG 规则书 · 本地预览')
    print('  ------------------------------------------')
    print('  地址：%s' % url)
    print('  目录：%s' % ROOT)
    print('')
    print('  改完 .md 直接刷新浏览器即可，不用重启。')
    print('  停止预览：关掉这个窗口，或按 Ctrl+C。')
    print('')

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n  已停止。')
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
