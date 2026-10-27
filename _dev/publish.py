#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
publish.py —— 一键发布（提交 + 推送到 GitHub）

【谁在用】
  双击项目根目录的「一键发布.bat」，它会调用这个脚本。
  不用记 git 命令。

【它做什么】
  1. 看一眼有哪些文件被改过，列给你确认
  2. 问你一句「这次改了什么」，回车就用默认的「更新内容 日期 时间」
  3. git add -A → git commit → git push
  4. 推送成功后，GitHub Pages 大约 30 秒自动更新

【安全网】
  · 没改动就直接退出，不会产生空提交
  · 推送失败（断网 / 没登录）时，本地提交会保留，网络恢复后再点一次就行
  · 不会强推、不会重置、不会删任何东西
"""

import datetime
import os
import subprocess
import sys

# 项目根目录：本脚本在 _dev/ 里，往上一层才是网站根目录
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE_URL = 'https://daikonarmororigin.github.io/pokemon-trpg/'

# git status 的前两位状态码 → 中文
LABELS = [
    ('??', '新增'),
    ('A', '新增'),
    ('M', '修改'),
    ('R', '改名'),
    ('C', '复制'),
    ('D', '删除'),
    ('U', '冲突'),
]


def git(*args, stream=False):
    """在项目根目录跑一条 git 命令。"""
    cmd = ['git'] + list(args)
    if stream:
        # 直接把输出交给控制台：推送进度这类长输出要让人看见
        return subprocess.run(cmd, cwd=ROOT).returncode
    return subprocess.run(
        cmd, cwd=ROOT, capture_output=True,
        encoding='utf-8', errors='replace'
    )


def label_of(code):
    for key, text in LABELS:
        if code.startswith(key):
            return text
    return '变更'


def show_changes(changes, limit=12):
    print('  检测到 %d 处改动：\n' % len(changes))
    for line in changes[:limit]:
        code, path = line[:2], line[3:]
        print('    %s  %s' % (label_of(code), path))
    if len(changes) > limit:
        print('    … 还有 %d 处' % (len(changes) - limit))
    print('')


def main():
    print('')
    print('  宝可梦 TRPG 规则书 · 一键发布')
    print('  ------------------------------------------')

    if not os.path.isdir(os.path.join(ROOT, '.git')):
        print('  [X] 这个目录不是 git 仓库，没法发布。')
        return 1

    # core.quotepath=false：让中文文件名原样显示，而不是 \344\270\255 这种转义
    status = git('-c', 'core.quotepath=false', 'status', '--porcelain')
    if status.returncode != 0:
        print('  [X] 读取改动失败：')
        print(status.stderr.strip())
        return 1

    changes = [l for l in status.stdout.splitlines() if l.strip()]
    if not changes:
        print('')
        print('  没有需要发布的改动，线上已经是最新的了。')
        print('  线上地址：%s' % LIVE_URL)
        return 0

    show_changes(changes)

    default_msg = '更新内容 ' + datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    try:
        msg = input('  这次改了什么？（回车直接用「%s」）\n  > ' % default_msg).strip()
    except (EOFError, KeyboardInterrupt):
        print('\n  已取消，什么都没改。')
        return 1
    if not msg:
        msg = default_msg

    print('')
    print('  [1/3] 暂存改动 …')
    if git('add', '-A').returncode != 0:
        print('  [X] 暂存失败。')
        return 1

    print('  [2/3] 提交 …')
    commit = git('commit', '-m', msg)
    if commit.returncode != 0:
        print('  [X] 提交失败：')
        print((commit.stdout + commit.stderr).strip())
        return 1

    print('  [3/3] 推送到 GitHub …（第一次可能要弹浏览器授权）')
    code = git('push', 'origin', 'HEAD', stream=True)
    if code != 0:
        print('')
        print('  [X] 推送没成功，常见原因：断网 / 需要重新登录 / 远程有你没拉取的提交。')
        print('      改动已经安全地提交在本地，处理好之后**再点一次这个文件**就行。')
        return 1

    print('')
    print('  [完成] 已发布')
    print('    线上地址：%s' % LIVE_URL)
    print('    GitHub Pages 大约 30 秒后自动更新，稍等一下刷新。')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('\n  已取消。')
        sys.exit(1)
