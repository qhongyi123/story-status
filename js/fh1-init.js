/* =====================================================================
 * FH1 · 本子世界（自由模式）界面逻辑
 * ---------------------------------------------------------------------
 * 前置条件
 *   1. index.html 引入顺序：core → presets → app → fc1-init → rules-presets → fh1-init → story-loader
 *   2. 预置数据：data/fh1-presets/worldviews.json（世界观）
 *                js/rules-presets.js（特殊规则清单）
 *      两份都由 工具\生成世界观预置.ps1 从 状态栏\content\本子世界\ 生成，勿手改
 *   3. 界面骨架由 story-loader.js 按 STORY_MANIFEST 的 headers 生成（四页）：
 *        FH1-sub1「世界观概览」 → 介绍 + 「进入本子世界」（HTML 在 story-loader）
 *        FH1-sub2「世界观」     → 卡片列表 → 点选后展开（可开编辑模式改／删）
 *        FH1-sub3「特殊规则」   → 规则卡：勾选 / 选模式 / 填常识（只改草稿）
 *        FH1-sub4「开局选择」   → 开局卡片 → 点「开始剧情」发送正文＋变量
 *
 * 关键规则
 *   · 编辑结果先落进内存草稿 FH1_DRAFT，**只有点「启用并继续」才写世界书**
 *   · 写入内容＝按骨架重新拼装的整套文本（含玩家的编辑与删除），写入世界书 uid 54
 *   · 特殊规则同理：只改草稿 FH1_RULES，点「开始剧情」时才 ①把所选规则的指导写进 uid 5
 *     ②把 rules 变量随开局消息一起投递（前端还没开局，没有变量树可写）
 *   · 点「隐藏」→ 右侧书签（以及本页两个侧边按钮）全隐藏，切换选项卡后恢复
 * ===================================================================== */

var FH1_PRESETS = null;        // worldviews.json 内容
var FH1_SELECTED = '';         // 当前选中的世界观名
var FH1_WORLDVIEW_UID = 54;    // 本子世界「世界观设定」条目 uid
var FH1_ECOLOGY_UID = 69;      // 本子世界「社会生态」条目 uid（与世界观同一次写入）
var FH1_VARRULES_UID = 28;     // 本子世界「自由-变量规则」条目 uid（跟着世界观一起切换）
var FH1_DRAFT = null;          // 当前世界观的可编辑草稿（含玩家的改与删）
var FH1_EDITING = false;       // 编辑模式开关状态
var FH1_SUBTAB = '';           // 当前 FH1 子页 id（如 FH1-sub2）
var FH1_AP_SEG = '';           // 附录抽屉当前对应的段落（世界风格 / 社会与法治 / 民俗风情 / 背景设定 / 社会生态 / 时代锚点）
var FH1_APPLIED = false;       // 是否已启用过世界观：启用过后再进「特殊规则」就不再叫玩家回去选
var FH1_ECO_BLOCK = 0;         // 社会生态当前显示第几块（选中谁显示谁）
var FH1_BG_GROUP = 0;          // 背景设定当前显示第几个小标题（选中谁显示谁）
var FH1_FOCUS_LAST = '';       // 形如 "bg:2"：重画后把光标停在该组最后一条上
var FH1_SUB_SCROLL = { bg: 0, eco: 0 };   // 小标题带的横向位置：重画后要还原，否则每次都跳回开头
var FH1_START_OPEN = '';       // 开局页当前展开：'' | 'custom' | 'preset:<序号>'
var FH1_START_CUSTOM_TEXT = '';// 自定义开局正文（重画不丢）

// 特殊规则（跨世界观通用）：草稿 ＋ 界面状态
var FH1_RULES = {};            // { 规则名: { 模式?: '...', '常识文本': {} } }，与写入 variables 的结构一致
var FH1_RULES_OPEN = {};       // 哪几张规则卡被展开（重画后保留）
var FH1_RULES_UID = 5;         // 「内化协议（本子世界）」条目 uid：开局把所选规则的指导写进去
var FH1_INNER_TAG = '世界观内化协议细节指导';

// 平铺段落：条目直接挂在标题下，标题右侧挂「＋ 添加」
var FH1_FLAT_SEGS = ['时代锚点', '世界风格', '社会与法治', '民俗风情'];
// 分组段落：大标题 → 小标题 → 子项。「＋ 添加」挂在大标题上；自定义要填「小标题 ＋ 子项」
var FH1_GROUP_SEGS = ['背景设定', '社会生态'];

function fh1IsGroupSeg(key) { return FH1_GROUP_SEGS.indexOf(key) !== -1; }

/* ------------------------------ 小工具 ------------------------------ */

