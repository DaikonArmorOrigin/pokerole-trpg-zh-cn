/* ============================================================
 * sheets.js — 角色卡交互
 *
 *  1  生成圆点 / 勾选框
 *  2  缩放适配
 *  3  选项卡与队伍槽位
 *  4  自动保存（localStorage）
 *  5  导出 PNG（foreignObject，无第三方库）
 * ============================================================ */
(function () {
    'use strict';

    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

    var STORE_KEY = 'poketrpg.sheets.v1';
    var card = 'tf';          // 当前卡面
    var slot = 0;             // 当前宝可梦槽位

    /* ==========================================================
     * 1. 圆点与勾选框
     * ========================================================== */
    function buildPips() {
        $$('.sheet .pips[data-pips]').forEach(function (box) {
            if (box.children.length) return;
            var max = parseInt(box.getAttribute('data-max'), 10) || 5;
            for (var i = 0; i < max; i++) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'pip';
                b.setAttribute('aria-label', (i + 1) + ' 点');
                box.appendChild(b);
            }
        });
    }

    // 点第 n 个 → 填满前 n 个；再点已填的那个 → 退回一格
    function onPipClick(e) {
        var pip = e.target.closest('.pip');
        if (!pip) return;
        e.preventDefault();
        var box = pip.parentNode;
        var pips = Array.prototype.slice.call(box.children);
        var idx = pips.indexOf(pip);
        var wasOn = pip.classList.contains('on');

        pips.forEach(function (p, i) {
            p.classList.toggle('on', i < (wasOn ? idx : idx + 1));
        });
        markDirty();
    }

    function buildChecks() {
        document.addEventListener('click', function (e) {
            var c = e.target.closest('.chk');
            if (!c) return;
            c.classList.toggle('on');
            c.setAttribute('aria-pressed', c.classList.contains('on') ? 'true' : 'false');
            markDirty();
        });
    }

    /* ==========================================================
     * 1b. 重复区块（队伍 6 格 / 招式 6 格）
     * ========================================================== */
    function buildTeam() {
        var grid = $('#teamGrid');
        if (!grid || grid.children.length) return;
        var html = '';
        for (var i = 0; i < 6; i++) {
            html +=
                '<div class="tslot">' +
                    '<div class="tname"><i>名字</i>' +
                        '<input type="text" data-f="team' + i + 'name" aria-label="宝可梦名字"></div>' +
                    '<div class="tava"></div>' +
                    '<div class="tfields">' +
                        '<label><i>等级</i><input type="text" data-f="team' + i + 'rank"></label>' +
                        '<label><i>道具</i><input type="text" data-f="team' + i + 'item"></label>' +
                        '<label><i>HP</i><input type="text" data-f="team' + i + 'hp"></label>' +
                    '</div>' +
                '</div>';
        }
        grid.innerHTML = html;
    }

    function buildMoves() {
        var grid = $('#movesGrid');
        if (!grid || grid.children.length) return;
        var fields = [
            ['type', '属性'], ['acc', '命中'], ['dmg', '伤害'], ['eff', '效果']
        ];
        var html = '';
        for (var i = 0; i < 6; i++) {
            var inner = fields.map(function (f) {
                return '<label>' + f[1] +
                    '<input type="text" data-f="mv' + i + f[0] + '"></label>';
            }).join('');
            var checks = [1, 2, 3].map(function (n) {
                return '<button class="chk" type="button" data-chk="mv' + i + 'c' + n +
                    '" aria-label="使用标记 ' + n + '"></button>';
            }).join('');
            html +=
                '<div class="move">' +
                    '<div class="mhead">' +
                        '<input class="mname" type="text" data-f="mv' + i + 'name" aria-label="招式名">' +
                        '<span class="pl">威力</span>' +
                        '<input class="pwr" type="text" data-f="mv' + i + 'pwr" aria-label="威力">' +
                    '</div>' +
                    '<div class="mbody">' +
                        '<div class="mfields">' + inner + '</div>' +
                        '<div class="mchecks">' + checks + '</div>' +
                    '</div>' +
                '</div>';
        }
        grid.innerHTML = html;
    }

    /* ==========================================================
     * 2. 缩放
     * ========================================================== */
    function fit() {
        var stage = $('#stage');
        if (!stage) return;
        var sheet = $('.sheet:not([hidden])');
        if (!sheet) return;

        var w = sheet.offsetWidth;
        var h = sheet.offsetHeight;
        if (!w) return;

        var avail = stage.clientWidth;
        // 桌面最多放到 1.62 倍，再大就糊了；窄屏按宽度铺满
        var k = Math.min(avail / w, 1.62);

        sheet.style.transform = 'scale(' + k + ')';
        stage.style.height = Math.ceil(h * k) + 'px';
    }

    /* ==========================================================
     * 3. 选项卡
     * ========================================================== */
    function showCard(name) {
        card = name;
        $$('.cs-tab[data-view]').forEach(function (t) {
            t.setAttribute('aria-selected', t.getAttribute('data-view') === name ? 'true' : 'false');
        });
        $$('.sheet').forEach(function (s) {
            s.hidden = s.getAttribute('data-card') !== name;
        });
        var isMon = name === 'pf' || name === 'pb';
        $('#slotBar').hidden = !isMon;
        fit();
        load();
    }

    /* ==========================================================
     * 4. 存取
     * ========================================================== */
    var saveTimer = null;

    function readAll() {
        var data = {};
        $$('.sheet').forEach(function (sh) {
            var key = sh.getAttribute('data-card');
            var obj = {};

            $$('[data-f]', sh).forEach(function (el) {
                obj[el.getAttribute('data-f')] =
                    el.isContentEditable ? el.textContent : el.value;
            });

            $$('[data-pips]', sh).forEach(function (box) {
                obj['_' + box.getAttribute('data-pips')] =
                    $$('.pip.on', box).length;
            });

            $$('[data-chk]', sh).forEach(function (c) {
                obj['_' + c.getAttribute('data-chk')] = c.classList.contains('on') ? 1 : 0;
            });

            data[key] = obj;
        });
        return data;
    }

    function markDirty() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 400);
    }

    function save() {
        try {
            var all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            all[card + (isMonCard() ? '@' + slot : '')] = readAll()[card];
            localStorage.setItem(STORE_KEY, JSON.stringify(all));
        } catch (e) { /* 存不下就算了 */ }
    }

    function isMonCard() {
        return card === 'pf' || card === 'pb';
    }

    function load() {
        var sh = $('.sheet[data-card="' + card + '"]');
        if (!sh) return;
        var all = {};
        try { all = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) {}

        var saved = all[card + (isMonCard() ? '@' + slot : '')] || {};

        $$('[data-f]', sh).forEach(function (el) {
            var k = el.getAttribute('data-f');
            var v = saved[k] != null ? saved[k] : '';
            if (el.isContentEditable) el.textContent = v;
            else el.value = v;
        });

        $$('[data-pips]', sh).forEach(function (box) {
            var n = saved['_' + box.getAttribute('data-pips')] || 0;
            $$('.pip', box).forEach(function (p, i) { p.classList.toggle('on', i < n); });
        });

        $$('[data-chk]', sh).forEach(function (c) {
            var on = !!saved['_' + c.getAttribute('data-chk')];
            c.classList.toggle('on', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    /* ==========================================================
     * 5. 导出 PNG
     * ========================================================== */
    function collectCSS() {
        var out = [];
        for (var i = 0; i < document.styleSheets.length; i++) {
            try {
                var rules = document.styleSheets[i].cssRules;
                for (var j = 0; j < rules.length; j++) out.push(rules[j].cssText);
            } catch (e) { /* 跨域跳过 */ }
        }
        return out.join('\n');
    }

    // 表单控件在 SVG 里不会显示值，导出前换成等价的静态文字。
    // 注意：computed style 必须从「还在文档里的原节点」读——
    // 克隆出来的是游离节点，getComputedStyle 在上面返回的全是空值。
    function freezeForms(clone, original) {
        // 按 data-f / data-chk 配对，不能按数组下标——
        // 前面几个节点被 replaceWith 换掉之后，下标就对不上了
        var keyOf = function (el) {
            return el.getAttribute('data-f') || el.getAttribute('data-chk') || '';
        };
        var byKey = {};
        $$('input, textarea, .chk', original).forEach(function (el) {
            var k = keyOf(el);
            if (k) byKey[k] = el;
        });
        var dsts = $$('input, textarea, .chk', clone);

        dsts.forEach(function (el) {
            var src = byKey[keyOf(el)];
            if (!src) return;
            var cs = getComputedStyle(src);

            if (el.classList && el.classList.contains('chk')) {
                // 勾选态就是整格涂黑（.chk.on），CSS 会跟着 <style> 一起进 foreignObject
                return;
            }

            var isArea = el.tagName === 'TEXTAREA';
            var txt = document.createElement(isArea ? 'div' : 'span');
            txt.textContent = src.value;

            var keys = ['fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'color',
                        'textAlign', 'letterSpacing', 'whiteSpace', 'width', 'height',
                        'padding', 'backgroundColor', 'backgroundImage', 'backgroundSize',
                        'backgroundRepeat', 'backgroundPosition', 'borderRadius', 'boxSizing',
                        'flexGrow', 'flexShrink', 'flexBasis'];
            // 不能用 flex 做垂直居中：foreignObject 里 flex 容器的匿名文本项会被丢掉，
            // 导出的图上就只剩一个空框。改用普通文本流 + line-height 贴顶。
            // position/z-index 必须带上：白条的斜切底是 ::before，
            // 替换出来的文本如果不提升层级，就会被那层白底盖掉
            // 【绝对定位的控件必须保留 absolute】否则 textarea 会掉回容器左上角，
            // 把同级的标题条整个盖住（备注框、背包框都踩过这个坑）
            var isAbs = cs.position === 'absolute';
            var style = 'display:block;overflow:visible;white-space:pre;' +
                (isAbs
                    ? 'position:absolute;left:' + cs.left + ';top:' + cs.top + ';right:auto;bottom:auto;'
                    : 'position:relative;z-index:2;');
            keys.forEach(function (k) {
                var v = cs[k];
                if (!v || v === 'auto' || v === 'none') return;
                style += k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ':' + v + ';';
            });
            txt.style.cssText = style;
            if (isArea) {
                txt.style.whiteSpace = 'pre-wrap';
            } else {
                var boxH = parseFloat(cs.height) || 15;
                var fs = parseFloat(cs.fontSize) || 8;
                var pad = Math.max(0, (boxH - fs * 1.35) / 2);
                // 高度交给 line-height 决定，不再固定 height：
                // 固定 height 时基线容易把字挤出可视区
                txt.style.height = 'auto';
                txt.style.paddingTop = pad.toFixed(1) + 'px';
                txt.style.paddingBottom = '0';
                txt.style.lineHeight = '1.35';
                // 空值时没有文字撑高，span 会塌成一条白线（额外技能栏踩过）
                // 用源输入框的计算高度兜底
                txt.style.minHeight = cs.height;
            }
            el.replaceWith(txt);
        });
    }

    function toCanvas(node, scale) {
        // 用 computed width/height 而不是 offsetWidth：
        // 画布是 550.5×386.8 这种小数，offsetWidth 会四舍五入，
        // 导出的图就和 PDF 差 0.5px，叠图时对不齐
        var ncs = getComputedStyle(node);
        var w = parseFloat(ncs.width) || node.offsetWidth;
        var h = parseFloat(ncs.height) || node.offsetHeight;

        var clone = node.cloneNode(true);
        clone.removeAttribute('hidden');
        clone.style.transform = 'none';
        clone.style.position = 'relative';
        clone.style.left = 'auto';
        clone.style.top = 'auto';
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        // 空的成就行会显示灰色占位提示，导出前摘掉，免得印到图片上
        $$('.aline-edit', clone).forEach(function (el) {
            if (!el.textContent.trim()) el.removeAttribute('data-placeholder');
        });
        freezeForms(clone, node);

        var cs = getComputedStyle(node);
        var holder = document.createElement('div');
        holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        // 必须带上 .cs-page：主题色变量和 box-sizing 都挂在这个类上，
        // 否则克隆出去之后 var(--ink) 全部失效、盒子按 content-box 计算，整张卡会散架
        holder.className = 'cs-page';
        holder.style.cssText =
            'width:' + w + 'px;height:' + h + 'px;' +
            'margin:0;padding:0;min-height:0;background:none;' +
            'font-family:' + cs.fontFamily + ';' +
            'color:' + cs.color + ';' +
            'font-size:' + cs.fontSize + ';line-height:' + cs.lineHeight + ';';
        holder.innerHTML = '<style>' + collectCSS() + '</style>';
        holder.appendChild(clone);
        // 注释节点里的 "--" 会让 XML 解析失败，整张图渲染不出来 —— 序列化前清掉
        (function stripComments(root) {
            var walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
            var kill = [], n;
            while ((n = walker.nextNode())) kill.push(n);
            kill.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); });
        })(holder);

        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"' +
            ' viewBox="0 0 ' + w + ' ' + h + '">' +
            '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
            new XMLSerializer().serializeToString(holder) +
            '</foreignObject></svg>';

        window.__lastSVG = svg;
        var img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

        return new Promise(function (resolve, reject) {
            img.onload = function () {
                var cv = document.createElement('canvas');
                cv.width = Math.round(w * scale);
                cv.height = Math.round(h * scale);
                var ctx = cv.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 0, 0, cv.width, cv.height);
                resolve(cv);
            };
            img.onerror = function () { reject(new Error('图片渲染失败')); };
        });
    }

    var NAMES = { tf: '训练家-正面', tb: '训练家-背面', pf: '宝可梦-正面', pb: '宝可梦-背面' };

    function exportPNG() {
        var sh = $('.sheet[data-card="' + card + '"]');
        if (!sh) return;
        var btn = $('#btnExport');
        btn.disabled = true;
        btn.textContent = '正在生成…';

        toCanvas(sh, 3).then(function (cv) {
            cv.toBlob(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                var suffix = isMonCard() ? '-' + (slot + 1) : '';
                a.href = url;
                a.download = NAMES[card] + suffix + '.png';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                btn.disabled = false;
                btn.textContent = '保存为图片';
            }, 'image/png');
        }).catch(function (e) {
            btn.disabled = false;
            btn.textContent = '保存为图片';
            alert('导出失败：' + e.message);
        });
    }

    /* ==========================================================
     * 启动
     * ========================================================== */
    document.addEventListener('DOMContentLoaded', function () {
        buildTeam();
        buildMoves();
        buildPips();
        buildChecks();

        document.addEventListener('click', onPipClick);

        $$('.cs-tab[data-view]').forEach(function (t) {
            t.addEventListener('click', function () {
                save();
                showCard(t.getAttribute('data-view'));
            });
        });

        $$('.cs-slot').forEach(function (b) {
            b.addEventListener('click', function () {
                save();
                slot = parseInt(b.getAttribute('data-slot'), 10);
                $$('.cs-slot').forEach(function (x) {
                    x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
                });
                load();
            });
        });

        document.addEventListener('input', function (e) {
            if (e.target.closest('.sheet')) markDirty();
        });

        $('#btnExport').addEventListener('click', exportPNG);

        window.addEventListener('resize', fit);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(fit);
        }
        fit();
        load();
    });
    // 调试用：控制台里可以 __sheetToCanvas(document.querySelector('.sheet'), 3)
    window.__sheetToCanvas = toCanvas;
})();
