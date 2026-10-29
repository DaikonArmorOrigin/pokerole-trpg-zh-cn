/* ============================================================
 * app.js — 宝可梦 TRPG 规则书 前端交互
 * 必须在 docsify.min.js 之前加载（因为要先写好 window.$docsify）
 *
 * 结构：
 *   1  圆点语法 {{n}} / {{当前/上限}}
 *   2  卡片语法 > [!tip]
 *   3  侧边栏（移动端抽屉）
 *   4  面包屑 + 上一节 / 下一节
 *   5  页内目录（右侧 TOC）+ 锚点定位
 *   6  属性克制提示框
 *  6.5 属性组合相克计算（typechart 页）
 *  6.6 队伍弱点补盲图（typechart 页）
 *   7  全屏搜索（图鉴按钮唤起）
 *   8  快速掷骰 + 掷骰记录（快速参考页）
 *   9  「跳到正文」
 *  10  外壳元素（面包屑 / 页脚）
 *  11  docsify 配置
 *  12  兼容与打印
 *  13  启动
 * ============================================================ */
(function () {
    'use strict';

    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) {
        return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    };
    var isMobile = function () { return window.innerWidth <= 768; };

    // 当前页面的「干净路径」：02-system-explained
    // docsify 传进来的 route.path 带前导斜杠（/02-system-explained），
    // 侧栏链接是 #/02-system-explained.md，两种都要能吃掉。
    function normalizePath(p) {
        return String(p || '')
            .replace(/^#/, '')
            .replace(/^\/+/, '')
            .replace(/\.md(?=$|[?#])/, '')
            .split('?')[0]
            .split('#')[0];
    }

    /* ==========================================================
     * 1. {{n}} / {{当前/上限}} / {{当前/可加/上限}} → 圆点
     * ========================================================== */
    var DOTS_RE = /\{\{(\d+)(?:\/(\d+)(?:\/(\d+))?)?\}\}/g;

    function repeat(html, n) {
        return n > 0 ? new Array(n + 1).join(html) : '';
    }

    function renderDots(cur, second, third) {
        var html;
        if (second == null) {
            html = repeat('<span class="attr-filled">●</span>', cur);
        } else if (third == null) {
            html = repeat('<span class="attr-filled">●</span>', cur) +
                   repeat('<span class="attr-empty">○</span>', second - cur);
        } else {
            html = repeat('<span class="attr-filled">●</span>', cur) +
                   repeat('<span class="attr-available">●</span>', second - cur) +
                   repeat('<span class="attr-empty">○</span>', third - second);
        }
        return '<span class="attribute-dots">' + html + '</span>';
    }

    function convertDots() {
        var root = $('.markdown-section');
        if (!root) return;

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var v = node.nodeValue;
                if (!v || v.indexOf('{{') === -1) return NodeFilter.FILTER_REJECT;
                var p = node.parentElement;
                if (p && p.closest('.attribute-dots, pre, code, .type-tooltip')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        var targets = [];
        while (walker.nextNode()) targets.push(walker.currentNode);

        targets.forEach(function (node) {
            var replaced = node.nodeValue.replace(DOTS_RE, function (m, a, b, c) {
                return renderDots(+a, b ? +b : null, c ? +c : null);
            });
            if (replaced === node.nodeValue) return;
            var holder = document.createElement('span');
            holder.innerHTML = replaced;
            node.parentNode.replaceChild(holder, node);
        });
    }

    /* ==========================================================
     * 2. 卡片语法（callout）
     *     作者只写：
     *         > [!tip] 标题
     *         >
     *         > 正文
     *     渲染成原来的 <div class="tip-card">，不必再手写 HTML。
     *     这套写法同时是 Obsidian 原生的 callout 语法，编辑器里也能直接看到卡片。
     * ========================================================== */
    var CALLOUT_ALIAS = {
        tip: 'tip', '提示': 'tip', '贴士': 'tip',
        rule: 'rule', '规则': 'rule',
        // 「注意 / 警告」沿用规则卡：暖米黄底 + 深褐标签，语义上就是「这条别搞错」
        warning: 'rule', '警告': 'rule', '注意': 'rule',
        gm: 'gm', '叙事': 'gm', '叙事者': 'gm',
        trainer: 'trainer', '训练家': 'trainer',
        note: 'note', '译注': 'note',
        details: 'details', '折叠': 'details', '展开': 'details'
    };

    var CALLOUT_BOX = {
        tip:     { cls: 'tip-card',         title: 'tip-title',  fallback: '' },
        rule:    { cls: 'rule-card',        title: 'rule-title', fallback: '' },
        gm:      { cls: 'storyteller-note', title: 'note-label', fallback: '🎭 叙事者笔记' },
        trainer: { cls: 'trainer-tip',      title: 'tip-label',  fallback: '💡 训练家贴士' }
    };

    function convertCallouts() {
        var root = $('.markdown-section');
        if (!root) return;

        $$('blockquote', root).forEach(function (bq) {
            var first = bq.firstElementChild;
            if (!first || first.tagName !== 'P') return;

            var m = first.innerHTML.match(/^\s*\[!([^\]\s]+)\]\s*([^\n<]*)([\s\S]*)$/);
            if (!m) return;

            var type = CALLOUT_ALIAS[m[1].trim().toLowerCase()];
            if (!type) return;

            var title = m[2].trim();
            var rest = m[3].replace(/^(\s*<br\s*\/?>)+/i, '');

            first.innerHTML = rest;
            if (!rest.trim()) first.parentNode.removeChild(first);

            var parent = bq.parentNode;
            var target;

            if (type === 'note') {
                // 译注：折叠面板，保持原来的 details 结构
                var details = document.createElement('details');
                details.className = 'translator-note';

                var summary = document.createElement('summary');
                var badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = '📝 译注';
                var hint = document.createElement('span');
                hint.className = 'hint';
                hint.textContent = title || '译注';
                // 「译注」两个字已经写在徽章里了，后面再跟一个「译注」是重复的
                if (hint.textContent.trim() === '译注') hint.textContent = '';
                summary.appendChild(badge);
                if (hint.textContent) summary.appendChild(hint);
                details.appendChild(summary);

                target = document.createElement('div');
                target.className = 'note-body';
                details.appendChild(target);
                parent.insertBefore(details, bq);
            } else if (type === 'details') {
                // 折叠块：原生 details，不依赖任何脚本
                var fold = document.createElement('details');
                fold.className = 'collapsible-insert';

                var head = document.createElement('summary');
                head.className = 'insert-header';

                var headTitle = document.createElement('span');
                headTitle.className = 'insert-title';
                headTitle.textContent = title || '展开查看';
                head.appendChild(headTitle);

                var arrow = document.createElement('span');
                arrow.className = 'arrow';
                arrow.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
                head.appendChild(arrow);

                fold.appendChild(head);

                target = document.createElement('div');
                target.className = 'insert-body';
                fold.appendChild(target);
                parent.insertBefore(fold, bq);
            } else {
                var cfg = CALLOUT_BOX[type];
                var box = document.createElement('div');
                box.className = cfg.cls;

                var labelText = title || cfg.fallback;
                if (labelText) {
                    var label = document.createElement('div');
                    label.className = cfg.title;
                    // 「💡 训练家贴士」拆成两段：emoji 单独一个 span，
                    // 圆标里才能让图标占一行、中文占下面两行（原书就这么排）。
                    var mm = labelText.match(/^([^\s\u4e00-\u9fa5]+)\s+(.+)$/);
                    if (mm) {
                        var ico = document.createElement('span');
                        ico.className = 'ico';
                        ico.textContent = mm[1];
                        label.appendChild(ico);
                        var txt = document.createElement('span');
                        txt.className = 'txt';
                        txt.textContent = mm[2];
                        label.appendChild(txt);
                    } else {
                        label.textContent = labelText;
                    }
                    box.appendChild(label);
                }

                parent.insertBefore(box, bq);
                target = box;
            }

            while (bq.firstChild) target.appendChild(bq.firstChild);
            parent.removeChild(bq);
        });
    }

    /* ==========================================================
     * 3. 侧边栏（移动端抽屉）
     * ========================================================== */
    function openSidebar() {
        var sidebar = $('.sidebar');
        var overlay = $('#sidebarOverlay');
        if (!sidebar) return;
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        var btn = $('#menuToggle');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
        var sidebar = $('.sidebar');
        var overlay = $('#sidebarOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        var btn = $('#menuToggle');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    function toggleSidebar() {
        var sidebar = $('.sidebar');
        if (!sidebar) return;
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
    }

    function bindSidebar() {
        var btn = $('#menuToggle');
        if (btn) btn.addEventListener('click', toggleSidebar);

        var overlay = $('#sidebarOverlay');
        if (overlay) overlay.addEventListener('click', closeSidebar);

        // 手机上点目录项后自动收起
        document.addEventListener('click', function (e) {
            if (!isMobile()) return;
            var sidebar = $('.sidebar');
            if (sidebar && sidebar.classList.contains('open') &&
                e.target.closest('.sidebar-nav a')) {
                closeSidebar();
            }
        });

        // 从手机宽度拉宽到桌面时，清掉抽屉状态
        var lastWidth = window.innerWidth;
        window.addEventListener('resize', function () {
            var w = window.innerWidth;
            if (w > 768 && lastWidth <= 768) closeSidebar();
            lastWidth = w;
        });
    }

    /* ==========================================================
     * 4. 面包屑 + 上一节 / 下一节
     *
     * 侧栏现在一章只放一条链接，所以这里的顺序就是书的顺序。
     * 「快速参考」那一组是工具页，不算正文章节，翻页时会跳过它们，
     * 免得读者从「术语表」点下一节又绕回「引言」。
     * ========================================================== */
    function getCurrentPath() {
        return normalizePath(window.location.hash) || 'readme';
    }

    function getSidebarLinks() {
        return $$('.sidebar-nav a').filter(function (a) {
            // 排除 docsify 自动生成的页内小标题（现在已关闭，留作保险）
            return !a.closest('.app-sub-sidebar');
        }).map(function (a) {
            var group = getGroupLabel(a);
            // 章节图标现在是一张位图（原书目录的球），不是 emoji，
            // 所以单独把 src 带出来，面包屑才能复用同一枚图标。
            var img = a.querySelector('img');
            return {
                href: normalizePath(a.getAttribute('href')),
                text: a.textContent.trim(),
                iconSrc: img ? (img.getAttribute('src') || '') : '',
                group: group,
                quickRef: /快速参考/.test(group),
                element: a
            };
        }).filter(function (item) { return !!item.href; });
    }

    // 取侧栏里"这一组"的标题原文（含 emoji）
    function normLabel(s) {
        // 去掉 emoji、空格与标点，便于比较"组名"和"页名"是否其实是同一个
        return String(s || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    }

    // 把 "🏛️ 引言" 拆成 { icon: '🏛️', name: '引言' }
    // 用 Unicode 属性做匹配；老浏览器不支持 \p{...} 时退回"开头非文字字符"规则
    var ICON_RE;
    try {
        ICON_RE = new RegExp('^([\\p{Extended_Pictographic}\\uFE0F\\u200D]+)\\s*', 'u');
    } catch (e) {
        ICON_RE = /^([^\u4e00-\u9fa5a-zA-Z0-9]+)\s*/;
    }

    function splitLabel(text) {
        var s = String(text || '').trim();
        var m = ICON_RE.exec(s);
        if (m && m[1]) {
            return { icon: m[1], name: s.slice(m[0].length).trim() };
        }
        return { icon: '', name: s };
    }

    // 找到链接所属的分组标题。两种写法都支持：
    //   - **🎲 快速参考**        （分组，下面挂子项）
    //   - **[🏛️ 引言](x.md)**    （单章，分组头本身就是链接）
    function getGroupLabel(linkEl) {
        if (!linkEl) return '';
        var li = linkEl.closest('li');
        if (!li) return '';

        // 往上爬到最外层的 li
        var top = li;
        while (top.parentElement) {
            var outer = top.parentElement.closest('li');
            if (!outer) break;
            top = outer;
        }

        var tagSet = { P: 1, A: 1, STRONG: 1, SPAN: 1, DIV: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1 };
        for (var i = 0; i < top.children.length; i++) {
            var child = top.children[i];
            if (!tagSet[child.tagName]) continue;
            var text = child.textContent.trim();
            if (text) return text;
        }
        return '';
    }

    function findCurrentIndex(links, currentPath) {
        var cur = normalizePath(currentPath);
        var exact = -1;
        links.forEach(function (link, idx) {
            if (exact === -1 && link.href === cur) exact = idx;
        });
        return exact;
    }

    var ARROW_LEFT = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>';
    var ARROW_RIGHT = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';

    // 面包屑：图标统一取"章节自己的 emoji"，保证侧栏和面包屑对得上
    function buildBreadcrumbHTML(link, currentPath) {
        if (!link) {
            var isHome = !currentPath || /^readme$/i.test(normalizePath(currentPath));
            return isHome
                ? '<span class="bc-icon" aria-hidden="true">🏠</span><span class="current">首页</span>'
                : '<span class="bc-icon" aria-hidden="true">🔍</span><span class="current">页面未找到</span>';
        }

        var group = splitLabel(link.group);
        var page = splitLabel(link.text);
        // 章节图标优先用侧栏那张位图，没有才退回 emoji
        var iconHTML = link.iconSrc
            ? '<img class="bc-ball" src="' + link.iconSrc + '" alt="" aria-hidden="true">'
            : '<span class="bc-icon" aria-hidden="true">' + (group.icon || page.icon || '📄') + '</span>';

        var html = iconHTML;

        // 组名和页名相同（如"引言 / 引言"）时只显示一层，但图标仍保留
        if (group.name && normLabel(group.name) !== normLabel(page.name)) {
            html += '<span class="parent">' + group.name + '</span><span class="sep">/</span>';
        }
        html += '<span class="current">' + (page.name || link.text) + '</span>';
        return html;
    }

    function goTo(href) {
        window.location.hash = '#/' + normalizePath(href);
    }

    function updateBreadcrumbAndNav() {
        var currentPath = getCurrentPath();
        var all = getSidebarLinks();
        var chapters = all.filter(function (l) { return !l.quickRef; });
        var idx = findCurrentIndex(chapters, currentPath);

        // docsify 只给「直接挂在 li 下的 a」打 active，而单章条目的结构是
        // li > strong > a，于是高亮一直不生效。这里自己标一次，两种结构都覆盖。
        all.forEach(function (l) {
            var on = l.href === currentPath;
            l.element.classList.toggle('active', on);
            var li = l.element.closest('li');
            if (li) li.classList.toggle('active', on);
        });

        var breadcrumb = $('#breadcrumb');
        if (breadcrumb) {
            var hit = idx >= 0 ? chapters[idx] : null;
            if (!hit) hit = all[findCurrentIndex(all, currentPath)] || null;
            breadcrumb.innerHTML = buildBreadcrumbHTML(hit, currentPath);
        }

        var prevBtn = $('#navPrev');
        var nextBtn = $('#navNext');
        if (!prevBtn || !nextBtn) return;

        var prev = null;
        var next = null;

        if (idx >= 0) {
            prev = idx > 0 ? chapters[idx - 1] : null;
            next = idx < chapters.length - 1 ? chapters[idx + 1] : null;
        } else {
            // 首页、快速参考页、404 页：都指向正文第一章，别让人卡在原地
            next = chapters[0] || null;
        }

        prevBtn.disabled = !prev;
        prevBtn.innerHTML = ARROW_LEFT + ' 上一节';
        if (prev) {
            prevBtn.title = prev.text;
            prevBtn.onclick = function () { goTo(prev.href); };
        } else {
            prevBtn.removeAttribute('title');
            prevBtn.onclick = null;
        }

        nextBtn.disabled = !next;
        nextBtn.innerHTML = '下一节 ' + ARROW_RIGHT;
        if (next) {
            nextBtn.title = next.text;
            nextBtn.onclick = function () { goTo(next.href); };
        } else {
            nextBtn.removeAttribute('title');
            nextBtn.onclick = null;
        }
    }

    /* ==========================================================
     * 5. 页内目录（右侧 TOC）
     *
     * 侧栏只负责"去哪一章"，这一列负责"去哪一节"。
     * H2/H3 常驻显示；H4 只在当前小节展开时出现——02 章光标题
     * 就有 78 个，全列出来等于把侧栏的老问题原样搬过来。
     * ========================================================== */
    var tocEl = null;
    var tocLinks = [];
    var tocHeadings = [];
    var tocPath = '';

    function ensureTOC() {
        if (tocEl && document.body.contains(tocEl)) return tocEl;
        tocEl = document.createElement('aside');
        tocEl.className = 'page-toc';
        tocEl.id = 'pageToc';
        tocEl.setAttribute('aria-label', '本页目录');
        tocEl.hidden = true;

        // 目录里的跳转自己处理：交给 docsify 会重新渲染整页，
        // 渲染完又滚回顶部，点了等于没点。这里只改地址栏 + 手动定位。
        tocEl.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a[data-target]');
            if (!a) return;
            e.preventDefault();
            e.stopPropagation();

            var id = a.getAttribute('data-target');
            var href = '#/' + tocPath + '?id=' + encodeURIComponent(id);
            if (window.history && history.replaceState) {
                history.replaceState(null, '', href);
            }
            scrollToAnchor(id);
            syncTOCActive();
        });

        document.body.appendChild(tocEl);
        return tocEl;
    }

    function buildTOC(vm) {
        var section = $('.content .markdown-section');
        var toc = ensureTOC();
        if (!section) return;

        var heads = $$('h2, h3, h4', section).filter(function (h) {
            return !h.closest('details, .type-tooltip');
        });

        var curPath = normalizePath((vm && vm.route && vm.route.path) || getCurrentPath());

        // 首页不挂目录：欢迎页就四段话，右侧多一列反而碍事
        // （docsify 在根路径下给出的 path 是空字符串，不是 'readme'）
        if (heads.length < 3 || !curPath || /^readme$/i.test(curPath)) {
            toc.hidden = true;
            document.body.classList.add('toc-off');
            tocLinks = [];
            tocHeadings = [];
            return;
        }
        document.body.classList.remove('toc-off');

        var path = curPath;
        tocPath = path;
        var ul = document.createElement('ul');
        ul.className = 'toc-list';

        heads.forEach(function (h, i) {
            if (!h.id) h.id = 'h-' + i;

            var li = document.createElement('li');
            li.className = 'toc-l' + h.tagName.charAt(1);

            var a = document.createElement('a');
            a.href = '#/' + path + '?id=' + encodeURIComponent(h.id);
            a.textContent = h.textContent.trim();
            a.setAttribute('data-target', h.id);
            li.appendChild(a);
            ul.appendChild(li);
        });

        var head = document.createElement('div');
        head.className = 'toc-head';
        head.textContent = '本页目录';

        toc.innerHTML = '';
        toc.appendChild(head);
        toc.appendChild(ul);
        toc.hidden = false;
        toc.scrollTop = 0;

        tocLinks = $$('.toc-list a', toc);
        tocHeadings = heads;
        syncTOCActive();
    }

    function syncTOCActive() {
        if (!tocLinks.length || !tocHeadings.length) return;

        var level = function (i) { return +tocHeadings[i].tagName.charAt(1); };

        var offset = 110;   // 顶栏 64px + 一点余量
        var active = 0;
        for (var i = 0; i < tocHeadings.length; i++) {
            if (tocHeadings[i].getBoundingClientRect().top <= offset) active = i;
            else break;
        }

        // 当前所在的 H2 区间
        var h2Start = -1;
        for (var a1 = active; a1 >= 0; a1--) {
            if (level(a1) === 2) { h2Start = a1; break; }
        }
        if (h2Start === -1) h2Start = 0;

        var h2End = tocHeadings.length - 1;
        for (var b1 = h2Start + 1; b1 < tocHeadings.length; b1++) {
            if (level(b1) === 2) { h2End = b1 - 1; break; }
        }

        // 当前所在的 H3 区间（没有 H3 的页面留空）
        var h3Start = -1;
        var h3End = h2End;
        for (var a2 = active; a2 >= h2Start; a2--) {
            if (level(a2) === 3) { h3Start = a2; break; }
        }
        if (h3Start !== -1) {
            for (var b2 = h3Start + 1; b2 <= h2End; b2++) {
                if (level(b2) <= 3) { h3End = b2 - 1; break; }
            }
        }

        // 逐级展开：H2 常驻 → 当前 H2 的 H3 → 当前 H3 的 H4
        for (var n = 0; n < tocLinks.length; n++) {
            var lvl = level(n);
            var show = true;
            if (lvl === 3) show = (n >= h2Start && n <= h2End);
            if (lvl === 4) show = (h3Start !== -1 && n > h3Start && n <= h3End);

            tocLinks[n].parentNode.classList.toggle('is-open', show);
            tocLinks[n].classList.toggle('active', n === active);
        }

        keepTOCVisible(tocLinks[active]);
    }

    function keepTOCVisible(link) {
        if (!link || !tocEl) return;
        var box = tocEl.getBoundingClientRect();
        var r = link.getBoundingClientRect();
        var headH = 38;
        if (r.top < box.top + headH) {
            tocEl.scrollTop -= (box.top + headH - r.top) + 6;
        } else if (r.bottom > box.bottom - 8) {
            tocEl.scrollTop += (r.bottom - box.bottom) + 8;
        }
    }

    function bindTOCScrollSpy() {
        if (window.__tocSpyBound) return;
        window.__tocSpyBound = true;

        // 用 setTimeout 节流而不是 requestAnimationFrame：
        // 后台标签页 / 部分无头环境里 rAF 会被暂停，标志位卡住之后
        // 目录就再也不跟着滚动了。setTimeout 最差也只是慢一拍。
        var spyTimer = null;
        window.addEventListener('scroll', function () {
            if (spyTimer) return;
            spyTimer = setTimeout(function () {
                spyTimer = null;
                syncTOCActive();
            }, 60);
        }, { passive: true });

        // 窗口尺寸变化时标题位置会变，重新算一次
        window.addEventListener('resize', function () {
            if (spyTimer) return;
            spyTimer = setTimeout(function () {
                spyTimer = null;
                syncTOCActive();
            }, 120);
        }, { passive: true });
    }

    /* ==========================================================
     * 5b. 锚点定位
     *
     * 点右侧目录会跳到 #/xx?id=标题。docsify 自己也会滚，但它在
     * 重新渲染之前就滚完了，结果页面又回到顶部——所以这里补一次，
     * 顺便减去固定顶栏的高度，免得标题被压在红条底下。
     *
     * 只补一次是不够的：章节里的插图是懒加载的，图片撑开布局后
     * 目标标题会往下跑（02 章能差 1200px）。anchorSettle() 会在
     * 之后 1.6 秒内持续校正位置，用户一旦自己滚动就立刻放手。
     * ========================================================== */
    var ANCHOR_OFFSET = 84;
    var anchorTimer = null;

    function scrollToAnchor(id) {
        if (!id) return;

        var key = id;
        try { key = decodeURIComponent(id); } catch (e) { /* 保持原样 */ }

        var el = document.getElementById(id) || document.getElementById(key);

        // id 对不上时（不同版本的 slug 规则可能有出入），按标题文字兜底，
        // 这样搜索和目录跳转不会因为一个 id 生成差异就失效。
        if (!el) {
            var heads = $$('.markdown-section h1, .markdown-section h2, .markdown-section h3, .markdown-section h4');
            for (var i = 0; i < heads.length; i++) {
                if (heads[i].textContent.trim() === key) { el = heads[i]; break; }
            }
        }
        if (!el) return;

        var top = el.getBoundingClientRect().top + window.pageYOffset - ANCHOR_OFFSET;
        window.scrollTo(0, Math.max(0, top));
    }

    function anchorSettle(id) {
        if (!id) return;
        clearInterval(anchorTimer);

        // 地址栏里的 id 可能是百分号编码过的，先解开，
        // 否则 getElementById 找不到元素，校正会在第一帧就放弃
        var key = id;
        try { key = decodeURIComponent(id); } catch (e) { /* 保持原样 */ }

        var stopped = false;
        function stop() { stopped = true; }

        // 用户一动手就把控制权还给他，别跟人抢滚动条
        window.addEventListener('wheel', stop, { once: true, passive: true });
        window.addEventListener('touchmove', stop, { once: true, passive: true });

        function align() {
            var el = document.getElementById(id) || document.getElementById(key);
            if (!el) return false;
            if (Math.abs(el.getBoundingClientRect().top - ANCHOR_OFFSET) > 2) {
                scrollToAnchor(id);
            }
            return true;
        }

        align();
        var tries = 0;
        anchorTimer = setInterval(function () {
            if (stopped || ++tries > 16 || !align()) clearInterval(anchorTimer);
        }, 100);
    }

    /* ==========================================================
     * 6. 属性克制提示框（document 级委托，只绑一次）
     * ========================================================== */
    var tooltip = null;
    var activeItem = null;
    var hideTimer = null;

    function ensureTooltip() {
        if (tooltip) return tooltip;
        tooltip = document.createElement('div');
        tooltip.className = 'type-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
        return tooltip;
    }

    function typeKeyOf(el) {
        var types = window.POKE_TYPES || {};
        var list = el.classList;
        // 注意：class 里还有 "type-item"，必须挑出真正在数据表里的那个
        for (var i = 0; i < list.length; i++) {
            var cls = list[i];
            if (cls.indexOf('type-') !== 0) continue;
            var key = cls.slice(5);
            if (types[key]) return key;
        }
        return null;
    }

    function tags(list, extraClass) {
        if (!list || !list.length) return '<span class="tt-empty">无</span>';
        return list.map(function (t) {
            return '<span class="tt-tag' + (extraClass || '') + '">' + t + '</span>';
        }).join('');
    }

    // 标签后面跟一个淡淡的倍率，省得「克制」和「抗性」看串
    function ttLabel(text, mult) {
        return '<span class="tt-label">' + text + '<b>' + mult + '</b></span>';
    }

    // 上「进攻」下「防守」分开写：火既克制钢、又抗钢，
    // 混在一起列读者会以为是同一件事
    function typeTooltipHtml(key) {
        var d = window.POKE_TYPES[key];
        return '<div class="tt-title">⚔️ ' + d.zh + '</div>' +
            '<div class="tt-sec">进攻 · 打别人</div>' +
            '<div class="tt-row tt-strong">' + ttLabel('克制', '×2') +
                '<div class="tt-tags">' + tags(d.strong) + '</div></div>' +
            '<div class="tt-sec tt-sec-def">防守 · 被打</div>' +
            '<div class="tt-row tt-weak">' + ttLabel('弱点', '×2') +
                '<div class="tt-tags">' + tags(d.weak) + '</div></div>' +
            '<div class="tt-row tt-resist">' + ttLabel('抗性', '×1/2') +
                '<div class="tt-tags">' + tags(d.resist) + '</div></div>' +
            '<div class="tt-row tt-immunity">' + ttLabel('免疫', '×0') +
                '<div class="tt-tags">' + tags(d.immunity, ' immunity') + '</div></div>';
    }

    function showTooltip(item) {
        var key = typeKeyOf(item);
        if (!key) return hideTooltip();

        var tip = ensureTooltip();
        tip.innerHTML = typeTooltipHtml(key);

        tip.classList.add('visible');
        activeItem = item;

        var rect = item.getBoundingClientRect();
        var tw = tip.offsetWidth;
        var th = tip.offsetHeight;
        var left = rect.left + rect.width / 2 - tw / 2;
        var top = rect.bottom + 12;

        if (top + th > window.innerHeight - 8) top = rect.top - th - 12;
        if (top < 8) top = 8;
        if (left < 8) left = 8;
        if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;

        tip.style.left = left + 'px';
        tip.style.top = top + 'px';

        // 刚塞进 DOM 时宽度还没定稿（标签换行、字体加载都会改它），
        // 于是「右边界留 8px」可能算少，手机上会贴着屏幕边。下一帧再校一次。
        requestAnimationFrame(function () {
            if (activeItem !== item) return;
            var w = tip.offsetWidth;
            var h = tip.offsetHeight;
            var l = left;
            var t = top;
            if (l + w > window.innerWidth - 8) l = window.innerWidth - w - 8;
            if (l < 8) l = 8;
            if (t + h > window.innerHeight - 8) t = Math.max(8, rect.top - h - 12);
            tip.style.left = l + 'px';
            tip.style.top = t + 'px';
        });
    }

    function hideTooltip() {
        if (tooltip) tooltip.classList.remove('visible');
        activeItem = null;
    }

    function hideTooltipSoon() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hideTooltip, 120);
    }

    function cancelHide() {
        clearTimeout(hideTimer);
    }

    function bindTypeTooltip() {
        // 只执行一次
        if (window.__typeTooltipBound) return;
        window.__typeTooltipBound = true;

        document.addEventListener('mouseover', function (e) {
            var item = e.target.closest && e.target.closest('.type-item');
            if (!item) return;
            cancelHide();
            if (item === activeItem) return;   // 卡片内部移动不重复渲染
            showTooltip(item);
        });

        document.addEventListener('mouseout', function (e) {
            var item = e.target.closest && e.target.closest('.type-item');
            if (!item) return;
            var to = e.relatedTarget;
            if (to && to.closest && to.closest('.type-item') === item) return;
            hideTooltipSoon();
        });

        // 键盘：Tab 到属性卡也能看到说明
        document.addEventListener('focusin', function (e) {
            var item = e.target.closest && e.target.closest('.type-item');
            if (item) { cancelHide(); showTooltip(item); }
        });
        document.addEventListener('focusout', function (e) {
            if (e.target.closest && e.target.closest('.type-item')) hideTooltipSoon();
        });

        // 点击（触屏 / 鼠标）：点一次显示，再点收起
        document.addEventListener('click', function (e) {
            var item = e.target.closest && e.target.closest('.type-item');
            if (item) {
                if (activeItem === item) hideTooltip();
                else showTooltip(item);
                return;
            }
            if (e.target.closest && e.target.closest('.type-tooltip')) return;
            hideTooltip();
        });

        // 页面滚动后固定定位会错位，直接收起
        window.addEventListener('scroll', function () {
            if (activeItem) hideTooltip();
        }, { passive: true });
    }

    // 让属性卡可聚焦、可被读屏识别
    function decorateTypes() {
        $$('.type-item').forEach(function (el) {
            if (el.dataset.ready) return;
            el.dataset.ready = '1';
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            var zh = el.querySelector('.zh');
            el.setAttribute('aria-label', (zh ? zh.textContent.trim() : '') + '属性，查看克制关系');
        });
    }

    /* ==========================================================
     * 6.5 属性组合相克计算（typechart 页的 #typeDual）
     * ----------------------------------------------------------
     * 算的是「防御向」：对每一种进攻属性，把每个防守属性的倍率相乘。
     *   · 只要有一个防守属性免疫，结果直接 0，其它不用再看
     *   · 否则 2×2=4、2×0.5=1（中性，不列出）、0.5×0.5=0.25
     * 默认两格；打开「第三属性」开关才是三格——森林咒术（追加草）、
     * 万圣夜（追加幽灵）这类效果才会让宝可梦变成三属性。
     * 固定行输出，空的一行写「无」，切换属性时版面才不会上下跳；
     * 8× / 1/8× 只有三属性才可能出现，所以只在开关打开时出现。
     * ========================================================== */
    var DUAL_GROUPS = [
        { m: 8,     cls: 'is-x8',      mult: '8×',   name: '弱点', only3: true },
        { m: 4,     cls: 'is-x4',      mult: '4×',   name: '弱点' },
        { m: 2,     cls: 'is-x2',      mult: '2×',   name: '弱点' },
        { m: 0.5,   cls: 'is-half',    mult: '1/2×', name: '抗性' },
        { m: 0.25,  cls: 'is-quarter', mult: '1/4×', name: '抗性' },
        { m: 0.125, cls: 'is-eighth',  mult: '1/8×', name: '抗性', only3: true },
        { m: 0,     cls: 'is-zero',    mult: '0×',   name: '免疫' }
    ];

    var SLOT_HINT = ['属性一', '属性二', '属性三'];
    var SLOT_ARIA = ['第一个属性：', '第二个属性：', '第三个属性：'];

    function dualMultiplier(atkKey, defKeys, types) {
        var atkZh = types[atkKey].zh;
        var m = 1;
        for (var i = 0; i < defKeys.length; i++) {
            var def = types[defKeys[i]];
            if (!def) continue;
            if ((def.immunity || []).indexOf(atkZh) >= 0) return 0;
            if ((def.weak || []).indexOf(atkZh) >= 0) m *= 2;
            else if ((def.resist || []).indexOf(atkZh) >= 0) m *= 0.5;
        }
        return m;
    }

    function initTypeDual() {
        var box = $('#typeDual');
        if (!box || box.dataset.ready) return;
        box.dataset.ready = '1';

        var types = window.POKE_TYPES || {};
        if (!Object.keys(types).length) return;

        var slotEls = $$('.td-slot', box);
        var chipEls = $$('.td-chip', box);
        var resultEl = $('#tdResult', box);
        var swapEl = $('#tdSwap', box);
        var resetEl = $('#tdReset', box);
        var thirdEl = $('#tdThird', box);
        if (slotEls.length < 3 || !resultEl) return;

        var slots = [null, null, null];
        var thirdOn = false;
        var active = 0;              // 高亮的槽：填满后再点属性就替换它

        function nameOf(key) { return types[key] ? types[key].zh : ''; }
        function slotCount() { return thirdOn ? 3 : 2; }

        function renderSlots() {
            var n = slotCount();
            slotEls.forEach(function (el, i) {
                var key = slots[i];
                var off = i >= n;
                el.disabled = off;
                el.className = 'td-slot' +
                    (key ? ' type-' + key + ' is-filled' : '') +
                    (i === active && !off ? ' is-active' : '') +
                    (off ? ' is-off' : '');
                el.innerHTML = key
                    ? '<span class="td-slot-name">' + nameOf(key) + '</span>' +
                      '<span class="td-slot-x" aria-hidden="true">×</span>'
                    : '<span class="td-slot-hint">' + SLOT_HINT[i] + '</span>';
                el.setAttribute('aria-label', SLOT_ARIA[i] +
                    (off ? '未开启' : (key ? nameOf(key) + '，点击清除' : '未选择')));
            });

            if (swapEl) swapEl.disabled = !(slots[0] && slots[1]);
            if (resetEl) resetEl.disabled = !slots[0] && !slots[1] && !slots[2];

            chipEls.forEach(function (c) {
                var on = slots.slice(0, n).indexOf(c.getAttribute('data-type')) >= 0;
                c.classList[on ? 'add' : 'remove']('is-on');
                c.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        }

        function renderResult() {
            var n = slotCount();
            var picked = slots.slice(0, n).filter(Boolean);
            if (!picked.length) {
                resultEl.innerHTML = '<p class="td-idle">' +
                    (thirdOn ? '第三属性已打开，点属性依次填三个槽。'
                             : '还没选属性。先点一个（选两个就是双属性）。') +
                    '</p>';
                return;
            }

            // 8× / 1/8× 只有真的凑齐三个属性才可能出现，按 picked 判断而不是按开关状态
            var buckets = DUAL_GROUPS
                .filter(function (g) { return !g.only3 || picked.length === 3; })
                .map(function (g) { return { g: g, list: [] }; });

            Object.keys(types).forEach(function (atkKey) {
                var m = dualMultiplier(atkKey, picked, types);
                for (var i = 0; i < buckets.length; i++) {
                    if (buckets[i].g.m === m) { buckets[i].list.push(atkKey); return; }
                }
            });

            var countText = picked.length === 1 ? '单属性'
                : picked.length === 2 ? '双属性' : '三属性';

            resultEl.innerHTML =
                '<div class="td-head">' +
                    picked.map(function (k) {
                        return '<span class="td-pill type-' + k + '">' + nameOf(k) + '</span>';
                    }).join('<span class="td-plus">＋</span>') +
                    '<span class="td-head-note">' + countText + '</span>' +
                '</div>' +
                buckets.map(function (b) {
                    var chips = b.list.length
                        ? b.list.map(function (k) {
                            return '<span class="td-res-chip type-' + k + '">' + nameOf(k) + '</span>';
                        }).join('')
                        : '<span class="td-none">无</span>';
                    return '<div class="td-row ' + b.g.cls + '">' +
                        '<span class="td-mult"><b>' + b.g.mult + '</b>' + b.g.name + '</span>' +
                        '<span class="td-list">' + chips + '</span>' +
                    '</div>';
                }).join('');
        }

        function pick(key) {
            if (!types[key]) return;
            var n = slotCount();

            var dup = slots.indexOf(key);
            if (dup >= 0 && dup < n) {          // 已经选过 → 取消
                slots[dup] = null;
                active = dup;
            } else {
                var i = -1;
                for (var j = 0; j < n; j++) { if (!slots[j]) { i = j; break; } }
                if (i < 0) i = active < n ? active : 0;   // 满了 → 替换高亮那个
                slots[i] = key;
                active = (i + 1) % n;           // 光标挪到下一格，方便连点
            }
            renderSlots();
            renderResult();
        }

        if (thirdEl) {
            thirdEl.addEventListener('change', function () {
                thirdOn = thirdEl.checked;
                if (thirdOn) {
                    active = 2;                 // 开了就直接等第三个属性
                } else {
                    slots[2] = null;            // 关掉就把第三格清空
                    if (active === 2) active = 0;
                }
                renderSlots();
                renderResult();
            });
        }

        box.addEventListener('click', function (e) {
            var chip = e.target.closest('.td-chip');
            if (chip) { pick(chip.getAttribute('data-type')); return; }

            var slot = e.target.closest('.td-slot');
            if (slot) {
                var i = +slot.getAttribute('data-slot');
                if (i >= slotCount()) return;    // 第三格没开时点不到（button 已 disabled）
                if (slots[i]) slots[i] = null;   // 点已填的槽 = 清掉它
                active = i;
                renderSlots();
                renderResult();
                return;
            }

            if (e.target.closest('#tdSwap')) {
                var t = slots[0]; slots[0] = slots[1]; slots[1] = t;
                renderSlots();
                renderResult();
                return;
            }

            if (e.target.closest('#tdReset')) {
                slots = [null, null, null];
                active = 0;
                renderSlots();
                renderResult();
            }
        });

        renderSlots();
        renderResult();
    }

    /* ==========================================================
     * 6.6 队伍弱点补盲图（typechart 页的 #teamChart）
     * ----------------------------------------------------------
     * 最多 6 只，每只 1～2 个属性。按 18 种「进攻属性」统计队里
     * 有几只吃 ×2 / ×4：条子越长洞越大，深红那一段是 ×4 的。
     * 一只都不怕的属性单独列在最后——那才是已经补上的盲区。
     * ========================================================== */
    var TEAM_MAX = 6;
    var TEAM_ORDER = ['normal', 'bug', 'dark', 'dragon', 'electric', 'fairy',
        'fight', 'fire', 'flying', 'ghost', 'grass', 'ground', 'ice',
        'poison', 'psychic', 'rock', 'steel', 'water'];
    var CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];

    function initTeamChart() {
        var box = $('#teamChart');
        if (!box || box.dataset.ready) return;
        box.dataset.ready = '1';

        var types = window.POKE_TYPES || {};
        if (!Object.keys(types).length) return;

        var listEl = $('#tmList', box);
        var addEl = $('#tmAdd', box);
        var resultEl = $('#tmResult', box);
        if (!listEl || !resultEl) return;

        var team = [{ a: '', b: '' }];

        function optionsFor(cur) {
            return TEAM_ORDER.map(function (k) {
                return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' +
                    types[k].zh + '</option>';
            }).join('');
        }

        function selectHtml(i, slot, cur) {
            return '<select class="tm-type' + (cur ? ' is-set type-' + cur : '') + '"' +
                ' data-i="' + i + '" data-slot="' + slot + '"' +
                ' aria-label="第 ' + (i + 1) + ' 只的' + (slot === 0 ? '第一' : '第二') + '属性">' +
                '<option value="">' + (slot === 0 ? '选属性' : '（单属性）') + '</option>' +
                optionsFor(cur) +
            '</select>';
        }

        function renderRows() {
            listEl.innerHTML = team.map(function (m, i) {
                return '<div class="tm-row">' +
                    '<span class="tm-no">' + (i + 1) + '</span>' +
                    selectHtml(i, 0, m.a) +
                    selectHtml(i, 1, m.b) +
                    '<button class="tm-del" type="button" data-i="' + i + '"' +
                        ' aria-label="删掉第 ' + (i + 1) + ' 只">✕</button>' +
                '</div>';
            }).join('');

            if (addEl) {
                addEl.disabled = team.length >= TEAM_MAX;
                addEl.textContent = team.length >= TEAM_MAX
                    ? '最多 ' + TEAM_MAX + ' 只'
                    : '＋ 添加一只';
            }
        }

        function update() {
            var members = [];
            team.forEach(function (m, i) {
                if (m.a || m.b) members.push({ a: m.a, b: m.b, i: i });
            });
            var total = members.length;

            if (!total) {
                resultEl.innerHTML = '<p class="td-idle">先给一只宝可梦选属性。</p>';
                return;
            }

            var rows = TEAM_ORDER.map(function (atk) {
                var w2 = 0, w4 = 0, hits = [];
                members.forEach(function (m) {
                    var mult = dualMultiplier(atk, [m.a, m.b].filter(Boolean), types);
                    if (mult >= 4) { w4++; hits.push(m.i); }
                    else if (mult === 2) { w2++; hits.push(m.i); }
                });
                return { atk: atk, w2: w2, w4: w4, weak: w2 + w4, hits: hits };
            });

            // 4× 的比 2× 严重，排序时算双份
            var holes = rows.filter(function (r) { return r.weak > 0; })
                .sort(function (a, b) { return (b.w4 * 2 + b.w2) - (a.w4 * 2 + a.w2); });
            var safe = rows.filter(function (r) { return r.weak === 0; });

            var worst = holes.slice(0, 2).map(function (r) {
                return types[r.atk].zh + ' ' + r.weak + ' 只';
            }).join('、');

            resultEl.innerHTML =
                '<div class="tm-sum">' +
                    '<span>共 <b>' + total + '</b> 只</span>' +
                    (worst ? '<span>最怕 <b>' + worst + '</b></span>' : '') +
                '</div>' +
                holes.map(function (r) {
                    return '<div class="tm-bar-row">' +
                        '<span class="tm-chip type-' + r.atk + '">' + types[r.atk].zh + '</span>' +
                        '<span class="tm-bar">' +
                            '<i class="tm-seg is-w4" style="width:' + (r.w4 / total * 100) + '%"></i>' +
                            '<i class="tm-seg is-w2" style="width:' + (r.w2 / total * 100) + '%"></i>' +
                        '</span>' +
                        '<span class="tm-count">' + r.weak + '<small>/' + total + '</small></span>' +
                        '<span class="tm-hits">' +
                            r.hits.map(function (i) { return CIRCLED[i]; }).join('') +
                        '</span>' +
                    '</div>';
                }).join('') +
                (safe.length
                    ? '<div class="tm-safe">全队都不怕：' + safe.map(function (r) {
                        return '<span class="tm-chip type-' + r.atk + '">' + types[r.atk].zh + '</span>';
                    }).join('') + '</div>'
                    : '');
        }

        listEl.addEventListener('change', function (e) {
            var sel = e.target.closest('.tm-type');
            if (!sel) return;
            var i = +sel.getAttribute('data-i');
            if (!team[i]) return;
            if (+sel.getAttribute('data-slot') === 0) team[i].a = sel.value;
            else team[i].b = sel.value;
            sel.className = 'tm-type' + (sel.value ? ' is-set type-' + sel.value : '');
            update();
        });

        listEl.addEventListener('click', function (e) {
            var del = e.target.closest('.tm-del');
            if (!del) return;
            team.splice(+del.getAttribute('data-i'), 1);
            if (!team.length) team.push({ a: '', b: '' });   // 至少留一行
            renderRows();
            update();
        });

        if (addEl) {
            addEl.addEventListener('click', function () {
                if (team.length >= TEAM_MAX) return;
                team.push({ a: '', b: '' });
                renderRows();
                update();
            });
        }

        renderRows();
        update();
    }

    /* ==========================================================
     * 7. 全屏搜索
     *
     * 不用 docsify 自带的搜索插件：它只服务于侧栏那个小输入框，
     * 索引结构也是内部实现，改版就废。这里自己抓一遍 md，
     * 按标题切成小节建索引，缓存在 localStorage。
     * 中文不做分词——直接子串匹配，多个词之间是「与」的关系。
     * ========================================================== */
    var SEARCH_CACHE_KEY = 'poke-trpg-search-v4';
    var SEARCH_MISS_KEY = 'poke-trpg-search-miss-v1';
    var SEARCH_TTL = 60 * 60 * 1000;

    var searchIndex = null;
    var searchLoading = false;
    var searchActive = -1;

    // 和 docsify 生成标题 id 的规则保持一致，搜索结果的锚点才对得上
    function slugify(s) {
        return String(s || '').trim()
            .replace(/[^a-z0-9\u4e00-\u9fa5\-_ ]/gi, '')
            .replace(/\s+/g, '-')
            .toLowerCase();
    }

    function stripMd(s) {
        return String(s || '')
            .replace(/```[\s\S]*?```/g, ' ')
            .split('\n')
            // 表格分隔行（|:---|---:|）整行丢掉，否则摘要里会冒出一串 ":---"
            .filter(function (line) { return !/^[\s|:-]*-[\s|:-]*$/.test(line); })
            .join('\n')
            .replace(/^#{1,6}\s*/gm, '')                  // 残留的 #### 标题记号
            .replace(/^[\s>*+-]{1,3}(?=[^\s])/gm, '')     // 列表符号 / 引用符
            .replace(/\[![^\]]*\]/g, ' ')                 // callout 标记 [!tip] / [!gm]
            .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')        // 图片
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')      // 链接只留文字
            .replace(/<[^>]+>/g, ' ')                     // 行内 HTML
            .replace(/\{\{[^}]*\}\}/g, ' ')               // 属性圆点语法
            .replace(/\|/g, ' ')
            .replace(/^\s*>\s?/gm, '')                    // 引用符号
            .replace(/[*_`~]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseMarkdown(path, chapterTitle, text) {
        var out = [];
        var chapter = chapterTitle || '';
        var cur = null;
        var buf = [];
        var inFence = false;

        function flush() {
            if (!cur) { buf = []; return; }
            out.push({
                path: path,
                chapter: chapter,
                heading: cur.heading,
                id: cur.id,
                // 用换行拼接：stripMd 里要按行剔除表格分隔行、引用符号
                text: stripMd(buf.join('\n'))
            });
            buf = [];
        }

        text.split('\n').forEach(function (line) {
            var t = line.trim();
            if (/^```/.test(t)) { inFence = !inFence; return; }
            if (inFence) return;

            var m = /^(#{1,4})\s+(.+)$/.exec(t);
            if (m) {
                flush();
                var title = m[2].replace(/[*_`#]/g, '').trim();
                if (m[1].length === 1) chapter = title;
                cur = { heading: title, id: slugify(title) };
                return;
            }
            if (cur) buf.push(line);
        });
        flush();
        return out;
    }

    function loadCachedIndex() {
        try {
            var obj = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || 'null');
            if (!obj || !obj.t || Date.now() - obj.t > SEARCH_TTL) return null;
            return obj.items;
        } catch (e) { return null; }
    }

    function saveIndex(items) {
        try {
            localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ t: Date.now(), items: items }));
        } catch (e) { /* 配额满了就每次重抓，不影响使用 */ }
    }

    // 侧栏里有不少还没翻译的章节（文件还不存在）。第一次建索引会挨个 404，
    // 一小时缓存期内重复打开搜索又会再撞一遍。这里把「确实没有」的路径记下来，
    // 下次直接跳过，等文件上线、TTL 过期后自然会重新尝试。
    function loadMiss() {
        try {
            var obj = JSON.parse(localStorage.getItem(SEARCH_MISS_KEY) || 'null');
            if (!obj || Date.now() - obj.t > SEARCH_TTL) return {};
            return obj.m || {};
        } catch (e) { return {}; }
    }

    function saveMiss(miss) {
        try {
            localStorage.setItem(SEARCH_MISS_KEY, JSON.stringify({ t: Date.now(), m: miss }));
        } catch (e) { /* 忽略 */ }
    }

    function buildSearchIndex(done) {
        if (searchIndex) { if (done) done(); return; }

        var cached = loadCachedIndex();
        if (cached) { searchIndex = cached; if (done) done(); return; }
        if (searchLoading) {
            // 已经在建了：排队等它建完，别直接返回一个空索引
            if (done) {
                var wait = setInterval(function () {
                    if (!searchLoading) { clearInterval(wait); done(); }
                }, 120);
            }
            return;
        }
        searchLoading = true;

        var seen = {};
        var miss = loadMiss();
        var jobs = getSidebarLinks().filter(function (l) {
            if (!l.href || seen[l.href] || miss[l.href]) return false;
            // 「角色卡」这类 .html 页面不是 md，没必要去抓 .html.md 撞 404
            if (/\.html?$/i.test(l.href)) return false;
            seen[l.href] = 1;
            return true;
        });

        Promise.all(jobs.map(function (l) {
            return fetch(l.href + '.md', { cache: 'no-cache' })
                .then(function (r) {
                    if (!r.ok) { miss[l.href] = 1; return ''; }
                    return r.text();
                })
                .then(function (txt) { return txt ? parseMarkdown(l.href, l.text, txt) : []; })
                .catch(function () { return []; });
        })).then(function (groups) {
            var items = [];
            groups.forEach(function (g) { items = items.concat(g); });
            searchIndex = items;
            searchLoading = false;
            saveMiss(miss);
            // 空索引（断网 / 全 404）不写缓存，免得下次连试都不试
            if (items.length) saveIndex(items);
            if (done) done();
        });
    }

    function countOcc(hay, needle) {
        var n = 0, i = 0;
        while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
        return n;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function highlight(text, terms) {
        var html = escapeHtml(text);
        terms.forEach(function (t) {
            if (!t) return;
            var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            html = html.replace(re, '<mark>$1</mark>');
        });
        return html;
    }

    function makeSnippet(text, terms) {
        var lower = text.toLowerCase();
        var pos = -1;
        terms.forEach(function (t) {
            var p = lower.indexOf(t);
            if (p !== -1 && (pos === -1 || p < pos)) pos = p;
        });
        if (pos === -1) pos = 0;

        var start = Math.max(0, pos - 30);
        // 中文没有词边界，硬切容易把「社交属性」切成「…交属性」。
        // 优先从这句的开头显示；退一步，找最近的分句标点。
        if (start > 0) {
            var cut = -1;
            var hard = '。！？';
            var soft = '；，、';
            for (var i = pos - 1; i >= Math.max(0, pos - 60); i--) {
                if (hard.indexOf(text.charAt(i)) !== -1) { cut = i; break; }
            }
            if (cut === -1) {
                for (var j = pos - 1; j >= Math.max(0, pos - 24); j--) {
                    if (soft.indexOf(text.charAt(j)) !== -1) { cut = j; break; }
                }
            }
            if (cut !== -1) start = cut + 1;
        }
        start = Math.max(0, Math.min(start, pos));

        var end = Math.min(text.length, start + 108);
        return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    }

    function doSearch(terms) {
        var hits = [];
        (searchIndex || []).forEach(function (sec) {
            var hay = (sec.heading + ' ' + sec.text).toLowerCase();
            var score = 0;
            for (var i = 0; i < terms.length; i++) {
                var n = countOcc(hay, terms[i]);
                if (!n) return;                 // 有一个词没命中就跳过
                score += n;
            }
            var titleHay = sec.heading.toLowerCase();
            terms.forEach(function (t) {
                if (titleHay.indexOf(t) !== -1) score += 12;   // 标题命中加权
            });
            hits.push({ sec: sec, score: score });
        });
        hits.sort(function (a, b) { return b.score - a.score; });
        return hits.slice(0, 24);
    }

    function setSearchActive(i) {
        var body = $('#searchBody');
        if (!body) return;
        var items = $$('.search-item', body);
        if (!items.length) return;
        searchActive = (i + items.length) % items.length;
        items.forEach(function (el, idx) {
            el.classList.toggle('is-active', idx === searchActive);
        });
        var el = items[searchActive];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }

    // 空状态给几个可点的示例词，比干巴巴一句提示更容易上手
    var SEARCH_EXAMPLES = ['招式', '属性', '骰池', '特性', '异常状态', '经验值'];

    function emptyStateHTML() {
        return '<p class="search-hint">输入关键词，或直接点下面的例子</p>' +
            '<div class="search-suggests">' +
            SEARCH_EXAMPLES.map(function (w) {
                return '<button type="button" data-q="' + w + '">' + w + '</button>';
            }).join('') +
            '</div>';
    }

    function renderSearch(raw) {
        var body = $('#searchBody');
        if (!body) return;

        var terms = String(raw || '').toLowerCase().split(/\s+/).filter(Boolean);
        searchActive = -1;

        if (!terms.length) {
            body.innerHTML = emptyStateHTML();
            return;
        }
        if (searchLoading) {
            body.innerHTML = '<p class="search-hint">正在建立索引…</p>';
            return;
        }
        if (!searchIndex) {
            body.innerHTML = '<p class="search-hint">索引还没准备好，稍等一下。</p>';
            return;
        }

        var hits = doSearch(terms);
        if (!hits.length) {
            body.innerHTML = '<p class="search-hint">没有找到「' + escapeHtml(terms.join(' ')) +
                '」<br>换个说法试试，或者只搜两个字。</p>';
            return;
        }

        body.innerHTML = '<div class="search-meta">找到 <b>' + hits.length + '</b> 处匹配' +
            (hits.length === 24 ? ' · 结果较多，只列前 24 条' : '') + '</div>' +
            hits.map(function (h) {
                var sec = h.sec;
                return '<a class="search-item" href="#/' + sec.path + '?id=' + encodeURIComponent(sec.id) + '">' +
                    '<div class="si-top">' + escapeHtml(sec.chapter) + '</div>' +
                    '<div class="si-title">' + highlight(sec.heading, terms) + '</div>' +
                    '<div class="si-snippet">' + highlight(makeSnippet(sec.text, terms), terms) + '</div>' +
                    '</a>';
            }).join('');

        setSearchActive(0);
    }

    function openSearch() {
        var overlay = $('#searchOverlay');
        if (!overlay) return;

        overlay.hidden = false;
        document.body.classList.add('search-open');
        var fab = $('#dexFab');
        if (fab) fab.setAttribute('aria-expanded', 'true');

        var input = $('#searchInput');
        if (input) {
            input.value = '';
            input.focus();
        }

        var body = $('#searchBody');
        if (searchIndex) {
            renderSearch('');
        } else if (body) {
            // 首次唤起要抓一遍 md，给个明确的等待态，别让人对着空白框发呆
            body.innerHTML = '<p class="search-hint is-loading">正在准备搜索索引…</p>';
        }

        buildSearchIndex(function () {
            var cur = $('#searchInput');
            if (cur && cur.value.trim()) renderSearch(cur.value);
            else renderSearch('');
        });
    }

    function closeSearch() {
        var overlay = $('#searchOverlay');
        if (!overlay || overlay.hidden) return;
        overlay.hidden = true;
        document.body.classList.remove('search-open');
        var fab = $('#dexFab');
        if (fab) {
            fab.setAttribute('aria-expanded', 'false');
            fab.focus();
        }
    }

    function bindSearch() {
        var fab = $('#dexFab');
        var overlay = $('#searchOverlay');
        var input = $('#searchInput');
        var body = $('#searchBody');
        var closeBtn = $('#searchClose');
        if (!fab || !overlay || !input) return;

        fab.addEventListener('click', openSearch);
        if (closeBtn) closeBtn.addEventListener('click', closeSearch);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeSearch();      // 点遮罩关闭
        });

        var timer = null;
        input.addEventListener('input', function () {
            clearTimeout(timer);
            timer = setTimeout(function () { renderSearch(input.value); }, 90);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActive(searchActive + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchActive(searchActive - 1); }
            else if (e.key === 'Enter') {
                var items = body ? $$('.search-item', body) : [];
                var target = items[searchActive >= 0 ? searchActive : 0];
                if (target) { e.preventDefault(); target.click(); }
            }
        });

        if (body) {
            body.addEventListener('click', function (e) {
                // 空状态的示例词：点一下等于替用户输入
                var sug = e.target.closest('.search-suggests button');
                if (sug) {
                    if (input) {
                        input.value = sug.getAttribute('data-q');
                        input.focus();
                    }
                    renderSearch(input ? input.value : '');
                    return;
                }
                if (e.target.closest('.search-item')) closeSearch();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (!overlay.hidden) closeSearch();
                else if ($('.sidebar') && $('.sidebar').classList.contains('open')) closeSidebar();
            }
        });

        // 浮层是模态的，Tab 不该跑到后面的正文里去
        overlay.addEventListener('keydown', function (e) {
            if (e.key !== 'Tab') return;
            var items = $$('input, button, a[href]', overlay).filter(function (el) {
                return el.offsetWidth || el.offsetHeight || el.getClientRects().length;
            });
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    }

    /* ==========================================================
     * 7b. 侧栏顶部的搜索入口
     *
     * 原来这里是 docsify 搜索插件的输入框，但它只作用于侧栏，
     * 和右下角的全屏搜索是两套东西，输入体验也不一致。
     * 现在统一成一个「按下去唤起全屏搜索」的按钮，只保留一个搜索。
     * ========================================================== */
    function ensureSearchTrigger() {
        var sidebar = $('.sidebar');
        if (!sidebar || $('.sidebar-search-trigger', sidebar)) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sidebar-search-trigger';
        btn.setAttribute('aria-label', '搜索规则内容');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
            ' stroke-linecap="round" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
            '<span>搜索规则内容</span>';
        btn.addEventListener('click', openSearch);

        sidebar.insertBefore(btn, sidebar.firstChild);
    }

    /* ==========================================================
     * 8. 快速掷骰（快速参考页里的 #diceRoller）
     * ----------------------------------------------------------
     * 每掷一次除了显示，还会往 localStorage 记一条：
     *   { t: 时间戳, n: 骰池大小, d: [每颗点数], s: 成功数 }
     * 只存这台设备，不上传；最多留 DICE_LOG_MAX 条，新的在最前面。
     * 隐私模式 / 配额满时写入会失败，这里直接吞掉，掷骰本身照常。
     * ========================================================== */
    var DICE_LOG_KEY = 'poketrpg.dicelog.v1';
    var DICE_LOG_MAX = 100;

    function diceLogRead() {
        try {
            var arr = JSON.parse(localStorage.getItem(DICE_LOG_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function diceLogWrite(rows) {
        try {
            localStorage.setItem(DICE_LOG_KEY, JSON.stringify(rows.slice(0, DICE_LOG_MAX)));
        } catch (e) { /* 存不进去就算了 */ }
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    // 当天的记录只显示时分秒，往前翻的带上「几月几日」
    function fmtRollTime(ts) {
        var d = new Date(ts);
        var now = new Date();
        var hm = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
        var sameDay = d.getFullYear() === now.getFullYear() &&
                      d.getMonth() === now.getMonth() &&
                      d.getDate() === now.getDate();
        return sameDay ? hm : (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
    }

    function initDiceRoller() {
        var box = $('#diceRoller');
        if (!box || box.dataset.ready) return;
        box.dataset.ready = '1';

        var input = box.querySelector('#drCount');
        var output = box.querySelector('#drOutput');
        if (!input || !output) return;

        var logBox = box.querySelector('#drLog');
        var logList = box.querySelector('#drLogList');
        var logMeta = box.querySelector('#drLogMeta');
        var logClear = box.querySelector('#drLogClear');
        var clearTimer = null;

        function clamp(v) {
            v = parseInt(v, 10);
            if (isNaN(v)) v = 1;
            return Math.max(1, Math.min(30, v));
        }

        function resetClearBtn() {
            if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
            if (logClear) {
                logClear.textContent = '清空';
                logClear.classList.remove('is-armed');
            }
        }

        // 整块从 localStorage 重画。docsify 每次翻页都会重建正文，
        // 所以「恢复历史」和「刷新列表」是同一件事。
        function renderLog() {
            if (!logBox || !logList) return;
            resetClearBtn();

            var rows = diceLogRead();
            if (!rows.length) {
                logBox.hidden = true;
                logList.innerHTML = '';
                if (logMeta) logMeta.textContent = '';
                return;
            }

            logBox.hidden = false;
            if (logMeta) {
                logMeta.textContent = (rows.length >= DICE_LOG_MAX
                    ? '最近 ' + DICE_LOG_MAX + ' 次'
                    : '共 ' + rows.length + ' 次') + ' · 只存本机';
            }

            logList.innerHTML = rows.map(function (r, i) {
                var dice = (r.d || []).map(function (v) {
                    return '<span class="dr-log-die' + (v >= 4 ? ' is-success' : '') + '">' + v + '</span>';
                }).join('');
                return '<li class="dr-log-row">' +
                    '<span class="dr-log-time">' + fmtRollTime(r.t) + '</span>' +
                    '<span class="dr-log-dice">' + dice + '</span>' +
                    '<span class="dr-log-res"><b>' + r.s + '</b><span>／' + r.n + '</span></span>' +
                    '<button class="dr-log-del" type="button" data-i="' + i + '"' +
                        ' title="删掉这条" aria-label="删掉这条记录">×</button>' +
                    '</li>';
            }).join('');
        }

        function renderResult(rec) {
            output.innerHTML =
                '<div class="dr-dice">' + (rec.d || []).map(function (d) {
                    // data-n 给 CSS 换骰面用；数字仍然写在标签里，读屏能念出来
                    return '<span class="dr-die' + (d >= 4 ? ' is-success' : '') +
                        '" data-n="' + d + '" aria-label="' + d + ' 点">' + d + '</span>';
                }).join('') + '</div>' +
                '<div class="dr-summary">' +
                    '<span>成功</span><b>' + rec.s + '</b>' +
                    '<span class="dr-total">／ 共 ' + rec.n + ' 颗</span>' +
                    '<span class="dr-time">' + fmtRollTime(rec.t) + '</span>' +
                '</div>';
        }

        function roll() {
            var n = clamp(input.value);
            input.value = n;

            var dice = [];
            var success = 0;
            for (var i = 0; i < n; i++) {
                var v = 1 + Math.floor(Math.random() * 6);
                if (v >= 4) success++;
                dice.push(v);
            }

            var rec = { t: Date.now(), n: n, d: dice, s: success };
            renderResult(rec);
            diceLogWrite([rec].concat(diceLogRead()));
            renderLog();
        }

        box.addEventListener('click', function (e) {
            var step = e.target.closest('.dr-step');
            if (step) {
                input.value = clamp(+input.value + (+step.getAttribute('data-step')));
                return;
            }
            if (e.target.closest('#drRoll')) { roll(); return; }

            var del = e.target.closest('.dr-log-del');
            if (del) {
                var rows = diceLogRead();
                rows.splice(+del.getAttribute('data-i'), 1);
                diceLogWrite(rows);
                renderLog();
                return;
            }

            if (e.target.closest('#drLogClear')) {
                // 二次确认：三秒内再点一下才真清空，免得手滑清掉整场记录
                if (clearTimer) {
                    diceLogWrite([]);
                    renderLog();
                } else {
                    logClear.textContent = '再点一次确认';
                    logClear.classList.add('is-armed');
                    clearTimer = setTimeout(function () {
                        clearTimer = null;
                        if (logClear) {
                            logClear.textContent = '清空';
                            logClear.classList.remove('is-armed');
                        }
                    }, 3000);
                }
            }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); roll(); }
        });

        // 回到这一页：把历史贴回来，顺便把最后一次的结果放回输出区，
        // 免得记录里明明有、上面却写着「还没掷过」。
        renderLog();
        var lastRoll = diceLogRead()[0];
        if (lastRoll) {
            renderResult(lastRoll);
            input.value = clamp(lastRoll.n);
        }
    }

    /* ==========================================================
     * 9. "跳到正文"（docsify 接管了 hash，必须拦下默认跳转）
     * ========================================================== */
    function bindSkipLink() {
        var link = $('.skip-link');
        if (!link) return;
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var target = $('.content .markdown-section') || $('#main');
            if (!target) return;
            target.setAttribute('tabindex', '-1');
            target.focus();
        });
    }

    /* ==========================================================
     * 9.5 章节配色 + 页脚插画
     * ----------------------------------------------------------
     * 原书每一章都有一条自己的主色（引言灰、世界红、系统青、角色橙……），
     * 章头色带、小节方块、点状分隔线、表格表头全用这一个色。
     * 网页上通过给 <body> 挂 data-chapter="02" 来切换，
     * theme.css 里 body[data-chapter] 一组规则负责把 --ch-* 映射到 --ch。
     *
     * 章号直接从路由前两位取（02-system-explained → 02），
     * 新增章节不用改这里；速查页（dice / typechart / itemprice / icons）
     * 没有章号，清掉属性即可回落到默认的灰色。
     * ========================================================== */
    var CHAPTER_SCENES = {
        '00': 'scene-market',   // 引言：友好商店与宝可梦中心
        '01': 'scene-autumn',   // 世界：秋日林道
        '02': 'scene-forest',   // 系统：双大树下的宝可梦
        '03': 'scene-town'      // 角色创建：大木研究所
    };

    function applyChapterTheme(path) {
        var m = /^(\d{2})-/.exec(path || '');
        var no = m ? m[1] : '';

        if (no) document.body.setAttribute('data-chapter', no);
        else document.body.removeAttribute('data-chapter');

        var section = $('.content .markdown-section');
        if (!section) return;

        // 每次翻页都重建正文，先清掉上一页留下的插画
        var old = section.querySelector('.chapter-scene');
        if (old) old.parentNode.removeChild(old);

        var scene = CHAPTER_SCENES[no];
        if (!scene) return;

        var box = document.createElement('div');
        box.className = 'chapter-scene';
        box.setAttribute('aria-hidden', 'true');

        var img = document.createElement('img');
        img.src = 'assets/img/' + scene + '.webp';
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';

        box.appendChild(img);
        section.appendChild(box);
    }

    /* ==========================================================
     * 10. 外壳元素（面包屑 / 页脚，每次翻页重建）
     * ========================================================== */
    function ensureChrome() {
        var section = $('.content .markdown-section');
        if (!section) return;

        if (!$('#breadcrumb')) {
            var bc = document.createElement('nav');
            bc.className = 'custom-breadcrumb';
            bc.id = 'breadcrumb';
            bc.setAttribute('aria-label', '面包屑导航');
            bc.innerHTML = '<span class="bc-icon" aria-hidden="true">📖</span><span>加载中…</span>';
            section.insertBefore(bc, section.firstChild);
        }

        if (!$('#customNavFooter')) {
            var wrapper = document.createElement('div');
            wrapper.id = 'customNavFooter';
            wrapper.innerHTML =
                '<div class="custom-nav">' +
                    '<button id="navPrev" type="button" disabled aria-label="上一节">' + ARROW_LEFT + ' 上一节</button>' +
                    '<button id="navNext" type="button" disabled aria-label="下一节">下一节 ' + ARROW_RIGHT + '</button>' +
                '</div>' +
                '<div class="custom-footer"><p>宝可梦TRPG 规则书 · 翻译项目 · 仅供学习交流</p></div>';

            var anchor = section.nextSibling;
            if (anchor && anchor.parentNode) {
                anchor.parentNode.insertBefore(wrapper, anchor);
            } else if (section.parentNode) {
                section.parentNode.appendChild(wrapper);
            }
        }
    }

    /* ==========================================================
     * 11. docsify 配置（必须在 docsify.min.js 之前执行）
     * ========================================================== */
    var lastRoutePath = null;

    window.$docsify = {
        name: '宝可梦TRPG 规则书',
        loadSidebar: true,

        // 侧栏只放章节，页内标题交给右侧 TOC。
        // 之前是 3，导致展开一章会刷出几十条，还会让"上一节/下一节"错位。
        subMaxLevel: 0,

        sidebarCollapse: true,
        auto2top: true,
        relativePath: false,
        notFoundPage: 'not-found.md',
        cache: 60 * 60 * 1000,   // 1 小时（原来 30 天，内容更新后读者看不到）

        plugins: [
            function (hook, vm) {
                hook.doneEach(function () {
                    var path = normalizePath((vm && vm.route && vm.route.path) || '');
                    var anchor = (vm && vm.route && vm.route.query && vm.route.query.id) || '';

                    // 换了一章就回到顶部。docsify 自带的 auto2top 在这里会被
                    // 浏览器的滚动锚定抵消——翻页后会停在上一页的滚动位置，
                    // 于是看起来"跳到了新章节的中间"。带 ?id= 的锚点跳转不处理。
                    if (path !== lastRoutePath && !anchor) {
                        clearInterval(anchorTimer);   // 别让上一页的锚点校正把新页面拽回去
                        window.scrollTo(0, 0);
                        document.documentElement.scrollTop = 0;
                        document.body.scrollTop = 0;
                    }
                    lastRoutePath = path;

                    ensureChrome();
                    convertCallouts();
                    convertDots();
                    decorateTypes();
                    markSkillTables();
                    markAttrTables();
                    markBattleTables();
                    wrapRankSections();
                    wrapNatureCards();
                    wrapBattleCards();
                    wrapManeuverCards();
                    buildActTrackers();
                    wrapPanels();
                    tintRegions();
                    fitPortraitFigures();
                    updateBreadcrumbAndNav();
                    applyChapterTheme(path);
                    buildTOC(vm);
                    initDiceRoller();
                    initTypeDual();
                    initTeamChart();
                    if (isMobile()) closeSidebar();

                    // 带锚点：等这一帧的布局稳定后再定位，之后一段时间内持续校正
                    if (anchor) {
                        requestAnimationFrame(function () { anchorSettle(anchor); });
                    }
                });
            }
        ]
    };

    /* ==========================================================
     * 11.5 原书还原层（2026-10-29）
     * ----------------------------------------------------------
     * 下面这几个函数都不改正文，只给渲染出来的 DOM「挂类名 / 搬结构」，
     * 让 theme.css 能把它们画成原书里的样子：
     *
     *   markSkillTables()    |点数|效果| 的表 → 胶囊点数条
     *   wrapRankSections()   ### 新手级：2 → 一张等级卡
     *   tintRegions()        地区小节标题 → 染上世界地图上的地区色
     *   fitPortraitFigures() 竖版插图 → 收窄，别撑成巨幅海报
     *
     * 之所以放在 JS 而不是改 md：正文保持「能直接读」的干净写法，
     * 样式要调只改 CSS，不用回头动几十处标记。
     * ========================================================== */

    /* 社交能力五条的配色（原书 p.24 各一色） */
    var PIP_TONES = {
        '强壮': 'tough',
        '帅气': 'cool',
        '美丽': 'beauty',
        '可爱': 'cute',
        '聪明': 'clever'
    };

    function markSkillTables() {
        var root = $('.markdown-section');
        if (!root) return;

        $$('table', root).forEach(function (tb) {
            var th = tb.querySelector('thead th');
            if (!th) return;
            if (th.textContent.trim() !== '点数') return;
            if (tb.classList.contains('is-pip')) return;
            // 必须真的有点数圆点才转。速查台那张「点数 / 档位 / 参考」表
            // 首列也叫「点数」，但里面是数字不是 {{n}}，转了就变成一排空胶囊。
            if (!tb.querySelector('.attribute-dots')) return;

            tb.classList.add('is-pip');

            // 往上找最近的三级标题，认它是哪条社交能力
            var el = tb;
            while (el && el !== root) {
                if (/^H[34]$/.test(el.tagName)) {
                    var tone = PIP_TONES[el.textContent.trim()];
                    if (tone) tb.setAttribute('data-tone', tone);
                    break;
                }
                el = el.previousElementSibling || el.parentElement;
            }
        });
    }

    /* 八个等级的色带色 + 字色。色值取自《3.0系统详解》p.30–31 的卡片抬头。
       浅色带（入门/资深/专家/冠军）白字读不清，原书也换成深字，
       这里按 WCAG 对比度挑，不是随手写的。 */
    var RANKS = [
        { re: /^入门级/,  no: 1, ball: 'ch-00-intro',   color: '#a7a9ac', ink: '#2b2b2c' },
        { re: /^新手级/,  no: 2, ball: 'ball-poke',     color: '#da473f', ink: '#ffffff' },
        { re: /^正式级/,  no: 3, ball: 'ball-great',    color: '#289ac2', ink: '#ffffff' },
        { re: /^资深级/,  no: 4, ball: 'ball-ultra',    color: '#fbb040', ink: '#2b2b2c' },
        { re: /^专家级/,  no: 5, ball: 'ball-dusk',     color: '#6ec49b', ink: '#1e3b2c' },
        { re: /^精英级/,  no: 6, ball: 'ball-cherish',  color: '#8b5da7', ink: '#ffffff' },
        { re: /^大师级/,  no: 7, ball: 'ball-master',   color: '#414042', ink: '#ffffff' },
        { re: /^冠军级/,  no: 8, ball: 'ch-12-spirit',  color: '#29bdbc', ink: '#1c3b3a' }
    ];

    function rankOf(text) {
        for (var i = 0; i < RANKS.length; i++) {
            if (RANKS[i].re.test(text)) return RANKS[i];
        }
        return null;
    }

    function wrapRankSections() {
        var root = $('.markdown-section');
        if (!root) return;

        var heads = $$('h3', root).filter(function (h) {
            return rankOf(h.textContent.trim()) && !h.closest('.rank-card');
        });
        if (!heads.length) return;

        heads.forEach(function (h) {
            var rk = rankOf(h.textContent.trim());

            var card = document.createElement('section');
            card.className = 'rank-card';
            card.style.setProperty('--rk', rk.color);
            card.style.setProperty('--rk-ink', rk.ink);

            h.parentNode.insertBefore(card, h);

            // 把标题和它后面的兄弟节点一起搬进卡片，遇到下一个 h2/h3/h4 就停。
            // 一定要停在 h4：冠军级后面紧跟一个「宝可梦的等级无法超过其训练家」
            // 的四级标题，不停的话它和后面几段会被一起卷进卡片里。
            var node = h;
            while (node) {
                var next = node.nextElementSibling;
                card.appendChild(node);
                if (!next) break;
                if (/^H[234]$/.test(next.tagName)) break;
                node = next;
            }

            // 等级球做成真 <img> 而不是 ::after 的背景图：
            // 自定义属性里的 url() 会被解析成相对 theme.css 的路径，
            // 放到 <img> 上就没有这个坑。
            var ball = document.createElement('img');
            ball.className = 'rank-ball';
            ball.src = 'assets/img/' + rk.ball + '.webp';
            ball.alt = '';
            ball.width = 30;
            ball.height = 30;
            h.insertBefore(ball, h.firstChild);

            // 「入门级：1」→ 标题只留名字，数字挪到右上角的方块里
            var span = h.querySelector('.anchor span') || h.querySelector('span');
            if (span) span.textContent = span.textContent.replace(/[：:]\s*\d+\s*$/, '');

            var no = document.createElement('span');
            no.className = 'rank-no';
            no.textContent = rk.no;
            h.appendChild(no);
        });

        // 把连在一起的等级卡包进一个两列的网格
        var cards = $$('.markdown-section > .rank-card', root);
        if (!cards.length) return;

        var grid = document.createElement('div');
        grid.className = 'rank-grid';
        cards[0].parentNode.insertBefore(grid, cards[0]);
        cards.forEach(function (c) { grid.appendChild(c); });
    }

    /* 世界地图上九个地区的颜色，直接采自 assets/img/world-map.webp */
    var REGION_COLORS = {
        '关都': '#b0b250',
        '城都': '#795753',
        '丰缘': '#5b907e',
        '神奥': '#6e838c',
        '合众': '#aaaaa1',
        '卡洛斯': '#848567',
        '阿罗拉': '#e6ad5a',
        '伽勒尔': '#5c9dae',
        '帕底亚': '#b15751'
    };

    function tintRegions() {
        var root = $('.markdown-section');
        if (!root) return;

        $$('h3', root).forEach(function (h) {
            var name = h.textContent.trim().replace(/地区$/, '');
            var c = REGION_COLORS[name];
            if (!c) return;
            h.setAttribute('data-region', name);
            h.style.setProperty('--rc', c);
            // 字用压深一档的同色，浅色（阿罗拉那种橙）才读得清
            h.style.setProperty('--rc-deep', 'color-mix(in srgb, ' + c + ' 72%, #000)');
        });
    }

    /* 有些表中间那一列只放两三个字（属性、稀有、产地、场地），
       在 width:100% 下会被拉成最宽的一列。按**第二列的表头**认出来，
       挂上类名让 CSS 改成按内容收缩。 */
    var NARROW_BY_2ND = {
        '属性': 'is-attr',
        '稀有': 'is-berry',
        '产地': 'is-berry',
        '场地': 'is-berry',
        '价格': 'is-price',
        '售价': 'is-price'
    };

    function markAttrTables() {
        var root = $('.markdown-section');
        if (!root) return;
        $$('table', root).forEach(function (tb) {
            var ths = tb.querySelectorAll('thead th');
            if (ths.length < 2) return;   // 「道具 | 属性」是两列，不能要求三列
            var cls = NARROW_BY_2ND[ths[1].textContent.trim()];
            if (cls) tb.classList.add(cls);
        });
    }

    function fitPortraitFigures() {
        var root = $('.markdown-section');
        if (!root) return;

        $$('p > img', root).forEach(function (img) {
            if (img.classList.contains('ball-icon') || img.classList.contains('mv-icon') ||
                img.classList.contains('item-icon') || img.classList.contains('rank-icon') ||
                img.classList.contains('world-icon') || img.classList.contains('mv-icon-lg')) return;

            function apply() {
                if (!img.naturalWidth || !img.naturalHeight) return;
                if (img.naturalHeight / img.naturalWidth > 1.12) {
                    img.classList.add('is-portrait');
                }
            }
            if (img.complete) apply();
            else img.addEventListener('load', apply, { once: true });
        });
    }

    /* 「开团速查台」整页包成一块块面板。
       只在 H1 是「开团速查台」的页面上生效，别的章节不受影响。
       每个 H2 连同它后面的内容包成一张 .gm-panel，再塞进 .gm-screen 网格。 */
    function wrapPanels() {
        var root = $('.markdown-section');
        if (!root) return;

        var h1 = root.querySelector('h1');
        if (!h1 || h1.textContent.indexOf('开团速查台') === -1) return;
        if (root.querySelector('.gm-screen')) return;   // 已经包过就别再包一层

        var heads = $$('h2', root);
        if (!heads.length) return;

        var screen = document.createElement('div');
        screen.className = 'gm-screen';
        heads[0].parentNode.insertBefore(screen, heads[0]);

        heads.forEach(function (h) {
            // 先把「标题 + 后面的兄弟节点」收成一个数组，再一次性搬进面板。
            // 一边搬一边找 nextElementSibling 是不行的——节点一移走，链就断了。
            var nodes = [h];
            var node = h;
            while (true) {
                var next = node.nextElementSibling;
                if (!next || next.tagName === 'H2' || next.tagName === 'H1') break;
                nodes.push(next);
                node = next;
            }

            var panel = document.createElement('section');
            panel.className = 'gm-panel';
            nodes.forEach(function (n) { panel.appendChild(n); });
            screen.appendChild(panel);
        });
    }

    /* 「性格」一节在原书 p.44–47 是**两列卡片**：
       橙色名字条（名字居中）+ 深灰特质条（斜体白字）+ 正文。
       正文还是 `### 固执 Adamant` + 一段粗体特质 + 若干段落，
       这里按英文性格名认出来，包成卡片。 */
    var NATURES = [
        'Adamant', 'Bashful', 'Bold', 'Brave', 'Calm', 'Careful', 'Docile',
        'Gentle', 'Hardy', 'Hasty', 'Impish', 'Jolly', 'Lax', 'Lonely', 'Mild',
        'Modest', 'Naive', 'Naughty', 'Quiet', 'Quirky', 'Rash', 'Relaxed',
        'Sassy', 'Serious', 'Timid'
    ];

    /* 只有粗体、没有别的内容的段落 —— 用来认「特质」那一行 */
    function isBoldOnly(p) {
        if (!p || p.tagName !== 'P') return false;
        var kids = Array.prototype.filter.call(p.childNodes, function (n) {
            return n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim());
        });
        return kids.length === 1 && kids[0].tagName === 'STRONG';
    }

    function wrapNatureCards() {
        var root = $('.markdown-section');
        if (!root) return;
        if (root.querySelector('.nature-grid')) return;   // 已经包过

        var heads = $$('h3', root).filter(function (h) {
            var t = h.textContent.trim();
            var m = t.match(/\s([A-Za-z]+)\s*$/);
            return m && NATURES.indexOf(m[1]) >= 0 && !h.closest('.nature-card');
        });
        if (!heads.length) return;

        heads.forEach(function (h) {
            var m = h.textContent.trim().match(/^(.*?)\s+([A-Za-z]+)\s*$/);

            // 先把「标题后面的兄弟节点」收成数组，再动手搬。
            // 一旦把 h 挪进卡片，h.nextElementSibling 就断了，边搬边找会拿到 null。
            var nodes = [];
            var node = h;
            var seenTraits = false;
            while (true) {
                var next = node.nextElementSibling;
                if (!next) break;
                if (/^H[1-4]$/.test(next.tagName)) break;
                if (isBoldOnly(next)) {
                    // 第一段粗体是特质条；再遇到一段粗体就是收尾句，卡片到此为止
                    if (seenTraits) break;
                    seenTraits = true;
                }
                nodes.push(next);
                node = next;
            }

            var card = document.createElement('section');
            card.className = 'nature-card';
            h.parentNode.insertBefore(card, h);
            card.appendChild(h);

            // 名字拆成「中文 + 英文」，英文用小字排在后面
            var span = h.querySelector('.anchor span') || h.querySelector('span');
            if (span && m) {
                span.innerHTML = '<span class="nc-zh">' + m[1] +
                    '</span><span class="nc-en">' + m[2] + '</span>';
            }

            nodes.forEach(function (n) {
                if (isBoldOnly(n)) {
                    var bar = document.createElement('div');
                    bar.className = 'nc-traits';
                    bar.textContent = n.textContent.trim();
                    card.appendChild(bar);
                    n.parentNode.removeChild(n);
                } else {
                    card.appendChild(n);
                }
            });
        });

        var cards = $$('.markdown-section > .nature-card', root);
        if (!cards.length) return;
        var grid = document.createElement('div');
        grid.className = 'nature-grid';
        cards[0].parentNode.insertBefore(grid, cards[0]);
        cards.forEach(function (c) { grid.appendChild(c); });
    }

    /* ==========================================================
     * 11.7 第四章「宝可梦对战」的卡片（2026-10-29）
     * ----------------------------------------------------------
     * 原书这一章有三种彩色卡：异常状态（p.84–85）、天气（p.88–90）、
     * 环境挑战（p.90–91）。三者的骨架一样：
     *
     *     ### 名称
     *     *一行副题*          ← 状态卡的「固定型 / 恶化型 / 易变型」
     *     正文……
     *
     * 正文里写的是能直接读的普通段落，这里把它们搬进卡片、挂上类名。
     * 标题仍然是真标题，右侧目录和锚点不受影响。
     * 配色逐张从 PDF 采样，值写在下面三张表里，别凭感觉调。
     * ========================================================== */

    /* 异常状态（p.84–85） */
    var STATUS_TONES = {
        '1级灼伤': { c: '#f05a22', ink: '#fff' },
        '2级灼伤': { c: '#c5351b', ink: '#fff' },
        '3级灼伤': { c: '#9e1b0e', ink: '#fff' },
        '混乱': { c: '#00b27c', ink: '#fff' },
        '定身法': { c: '#282829', ink: '#fff' },
        '麻痹': { c: '#eddb00', ink: '#3a3300' },
        '畏缩': { c: '#555d69', ink: '#fff' },
        '冰冻': { c: '#87d1d1', ink: '#12403f' },
        '着迷': { c: '#f05a7d', ink: '#fff' },
        '中毒': { c: '#956597', ink: '#fff' },
        '剧毒': { c: '#774386', ink: '#fff' },
        '睡眠': { c: '#b4b68b', ink: '#33361f' }
    };

    /* 天气（p.88–90），图标沿用招式简介册 p.439 那套 wx-* */
    var WEATHER_TONES = {
        '大晴天': { c: '#5acbf5', ink: '#12455c', icon: 'sunny' },
        '下雨': { c: '#6aa2bb', ink: '#fff', icon: 'rain' },
        '沙暴': { c: '#9d9273', ink: '#fff', icon: 'sandstorm' },
        '下雪': { c: '#256290', ink: '#fff', icon: 'snow' },
        '冰雹': { c: '#71c5ee', ink: '#123b52', icon: 'hail' },
        '大日照': { c: '#f47c2e', ink: '#fff', icon: 'desolate' },
        '大雨': { c: '#03242b', ink: '#fff', icon: 'typhoon' },
        '乱流': { c: '#5acbf5', ink: '#12455c', icon: 'wind' }
    };

    /* 环境挑战（p.90–91） */
    var ENV_TONES = {
        '浓雾/黑暗': { c: '#282829', ink: '#fff' },
        '泥泞': { c: '#82504f', ink: '#fff' },
        '水下': { c: '#0074bb', ink: '#fff' },
        '烈焰熊熊！': { c: '#d05121', ink: '#fff' },
        '电气柱': { c: '#be9b19', ink: '#fff' },
        '花团锦簇': { c: '#f17bb0', ink: '#fff' },
        '下水道/垃圾堆': { c: '#8462a1', ink: '#fff' },
        '丛林深处': { c: '#68a34a', ink: '#fff' },
        '踩高跷': { c: '#7caec6', ink: '#1b3c4a' },
        '洒水器': { c: '#00addd', ink: '#fff' },
        '宝可梦墓地': { c: '#5e67af', ink: '#fff' },
        '雷区': { c: '#a67244', ink: '#fff' },
        '治愈伤口': { c: '#e45687', ink: '#fff' },
        '毁坏的世界': { c: '#4e4663', ink: '#fff' },
        '终点': { c: '#bc4dad', ink: '#fff' }
    };

    /* 「异常效果」「解决方案 & 持续时间」这类小标题带 */
    function isCardBand(el) {
        if (!el || el.tagName !== 'P') return false;
        var t = el.textContent.replace(/\s+/g, ' ').trim();
        return t === '异常效果' || t === '状态效果' ||
            t === '解决方案 & 持续时间' || t === '解决方案&持续时间';
    }

    /* 副题行：整段只有一个 <em> */
    function isEmOnly(el) {
        if (!el || el.tagName !== 'P') return false;
        if (el.children.length !== 1 || el.children[0].tagName !== 'EM') return false;
        return el.textContent.trim().length > 0;
    }

    function wrapOneCard(h, tones, cls, toneVar, inkVar) {
        var tone = tones[h.textContent.trim()];
        if (!tone) return null;

        var card = document.createElement('section');
        card.className = cls;
        card.style.setProperty(toneVar, tone.c);
        card.style.setProperty(inkVar, tone.ink || '#fff');

        h.parentNode.insertBefore(card, h);

        // 先把兄弟节点收成数组再搬——边搬边取 nextElementSibling 会拿到 null
        var nodes = [h];
        var node = h;
        while (true) {
            var next = node.nextElementSibling;
            if (!next) break;
            if (/^H[1-4]$/.test(next.tagName)) break;
            nodes.push(next);
            node = next;
        }
        nodes.forEach(function (n) { card.appendChild(n); });

        // 副题（第一段只有 <em> 的）→ .sc-type
        var typeEl = null;
        var kids = Array.prototype.slice.call(card.children);
        for (var i = 0; i < kids.length; i++) {
            if (isEmOnly(kids[i])) { typeEl = kids[i]; break; }
        }
        if (typeEl) typeEl.classList.add('sc-type');

        // 状态卡再多一段风味描述（副题后面那段普通段落）
        if (cls === 'status-card' && typeEl && typeEl.nextElementSibling &&
            typeEl.nextElementSibling.tagName === 'P') {
            typeEl.nextElementSibling.classList.add('sc-flavor');
        }
        // 天气卡的描述条同理
        if (cls === 'weather-card' && typeEl && typeEl.nextElementSibling &&
            typeEl.nextElementSibling.tagName === 'P') {
            typeEl.nextElementSibling.classList.add('wc-desc');
        }

        // 天气卡：抬头左边放一枚天气图标
        if (tone.icon) {
            var plate = document.createElement('span');
            plate.className = 'wc-ico';
            plate.innerHTML = '<poke-icon class="wx ' + tone.icon + '"></poke-icon>';
            h.insertBefore(plate, h.firstChild);
        }

        // 状态卡：把「异常效果 / 解决方案 & 持续时间」拆成色带 + 正文块
        if (cls === 'status-card') buildCardBlocks(card);

        return card;
    }

    function buildCardBlocks(card) {
        var anchor = card.querySelector('.sc-flavor') || card.querySelector('.sc-type') ||
            card.querySelector('h3');
        if (!anchor) return;

        var cur = anchor.nextElementSibling;
        while (cur) {
            if (isCardBand(cur)) {
                var block = document.createElement('div');
                block.className = 'sc-block';
                card.insertBefore(block, cur);

                var band = document.createElement('div');
                band.className = 'sc-band';
                band.textContent = cur.textContent.replace(/\s+/g, ' ').trim();
                block.appendChild(band);

                var body = document.createElement('div');
                body.className = 'sc-body';
                block.appendChild(body);

                cur.parentNode.removeChild(cur);

                var nx = block.nextElementSibling;
                while (nx && !isCardBand(nx)) {
                    var after = nx.nextElementSibling;
                    body.appendChild(nx);
                    nx = after;
                }
                cur = block.nextElementSibling;
            } else {
                cur = cur.nextElementSibling;
            }
        }
    }

    function wrapBattleCards() {
        var root = $('.markdown-section');
        if (!root) return;

        var groups = [
            { tones: STATUS_TONES, cls: 'status-card', grid: 'status-grid', v: '--sc', ink: '--sc-ink' },
            { tones: WEATHER_TONES, cls: 'weather-card', grid: null, v: '--wc', ink: '--wc-ink' },
            { tones: ENV_TONES, cls: 'env-card', grid: 'env-grid', v: '--ec', ink: '--ec-ink' }
        ];

        groups.forEach(function (g) {
            var heads = $$('h3', root).filter(function (h) {
                return g.tones[h.textContent.trim()] && !h.closest('.' + g.cls);
            });
            if (!heads.length) return;

            var made = [];
            heads.forEach(function (h) {
                var c = wrapOneCard(h, g.tones, g.cls, g.v, g.ink);
                if (c) made.push(c);
            });

            if (!g.grid || !made.length) return;
            var grid = document.createElement('div');
            grid.className = g.grid;
            made[0].parentNode.insertBefore(grid, made[0]);
            made.forEach(function (c) { grid.appendChild(c); });
        });

        wrapTipsPanel(root);
    }

    /* 「成功战斗10大要诀」：原书是一整块绿色面板，两栏编号条目。
       正文里标题下面紧跟一个 .tips-list，这里把两者包成一块面板。 */
    function wrapTipsPanel(root) {
        $$('h2', root).forEach(function (h) {
            if (h.textContent.trim().indexOf('成功战斗') !== 0) return;
            var list = h.nextElementSibling;
            if (!list || !list.classList.contains('tips-list')) return;
            if (h.closest('.tips-panel')) return;

            var panel = document.createElement('section');
            panel.className = 'tips-panel';
            h.parentNode.insertBefore(panel, h);
            panel.appendChild(h);
            panel.appendChild(list);
        });
    }

    /* 冲抵 & 闪避：原书 p.70 是左右两张绿卡。
       正文里仍是两个真 h3，这里把标题和后面的兄弟节点包成一张卡，
       再把两张卡塞进 .maneuver-grid。锚点和右侧目录照旧。 */
    function wrapManeuverCards() {
        var root = $('.markdown-section');
        if (!root) return;
        if (root.querySelector('.maneuver-grid')) return;

        var heads = $$('h3', root).filter(function (h) {
            var t = h.textContent.trim();
            return (t === '冲抵' || t === '闪避') && !h.closest('.maneuver-card');
        });
        if (heads.length !== 2) return;

        var cards = heads.map(function (h) {
            var card = document.createElement('section');
            card.className = 'maneuver-card';
            h.parentNode.insertBefore(card, h);

            var nodes = [h];
            var node = h;
            while (true) {
                var next = node.nextElementSibling;
                if (!next) break;
                if (/^H[1-4]$/.test(next.tagName)) break;
                if (next.classList && next.classList.contains('mn-end')) break;
                nodes.push(next);
                node = next;
            }
            nodes.forEach(function (n) { card.appendChild(n); });
            return card;
        });

        var grid = document.createElement('div');
        grid.className = 'maneuver-grid';
        cards[0].parentNode.insertBefore(grid, cards[0]);
        cards.forEach(function (c) { grid.appendChild(c); });
    }

    /* 动作条（原书 p.54 的 Actions Used）：
       <span class="act-tracker" data-n="1" data-label="伊布"></span>
       5 个格子，前 n 个填满。写 md 时只给数字，格子在这里生成。 */
    function buildActTrackers() {
        var root = $('.markdown-section');
        if (!root) return;
        $$('.act-tracker', root).forEach(function (el) {
            if (el.getAttribute('data-built')) return;
            var n = parseInt(el.getAttribute('data-n') || '0', 10);
            var label = el.getAttribute('data-label') || '';
            el.innerHTML = '';
            if (label) {
                var s = document.createElement('span');
                s.className = 'at-label';
                s.textContent = label;
                el.appendChild(s);
            }
            for (var i = 0; i < 5; i++) {
                var b = document.createElement('i');
                if (i < n) b.className = 'on';
                el.appendChild(b);
            }
            el.setAttribute('data-built', '1');
        });
    }

    /* 第四章的两张属性表：属性总表（2 列）和防御相克表（4 列）。
       表头第 1 格都是「属性」，靠列数区分，别靠表头文字。 */
    function markBattleTables() {
        var root = $('.markdown-section');
        if (!root) return;
        $$('table', root).forEach(function (tb) {
            var ths = tb.querySelectorAll('thead th');
            if (!ths.length) return;
            if (ths[0].textContent.trim() !== '属性') return;
            if (ths.length >= 4) tb.classList.add('is-typechart');
            else if (ths.length === 2) tb.classList.add('is-typeline');
        });
    }

    /* ==========================================================
     * 12. 图片放大（点击正文插图全屏看）
     * ----------------------------------------------------------
     * 用原生 <dialog>，不引任何第三方库：Esc 关闭、点背景关闭都是
     * 浏览器自带的行为。行内小图标（球、队徽）不参与——它们贴着字
     * 当装饰用，放大没有意义。
     * ========================================================== */
    var zoomDialog = null;

    function ensureZoomDialog() {
        if (zoomDialog) return zoomDialog;
        var dlg = document.createElement('dialog');
        dlg.className = 'img-zoom';

        var img = document.createElement('img');
        img.alt = '';
        dlg.appendChild(img);

        var tip = document.createElement('span');
        tip.className = 'img-zoom-tip';
        tip.textContent = '点击空白处或按 Esc 关闭';
        dlg.appendChild(tip);

        // 点背景关闭；点图片本身不关，方便对着细节看
        dlg.addEventListener('click', function (e) {
            if (e.target !== img) dlg.close();
        });

        document.body.appendChild(dlg);
        zoomDialog = dlg;
        return dlg;
    }

    function bindImageZoom() {
        document.addEventListener('click', function (e) {
            var img = e.target;
            if (!img || img.tagName !== 'IMG') return;
            if (!img.closest('.markdown-section')) return;          // 只管正文
            if (img.classList.contains('ball-icon')) return;        // 行内图标不算
            if (img.classList.contains('rank-icon')) return;        // 等级球同理
            if (img.classList.contains('item-icon')) return;
            if (img.classList.contains('world-icon')) return;
            if (img.classList.contains('mv-icon')) return;
            if (img.classList.contains('mv-icon-lg')) return;
            if (img.closest('a')) return;                           // 已经是链接的交给链接

            var dlg = ensureZoomDialog();
            var big = dlg.querySelector('img');
            big.src = img.currentSrc || img.src;
            big.alt = img.alt || '';
            e.preventDefault();
            if (dlg.showModal) dlg.showModal();
        });
    }

    /* ==========================================================
     * 13. 兼容与打印
     * ========================================================== */
    // 打印 / 导出 PDF 前展开所有折叠块，打印完再收回去
    var openedForPrint = [];
    function bindPrintExpand() {
        window.addEventListener('beforeprint', function () {
            openedForPrint = [];
            $$('details').forEach(function (d) {
                if (!d.open) {
                    d.open = true;
                    openedForPrint.push(d);
                }
            });
        });
        window.addEventListener('afterprint', function () {
            openedForPrint.forEach(function (d) { d.open = false; });
            openedForPrint = [];
        });
    }

    /* ==========================================================
     * 14. 启动
     * ========================================================== */
    function boot() {
        bindSkipLink();
        bindSidebar();
        bindTypeTooltip();
        bindSearch();
        bindPrintExpand();
        bindTOCScrollSpy();
        bindImageZoom();
        ensureTooltip();
        ensureTOC();

        // 侧栏是异步 fetch 的。以前用 setTimeout 轮询等它出现，
        // 网慢的时候 600ms 不够、网快的时候白等；这里改成等节点出现。
        if ($('.sidebar-nav')) {
            refreshChrome();
        } else {
            var obs = new MutationObserver(function () {
                if ($('.sidebar-nav')) {
                    obs.disconnect();
                    refreshChrome();
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }

    function refreshChrome() {
        ensureChrome();
        ensureSearchTrigger();
        updateBreadcrumbAndNav();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