function fh1Esc(s) {
    return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fh1DeepCopy(o) { return JSON.parse(JSON.stringify(o)); }

function fh1GetPreset(name) {
    if (!FH1_PRESETS || !FH1_PRESETS.worldviews) return null;
    return FH1_PRESETS.worldviews[name] || null;
}

function fh1CountItems(preset) {
    if (!preset) return 0;
    var n = 0;
    (preset.segments || []).forEach(function (s) { n += (s.items || []).length; });
    (preset.background || []).forEach(function (g) { n += (g.items || []).length; });
    return n;
}

// 显示用：去掉条目开头的「- 」
function fh1ItemText(line) {
    return String(line === undefined || line === null ? '' : line).replace(/^-\s*/, '');
}

// 写回草稿用：保证条目以「- 」开头
function fh1NormItem(t) {
    var s = String(t === undefined || t === null ? '' : t).trim();
    return s.charAt(0) === '-' ? s : '- ' + s;
}

function fh1IsBlankItem(t) {
    return String(t === undefined || t === null ? '' : t).replace(/^-\s*/, '').trim() === '';
}

// 段落标题右侧的「＋ 添加」按钮（哪怕这一段没有附录，抽屉里也有「自定义」可用）
function fh1PlusBtn(key) {
    return '<button class="fh1-seg-plus" title="打开附录：可勾选现成条目，也可新建小标题／自定义添加" ' +
        'onclick="fh1OpenAppendix(this.getAttribute(\'data-seg\'))" data-seg="' + fh1Esc(key) + '">\uFF0B 添加</button>';
}

// 编辑模式下：小标题条下方的操作行（给当前小标题加子项 / 删去本标题及子项）
function fh1SubActions(kind, idx, count) {
    if (!FH1_EDITING) return '';
    return '<div class="fh1-sub-actions">' +
        '<button class="fh1-sub-add" onclick="fh1AddSubItemIdx(\'' + kind + '\',' + idx + ')" title="给这个小标题加一条子项">\uFF0B 子项</button>' +
        '<button class="fh1-sub-del" onclick="fh1DeleteGroup(\'' + kind + '\',' + idx + ')" title="删去这个小标题及它下面的全部子项">\u2715 删去本标题及子项' +
            (count ? '（' + count + '）' : '') + '</button>' +
    '</div>';
}

// 小标题条：左右箭头 + 可拖动 + 不换行（每次只露出部分，滑动看别的）
function fh1SubStrip(kind, titles, sel) {
    var chips = titles.map(function (t, i) {
        return '<span class="fh1-sub-chip' + (i === sel ? ' active' : '') + '" ' +
            'onclick="fh1SelectSub(\'' + kind + '\',' + i + ')">' + fh1Esc(t) + '</span>';
    }).join('');
    return '<div class="fh1-sub-strip" data-kind="' + kind + '">' +
        '<span class="fh1-sub-arrow" onclick="fh1SubScroll(this,-1)" title="向左看">\u2039</span>' +
        '<div class="fh1-sub-track">' + chips + '</div>' +
        '<span class="fh1-sub-arrow" onclick="fh1SubScroll(this,1)" title="向右看">\u203A</span>' +
    '</div>';
}

// 点箭头：把标题带横向滚动一段
window.fh1SubScroll = function (el, dir) {
    var strip = el && el.parentElement;
    var track = strip ? strip.querySelector('.fh1-sub-track') : null;
    if (!track) return;
    track.scrollLeft += dir * 140;
};

// 点某个小标题：选中它（先存回当前小标题里的改动）
window.fh1SelectSub = function (kind, i) {
    if (!FH1_DRAFT) return;
    fh1SyncDraftFromDOM();
    if (kind === 'bg') { FH1_BG_GROUP = i | 0; } else { FH1_ECO_BLOCK = i | 0; }
    fh1RenderOpenCard();
};

// 删去某个小标题及它下面的全部子项
window.fh1DeleteGroup = async function (kind, idx) {
    if (!FH1_DRAFT) return;
    fh1SyncDraftFromDOM();
    var arr = (kind === 'bg')
        ? FH1_DRAFT.background
        : (FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks);
    if (!arr || !arr[idx]) return;
    var g = arr[idx];
    var title = g.title || g.label || '（未命名）';
    var n = (g.items || []).length;
    var ok = await showCustomConfirm('删去小标题「' + title + '」及它下面的 ' + n + ' 条子项？');
    if (!ok) return;
    arr.splice(idx, 1);
    if (kind === 'bg') { FH1_BG_GROUP = 0; } else { FH1_ECO_BLOCK = 0; }
    fh1RenderOpenCard();
};

// 标题带支持鼠标拖动滑动（拖动后不触发 chip 的选中）
function fh1BindSubTracks(box) {    box.querySelectorAll('.fh1-sub-track').forEach(function (track) {
        if (track.getAttribute('data-dragbound')) return;
        track.setAttribute('data-dragbound', '1');
        var down = false, startX = 0, startLeft = 0, moved = false;
        track.addEventListener('mousedown', function (e) {
            down = true; moved = false;
            startX = e.clientX; startLeft = track.scrollLeft;
            track.classList.add('grabbing');
        });
        track.addEventListener('mousemove', function (e) {
            if (!down) return;
            var dx = e.clientX - startX;
            if (Math.abs(dx) > 3) { moved = true; track.scrollLeft = startLeft - dx; e.preventDefault(); }
        });
        var stop = function () { down = false; track.classList.remove('grabbing'); };
        track.addEventListener('mouseup', stop);
        track.addEventListener('mouseleave', stop);
        track.addEventListener('click', function (e) {
            if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
        }, true);
    });
}

// 重画前：记住每条标题带滚到哪儿了
function fh1CaptureSubScroll(box) {
    box.querySelectorAll('.fh1-sub-strip').forEach(function (strip) {
        var k = strip.getAttribute('data-kind');
        var track = strip.querySelector('.fh1-sub-track');
        if (k && track) FH1_SUB_SCROLL[k] = track.scrollLeft;
    });
}

// 重画后：还原横向位置；若选中的标题被挤出可视区，把它滚回来（这样连点后面的标题不用每次重新翻）
function fh1RestoreSubScroll(box) {
    box.querySelectorAll('.fh1-sub-strip').forEach(function (strip) {
        var k = strip.getAttribute('data-kind');
        var track = strip.querySelector('.fh1-sub-track');
        if (!k || !track) return;
        if (FH1_SUB_SCROLL[k]) track.scrollLeft = FH1_SUB_SCROLL[k];
        var chip = track.querySelector('.fh1-sub-chip.active');
        if (!chip) return;
        var l = chip.offsetLeft, r = l + chip.offsetWidth;
        if (l < track.scrollLeft) track.scrollLeft = Math.max(0, l - 6);
        else if (r > track.scrollLeft + track.clientWidth) track.scrollLeft = r - track.clientWidth + 6;
    });
}

// 按小标题找一个分组容器（找不到返回 null）
function fh1FindGroup(d, segKey, title) {
    if (!d) return null;
    var hit = null;
    if (segKey === '背景设定') {
        (d.background || []).forEach(function (x) { if (x.title === title) hit = x; });
    } else if (segKey === '社会生态') {
        ((d.ecology && d.ecology.blocks) || []).forEach(function (x) { if ((x.title || x.label) === title) hit = x; });
    } else {
        (d.segments || []).forEach(function (s) { if (s.key === segKey) hit = s; });
    }
    return hit;
}

// 找到（没有就新建）分组容器：
//   背景设定 → draft.background[]      社会生态 → draft.ecology.blocks[]（label 按【世界观名-小标题】补全）
//   平铺段落 → 直接命中该段落本身（整段算一组）
function fh1EnsureGroup(d, segKey, title) {
    var g = fh1FindGroup(d, segKey, title);
    if (g || !d) return g;
    if (segKey === '背景设定') {
        d.background = d.background || [];
        g = { title: title, items: [] };
        d.background.push(g);
        return g;
    }
    if (segKey === '社会生态') {
        d.ecology = d.ecology || { blocks: [] };
        d.ecology.blocks = d.ecology.blocks || [];
        g = { label: String(d.name || '') + '-' + title, title: title, items: [] };
        d.ecology.blocks.push(g);
        return g;
    }
    return null;
}

// 在「本窗口 → 父窗口 → 顶层窗口」里找可用的世界书接口
function fh1WorldbookHost() {
    var cands = [];
    try { cands.push(window); } catch (e) {}
    try { if (window.parent && window.parent !== window) cands.push(window.parent); } catch (e) {}
    try { if (window.top && cands.indexOf(window.top) === -1) cands.push(window.top); } catch (e) {}
    for (var i = 0; i < cands.length; i++) {
        var w = cands[i];
        if (!w) continue;
        try {
            if (w.TavernHelper) return w.TavernHelper;
            if (typeof w.updateWorldbookWith === 'function') return w;
            if (typeof w.setLorebookEntries === 'function') return w;
        } catch (e) {}
    }
    return null;
}

// 定位要写的世界书名：优先角色卡绑定的 primary，退回 LOREBOOK_NAME
function fh1WorldbookName(host) {
    try {
        if (host && typeof host.getCharWorldbookNames === 'function') {
            var c = host.getCharWorldbookNames('current');
            if (c && c.primary) return c.primary;
        }
    } catch (e) {}
    try {
        if (typeof LOREBOOK_NAME !== 'undefined' && LOREBOOK_NAME) return LOREBOOK_NAME;
    } catch (e) {}
    return '千叶的睡前小故事';
}

// 写单条世界书条目（只改 content，不碰其它字段）
async function fh1WriteWorldbookEntry(uid, content) {
    var host = fh1WorldbookHost();
    if (!host) {
        return { ok: false, msg: '没找到世界书接口（Tavern Helper / 兼容脚本不可用）' };
    }
    var name = fh1WorldbookName(host);

    // ① 新 API 家族：updateWorldbookWith（收/返数组）
    if (typeof host.updateWorldbookWith === 'function') {
        try {
            await host.updateWorldbookWith(name, function (wb) {
                var arr = Array.isArray(wb) ? wb : [];
                var hit = false;
                var out = arr.map(function (e) {
                    if (String(e && e.uid) === String(uid)) {
                        hit = true;
                        var copy = {};
                        for (var k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) copy[k] = e[k]; }
                        copy.content = content;
                        return copy;
                    }
                    return e;
                });
                if (!hit) throw new Error('世界书里没有 uid ' + uid);
                return out;
            }, { render: 'debounced' });
            return { ok: true, msg: 'updateWorldbookWith' };
        } catch (e) {
            console.warn('FH1: updateWorldbookWith 写入失败，尝试旧接口', e);
        }
    }

    // ② 旧接口：setLorebookEntries
    if (typeof host.setLorebookEntries === 'function') {
        try {
            await host.setLorebookEntries(name, [{ uid: uid, content: content }]);
            return { ok: true, msg: 'setLorebookEntries' };
        } catch (e) {
            return { ok: false, msg: 'setLorebookEntries 抛错：' + ((e && e.message) || e) };
        }
    }

    return { ok: false, msg: '可用接口不支持写入条目 content' };
}

/* -------------------- 拼装：草稿 → uid 54 正文 -------------------- */
/* 与 工具\生成世界观预置.ps1 的组装规则逐字一致：
   时代锚点不包裹；世界风格/社会与法治/民俗风情 = --- + 标签：{世界观名} + 条目 + ---；
   背景设定 = # 大标题 + ## 小标题 + 条目。段落之间空一行。 */
function fh1Assemble(d) {
    if (!d) return '';
    var labels = { '世界风格': '风格', '社会与法治': '社会与法治', '民俗风情': '民俗风情' };
    var L = [];
    L.push('<本子>');
    L.push('# 世界观与基调设定');
    L.push('');
    (d.segments || []).forEach(function (s) {
        L.push('## ' + s.key);
        var items = (s.items || []).filter(function (t) { return !fh1IsBlankItem(t); });
        var label = labels[s.key] || null;
        if (items.length) {
            if (label) { L.push('---'); L.push(label + '：' + d.name); }
            items.forEach(function (t) { L.push(fh1NormItem(t)); });
            if (label) { L.push('---'); }
        }
        L.push('');
    });
    L.push('</本子>');
    L.push('');
    L.push('<背景设定>');
    var bgLines = [];
    (d.background || []).forEach(function (g) {
        var items = (g.items || []).filter(function (t) { return !fh1IsBlankItem(t); });
        if (!items.length) return;
        bgLines.push('## ' + g.title);
        items.forEach(function (t) { bgLines.push(fh1NormItem(t)); });
    });
    if (bgLines.length) {
        L.push('# ' + d.name);
        bgLines.forEach(function (l) { L.push(l); });
    }
    L.push('</背景设定>');
    return L.join('\n');
}

/* -------------------- 拼装：草稿 → uid 69 正文（社会生态） -------------------- */
/* 与 工具\生成世界观预置.ps1 的组装规则逐字一致：
   <社会生态> ＋ 每个块前一个空行 ＋ 【块标题】 ＋ 条目 ＋ </社会生态>
   没有任何块时返回空串——表示该世界观没有生态，写入时应清空 uid 69。 */
function fh1EcologyAssemble(d) {
    var blocks = (d && d.ecology && d.ecology.blocks) ? d.ecology.blocks : [];
    if (!blocks.length) return '';
    var L = ['<社会生态>'];
    blocks.forEach(function (b) {
        var items = (b.items || []).filter(function (t) { return !fh1IsBlankItem(t); });
        L.push('');
        L.push('【' + b.label + '】');
        items.forEach(function (t) { L.push(fh1NormItem(t)); });
    });
    L.push('</社会生态>');
    return L.join('\n');
}

