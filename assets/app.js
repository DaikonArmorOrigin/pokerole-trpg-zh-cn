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
 *   7  全屏搜索（图鉴按钮唤起）
 *   8  快速掷骰（快速参考页）
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
                summary.appendChild(badge);
                summary.appendChild(hint);
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
                    label.textContent = labelText;
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
            return {
                href: normalizePath(a.getAttribute('href')),
                text: a.textContent.trim(),
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
        var icon = group.icon || page.icon || '📄';

        var html = '<span class="bc-icon" aria-hidden="true">' + icon + '</span>';

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

    function showTooltip(item) {
        var key = typeKeyOf(item);
        if (!key) return hideTooltip();

        var data = window.POKE_TYPES[key];
        var tip = ensureTooltip();

        tip.innerHTML =
            '<div class="tt-title">⚔️ ' + data.zh + '</div>' +
            '<div class="tt-row tt-strong"><span class="tt-label">🟢 克制</span>' +
                '<div class="tt-tags">' + tags(data.strong) + '</div></div>' +
            '<div class="tt-row tt-weak"><span class="tt-label">🔴 弱点</span>' +
                '<div class="tt-tags">' + tags(data.weak) + '</div></div>' +
            '<div class="tt-row tt-immunity"><span class="tt-label">⚪ 免疫</span>' +
                '<div class="tt-tags">' + tags(data.immunity, ' immunity') + '</div></div>';

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
     * ========================================================== */
    function initDiceRoller() {
        var box = $('#diceRoller');
        if (!box || box.dataset.ready) return;
        box.dataset.ready = '1';

        var input = box.querySelector('#drCount');
        var output = box.querySelector('#drOutput');
        if (!input || !output) return;

        function clamp(v) {
            v = parseInt(v, 10);
            if (isNaN(v)) v = 1;
            return Math.max(1, Math.min(30, v));
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

            output.innerHTML =
                '<div class="dr-dice">' + dice.map(function (d) {
                    return '<span class="dr-die' + (d >= 4 ? ' is-success' : '') + '">' + d + '</span>';
                }).join('') + '</div>' +
                '<div class="dr-summary">' +
                    '<span>成功</span><b>' + success + '</b>' +
                    '<span class="dr-total">／ 共 ' + n + ' 颗</span>' +
                '</div>';
        }

        box.addEventListener('click', function (e) {
            var step = e.target.closest('.dr-step');
            if (step) {
                input.value = clamp(+input.value + (+step.getAttribute('data-step')));
                return;
            }
            if (e.target.closest('#drRoll')) roll();
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); roll(); }
        });
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
                    updateBreadcrumbAndNav();
                    buildTOC(vm);
                    initDiceRoller();
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
     * 12. 兼容与打印
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
     * 13. 启动
     * ========================================================== */
    function boot() {
        bindSkipLink();
        bindSidebar();
        bindTypeTooltip();
        bindSearch();
        bindPrintExpand();
        bindTOCScrollSpy();
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