/* ------------------------- 预置数据加载 ------------------------- */

window.loadFh1Presets = async function () {
    if (FH1_PRESETS) return FH1_PRESETS;
    try {
        var res = await fetch('data/fh1-presets/worldviews.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        FH1_PRESETS = await res.json();
    } catch (e) {
        console.warn('FH1: 世界观预置加载失败', e);
        FH1_PRESETS = null;
    }
    return FH1_PRESETS;
};

/* --------------------- sub1：世界观概览 --------------------- */

// 概览页＝世界介绍 + 「进入本子世界」按钮（HTML 在 story-loader）
// 注意：**不要清空已选世界观**——否则从概览切到「开局选择」就看不到那套世界观的开局了。
window.fh1InitOverview = function () {
    FH1_EDITING = false;
    var chk = document.getElementById('fh1-edit-chk');
    if (chk) chk.checked = false;
};

/* --------------------- sub2：世界观选择 --------------------- */

window.fh1InitWorldviewPage = function () {
    var box = document.getElementById('fh1-wv-list');
    if (!box) return;

    var render = function () {
        if (!FH1_PRESETS || !FH1_PRESETS.order || !FH1_PRESETS.order.length) {
            box.innerHTML = '<div class="fh1-hint">世界观数据加载失败：请确认 <code>data/fh1-presets/worldviews.json</code> 可访问（改完记得 Ctrl+Shift+R 强刷）</div>';
            return;
        }
        if (FH1_SELECTED && FH1_DRAFT) { fh1RenderOpenCard(); fh1SyncSideBookmarks(); return; }
        fh1SyncSideBookmarks();
        box.innerHTML = FH1_PRESETS.order.map(function (n) {
            var p = fh1GetPreset(n) || {};
            return '<div class="fh1-wv-card" data-wv="' + fh1Esc(n) + '" onclick="fh1SelectWorldview(this.getAttribute(\'data-wv\'))">' +
                '<div class="fh1-wv-card-top">' +
                    '<span class="fh1-wv-name">' + fh1Esc(n) + '</span>' +
                    '<span class="fh1-wv-era-tag">' + fh1Esc(p.eraShort || '') + '</span>' +
                '</div>' +
                '<div class="fh1-wv-sum">' + fh1Esc(p.summary || '') + '</div>' +
            '</div>';
        }).join('');
    };

    if (FH1_PRESETS) {
        render();
    } else {
        box.innerHTML = '<div class="fh1-hint">正在加载世界观…</div>';
        loadFh1Presets().then(render);
    }
};

// 选中：进入草稿 + 展开
window.fh1SelectWorldview = function (name) {
    var p = fh1GetPreset(name);
    if (!p) return;
    FH1_SELECTED = name;
    FH1_DRAFT = fh1DeepCopy(p);
    FH1_EDITING = false;
    FH1_ECO_BLOCK = 0;         // 社会生态回到第一块
    FH1_BG_GROUP = 0;          // 背景设定回到第一个小标题
    var chk = document.getElementById('fh1-edit-chk');
    if (chk) chk.checked = false;
    fh1RenderOpenCard();
    fh1SyncSideBookmarks();
};

// 一行条目（编辑模式下带 ✕）
function fh1ItemRow(text, attrs) {
    return '<div class="fh1-wv-item-row"' + (attrs ? ' ' + attrs : '') + '>' +
        '<div class="fh1-wv-item"' + (FH1_EDITING ? ' contenteditable="true"' : '') + '>' + fh1Esc(text) + '</div>' +
        (FH1_EDITING ? '<button class="fh1-item-del" onclick="fh1DeleteItem(this)" title="删去这一项">\u2715</button>' : '') +
    '</div>';
}

window.fh1RenderOpenCard = function () {
    var box = document.getElementById('fh1-wv-list');
    if (!box || !FH1_DRAFT) return;
    fh1CaptureSubScroll(box);   // 记住标题带当前位置，重画后还原（不然每次点标题都跳回开头）
    var d = FH1_DRAFT;

    // 平铺段落：标题 + 条目，标题右侧一律挂「＋ 添加」（含「时代锚点」）
    var segHTML = (d.segments || []).map(function (s, si) {
        var rows = (s.items || []).map(function (it, ii) {
            return fh1ItemRow(fh1ItemText(it), 'data-kind="seg" data-si="' + si + '" data-ii="' + ii + '"');
        }).join('');
        return '<div class="fh1-wv-seg"><div class="fh1-wv-seg-title"><span>' + fh1Esc(s.key) + '</span>' + fh1PlusBtn(s.key) + '</div>' +
            (rows || '<div class="fh1-hint">（这一段还没有条目）</div>') + '</div>';
    }).join('');

    // 背景设定（分组）：第一行＝小标题带（左右箭头／可拖／不换行），编辑模式下多一行操作，再下面是选中那小标题的子项
    var bgGroups = d.background || [];
    var bgHTML = '<div class="fh1-wv-seg"><div class="fh1-wv-seg-title"><span>背景设定</span>' + fh1PlusBtn('背景设定') + '</div>';
    if (bgGroups.length) {
        var bgSel = Math.min(Math.max(FH1_BG_GROUP | 0, 0), bgGroups.length - 1);
        FH1_BG_GROUP = bgSel;
        var bgRows = (bgGroups[bgSel].items || []).map(function (it, ii) {
            return fh1ItemRow(fh1ItemText(it), 'data-kind="bg" data-gi="' + bgSel + '" data-ii="' + ii + '"');
        }).join('');
        bgHTML += fh1SubStrip('bg', bgGroups.map(function (g) { return g.title; }), bgSel) +
            fh1SubActions('bg', bgSel, (bgGroups[bgSel].items || []).length) +
            (bgRows || '<div class="fh1-hint">（这个小标题下还没有子项' + (FH1_EDITING ? '，点上面的「＋ 子项」加一条' : '') + '）</div>');
    } else {
        bgHTML += '<div class="fh1-hint">（还没有小标题，可点右上「＋ 添加」新建）</div>';
    }
    bgHTML += '</div>';

    // 社会生态（对应世界书 uid 69）：同样「小标题带 ＋ 操作行 ＋ 选中那块的子项」
    var blocks = (d.ecology && d.ecology.blocks) ? d.ecology.blocks : [];
    var ecoHTML = '<div class="fh1-wv-seg"><div class="fh1-wv-seg-title"><span>社会生态</span>' + fh1PlusBtn('社会生态') + '</div>';
    if (blocks.length) {
        var sel = Math.min(Math.max(FH1_ECO_BLOCK | 0, 0), blocks.length - 1);
        FH1_ECO_BLOCK = sel;
        var ecoRows = (blocks[sel].items || []).map(function (it, ii) {
            return fh1ItemRow(fh1ItemText(it), 'data-kind="eco" data-bi="' + sel + '" data-ii="' + ii + '"');
        }).join('');
        ecoHTML += fh1SubStrip('eco', blocks.map(function (b, bi) { return b.title || b.label || ('生态' + (bi + 1)); }), sel) +
            fh1SubActions('eco', sel, (blocks[sel].items || []).length) +
            (ecoRows || '<div class="fh1-hint">（这一块还没有子项' + (FH1_EDITING ? '，点上面的「＋ 子项」加一条' : '') + '）</div>');
    } else {
        ecoHTML += '<div class="fh1-hint">这套世界观还没有生态内容，可点右上「＋ 添加」新建一个小标题。</div>';
    }
    ecoHTML += '</div>';

    box.innerHTML =
        '<div class="fh1-wv-detail' + (FH1_EDITING ? ' fh1-editing' : '') + '">' +
            '<div class="fh1-wv-detail-head">' +
                '<div class="fh1-wv-card-top">' +
                    '<span class="fh1-wv-name">' + fh1Esc(d.name) + '</span>' +
                    '<span class="fh1-wv-era-tag">' + fh1Esc(d.eraShort || '') + '</span>' +
                '</div>' +
                '<div class="fh1-wv-era-full">' + fh1Esc(d.era || '') + '</div>' +
                '<div class="fh1-wv-sum">' + fh1Esc(d.summary || '') + '</div>' +
            '</div>' +
            '<div class="fh1-wv-body">' + segHTML + bgHTML + ecoHTML + '</div>' +
            '<button class="fh1-apply-btn" onclick="fh1EnableAndContinue()">\u25B6 启用并继续</button>' +
        '</div>';

    fh1RestoreSubScroll(box);  // 还原标题带横向位置 + 保证选中项可见
    fh1BindSubTracks(box);     // 小标题带：支持鼠标拖动滑动
    fh1FocusPendingRow(box);   // 刚加了「＋ 子项」的话，把光标停到新行
};

/* ---------------------- 附录（＋ 抽屉：挑几条加进来） ---------------------- */

// 平铺段落：一行 = 勾选框 + 内容；正文里已有的标「已添加」并禁用
function fh1ApItems(items, hasMap) {
    if (!items || !items.length) return '<div class="fh1-ap-empty">（这一段还没有附录内容，可用下方「＋ 自定义」自己写）</div>';
    return items.map(function (t) {
        var text = fh1ItemText(t).trim();
        var added = !!hasMap[text];
        return '<label class="fh1-ap-item' + (added ? ' added' : '') + '">' +
            '<input type="checkbox" value="' + fh1Esc(text) + '"' + (added ? ' disabled checked' : '') + '>' +
            '<span>' + fh1Esc(text) + '</span>' +
            (added ? '<em class="fh1-ap-tag">已添加</em>' : '') +
        '</label>';
    }).join('');
}

function fh1ClosestByClass(el, cls) {
    while (el && el.nodeType === 1) {
        if ((' ' + el.className + ' ').indexOf(' ' + cls + ' ') !== -1) return el;
        el = el.parentElement;
    }
    return null;
}

// 取附录数据：平铺段落用 sections[段]，分组段落用 groups[段]
function fh1ApFlatOf(src, segKey) {
    return (src && src.appendix && src.appendix.sections && src.appendix.sections[segKey]) || [];
}
function fh1ApGroupsOf(src, segKey) {
    return (src && src.appendix && src.appendix.groups && src.appendix.groups[segKey]) || [];
}

// 分组段落：一个小标题一块；块头带小标题级勾选框（勾它＝勾上它下面所有子项）
function fh1ApGroups(groups, segKey) {
    if (!groups || !groups.length) return '<div class="fh1-ap-empty">（这一段还没有附录内容，可在下方「＋ 自定义」里填小标题＋子项）</div>';
    return groups.map(function (g) {
        var rows = (g.items || []).map(function (t) {
            var text = fh1ItemText(t).trim();
            var added = fh1GroupHasItem(segKey, g.title, text);
            return '<label class="fh1-ap-item' + (added ? ' added' : '') + '">' +
                '<input type="checkbox" class="fh1-ap-itembox" data-gtitle="' + fh1Esc(g.title) + '" value="' + fh1Esc(text) + '"' +
                    (added ? ' disabled checked' : '') + ' onchange="fh1ApItemToggle(this)">' +
                '<span>' + fh1Esc(text) + '</span>' +
                (added ? '<em class="fh1-ap-tag">已添加</em>' : '') +
            '</label>';
        }).join('');
        return '<div class="fh1-ap-sec open">' +
            '<div class="fh1-ap-sec-head" onclick="fh1ApToggle(this)">' +
                '<input type="checkbox" class="fh1-ap-groupbox" data-gtitle="' + fh1Esc(g.title) + '"' +
                    ' onclick="event.stopPropagation()" onchange="fh1ApGroupToggle(this)">' +
                '<span class="fh1-ap-sec-title">' + fh1Esc(g.title) + '</span>' +
                '<span class="fh1-ap-caret">\u25BE</span>' +
            '</div>' +
            '<div class="fh1-ap-sec-body">' + (rows || '<div class="fh1-ap-empty">（空）</div>') + '</div>' +
        '</div>';
    }).join('');
}

// 草稿里该小标题下是否已有这条
function fh1GroupHasItem(segKey, gtitle, text) {
    var g = null;
    if (segKey === '背景设定') {
        (FH1_DRAFT.background || []).forEach(function (x) { if (x.title === gtitle) g = x; });
    } else if (segKey === '社会生态') {
        ((FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks) || []).forEach(function (x) { if ((x.title || x.label) === gtitle) g = x; });
    }
    if (!g) return false;
    var hit = false;
    (g.items || []).forEach(function (t) { if (fh1ItemText(t).trim() === text) hit = true; });
    return hit;
}

window.fh1OpenAppendix = function (segKey) {
    if (!segKey) return;
    if (!FH1_DRAFT || !FH1_PRESETS) { showCustomAlert('世界观数据还没准备好'); return; }
    if (typeof fc1isOpenDrawer !== 'function') { showCustomAlert('抽屉组件不可用（fc1isOpenDrawer 缺失）'); return; }

    FH1_AP_SEG = segKey;
    var isGroup = fh1IsGroupSeg(segKey);

    // 平铺段落：正文里已有的条目（用于标「已添加」）
    var hasMap = {};
    if (!isGroup) {
        (FH1_DRAFT.segments || []).forEach(function (s) {
            if (s.key !== segKey) return;
            (s.items || []).forEach(function (t) { hasMap[fh1ItemText(t).trim()] = true; });
        });
    }

    var html = '';
    var note = (FH1_DRAFT.appendix && FH1_DRAFT.appendix.note) || '';
    if (note) { html += '<div class="fh1-ap-note">' + fh1Esc(note) + '</div>'; }

    // ① 当前世界观的这一段（默认展开）
    html += '<div class="fh1-ap-sec open">' +
        '<div class="fh1-ap-sec-head" onclick="fh1ApToggle(this)">' +
            '<span class="fh1-ap-sec-title">' + fh1Esc(segKey) + '</span><span class="fh1-ap-caret">\u25BE</span>' +
        '</div>' +
        '<div class="fh1-ap-sec-body">' +
            (isGroup ? fh1ApGroups(fh1ApGroupsOf(FH1_DRAFT, segKey), segKey)
                     : fh1ApItems(fh1ApFlatOf(FH1_DRAFT, segKey), hasMap)) +
        '</div>' +
    '</div>';

    // ② 其他世界观的同段落（默认折叠）
    (FH1_PRESETS.order || []).forEach(function (n) {
        if (n === FH1_DRAFT.name) return;
        var o = fh1GetPreset(n) || {};
        html += '<div class="fh1-ap-sec">' +
            '<div class="fh1-ap-sec-head" onclick="fh1ApToggle(this)">' +
                '<span class="fh1-ap-sec-title">' + fh1Esc(n) + '-' + fh1Esc(segKey) + '</span><span class="fh1-ap-caret">\u25B8</span>' +
            '</div>' +
            '<div class="fh1-ap-sec-body">' +
                (isGroup ? fh1ApGroups(fh1ApGroupsOf(o, segKey), segKey) : fh1ApItems(fh1ApFlatOf(o, segKey), hasMap)) +
            '</div>' +
        '</div>';
    });

    // ③ 自定义项：平铺段落＝自定义一条；分组段落＝新建小标题（子项可留空，之后在编辑模式里加）
    html += '<div class="fh1-ap-custom">' +
        '<button class="fh1-ap-custom-btn" onclick="fh1ApCustomToggle()">' + (isGroup ? '\uFF0B 新建小标题' : '\uFF0B 自定义') + '</button>' +
        '<div class="fh1-ap-custom-row' + (isGroup ? ' fh1-ap-custom-col' : '') + '" id="fh1-ap-custom-row" style="display:none;">' +
            (isGroup ? '<input type="text" id="fh1-ap-custom-title" class="fh1-ap-custom-title" placeholder="新小标题名称（必填，如：授精部）">' : '') +
            (isGroup
                ? '<textarea id="fh1-ap-custom-input" class="fh1-ap-custom-input" rows="3" placeholder="子项内容，一行一条（可留空，先只建小标题）"></textarea>'
                : '<input type="text" id="fh1-ap-custom-input" class="fh1-ap-custom-input" placeholder="输入要添加的内容，回车即可添加">') +
            '<button class="fh1-ap-custom-add" onclick="fh1ApCustomAdd()">' + (isGroup ? '创建 / 添加' : '添加') + '</button>' +
        '</div>' +
        '<div class="fh1-ap-custom-tip" id="fh1-ap-custom-tip"></div>' +
    '</div>';

    html += '<button class="fh1-ap-add" onclick="fh1AppendixAdd()">点击添加</button>';
    fc1isOpenDrawer('附录 \u00B7 ' + segKey, html);
};

// 「＋ 自定义」：展开输入行并聚焦
window.fh1ApCustomToggle = function () {
    var row = document.getElementById('fh1-ap-custom-row');
    if (!row) return;
    var show = (row.style.display === 'none' || !row.style.display);
    row.style.display = show ? 'flex' : 'none';
    if (show) {
        var inp = document.getElementById('fh1-ap-custom-input');
        if (inp) { try { inp.focus(); } catch (e) {} }
    }
};

// 「＋ 自定义」：分组段落要先填小标题，子项一行一条
window.fh1ApCustomAdd = function () {
    if (!FH1_DRAFT || !FH1_AP_SEG) return;
    var inp = document.getElementById('fh1-ap-custom-input');
    var tip = document.getElementById('fh1-ap-custom-tip');
    if (!inp) return;

    // ① 分组段落（背景设定 / 社会生态）：新建小标题（子项可留空；已有该小标题则往里加）
    if (fh1IsGroupSeg(FH1_AP_SEG)) {
        var titleEl = document.getElementById('fh1-ap-custom-title');
        var title = titleEl ? String(titleEl.value || '').trim() : '';
        if (!title) { if (tip) tip.textContent = '请先填小标题名称'; return; }
        var lines = String(inp.value || '').split('\n').map(function (t) { return t.trim(); }).filter(function (t) { return !!t; });
        var existed = !!fh1FindGroup(FH1_DRAFT, FH1_AP_SEG, title);
        var grp = fh1EnsureGroup(FH1_DRAFT, FH1_AP_SEG, title);
        if (!grp) { if (tip) tip.textContent = '没找到对应段落：' + FH1_AP_SEG; return; }
        grp.items = grp.items || [];
        if (lines.length) {
            grp.items = grp.items.concat(lines.map(function (t) { return fh1NormItem(t); }));
            if (tip) tip.textContent = (existed ? '已添加到「' : '已新建「') + title + '」：' + lines.length + ' 条';
        } else {
            if (tip) {
                tip.textContent = existed
                    ? ('「' + title + '」已经存在，可在编辑模式下给它加子项')
                    : ('已新建小标题「' + title + '」，可在编辑模式下给它加子项');
            }
        }
        inp.value = '';
        fh1RenderOpenCard();
        try { inp.focus(); } catch (e) {}
        return;
    }

    // ② 平铺段落：一次一条
    var text = String(inp.value || '').trim();
    if (!text) { if (tip) tip.textContent = '还没输入内容'; return; }
    var seg = fh1EnsureGroup(FH1_DRAFT, FH1_AP_SEG, '');
    if (!seg) { if (tip) tip.textContent = '没找到对应段落：' + FH1_AP_SEG; return; }

    seg.items = (seg.items || []).concat([fh1NormItem(text)]);
    inp.value = '';
    if (tip) tip.textContent = '已添加：' + text;
    fh1RenderOpenCard();          // 背后的展开页同步刷新（抽屉不动）
    try { inp.focus(); } catch (e) {}
};

// 勾小标题 → 它下面所有子项一起勾上
window.fh1ApGroupToggle = function (cb) {
    var sec = fh1ClosestByClass(cb, 'fh1-ap-sec');
    if (!sec) return;
    var on = !!cb.checked;
    sec.querySelectorAll('input.fh1-ap-itembox').forEach(function (ib) { if (!ib.disabled) ib.checked = on; });
    cb.indeterminate = false;
};

// 勾某个子项 → 同步小标题的状态（部分选中显示为半选，添加时会把小标题一起带出）
window.fh1ApItemToggle = function (cb) {
    var sec = fh1ClosestByClass(cb, 'fh1-ap-sec');
    if (!sec) return;
    var gb = sec.querySelector('input.fh1-ap-groupbox');
    if (!gb) return;
    var boxes = Array.prototype.slice.call(sec.querySelectorAll('input.fh1-ap-itembox')).filter(function (b) { return !b.disabled; });
    var checked = boxes.filter(function (b) { return b.checked; }).length;
    gb.checked = (boxes.length > 0 && checked === boxes.length);
    gb.indeterminate = (checked > 0 && checked < boxes.length);
};

/* ---------- 编辑模式：给已有小标题加子项（新建小标题走抽屉的「＋ 添加」） ---------- */

window.fh1AddSubItem = function (btn) {
    if (!btn) return;
    fh1AddSubItemIdx(btn.getAttribute('data-kind'), parseInt(btn.getAttribute('data-idx'), 10));
};

window.fh1AddSubItemIdx = function (kind, idx) {
    if (!FH1_DRAFT) return;
    fh1SyncDraftFromDOM();            // 先存回现有改动，避免丢失
    var g = null;
    if (kind === 'bg') {
        g = (FH1_DRAFT.background || [])[idx];
    } else if (kind === 'eco') {
        g = (FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks) ? FH1_DRAFT.ecology.blocks[idx] : null;
    }
    if (!g) return;
    g.items = (g.items || []).concat(['- ']);   // 空条目：填入内容前不会写进世界书
    FH1_FOCUS_LAST = kind + ':' + idx;
    fh1RenderOpenCard();
};

// 重画后把光标放到刚才新增的那一行上
function fh1FocusPendingRow(box) {
    if (!FH1_FOCUS_LAST) return;
    var parts = FH1_FOCUS_LAST.split(':');
    FH1_FOCUS_LAST = '';
    var attr = (parts[0] === 'bg') ? 'data-gi' : 'data-bi';
    var rows = box.querySelectorAll('.fh1-wv-item-row[' + attr + '="' + parts[1] + '"]');
    if (!rows.length) return;
    var it = rows[rows.length - 1].querySelector('.fh1-wv-item');
    if (!it) return;
    try {
        it.focus();
        var r = document.createRange();
        r.selectNodeContents(it);
        r.collapse(false);
        var s = window.getSelection();
        if (s) { s.removeAllRanges(); s.addRange(r); }
    } catch (e) {}
}

window.fh1ApToggle = function (headEl) {
    var sec = headEl && headEl.parentElement;
    if (!sec) return;
    var open = sec.classList.toggle('open');
    var caret = sec.querySelector('.fh1-ap-caret');
    if (caret) caret.textContent = open ? '\u25BE' : '\u25B8';
};

// 把勾选的附录项追加进当前世界观的对应段落（草稿），再重画展开页
//   平铺段落：勾谁加谁
//   分组段落：勾小标题＝加它下面全部子项；勾某一子项＝加这一条，并连带它的小标题（没有该小标题就新建）
window.fh1AppendixAdd = function () {
    if (!FH1_DRAFT || !FH1_AP_SEG) return;
    var drawer = document.getElementById('fc1-drawer');
    if (!drawer) return;

    var segKey = FH1_AP_SEG;
    var picked = [];

    if (fh1IsGroupSeg(segKey)) {
        drawer.querySelectorAll('input.fh1-ap-groupbox:checked').forEach(function (gb) {
            var sec = fh1ClosestByClass(gb, 'fh1-ap-sec');
            var gt = gb.getAttribute('data-gtitle') || '';
            if (!sec) return;
            sec.querySelectorAll('input.fh1-ap-itembox').forEach(function (ib) {
                if (!ib.disabled) picked.push({ g: gt, t: ib.value });
            });
        });
        drawer.querySelectorAll('input.fh1-ap-itembox:checked:not(:disabled)').forEach(function (ib) {
            picked.push({ g: ib.getAttribute('data-gtitle') || '', t: ib.value });
        });
    } else {
        drawer.querySelectorAll('.fh1-ap-item input[type="checkbox"]:checked:not(:disabled)').forEach(function (b) {
            picked.push({ g: '', t: b.value });
        });
    }

    if (!picked.length) { showCustomAlert('还没勾选要添加的条目'); return; }

    var added = 0, skipped = 0;
    picked.forEach(function (p) {
        var g = fh1EnsureGroup(FH1_DRAFT, segKey, p.g || segKey);
        if (!g) return;
        g.items = g.items || [];
        var exists = false;
        g.items.forEach(function (t) { if (fh1ItemText(t).trim() === fh1ItemText(p.t).trim()) exists = true; });
        if (exists) { skipped++; return; }
        g.items.push(fh1NormItem(p.t));
        added++;
    });

    if (typeof fc1isCloseDrawer === 'function') { fc1isCloseDrawer(); }
    fh1RenderOpenCard();
    if (added === 0) { showCustomAlert('勾选的条目都已经在正文里了，没有重复添加。'); }
    console.log('FH1: 附录添加 → ' + segKey + ' 新增 ' + added + ' 条，跳过重复 ' + skipped + ' 条');
};

/* ---------------------- 编辑模式（改／删） ---------------------- */

window.fh1ToggleEditMode = function (el) {
    FH1_EDITING = !!(el && el.checked);
    if (!FH1_DRAFT) return;
    if (!FH1_EDITING) { fh1SyncDraftFromDOM(); }
    fh1RenderOpenCard();
};

// 把 DOM 里的文字与结构同步回草稿
window.fh1SyncDraftFromDOM = function () {
    if (!FH1_DRAFT) return;
    var box = document.getElementById('fh1-wv-list');
    if (!box) return;
    var segMap = {}, bgMap = {}, ecoMap = {};
    box.querySelectorAll('.fh1-wv-item-row').forEach(function (row) {
        var txt = row.querySelector('.fh1-wv-item');
        var text = txt ? fh1NormItem(txt.textContent) : '- ';
        var kind = row.getAttribute('data-kind');
        if (kind === 'seg') {
            var si = parseInt(row.getAttribute('data-si'), 10);
            if (!segMap[si]) segMap[si] = [];
            segMap[si].push(text);
        } else if (kind === 'eco') {
            var bi = parseInt(row.getAttribute('data-bi'), 10);
            if (!ecoMap[bi]) ecoMap[bi] = [];
            ecoMap[bi].push(text);
        } else {
            var gi = parseInt(row.getAttribute('data-gi'), 10);
            if (!bgMap[gi]) bgMap[gi] = [];
            bgMap[gi].push(text);
        }
    });
    // 只要有行（哪怕为空）就按行覆盖；段落整体被删空时保留空数组
    Object.keys(segMap).forEach(function (k) {
        if (FH1_DRAFT.segments[k]) FH1_DRAFT.segments[k].items = segMap[k];
    });
    Object.keys(bgMap).forEach(function (k) {
        if (FH1_DRAFT.background[k]) FH1_DRAFT.background[k].items = bgMap[k];
    });
    Object.keys(ecoMap).forEach(function (k) {
        if (FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks[k]) FH1_DRAFT.ecology.blocks[k].items = ecoMap[k];
    });
};

// 删去一项（先同步其余编辑，再按索引删）
window.fh1DeleteItem = function (btn) {
    var row = btn && btn.parentElement;
    if (!row || !FH1_DRAFT) return;
    fh1SyncDraftFromDOM();
    var kind = row.getAttribute('data-kind');
    var ii = parseInt(row.getAttribute('data-ii'), 10);
    if (kind === 'seg') {
        var si = parseInt(row.getAttribute('data-si'), 10);
        if (FH1_DRAFT.segments[si]) FH1_DRAFT.segments[si].items.splice(ii, 1);
    } else if (kind === 'eco') {
        var bi = parseInt(row.getAttribute('data-bi'), 10);
        if (FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks[bi]) FH1_DRAFT.ecology.blocks[bi].items.splice(ii, 1);
    } else {
        var gi = parseInt(row.getAttribute('data-gi'), 10);
        if (FH1_DRAFT.background[gi]) FH1_DRAFT.background[gi].items.splice(ii, 1);
    }
    fh1RenderOpenCard();
};

/* ------------------- 重选 / 启用并继续 ------------------- */

window.fh1ReselectWorldview = function () {
    FH1_SELECTED = '';
    FH1_DRAFT = null;
    FH1_EDITING = false;
    var chk = document.getElementById('fh1-edit-chk');
    if (chk) chk.checked = false;
    var box = document.getElementById('fh1-wv-list');
    if (box) box.innerHTML = '';
    fh1InitWorldviewPage();
};

// 只有这个按钮会把当前内容写进世界书（含玩家的编辑与删除）
window.fh1EnableAndContinue = async function () {
    if (!FH1_DRAFT || !FH1_SELECTED) return;
    fh1SyncDraftFromDOM();

    var name = FH1_DRAFT.name;
    var agree = await showCustomConfirm('启用「' + name + '」并把当前内容写入世界书吗？\n（世界观与社会生态都会写入，含你在编辑模式里的改动与删除）');
    if (!agree) return;

    var text = fh1Assemble(FH1_DRAFT);
    var res = await fh1WriteWorldbookEntry(FH1_WORLDVIEW_UID, text);
    if (!res.ok) {
        showCustomAlert('写入世界书失败：' + res.msg + '\n（请确认本环境加载了 Tavern Helper 或兼容脚本）');
        return;
    }
    // 社会生态写进 uid 69；这套世界观没有生态时写空串，清掉上一套留下的生态
    var ecoText = fh1EcologyAssemble(FH1_DRAFT);
    var resEco = await fh1WriteWorldbookEntry(FH1_ECOLOGY_UID, ecoText);
    if (!resEco.ok) {
        showCustomAlert('世界观已写入，但社会生态写入失败：' + resEco.msg + '\n（可再点一次「启用并继续」重试）');
        return;
    }
    console.log('FH1: 已写入 uid ' + FH1_WORLDVIEW_UID + '（' + text.length + ' 字）与 uid ' + FH1_ECOLOGY_UID +
        '（' + ecoText.length + ' 字，' + (FH1_DRAFT.ecology && FH1_DRAFT.ecology.blocks ? FH1_DRAFT.ecology.blocks.length : 0) + ' 块）｜' + res.msg);

    // 变量规则写进 uid 28；这套世界观没有变量规则文件（空串）时跳过，保留世界书里现有的
    var varText = String(FH1_DRAFT.varRulesFree || '').trim();
    if (varText) {
        var resVar = await fh1WriteWorldbookEntry(FH1_VARRULES_UID, varText);
        if (!resVar.ok) {
            showCustomAlert('世界观与生态已写入，但变量规则写入失败：' + resVar.msg + '\n（可再点一次「启用并继续」重试）');
            return;
        }
        console.log('FH1: 已写入 uid ' + FH1_VARRULES_UID + '（变量规则，' + varText.length + ' 字）');
    } else {
        console.log('FH1: 这套世界观没有变量规则文件，跳过 uid ' + FH1_VARRULES_UID);
    }

    // 切换选项卡 → 隐藏的书签由 switchSubTab 恢复；标记「已启用过世界观」
    FH1_APPLIED = true;
    fh1RestoreBookmarks();
    if (typeof goToSubTab === 'function') { goToSubTab('FH1', 'FH1-sub3'); }
};

/* ------------- 右侧书签：目录 / 封面 / 翻页 / 角色 / 隐藏 / 重选 ------------- */
/* 六个书签颜色各不相同（不含「返回」，它只在角色管理页出现）：
   目录·金 ｜ 封面·蓝 ｜ 翻页·红 ｜ 角色·绿 ｜ 隐藏·灰蓝 ｜ 重选·褐
   「隐藏」「重选」在「世界观」页选中一套、或「开局选择」页展开一张卡时出现；
   点「隐藏」只藏别的书签，「重选」始终留着。 */

var FH1_BOOKMARK_SEL = '.bookmark-menu, .bookmark-back, .bookmark-next, .bookmark-role, .bookmark-hide';
var FH1_BOOKMARK_ALL = FH1_BOOKMARK_SEL + ', .bookmark-reselect';
var FH1_BOOKMARK_KEEP = '.bookmark-reselect';   // 点「隐藏」时唯一留下来的

// 两个新书签的 CSS 默认是 display:none，显示时必须显式设成 flex
function fh1ShowEl(el, on) { if (el) el.style.display = on ? 'flex' : 'none'; }

// 只同步「隐藏 / 重选」两个书签的显隐
//   世界观页：选中了一套（FH1_SELECTED）｜开局页：展开了一张卡（FH1_START_OPEN）
window.fh1SyncSideBookmarks = function () {
    var panel = document.getElementById('FH1');
    var onMainTab = !!(panel && panel.classList.contains('active'));
    var wvOpen = !!(FH1_SELECTED && FH1_SUBTAB === 'FH1-sub2');
    var stOpen = !!(FH1_SELECTED && FH1_SUBTAB === 'FH1-sub4' && FH1_START_OPEN);
    var on = onMainTab && (wvOpen || stOpen);
    fh1ShowEl(document.getElementById('fh1-bookmark-hide'), on);
    fh1ShowEl(document.getElementById('fh1-bookmark-reselect'), on);
};

// 「隐藏」：除了「重选」，其它书签全藏起来，直到切换选项卡
window.fh1HideBookmarks = function () {
    document.querySelectorAll(FH1_BOOKMARK_SEL).forEach(function (el) { el.style.display = 'none'; });
};

// 「重选」：按当前子页决定回哪个列表（世界观卡片 / 开局卡片）
window.fh1Reselect = function () {
    if (FH1_SUBTAB === 'FH1-sub4') { fh1BackStartList(); return; }
    fh1ReselectWorldview();
};

// 恢复：全部恢复，再按当前页面把「隐藏 / 重选」调回应有状态
window.fh1RestoreBookmarks = function () {
    document.querySelectorAll(FH1_BOOKMARK_ALL).forEach(function (el) { el.style.display = ''; });
    fh1SyncSideBookmarks();
};

// 子页切换：记录当前子页；编辑模式开关只在「世界观」页显示；离开该页关闭编辑
window.fh1OnSubTabChange = function (subTabId) {
    FH1_SUBTAB = subTabId || '';
    var sw = document.getElementById('fh1-edit-switch');
    if (sw) sw.style.display = (subTabId === 'FH1-sub2') ? '' : 'none';
    if (subTabId !== 'FH1-sub2' && FH1_EDITING) {
        FH1_EDITING = false;
        var chk = document.getElementById('fh1-edit-chk');
        if (chk) chk.checked = false;
        fh1SyncDraftFromDOM();
    }
    // 「特殊规则」页：只要还没启用过世界观，就提示先去选；启用过就直接给「跳过 / 选择」
    if (subTabId === 'FH1-sub3') {
        fh1RenderRulesGate();
    }
    // 「开局选择」页：渲染开局卡片
    if (subTabId === 'FH1-sub4' && typeof fh1InitStartPanel === 'function') {
        fh1InitStartPanel();
    }
    fh1SyncSideBookmarks();
};

/* ---------------------- 特殊规则页：两种进入方式的提示 ---------------------- */

window.fh1RenderRulesGate = function () {
    var gate = document.getElementById('fh1-rules-gate');
    var body = document.getElementById('fh1-rules-body');
    if (!gate) return;

    // 只要启用过一次世界观，就不再要求玩家回去选
    if (FH1_APPLIED) {
        // ① 已启用过世界观：推荐跳过（之后可用状态栏加规则）
        var picked = Object.keys(FH1_RULES).length;
        gate.innerHTML =
            '<div class="fh1-gate-note">刚开始游玩时，为保证游玩体验，<b>推荐跳过特殊规则的选择</b>；' +
            '之后也可以在<b>状态栏</b>里随时增加特殊规则。' +
            (picked ? '<br>你已经选了 <b>' + picked + '</b> 条，点「选择特殊规则」可以继续改。' : '') +
            '</div>' +
            '<div class="fh1-gate-btns">' +
                '<button class="fh1-gate-btn primary" onclick="fh1RulesSkip()">确认跳过</button>' +
                '<button class="fh1-gate-btn" onclick="fh1RulesChoose()">选择特殊规则</button>' +
            '</div>';
    } else {
        // ② 还没启用过任何世界观：先回去选
        gate.innerHTML =
            '<div class="fh1-gate-note">请先到「<b>世界观</b>」页挑选一套世界观；选好后点该页卡片下方的' +
            '「<b>启用并继续</b>」，再回到这里选择特殊规则。</div>' +
            '<div class="fh1-gate-btns">' +
                '<button class="fh1-gate-btn primary" onclick="fh1GotoWorldview()">前往世界观</button>' +
            '</div>';
    }
    gate.style.display = '';
    if (body) body.style.display = 'none';
};

// 确认跳过 → 进入下一站「开局选择」
window.fh1RulesSkip = function () {
    if (typeof goToSubTab === 'function') { goToSubTab('FH1', 'FH1-sub4'); }
};

// 选择特殊规则 → 收起提示，露出规则区（规则卡在 fh1RenderRules 里画）
window.fh1RulesChoose = function () {
    var gate = document.getElementById('fh1-rules-gate');
    var body = document.getElementById('fh1-rules-body');
    if (gate) gate.style.display = 'none';
    if (body) { body.style.display = ''; fh1RenderRules(); }
};

window.fh1GotoWorldview = function () {
    if (typeof goToSubTab === 'function') { goToSubTab('FH1', 'FH1-sub2'); }
};

/* ================== 特殊规则页：规则卡（只改草稿 FH1_RULES） ==================
 * 规则清单来自 js/rules-presets.js（window.RULES_PRESETS，生成产物，勿手改）。
 * 与状态栏第 3 页同一份清单、同一套结构：
 *   规则名 → 值对象        { '时间暂停': { '模式': '快感累计' } }
 *   填写式规则用填写内容当键 { 'xx是常识': { '天空是绿色的': {} } }
 * 差别只在落盘时机：状态栏当场写变量；前端没开局，只能等「开始剧情」时随开局一起发。
 * ========================================================================== */

function fh1RulePresets() {
    return (window.RULES_PRESETS && window.RULES_PRESETS.rules) || [];
}

function fh1RuleByName(name) {
    var hit = null;
    fh1RulePresets().forEach(function (p) { if (p.name === name) hit = p; });
    return hit;
}

// 单张规则卡的 HTML：默认只显示规则名，点一下才从下方拉出简介/勾选/模式/填写框
function fh1RuleCardHtml(p) {
    var v = FH1_RULES[p.name], on = (v !== undefined), open = !!FH1_RULES_OPEN[p.name];
    var hasModes = !!(p.modes && p.modes.length);
    var h = '<div class="fh1-rule-card' + (on ? ' on' : '') + '">';
    h += '<div class="fh1-rule-head" data-rx="expand" data-name="' + fh1Esc(p.name) + '">' +
            '<span class="fh1-rule-name">' + fh1Esc(p.name) + '</span>' +
            (on ? '<span class="fh1-rule-on">已启用</span>' : '') +
            '<span class="fh1-rule-arrow">' + (open ? '\u25BE' : '\u25B8') + '</span>' +
         '</div>';
    if (!open) { return h + '</div>'; }

    h += '<div class="fh1-rule-body">';
    if (p.intro) { h += '<div class="fh1-rule-intro">' + fh1Esc(p.intro) + '</div>'; }
    h += '<label class="fh1-rule-enable"><input type="checkbox" data-rx="toggle" data-name="' + fh1Esc(p.name) + '"' +
        (on ? ' checked' : '') + '>启用这条规则</label>';
    if (hasModes) {
        h += '<div class="fh1-rule-modes">' + p.modes.map(function (m) {
            var sel = !!(v && v['模式'] === m);
            return '<label class="fh1-rule-mode"><input type="radio" name="fh1rm-' + fh1Esc(p.name) + '"' +
                ' data-rx="mode" data-name="' + fh1Esc(p.name) + '" data-mode="' + fh1Esc(m) + '"' +
                (sel ? ' checked' : '') + '>' + fh1Esc(m) + '</label>';
        }).join('') + '</div>';
    }
    if (p.fill) {
        h += '<div class="fh1-rule-fillbar">' +
                '<input type="text" class="fh1-rule-input" data-rx-input="' + fh1Esc(p.name) + '"' +
                ' placeholder="' + fh1Esc(p.fill) + '">' +
                '<button class="fh1-rule-add" data-rx="add-entry" data-name="' + fh1Esc(p.name) + '">添加</button>' +
             '</div>';
        var ks = on ? Object.keys(v).filter(function (k) { return k !== '模式'; }) : [];
        if (ks.length) {
            h += '<div class="fh1-rule-entries">' + ks.map(function (k) {
                return '<div class="fh1-rule-entry"><span class="fh1-rule-entry-text">' + fh1Esc(k) + '</span>' +
                    '<button class="fh1-rule-mini del" data-rx="del-entry" data-name="' + fh1Esc(p.name) + '"' +
                    ' data-text="' + fh1Esc(k) + '">删除</button></div>';
            }).join('') + '</div>';
        }
    }
    h += '</div></div>';
    return h;
}

window.fh1RenderRules = function () {
    var body = document.getElementById('fh1-rules-body');
    if (!body) { return; }
    var presets = fh1RulePresets();

    if (!presets.length) {
        body.innerHTML = '<div class="fh1-rules-err">规则清单没加载：确认 <code>js/rules-presets.js</code> 已上传，' +
            '并且在 <code>index.html</code> 里排在 <code>js/fh1-init.js</code> 之前。</div>';
        return;
    }

    var on = Object.keys(FH1_RULES).length;
    var html = '<div class="fh1-rules-tip">开局前可以先挑几条规则，也可以一条都不挑（点「确认跳过」）。' +
        '这里改动只是草稿，点「开始剧情」才会生效；<b>游玩中还能在状态栏里随时增删</b>。' +
        (on ? '　当前已选 <b>' + on + '</b> 条。' : '') + '</div>';
    html += '<div class="fh1-rule-list">' + presets.map(fh1RuleCardHtml).join('') + '</div>';
    body.innerHTML = html;
    fh1BindRules(body);
};

// 事件只在第一次绑一次；卡片重画不影响（监听挂在容器上）
function fh1BindRules(body) {
    if (!body || body.getAttribute('data-rx-bound')) { return; }
    body.setAttribute('data-rx-bound', '1');

    body.addEventListener('click', function (ev) {
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-rx]') : null;
        if (!el || !body.contains(el)) { return; }
        var act = el.getAttribute('data-rx');
        var name = el.getAttribute('data-name') || '';
        if (act === 'expand') { FH1_RULES_OPEN[name] = !FH1_RULES_OPEN[name]; fh1RenderRules(); return; }
        if (act === 'toggle') { fh1RuleToggle(name); return; }
        if (act === 'mode') {
            FH1_RULES[name] = FH1_RULES[name] || {};
            FH1_RULES[name]['模式'] = el.getAttribute('data-mode') || '';
            fh1RenderRules();
            return;
        }
        if (act === 'add-entry') { fh1RuleAddEntry(name); return; }
        if (act === 'del-entry') { fh1RuleDelEntry(name, el.getAttribute('data-text') || ''); return; }
    });

    // 填写框里按回车＝点「添加」
    body.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') { return; }
        var t = ev.target;
        if (!t || !t.getAttribute) { return; }
        var nm = t.getAttribute('data-rx-input');
        if (!nm) { return; }
        ev.preventDefault();
        fh1RuleAddEntry(nm);
    });
}

function fh1RuleToggle(name) {
    // 已在草稿里 → 取消勾选
    if (FH1_RULES[name] !== undefined) {
        delete FH1_RULES[name];
        fh1RenderRules();
        return;
    }
    var p = fh1RuleByName(name);
    FH1_RULES_OPEN[name] = true;
    // 有模式 / 要填写的规则，不能靠勾选框直接启用（与状态栏一致）
    if (p && p.modes && p.modes.length) {
        showCustomAlert('「' + name + '」需要先在上面选一个模式才算启用。');
        fh1RenderRules();
        return;
    }
    if (p && p.fill) {
        showCustomAlert('「' + name + '」需要先在框里填内容、点「添加」，填进去的内容本身就是这条规则。');
        fh1RenderRules();
        return;
    }
    FH1_RULES[name] = {};
    fh1RenderRules();
}

function fh1RuleAddEntry(name) {
    var body = document.getElementById('fh1-rules-body');
    var box = body ? body.querySelector('[data-rx-input="' + name + '"]') : null;
    var text = box ? String(box.value || '').trim() : '';
    if (!text) { showCustomAlert('先填内容，再点「添加」。'); return; }

    if (FH1_RULES[name] === undefined) {
        var p = fh1RuleByName(name);
        if (p && p.modes && p.modes.length) { showCustomAlert('「' + name + '」要先选一个模式。'); return; }
        FH1_RULES[name] = {};
    }
    FH1_RULES[name][text] = {};
    fh1RenderRules();
}

function fh1RuleDelEntry(name, text) {
    if (!FH1_RULES[name]) { return; }
    delete FH1_RULES[name][text];
    fh1RenderRules();
}

// 把所选规则的指导拼成 uid 5 的正文（与状态栏 writeInnerGuidance 同一写法：标签包裹、块间 ---）
function fh1RulesGuidance() {
    var blocks = [];
    fh1RulePresets().forEach(function (p) {
        if (FH1_RULES[p.name] !== undefined && p.guide) { blocks.push(String(p.guide).trim()); }
    });
    return '<' + FH1_INNER_TAG + '>\n' + (blocks.length ? blocks.join('\n---\n') : '') + '\n</' + FH1_INNER_TAG + '>';
}

/* --------------------- 开局（「开局选择」页） --------------------- */
/* 卡片列表：这套世界观的预置开局（内容源 世界观\{名}\开局\*.txt）＋ 一张「自定义开局」
   点卡片 → 展开：不受卡片限制、完整展示；下方「▶ 开始剧情」直接发送正文＋变量 */

window.fh1InitStartPanel = function () {
    var box = document.getElementById('fh1-start-list');
    if (!box) return;
    if (!FH1_PRESETS) {
        box.innerHTML = '<div class="fh1-hint">正在加载开局数据…</div>';
        loadFh1Presets().then(function () { fh1RenderStartPanel(); });
        return;
    }
    fh1RenderStartPanel();
};

function fh1StartOpenings() {
    var p = fh1GetPreset(FH1_SELECTED);
    return (p && p.openings) ? p.openings : [];
}

window.fh1RenderStartPanel = function () {
    var box = document.getElementById('fh1-start-list');
    if (!box) return;

    if (!FH1_SELECTED) {
        box.innerHTML = '<div class="fh1-start-gate">' +
            '<div class="fh1-gate-note">请先到「<b>世界观</b>」页挑选一套世界观，选好后点卡片下方的「<b>启用并继续</b>」，' +
            '再回到这里选开局。</div>' +
            '<div class="fh1-gate-btns">' +
                '<button class="fh1-gate-btn primary" onclick="fh1GotoWorldview()">前往世界观</button>' +
            '</div>' +
        '</div>';
        fh1SyncSideBookmarks();
        return;
    }

    var opens = fh1StartOpenings();
    var html = '';

    if (!FH1_START_OPEN) {
        // ① 卡片列表
        html += opens.map(function (o, i) {
            return '<div class="fh1-st-card" onclick="fh1SelectStart(\'preset\',' + i + ')">' +
                '<div class="fh1-st-card-top">' +
                    '<span class="fh1-st-name">' + fh1Esc(o.title || ('开局' + (i + 1))) + '</span>' +
                    '<span class="fh1-st-tag">' + fh1Esc(FH1_SELECTED) + '</span>' +
                '</div>' +
                '<div class="fh1-st-sum">' + fh1Esc(o.summary || '') + '</div>' +
            '</div>';
        }).join('');
        html += '<div class="fh1-st-card fh1-st-card-custom" onclick="fh1SelectStart(\'custom\')">' +
            '<div class="fh1-st-card-top">' +
                '<span class="fh1-st-name">自定义开局</span><span class="fh1-st-tag">自己写</span>' +
            '</div>' +
            '<div class="fh1-st-sum">自己写一段开局（可含 {{user}} 宏），写完点「开始剧情」发送。</div>' +
        '</div>';
        if (!opens.length) {
            html = '<div class="fh1-hint">「' + fh1Esc(FH1_SELECTED) + '」还没有预置开局，可以直接用下面的「自定义开局」。</div>' + html;
        }
    } else if (FH1_START_OPEN === 'custom') {
        // ② 自定义开局：全宽输入区，不受卡片限制（返回列表走右侧「重选」书签）
        html += '<div class="fh1-st-detail">' +
            '<div class="fh1-st-detail-head">' +
                '<span class="fh1-st-name">自定义开局</span>' +
                '<span class="fh1-st-tag">自己写</span>' +
            '</div>' +
            '<textarea id="fh1-st-custom" class="fh1-st-custom" oninput="FH1_START_CUSTOM_TEXT=this.value" ' +
                'placeholder="在这里写你的开局（可含 {{user}} 宏），写完点下方「开始剧情」。">' + fh1Esc(FH1_START_CUSTOM_TEXT) + '</textarea>' +
            '<button class="fh1-apply-btn" onclick="fh1StartStory()">\u25B6 开始剧情</button>' +
        '</div>';
    } else {
        // ③ 预置开局：全宽展示，不受卡片限制（返回列表走右侧「重选」书签）
        var idx = parseInt(String(FH1_START_OPEN).split(':')[1], 10) || 0;
        var o = opens[idx];
        if (!o) { FH1_START_OPEN = ''; fh1RenderStartPanel(); return; }
        html += '<div class="fh1-st-detail">' +
            '<div class="fh1-st-detail-head">' +
                '<span class="fh1-st-name">' + fh1Esc(o.title || '开局') + '</span>' +
                '<span class="fh1-st-tag">' + fh1Esc(FH1_SELECTED) + '</span>' +
            '</div>' +
            '<div class="fh1-st-text">' + fh1Esc(o.text || '') + '</div>' +
            '<button class="fh1-apply-btn" onclick="fh1StartStory()">\u25B6 开始剧情</button>' +
        '</div>';
    }
    box.innerHTML = html;
    fh1SyncSideBookmarks();   // 展开卡片 → 右侧「隐藏 / 重选」跟着出现
};

window.fh1SelectStart = function (kind, i) {
    FH1_START_OPEN = (kind === 'custom') ? 'custom' : ('preset:' + (i | 0));
    fh1RenderStartPanel();
};

window.fh1BackStartList = function () {
    var ta = document.getElementById('fh1-st-custom');
    if (ta) FH1_START_CUSTOM_TEXT = ta.value;
    FH1_START_OPEN = '';
    fh1RenderStartPanel();
};

// 「开始剧情」：先把所选规则的指导写进 uid 5，再把开局正文 ＋ 变量（含 rules）发出去
window.fh1StartStory = async function () {
    if (!FH1_SELECTED) { showCustomAlert('请先到「世界观」页选一套世界观并点「启用并继续」'); return; }

    var text = '';
    if (FH1_START_OPEN === 'custom') {
        var ta = document.getElementById('fh1-st-custom');
        text = ta ? String(ta.value || '') : String(FH1_START_CUSTOM_TEXT || '');
    } else {
        var idx = parseInt(String(FH1_START_OPEN).split(':')[1], 10) || 0;
        var o = fh1StartOpenings()[idx];
        text = o ? String(o.text || '') : '';
    }
    text = text.trim();
    if (!text) { showCustomAlert('开局内容是空的：先选一个开局，或把自定义内容写上'); return; }
    if (typeof triggerSTSlashSend !== 'function') { showCustomAlert('发送接口不可用（triggerSTSlashSend 缺失）'); return; }

    // ① 规则指导 → uid 5。变量随消息走，指导必须在这一局开始前就位，
    //    否则 uid 38 只报了规则名，却让 AI 去看「内化协议里对应的规则指导」，而那条是空的。
    var names = Object.keys(FH1_RULES);
    var res = await fh1WriteWorldbookEntry(FH1_RULES_UID, fh1RulesGuidance());
    if (!res.ok) {
        var go = await showCustomConfirm('规则指导写入世界书 uid ' + FH1_RULES_UID + ' 失败：' + res.msg +
            '\n\n规则变量仍会随开局发送，但 AI 拿不到每条规则的详细指导。\n要照常开始吗？（可取消，再点一次「开始剧情」重试）');
        if (!go) { return; }
    } else {
        console.log('FH1: 已把 ' + names.length + ' 条规则的指导写入 uid ' + FH1_RULES_UID);
    }

    // ② 开局正文 ＋ 变量（rules 由 fh1CollectVars 带上）
    triggerSTSlashSend(text, fh1CollectVars());
    console.log('FH1: 已发送开局（' + FH1_SELECTED + '｜' + (FH1_START_OPEN === 'custom' ? '自定义' : '预置') +
        '｜' + text.length + ' 字｜规则 ' + names.length + ' 条）');
};

window.fh1CollectVars = function () {
    var v = {};
    try {
        if (typeof tabsDataMap !== 'undefined' && tabsDataMap['FH1']) {
            v = JSON.parse(JSON.stringify(tabsDataMap['FH1'].data.variable || {}));
        }
    } catch (e) { v = {}; }
    v.setting = v.setting || {};
    v.setting.mode = (typeof __currentMode !== 'undefined' && __currentMode) ? __currentMode : 'free';
    v.setting.worldview = 'hentai';
    delete v.write;
    delete v['剧情线'];
    if (v['背景信息'] && v['背景信息']['地区'] && Object.keys(v['背景信息']['地区']).length === 0) {
        delete v['背景信息'];
    }
    // 特殊规则：前端开局前没有变量树可写，只能跟开局消息一起投递（<VariableInsert> 里带上 rules）
    // 结构： { 规则名: { 模式?: '...', '常识文本': {} } }；一条都没选时不带这个键
    if (Object.keys(FH1_RULES).length) { v.rules = fh1DeepCopy(FH1_RULES); }
    return v;
};
