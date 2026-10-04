var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

/* =====================================================================
 * 状态栏视图骨架（模式 × 世界观 两个维度）
 * ---------------------------------------------------------------------
 * 维度一：模式（setting.mode）
 *   自由模式 / 剧情模式，两者仅「剧情」区块有区别。
 *   showStage : 是否显示「剧情」面板。
 *
 * 维度二：世界观（setting.worldview）
 *   五个世界观各自读取、处理不同的变量，用 pages 列出各页要渲染的区块 key。
 *   区块 key 对应下方 SECTION_RENDERERS 里的渲染函数。
 *
 * 扩展方式：
 *   - 新增/调整世界观：改 STATUS_WORLDVIEWS（增删 pages 里的 key）。
 *   - 新增区块：在 SECTION_RENDERERS 里加一个 key 对应的渲染函数。
 * ===================================================================== */

// 维度一：模式（只影响「剧情」区块）
var STATUS_MODES = {
    free:   { name: '自由模式', showStage: false },
    script: { name: '剧情模式', showStage: true }
};

// 维度二：世界观（各自读取不同的变量区块）
// pages 是二维数组：pages[i] 为该世界观落在「第 i+2 页」的区块 key 列表
// （第 1 页固定为个人信息，不在此配置）
var STATUS_WORLDVIEWS = {
    medieval: { name: '中世纪童话', pages: [] },
    colony:   { name: '开拓新大陆', pages: [
        ['estate'],         // 第 2 页
        ['ships'],          // 第 3 页
        ['relationship'],   // 第 4 页
        ['region']          // 第 5 页
    ]},
    hentai:   { name: '本子',     pages: [['worldview'], ['ability'], ['character']] },  // TODO 阶段4 待实现渲染器（世界观 / 特殊能力 / 角色状态）
    xianxia:  { name: '东方修仙', pages: [] },  // TODO 待定变量区块
    magic:    { name: '西方魔法', pages: [] }   // TODO 待定变量区块
};

// 解析：模式 × 世界观 → 视图配置
function getStatusView(mode, worldview) {
    var m = STATUS_MODES[mode] || STATUS_MODES.script;
    var w = STATUS_WORLDVIEWS[worldview] || STATUS_WORLDVIEWS.medieval;
    return {
        mode: mode,
        worldview: worldview,
        modeName: m.name,
        worldviewName: w.name,
        showStage: m.showStage,
        pages: w.pages
    };
}

/* ---------------------------------------------------------------------
 * 区块渲染小工具（按现有配色/风格构建 DOM）
 * --------------------------------------------------------------------- */
function fmtValue(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') {
        var s = JSON.stringify(v);
        return s === '{}' || s === '[]' ? '' : s;
    }
    return String(v);
}

function fmtList(v) {
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join('、');
    return String(v);
}

/* ---------------------------------------------------------------------
 * 世界信息条：货币换算 + 时间格式化
 * --------------------------------------------------------------------- */
var COIN_RATIO = 15; // 1 金币 = 15 银币

function parseCoins(goldStr, wealthStr) {
    var r = { gold: 0, silver: 0 };
    var gm = String(goldStr || '').match(/(\d+(?:\.\d+)?)/);
    var sm = String(wealthStr || '').match(/(\d+(?:\.\d+)?)/);
    if (gm) r.gold = parseFloat(gm[1]);
    if (sm) r.silver = parseFloat(sm[1]);
    return r;
}

function normalizeCoins(c) {
    if (c.silver >= COIN_RATIO) {
        c.gold += Math.floor(c.silver / COIN_RATIO);
        c.silver = c.silver % COIN_RATIO;
    }
    return c;
}

function formatWealth(goldStr, wealthStr) {
    var c = parseCoins(goldStr, wealthStr);
    return '金币' + c.gold + '枚，银币' + c.silver + '枚';
}

function formatTime(t) {
    if (!t) return '--:--';
    var s = String(t).trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;
    return s;
}

// 世界信息条的可切换项（顺序即默认展示顺序）
var WIB_ITEMS = [
    { key: 'date',     label: '日期' },
    { key: 'position', label: '位置' },
    { key: 'time',     label: '时间' },
    { key: 'wealth',   label: '财富' }
];

// 家产类型映射：uid27 完整类型名(key) → 选项卡短名(label)，顺序即展示顺序
var ESTATE_TYPES = [
    { key: '居所',             label: '居所' },
    { key: '商业',             label: '商铺' },
    { key: '农事',             label: '农事' },
    { key: '手工业', label: '手工业' },
    { key: '其他',             label: '其他' }
];

// 家产当前选中的选项卡（顶层变量，存 label 短名）
var CURRENT_ESTATE_TAB = '居所';

// 大洲（世界书规定家产 location 第一段优先用这三个）
var CONTINENTS = ['南美', '欧洲', '西非'];
var CURRENT_CONTINENT = '南美';

// 关系界面当前选中的子选项卡
var CURRENT_REL_TAB = '管理';

// 相关人员分组的展开状态（仅会话内记忆、不持久化；状态栏重新出现时恢复默认折叠）
var REL_GROUP_OPEN = {};

// 地区民俗风情的当前选中下标（按地区名记忆，仅会话内）
var REGION_CUSTOM_INDEX = {};

// 自定义角色条目（uid 125~149）内容缓存：条目名 -> 内容
var CACHED_CHAR_ENTRIES = {};

// 薪资确认按钮冷却表：名字 -> 到期时间戳(ms)，跨重渲染保持冷却
var SALARY_COOLDOWN = {};

// story_log 下一个编号（单调递增，只增不减；解析时从后端最大编号恢复）
var STORY_LOG_NEXT = 1;

// 人员分配当前选中的资产 { type: 'estate'|'ship', name }
var CURRENT_ASSIGN_TARGET = null;

// 人员分配当前选中的棋盘选项卡（'家产' | '船只'）
var CURRENT_BOARD_TAB = '家产';

// 家产棋盘是否按地区（大洲）分类
var GROUP_BY_REGION = false;

// 家产棋盘下钻路径（面包屑栈，空数组 = 顶层）
var ESTATE_BOARD_PATH = [];

// 指令系统：分类 → 指令模板（{角色}=目标名，{TA}=代词 男→他/其余→她）
var COMMAND_GROUPS = [
    { name: '基础', commands: [
        { name: '面谈', text: '我叫{角色}过来，我有话跟{TA}说' },
        { name: '传唤', text: '我让人把{角色}给我叫来' },
        { name: '问话', text: '我叫{角色}过来回话' },
        { name: '通报', text: '我叫{角色}过来，让{TA}说说最近都发生了什么事' },
        { name: '待命', text: '我叫{角色}过来，先在我身边候着' }
    ] },
    { name: '服侍', commands: [
        { name: '更衣', text: '我叫{角色}过来给我更衣' },
        { name: '侍浴', text: '我叫{角色}过来伺候我沐浴' },
        { name: '梳妆', text: '我叫{角色}过来给我梳头' },
        { name: '按摩', text: '我叫{角色}过来给我捏捏肩背' },
        { name: '喝下午精', text: '我叫{角色}过来，让{TA}把鸡巴掏出来，我要喝下午精了' },
        { name: '侍寝', text: '我叫{角色}今晚到我房里来' }
    ] },
    { name: '调教', commands: [
        { name: '训话', text: '我叫{角色}过来跪下听训' },
        { name: '立规矩', text: '我叫{角色}过来，把规矩给我背一遍' },
        { name: '惩戒', text: '我叫{角色}过来领罚' },
        { name: '赏赐', text: '我叫{角色}过来领赏' },
        { name: '检查', text: '我叫{角色}过来站好让我看看' }
    ] },
    { name: '产业', commands: [
        { name: '巡视', text: '我命{角色}去巡视各处产业' },
        { name: '催账', text: '我命{角色}去把账收一收' },
        { name: '催货', text: '我命{角色}去催一催这批货' },
        { name: '出货', text: '我命{角色}去把这批货卖掉' }
    ] },
    { name: '航行', commands: [
        { name: '起锚', text: '我命{角色}起锚，准备出航' },
        { name: '瞭望', text: '我命{角色}上瞭望台盯着海面' },
        { name: '掌舵', text: '我命{角色}去掌舵' },
        { name: '整备', text: '我命{角色}带人去把船收拾利索' }
    ] },
    { name: '亲密', commands: [
        { name: '谈心', text: '我叫{角色}过来陪我说说话' },
        { name: '拥抱', text: '我叫{角色}过来，让我抱抱' },
        { name: '侍奉', text: '我叫{角色}过来好好侍奉我' }
    ] }
];

// 指令系统：指令模式开关（勾选后角色卡片才可点击选择）
var COMMAND_MODE = false;

// 指令系统：当前选中的目标角色（点击角色卡片选择）
var SELECTED_PERSON = null;

// 指令系统：指令面板弹窗元素
var COMMAND_POPOVER = null;

// 收款日期与财富处理（状态栏内部逻辑）
function worldDateToISO(worldDate) {
    if (!worldDate) return '';
    var m = String(worldDate).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (!m) return '';
    function p2(s) { return s.length === 1 ? '0' + s : s; }
    return m[1] + '-' + p2(m[2]) + '-' + p2(m[3]);
}

function daysBetween(iso1, iso2) {
    var d1 = new Date(iso1 + 'T00:00:00Z');
    var d2 = new Date(iso2 + 'T00:00:00Z');
    return Math.round((d2 - d1) / 86400000);
}

function addWealthSilver(wealthStr, amount) {
    amount = Math.round(amount);
    var s = String(wealthStr);
    var m = s.match(/银币\s*(\d+(?:\.\d+)?)/);
    if (m) {
        return s.replace(/银币\s*\d+(?:\.\d+)?/, '银币 ' + (parseFloat(m[1]) + amount));
    }
    return (s ? s + ', ' : '') + '银币 ' + amount + ' 枚';
}

/* 本地即时同步与刷新：结算动作成功后同步本地数据并重渲染；
 * 刷新按钮重读最新变量（同步 AI 剧情改动、重置按钮状态）。 */
function getStatusApp() {
    return (typeof window !== 'undefined' && window.STATUS_APP) ? window.STATUS_APP : null;
}

function setLocalWealth(wealthStr) {
    var app = getStatusApp();
    if (app && app.state && app.state.parsedData && app.state.parsedData.user) {
        app.state.parsedData.user.wealth = wealthStr;
    }
}

function syncLocalRender() {
    var app = getStatusApp();
    if (app && app.ui && app.ui.updateAll) {
        app.ui.updateAll();
    }
}

function refreshVariables(done) {
    var app = getStatusApp();
    if (!app || !app.parsers || !app.parsers.getVariableData) {
        if (done) done();
        return;
    }
    app.parsers.getVariableData().then(function(raw) {
        app.state.parsedData = app.parsers.parseData(raw);
        var prev = app.state.prevRenderData;
        prev.modeForSections = null;
        prev.modeExtra = null;
        prev.world = null;
        prev.wealth = null;
        prev.gold = null;
        return refreshCharEntries();
    }).then(function() {
        app.ui.updateAll();
        if (done) done();
    }).catch(function() {
        app.ui.updateAll();
        if (done) done();
    });
}

// 刷新所有转化方针下拉（方针编辑面板关闭后调用）
function refreshPolicySelects() {
    var p = getConversionPolicies();
    document.querySelectorAll('.conv-policy-select').forEach(function(sel) {
        sel.innerHTML = '';
        p.defaults.forEach(function(policy, i) {
            var o = document.createElement('option');
            o.value = 'd' + i; o.textContent = policy.name;
            sel.appendChild(o);
        });
        p.customs.forEach(function(policy, i) {
            var o = document.createElement('option');
            o.value = 'c' + i; o.textContent = policy.name;
            sel.appendChild(o);
        });
        sel.value = p.activeKey;
    });
}

// 关闭指令/就职弹窗并清除选中状态（切换选项卡或翻页时调用）
function closeOverlays() {
    if (ASSIGN_POPOVER) {
        ASSIGN_POPOVER.remove();
        ASSIGN_POPOVER = null;
    }
    closeCommandPanel();
    CURRENT_ASSIGN_TARGET = null;
    var sel = document.querySelector('.asset-tile.selected');
    if (sel) sel.classList.remove('selected');
    SELECTED_PERSON = null;
    document.querySelectorAll('.person-card.person-selected').forEach(function(el) { el.classList.remove('person-selected'); });
}

// 归一化 story_log：兼容旧格式（JSON 字符串 / 对象数组 / 编号对象），统一为字符串数组（旧→新），并恢复下一个编号
function normalizeStoryLog(raw) {
    var out = [];
    STORY_LOG_NEXT = 1;
    if (raw === null || raw === undefined) return out;
    var src = raw;
    if (typeof src === 'string') {
        try { src = JSON.parse(src); } catch (e) { return out; }
    }
    function pushText(v) {
        if (v && typeof v === 'object') {
            out.push(v.text || v.content || '');
        } else {
            out.push(String(v == null ? '' : v));
        }
    }
    if (Array.isArray(src)) {
        src.forEach(pushText);
        STORY_LOG_NEXT = out.length + 1;
    } else if (typeof src === 'object') {
        var keys = Object.keys(src).filter(function(k) { return /^\d+$/.test(k); });
        keys.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
        var max = 0;
        keys.forEach(function(k) {
            pushText(src[k]);
            var n = parseInt(k, 10);
            if (n > max) max = n;
        });
        STORY_LOG_NEXT = max + 1;
    }
    return out;
}

// 修改角色薪资：写回 relationship.<名>.expense 并记录涨/降薪到 story_log
function updatePersonSalary(name, person, input, data) {
    var old = extractCount(person.expense);
    var next = Math.floor(parseFloat(input.value));
    if (isNaN(next) || next < 0) { input.value = old; return; }
    if (next === old) return;
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); input.value = old; return; }
    var hadExpense = person.expense !== undefined && person.expense !== null && String(person.expense).trim() !== '';
    var nextExpense = next + ' 银币/月';
    person.expense = nextExpense;
    var payload = {};
    payload[name] = { expense: nextExpense };
    if (hadExpense) window.eventEmit('era:updateByObject', { relationship: payload });
    else window.eventEmit('era:insertByObject', { relationship: payload });
    var verb = next > old ? '涨薪' : '降薪';
    var text = verb + '：' + name + ' 的月薪由 ' + old + ' 银币' + (next > old ? '涨至' : '降至') + ' ' + next + ' 银币';
    appendStoryLog(data, text);
    syncLocalRender();
}

// 追加一条故事日志（写入 story_log 变量；只增不删，刷新已打开的日志面板）
function appendStoryLog(data, text) {
    var log = (data.story_log || []).slice();
    log.push(text);
    data.story_log = log;
    if (typeof window.eventEmit === 'function') {
        // 新条目 = 新编号键 → insertByObject（只写不存在的路径，正好匹配新键；旧键不动）
        var payload = {};
        payload[String(STORY_LOG_NEXT)] = text;
        STORY_LOG_NEXT++;
        window.eventEmit('era:insertByObject', { story_log: payload });
    }
    var panel = document.getElementById('story-log-panel');
    if (panel && panel.classList.contains('open')) renderStoryLog(log);
}

// 追加故事日志（从当前 parsedData 取上下文；由结算动作内部调用，不触发重渲染）
function appendStatusLog(text) {
    var app = getStatusApp();
    if (app && app.state && app.state.parsedData) {
        appendStoryLog(app.state.parsedData, text);
    }
}

// 渲染故事日志面板：逐条展示（最新在上），不再按日期分隔
function renderStoryLog(log) {
    var content = document.getElementById('story-log-content');
    if (!content) return;
    content.innerHTML = '';
    if (!log || !log.length) {
        content.appendChild(buildEmptyHint('暂无故事日志...'));
        return;
    }
    var items = log.slice().reverse();
    items.forEach(function(t) {
        var row = document.createElement('div');
        row.className = 'story-log-item';
        row.textContent = t;
        content.appendChild(row);
    });
}

// 打开故事日志面板：先读取最新变量，再渲染日志
function openStoryLogPanel() {
    var panel = document.getElementById('story-log-panel');
    if (panel) panel.classList.add('open');
    var app = getStatusApp();
    if (app && app.parsers && app.parsers.getVariableData) {
        refreshVariables(function() {
            var log = (app.state.parsedData && app.state.parsedData.story_log) || [];
            renderStoryLog(log);
        });
    } else {
        renderStoryLog((app && app.state && app.state.parsedData && app.state.parsedData.story_log) || []);
    }
}

// 船只选项卡类别（与 uid27 船只 type 枚举一致，按 uid80 船只参考档位排序）
var SHIP_TYPES = ['小艇', '渔船', '双桅帆船', '商船', '盖伦船', '大型商船', '护卫舰', '战列舰'];

// 船只当前选中的选项卡（顶层变量，初始为空，渲染时回退到第一个有船的类型）
var CURRENT_SHIP_TAB = '';

// 货物品质评分与分级（用于「分类」展示模式）
var QUALITY_SCORES = { '次品': 0, '中等': 60, '良': 75, '优': 90, '上好': 100 };

function qualityToScore(q) {
    return QUALITY_SCORES[q] !== undefined ? QUALITY_SCORES[q] : 0;
}

function scoreToQuality(avg) {
    if (avg < 30) return '次品';
    if (avg < 67.5) return '中等';
    if (avg < 82.5) return '良';
    if (avg < 95) return '优';
    return '上好';
}

function extractCount(countStr) {
    if (countStr === undefined || countStr === null) return 0;
    if (typeof countStr === 'number') return countStr;
    if (typeof countStr === 'object') {
        return extractCount(countStr.count !== undefined ? countStr.count : countStr.数目);
    }
    var m = String(countStr).match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : 0;
}

/* =====================================================================
 * 单位换算（状态栏内部）：统一折算到「价格基准单位」再计算价格
 * ---------------------------------------------------------------------
 * 重量类 → 磅；酒类 → 加仑；纺织品 → 匹；件数类（珠宝/杂货）→ 件。
 * 大/小前缀：大 = ×1.5（+50%），小 = ×0.4（-60%）。
 * ===================================================================== */

var UNIT_PREFIX_MULT = { '大': 1.5, '小': 0.4 };

// 重量 → 磅
var UNIT_TO_POUND = {
    '磅': 1,
    '担': 100,
    '吨': 2240,
    '捆': 50,
    '包': 100,
    '袋': 100,
    '箱': 80,
    '桶': 100
};

// 容积 → 加仑
var UNIT_TO_GALLON = {
    '加仑': 1,
    '桶': 31.5,
    '大桶': 63
};

// 布匹 → 匹
var UNIT_TO_PI = {
    '匹': 1,
    '件': 0.1,
    '捆': 10,
    '包': 20
};

// 件数类 → 件（珠宝、杂货共用；磅为杂货按重量折件，1 件 ≈ 10 磅）
var UNIT_TO_PIECE = {
    '件': 1,
    '磅': 0.1,
    '袋': 10,
    '箱': 50
};

// 奴隶 → 名
var UNIT_TO_PERSON = {
    '名': 1
};

// 动物 → 头
var UNIT_TO_HEAD = {
    '头': 1,
    '匹': 1,
    '只': 1
};

// 品类 → 价格基准单位（未列出的默认按磅）
var CATEGORY_BASE_UNIT = {
    '酒类': '加仑',
    '纺织品': '匹',
    '贵重珠宝': '件',
    '杂货': '件',
    '奴隶': '名',
    '动物': '头'
};

function getCategoryBaseUnit(category) {
    return CATEGORY_BASE_UNIT[category] || '磅';
}

function parseCountUnit(countStr) {
    if (countStr === undefined || countStr === null) return { num: 0, unit: '' };
    if (typeof countStr === 'number') return { num: countStr, unit: '' };
    var s = String(countStr).trim();
    var m = s.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    var num = m ? parseFloat(m[1]) : 0;
    var unit = m ? m[2] : '';
    return { num: num, unit: unit };
}

// 把「数字+量词」折算到该品类的价格基准单位（磅/加仑/匹/件）。
function convertToBase(countStr, category) {
    var p = parseCountUnit(countStr);
    if (!p.unit) return p.num;
    var base = getCategoryBaseUnit(category);
    var table;
    if (base === '加仑') table = UNIT_TO_GALLON;
    else if (base === '匹') table = UNIT_TO_PI;
    else if (base === '件') table = UNIT_TO_PIECE;
    else if (base === '名') table = UNIT_TO_PERSON;
    else if (base === '头') table = UNIT_TO_HEAD;
    else table = UNIT_TO_POUND;
    var factor = table[p.unit];
    if (factor === undefined && (p.unit[0] === '大' || p.unit[0] === '小')) {
        var inner = table[p.unit.slice(1)];
        if (inner !== undefined) factor = inner * (UNIT_PREFIX_MULT[p.unit[0]] || 1);
    }
    if (factor === undefined || factor === null) factor = 1;
    return p.num * factor;
}

// 分类基础价区间（银币/基准单位：磅/加仑/匹/件），下限=次品价、上限=上好价
var CATEGORY_PRICE_RANGES = {
    '粮食': [0.05, 0.25],
    '酒类': [0.3, 1.5],
    '种植园作物': [0.15, 0.8],
    '纺织品': [2, 10],
    '军火': [0.15, 0.6],
    '杂货': [0.5, 3],
    '香料': [0.5, 3.0],
    '贵重珠宝': [80, 600]
};

// 奴隶/动物按 type 直接计价（不按品质插值），单位：银币/名、银币/头
var SLAVE_TYPE_PRICE = { '健壮': 300, '幼小': 150, '瘦弱': 100, '病老': 50 };
var ANIMAL_TYPE_PRICE = { '健壮': 60, '幼小': 30, '瘦弱': 20, '病老': 10 };

function isSpecialCategory(cat) {
    return cat === '奴隶' || cat === '动物';
}

// 按分类计算货值：普通货物按分类聚合+品质插值；奴隶/动物按 type 直接逐条计价相加
function calculateCargoValue(cargo) {
    if (!cargo) return 0;
    var groups = {};
    var specialValue = 0;
    Object.keys(cargo).forEach(function(name) {
        var c = cargo[name] || {};
        var cat = c.category || '未分类';
        if (isSpecialCategory(cat)) {
            var n = extractCount(c.count);
            var priceTable = (cat === '奴隶') ? SLAVE_TYPE_PRICE : ANIMAL_TYPE_PRICE;
            var unit = priceTable[c.type];
            if (unit === undefined || unit === null) unit = (cat === '奴隶') ? SLAVE_TYPE_PRICE['病老'] : ANIMAL_TYPE_PRICE['病老'];
            specialValue += n * unit;
            return;
        }
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ count: convertToBase(c.count, cat), quality: c.quality });
    });
    var totalValue = specialValue;
    Object.keys(groups).forEach(function(cat) {
        var range = CATEGORY_PRICE_RANGES[cat];
        if (!range) return;
        var items = groups[cat];
        var total = 0, weighted = 0;
        items.forEach(function(it) {
            total += it.count;
            weighted += it.count * qualityToScore(it.quality);
        });
        if (total <= 0) return;
        var s = weighted / total;
        var unitPrice = range[0] + (range[1] - range[0]) * (s / 100);
        totalValue += total * unitPrice;
    });
    return Math.round(totalValue);
}

function buildSectionTitle(iconEntity, title) {
    var t = document.createElement('div');
    t.className = 'section-title';
    t.innerHTML = iconEntity + ' ' + title;
    return t;
}

function buildKVList(rows) {
    var list = document.createElement('div');
    list.className = 'kv-list';
    var has = false;
    rows.forEach(function(r) {
        var v = fmtValue(r.value);
        if (!v) return;
        has = true;
        var row = document.createElement('div');
        row.className = 'kv-row';
        var lbl = document.createElement('span');
        lbl.className = 'kv-label';
        lbl.textContent = r.label + '：';
        var val = document.createElement('span');
        val.className = 'kv-value';
        val.textContent = v;
        row.appendChild(lbl);
        row.appendChild(val);
        list.appendChild(row);
    });
    return has ? list : null;
}

function buildEmptyHint(text) {
    var hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = text || '暂无数据...';
    return hint;
}

function buildEntityCard(name, rows) {
    var card = document.createElement('div');
    card.className = 'entity-card';
    var nameEl = document.createElement('div');
    nameEl.className = 'entity-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);
    var list = buildKVList(rows);
    if (list) card.appendChild(list);
    return card;
}

// 地区卡：描述 + 民俗风情（左右箭头切换不同民俗）
function buildRegionCard(name, r) {
    var card = document.createElement('div');
    card.className = 'entity-card region-card';
    var nameEl = document.createElement('div');
    nameEl.className = 'entity-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);

    var descLabel = document.createElement('div');
    descLabel.className = 'region-field-label';
    descLabel.textContent = '描述';
    card.appendChild(descLabel);
    var descVal = document.createElement('div');
    descVal.className = 'region-desc';
    descVal.textContent = r['描述'] || r.description || '';
    card.appendChild(descVal);

    var customs = r['民俗风情'] || {};
    var customKeys = Object.keys(customs);
    var customsLabel = document.createElement('div');
    customsLabel.className = 'region-field-label';
    customsLabel.textContent = '民俗风情：';
    card.appendChild(customsLabel);

    if (!customKeys.length) {
        var empty = buildEmptyHint('暂无民俗风情');
        card.appendChild(empty);
        return card;
    }

    var idx = REGION_CUSTOM_INDEX[name] || 0;
    if (idx >= customKeys.length) idx = 0;
    REGION_CUSTOM_INDEX[name] = idx;

    var nav = document.createElement('div');
    nav.className = 'region-custom-nav';
    var leftBtn = document.createElement('button');
    leftBtn.type = 'button';
    leftBtn.className = 'region-arrow-btn';
    leftBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'region-custom-name';
    var rightBtn = document.createElement('button');
    rightBtn.type = 'button';
    rightBtn.className = 'region-arrow-btn';
    rightBtn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M9 5 L16 12 L9 19" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    nav.appendChild(leftBtn);
    nav.appendChild(nameSpan);
    nav.appendChild(rightBtn);
    card.appendChild(nav);

    var contentEl = document.createElement('div');
    contentEl.className = 'region-custom-content';
    card.appendChild(contentEl);

    function render() {
        var i = REGION_CUSTOM_INDEX[name] || 0;
        if (i >= customKeys.length) i = 0;
        nameSpan.textContent = customKeys[i];
        contentEl.textContent = customs[customKeys[i]] || '';
    }
    leftBtn.addEventListener('click', function() {
        var i = (REGION_CUSTOM_INDEX[name] || 0);
        REGION_CUSTOM_INDEX[name] = (i - 1 + customKeys.length) % customKeys.length;
        render();
    });
    rightBtn.addEventListener('click', function() {
        var i = (REGION_CUSTOM_INDEX[name] || 0);
        REGION_CUSTOM_INDEX[name] = (i + 1) % customKeys.length;
        render();
    });
    render();
    return card;
}

// 收款：月营收视为 30 天，按天向上取整；首次收款收一个月，否则按日期差计；写入财富与收款日期
function collectEstateRevenue(name, estate, todayISO, currentWealth, btn, info) {
    if (!todayISO) { alert('当前日期无法解析，无法收款。'); return; }
    var monthly = extractCount(estate.revenue);
    if (!monthly || monthly <= 0) return;
    var daily = Math.ceil(monthly / 30);
    var last = estate.last_collected;
    var isFirst = !last;
    var days = isFirst ? 30 : daysBetween(last, todayISO);
    if (days < 0) days = 0;
    var amount = daily * days;

    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return; }

    var newWealth = addWealthSilver(currentWealth, amount);
    var estatePayload = {};
    estatePayload[name] = { last_collected: todayISO };

    if (isFirst) {
        window.eventEmit('era:updateByObject', { user: { wealth: newWealth } });
        window.eventEmit('era:insertByObject', { estate: estatePayload });
    } else {
        window.eventEmit('era:updateByObject', { user: { wealth: newWealth }, estate: estatePayload });
    }

    estate.last_collected = todayISO;
    setLocalWealth(newWealth);
    appendStatusLog('经营：' + name + '营收了' + amount + '银币');
    syncLocalRender();
    if (info) info.textContent = '上次收款：' + todayISO;
    if (btn) { btn.textContent = '已收 ' + amount + ' 银币'; btn.disabled = true; }
}

// 收获：种植园（农事）把月产作物收进仓库
var HARVEST_MIN_DAYS = 20;

// 家产所在大洲：location 第一段（"南美 - 巴西 - 累西腓" → "南美"）
function getRegion(location) {
    if (!location) return '本地';
    var parts = String(location).split(' - ');
    return (parts[0] || '').trim() || '本地';
}

// 销售参考价（银币/磅），未收录的物品按 SELL_DEFAULT_PRICE
var SELL_PRICES = {
    '甘蔗': 0.05, '烟草': 0.15, '棉花': 0.25, '小麦': 0.08, '靛蓝': 0.3, '可可': 0.25,
    '糖': 0.3, '糖蜜': 0.1, '面粉': 0.2, '布匹': 0.5, '工具': 0.5, '农具': 0.4, '武器': 1.0
};
var SELL_DEFAULT_PRICE = 0.1;

function sellPriceOf(item) {
    var p = SELL_PRICES[item];
    return (p === undefined || p === null) ? SELL_DEFAULT_PRICE : p;
}

// 同步某地区仓库：新增键 insert、已存在键 update、消失键 delete
function syncRegionWarehouse(region, oldRegionWarehouse, newRegionWarehouse) {
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return false; }
    var insert = {};
    var update = {};
    var del = {};
    Object.keys(newRegionWarehouse).forEach(function(k) {
        var v = newRegionWarehouse[k];
        if (typeof v === 'number') v = Math.floor(v);
        if (oldRegionWarehouse && oldRegionWarehouse[k] !== undefined) update[k] = v;
        else insert[k] = v;
    });
    Object.keys(oldRegionWarehouse || {}).forEach(function(k) {
        if (newRegionWarehouse[k] === undefined) del[k] = {};
    });
    if (Object.keys(insert).length) {
        var ip = {}; ip[region] = insert;
        window.eventEmit('era:insertByObject', { warehouse: ip });
    }
    if (Object.keys(update).length) {
        var up = {}; up[region] = update;
        window.eventEmit('era:updateByObject', { warehouse: up });
    }
    if (Object.keys(del).length) {
        var dp = {}; dp[region] = del;
        window.eventEmit('era:deleteByObject', { warehouse: dp });
    }
    return true;
}

// "500担/月" → 磅
function outputToPound(outputStr) {
    var s = String(outputStr || '').replace(/\/月\s*$/, '').trim();
    var p = parseCountUnit(s);
    if (!p.unit) return p.num;
    var factor = UNIT_TO_POUND[p.unit];
    if (factor === undefined && (p.unit[0] === '大' || p.unit[0] === '小')) {
        var inner = UNIT_TO_POUND[p.unit.slice(1)];
        if (inner !== undefined) factor = inner * (UNIT_PREFIX_MULT[p.unit[0]] || 1);
    }
    if (factor === undefined || factor === null) factor = 1;
    return p.num * factor;
}

// 解析农事月产：单作物（output 字符串）或多作物（output 对象）→ [{crop, monthlyPound}]
function parseEstateOutputs(estate) {
    var list = [];
    var out = estate && estate.output;
    if (!out) return list;
    if (typeof out === 'string') {
        var crop = (estate.product && typeof estate.product === 'string') ? estate.product : '作物';
        list.push({ crop: crop, monthlyPound: outputToPound(out) });
    } else if (typeof out === 'object') {
        Object.keys(out).forEach(function(crop) {
            list.push({ crop: crop, monthlyPound: outputToPound(out[crop]) });
        });
    }
    return list;
}

// 产出块显示文本（支持多作物/多产品）
function formatEstateOutput(estate) {
    if (estate.revenue) return { label: '月营收', value: String(estate.revenue) };
    var out = estate.output;
    if (!out) return null;
    if (typeof out === 'string') {
        var crop = (estate.product && typeof estate.product === 'string') ? estate.product : '';
        return { label: '月产', value: crop ? (crop + ' ' + out) : String(out) };
    }
    if (typeof out === 'object') {
        var parts = Object.keys(out).map(function(k) { return k + ' ' + out[k]; });
        return { label: '月产', value: parts.join('、') };
    }
    return null;
}

// 收获：首次收一个月，不足 20 天不可收，满 20 天按天数比例收；写入该地区仓库
function collectEstateHarvest(name, estate, todayISO, warehouse, region, btn, info) {
    if (!todayISO) { alert('当前日期无法解析，无法收获。'); return; }
    var outputs = parseEstateOutputs(estate);
    if (!outputs.length) return;
    var last = estate.last_harvested;
    var isFirst = !last;
    var days = isFirst ? 30 : daysBetween(last, todayISO);
    if (isNaN(days)) days = 0;
    if (!isFirst && days < HARVEST_MIN_DAYS) return;
    if (days < 0) days = 0;
    var ratio = days / 30;

    var regionWarehouse = (warehouse && warehouse[region]) || {};
    var newWarehouse = {};
    Object.keys(regionWarehouse).forEach(function(k) { newWarehouse[k] = regionWarehouse[k]; });
    var totalGain = 0;
    outputs.forEach(function(o) {
        var amt = Math.floor(o.monthlyPound * ratio);
        newWarehouse[o.crop] = (newWarehouse[o.crop] || 0) + amt;
        totalGain += amt;
    });

    if (!syncRegionWarehouse(region, regionWarehouse, newWarehouse)) return;

    var estatePayload = {};
    estatePayload[name] = { last_harvested: todayISO };
    if (isFirst) window.eventEmit('era:insertByObject', { estate: estatePayload });
    else window.eventEmit('era:updateByObject', { estate: estatePayload });

    estate.last_harvested = todayISO;
    if (warehouse) warehouse[region] = newWarehouse;
    var cropNames = outputs.map(function(o) { return o.crop; }).join('、');
    appendStatusLog('收获：' + name + '收获了' + cropNames + Math.round(totalGain) + ' 磅');
    syncLocalRender();
    if (info) info.textContent = '上次收获：' + todayISO;
    if (btn) { btn.textContent = '已收 ' + Math.round(totalGain) + ' 磅'; btn.disabled = true; }
}

/* ============ 转化比例方针（手工业生产转化） ============ */
var DEFAULT_POLICIES = [
    { name: '粗放转化', ratio: '10:1', limits: [100, 500, 2000], desc: '适合大宗农产加工：甘蔗→糖、甘蔗→糖蜜' },
    { name: '精制转化', ratio: '15:1', limits: [50, 200, 1000], desc: '适合高耗原料加工：棉花→棉布、亚麻→麻布' },
    { name: '快速转化', ratio: '7:1', limits: [200, 1000, 5000], desc: '适合高转化率加工：糖蜜→朗姆酒、小麦→面粉' }
];
var CONV_POLICY_KEY = 'state_convpolicies';
var conversionPolicies = null;

function getConversionPolicies() {
    if (conversionPolicies) return conversionPolicies;
    try {
        var saved = JSON.parse(localStorage.getItem(CONV_POLICY_KEY));
        if (saved && saved.defaults) {
            conversionPolicies = saved;
            if (!conversionPolicies.activeLimit) conversionPolicies.activeLimit = 100;
            return conversionPolicies;
        }
    } catch (e) {}
    conversionPolicies = {
        defaults: JSON.parse(JSON.stringify(DEFAULT_POLICIES)),
        customs: [],
        activeKey: 'd0',
        activeLimit: DEFAULT_POLICIES[0].limits[1]
    };
    return conversionPolicies;
}
function saveConversionPolicies() {
    try { localStorage.setItem(CONV_POLICY_KEY, JSON.stringify(conversionPolicies)); } catch (e) {}
}
function convPolicyByIdx(p, key) {
    if (!key) key = 'd0';
    if (key.charAt(0) === 'c') return p.customs[parseInt(key.slice(1), 10)];
    return p.defaults[parseInt(key.slice(1), 10)];
}
function convActivePolicy(p) {
    return convPolicyByIdx(p, p.activeKey) || p.defaults[0];
}
function convRatioNumbers(ratio) {
    var m = String(ratio || '').match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (!m) return { in: 10, out: 1 };
    return { in: parseFloat(m[1]) || 1, out: parseFloat(m[2]) || 1 };
}

// 转化比例方针面板：默认方针 ×3 + 自定义方针，可改名/改比例/选每日上限，可重置
function openPolicyModal(onDone) {
    var p = getConversionPolicies();
    var overlay = document.createElement('div');
    overlay.className = 'conv-policy-overlay';
    var panel = document.createElement('div');
    panel.className = 'conv-policy-panel';

    var head = document.createElement('div');
    head.className = 'conv-policy-head';
    var headTitle = document.createElement('span');
    headTitle.className = 'conv-policy-title';
    headTitle.textContent = '转化比例方针';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'conv-policy-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() { overlay.remove(); if (onDone) onDone(); });
    head.appendChild(headTitle); head.appendChild(closeBtn);
    panel.appendChild(head);

    var listArea = document.createElement('div');
    listArea.className = 'conv-policy-list';
    panel.appendChild(listArea);

    function renderPolicyList() {
        while (listArea.firstChild) listArea.removeChild(listArea.firstChild);
        var sections = [
            { label: '默认方针', items: p.defaults, baseKey: 'd' },
            { label: '自定义方针', items: p.customs, baseKey: 'c' }
        ];
        sections.forEach(function(sec) {
            if (!sec.items.length) return;
            var secTitle = document.createElement('div');
            secTitle.className = 'conv-policy-section-title';
            secTitle.textContent = sec.label;
            listArea.appendChild(secTitle);
            sec.items.forEach(function(policy, i) {
                var key = sec.baseKey + i;
                var row = document.createElement('div');
                row.className = 'conv-policy-row' + (key === p.activeKey ? ' selected' : '');
                var radio = document.createElement('input');
                radio.type = 'radio'; radio.name = 'conv-policy'; radio.checked = (key === p.activeKey);
                radio.addEventListener('change', function() {
                    p.activeKey = key;
                    p.activeLimit = (policy.limits && policy.limits.length) ? policy.limits[0] : 100;
                    saveConversionPolicies();
                    renderPolicyList();
                });
                row.appendChild(radio);
                var nameInput = document.createElement('input');
                nameInput.type = 'text'; nameInput.value = policy.name;
                nameInput.title = '方针名称';
                nameInput.className = 'conv-policy-input conv-policy-name';
                nameInput.addEventListener('change', function() { policy.name = nameInput.value; saveConversionPolicies(); });
                row.appendChild(nameInput);
                var ratioInput = document.createElement('input');
                ratioInput.type = 'text'; ratioInput.value = policy.ratio;
                ratioInput.title = '转化比例（原料:产品，如 10:1）';
                ratioInput.className = 'conv-policy-input conv-policy-ratio';
                ratioInput.addEventListener('change', function() { policy.ratio = ratioInput.value; saveConversionPolicies(); });
                row.appendChild(ratioInput);
                var limitSel = document.createElement('select');
                limitSel.title = '每日转化上限（磅）';
                limitSel.className = 'conv-policy-input conv-policy-limit';
                (policy.limits || []).forEach(function(l) {
                    var o = document.createElement('option');
                    o.value = l; o.textContent = l + ' 磅/日';
                    limitSel.appendChild(o);
                });
                limitSel.value = String(p.activeLimit);
                limitSel.addEventListener('change', function() {
                    p.activeLimit = parseInt(limitSel.value, 10);
                    saveConversionPolicies();
                });
                row.appendChild(limitSel);
                var descInput = document.createElement('input');
                descInput.type = 'text'; descInput.value = policy.desc || '';
                descInput.placeholder = '说明（适合何种手工业）';
                descInput.className = 'conv-policy-input conv-policy-desc';
                descInput.addEventListener('change', function() { policy.desc = descInput.value; saveConversionPolicies(); });
                row.appendChild(descInput);
                listArea.appendChild(row);
            });
        });
        if (!p.defaults.length && !p.customs.length) {
            var empty = document.createElement('div');
            empty.className = 'conv-policy-empty';
            empty.textContent = '暂无方针';
            listArea.appendChild(empty);
        }
    }
    renderPolicyList();

    var foot = document.createElement('div');
    foot.className = 'conv-policy-foot';
    var addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.className = 'collect-btn';
    addBtn.textContent = '+ 新增自定义方针';
    addBtn.addEventListener('click', function() {
        p.customs.push({ name: '自定义方针' + (p.customs.length + 1), ratio: '10:1', limits: [100, 500], desc: '' });
        p.activeKey = 'c' + (p.customs.length - 1);
        p.activeLimit = 100;
        saveConversionPolicies();
        renderPolicyList();
    });
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button'; resetBtn.className = 'collect-btn';
    resetBtn.textContent = '方针重置';
    resetBtn.addEventListener('click', function() {
        p.defaults = JSON.parse(JSON.stringify(DEFAULT_POLICIES));
        p.customs = [];
        p.activeKey = 'd0';
        p.activeLimit = DEFAULT_POLICIES[0].limits[1];
        saveConversionPolicies();
        renderPolicyList();
    });
    var doneBtn = document.createElement('button');
    doneBtn.type = 'button'; doneBtn.className = 'collect-btn';
    doneBtn.textContent = '完成';
    doneBtn.addEventListener('click', function() { overlay.remove(); if (onDone) onDone(); });
    foot.appendChild(addBtn); foot.appendChild(resetBtn); foot.appendChild(doneBtn);
    panel.appendChild(foot);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}

// 生产转化：把选中的原料按方针比例转化为产品，写入该地区仓库；受每日上限约束
function collectConversionByPolicy(name, estate, todayISO, warehouse, region, material, productName, policy, limit, inputPounds, btn, resultEl) {
    if (!todayISO) { alert('当前日期无法解析，无法转化。'); return; }
    inputPounds = Math.floor(parseFloat(inputPounds));
    if (!inputPounds || inputPounds <= 0) { alert('请输入有效的转化数量。'); return; }
    if (!material) { alert('请先选择原料（生产方式）。'); return; }
    var regionWarehouse = (warehouse && warehouse[region]) || {};
    var have = regionWarehouse[material] || 0;
    if (have < inputPounds) { alert('原料不足：' + material + ' 仅剩 ' + Math.round(have) + ' 磅'); return; }
    if (inputPounds > limit) { alert('超过单次转化上限（' + limit + ' 磅）。'); return; }
    var todayUsed = (estate.last_converted_date === todayISO) ? (estate.converted_today || 0) : 0;
    if (todayUsed + inputPounds > limit) { alert('超过今日转化上限（' + limit + ' 磅，今日已用 ' + Math.round(todayUsed) + ' 磅）。'); return; }

    var r = convRatioNumbers(policy && policy.ratio);
    var outPounds = Math.floor(inputPounds * r.out / r.in);

    var newWarehouse = {};
    Object.keys(regionWarehouse).forEach(function(k) { newWarehouse[k] = regionWarehouse[k]; });
    newWarehouse[material] = (newWarehouse[material] || 0) - inputPounds;
    if (newWarehouse[material] <= 0) delete newWarehouse[material];
    newWarehouse[productName] = (newWarehouse[productName] || 0) + outPounds;
    if (!syncRegionWarehouse(region, regionWarehouse, newWarehouse)) return;

    var estatePayload = {};
    estatePayload[name] = { last_converted_date: todayISO, converted_today: Math.floor(todayUsed + inputPounds) };
    var isFirstConv = !estate.last_converted_date;
    if (isFirstConv) window.eventEmit('era:insertByObject', { estate: estatePayload });
    else window.eventEmit('era:updateByObject', { estate: estatePayload });
    estate.last_converted_date = todayISO;
    estate.converted_today = Math.floor(todayUsed + inputPounds);
    if (warehouse) warehouse[region] = newWarehouse;
    appendStatusLog('生产：' + name + '生产了' + Math.round(outPounds) + '磅' + productName);
    syncLocalRender();

    if (btn) btn.textContent = '已转化';
    if (resultEl) resultEl.textContent = '消耗 ' + Math.round(inputPounds) + ' 磅' + material + '，生成 ' + Math.round(outPounds) + ' 磅' + productName;
}

// 出售：商铺把该地区仓库所有商品按参考价卖成银币（清空该地区仓库）
function collectSell(name, estate, todayISO, currentWealth, warehouse, region, btn, info) {
    var regionWarehouse = (warehouse && warehouse[region]) || {};
    var items = Object.keys(regionWarehouse).filter(function(k) { return (regionWarehouse[k] || 0) > 0; });
    if (!items.length) { alert('该地区仓库暂无商品可卖。'); return; }

    var total = 0;
    items.forEach(function(item) { total += regionWarehouse[item] * sellPriceOf(item); });
    total = Math.round(total);

    var newWealth = addWealthSilver(currentWealth, total);
    var newWarehouse = {};
    Object.keys(regionWarehouse).forEach(function(k) { if (items.indexOf(k) === -1) newWarehouse[k] = regionWarehouse[k]; });

    if (!syncRegionWarehouse(region, regionWarehouse, newWarehouse)) return;
    window.eventEmit('era:updateByObject', { user: { wealth: newWealth } });

    if (warehouse) warehouse[region] = newWarehouse;
    setLocalWealth(newWealth);
    appendStatusLog('出售：' + name + '售出了' + items.join('、') + '，获得 ' + total + ' 银币');
    syncLocalRender();
    if (btn) { btn.textContent = '已卖 ' + total + ' 银币'; btn.disabled = true; }
    if (info) info.textContent = '售出：' + items.join('、');
}

// 仓库表格（单地区）：物品 / 数量（磅）
function buildWarehouseTable(regionWarehouse) {
    var rows = [];
    Object.keys(regionWarehouse || {}).forEach(function(item) {
        var v = regionWarehouse[item];
        var num = (typeof v === 'number') ? v : extractCount(v);
        if (num > 0) rows.push({ name: item, quantity: Math.round(num) + ' 磅' });
    });
    if (!rows.length) return buildEmptyHint('暂无存货...');
    var table = document.createElement('table');
    table.className = 'cargo-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['物品', '数量（磅）'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function(r) {
        var tr = document.createElement('tr');
        [r.name, r.quantity].forEach(function(cell) {
            var td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

// 仓库展示：按地区分组（每个大洲一个仓库）；onlyRegion 时只显示该地区
function buildWarehouseBlock(warehouse, onlyRegion, data) {
    var regions = Object.keys(warehouse || {}).filter(function(r) {
        if (onlyRegion && r !== onlyRegion) return false;
        return Object.keys(warehouse[r] || {}).some(function(k) { return (warehouse[r][k] || 0) > 0; });
    });
    if (!regions.length) return buildEmptyHint('仓库暂无存货...');
    var block = document.createElement('div');
    block.className = 'warehouse-block';
    regions.forEach(function(region) {
        var title = document.createElement('div');
        title.className = 'entity-group-title';
        title.style.display = 'flex';
        title.style.justifyContent = 'space-between';
        title.style.alignItems = 'center';
        var titleSpan = document.createElement('span');
        titleSpan.textContent = '仓库 · ' + region;
        title.appendChild(titleSpan);
        var refreshBtn = document.createElement('button');
        refreshBtn.type = 'button';
        refreshBtn.className = 'collect-btn';
        refreshBtn.textContent = '刷新';
        refreshBtn.title = '重新读取最新变量并刷新显示（同步 AI 剧情改动）';
        refreshBtn.addEventListener('click', function() {
            refreshVariables();
        });
        title.appendChild(refreshBtn);
        block.appendChild(title);
        block.appendChild(buildWarehouseTable(warehouse[region]));
    });
    return block;
}

// 家产信息卡：字段 + 产出块 + 收款/收获/转化/出售按钮（软门控：商业/农事/手工业需就职人员）
function buildEstateCard(name, estate, todayISO, currentWealth, warehouse, staffCount, assignmentList) {
    var region = getRegion(estate.location);
    var gatedType = estate.type === '商业' || estate.type === '农事' || estate.type === '手工业';
    var hasStaff = (staffCount || 0) >= 1;
    var blocked = gatedType && !hasStaff;
    var card = buildEntityCard(name, [
        { label: '位置', value: estate.location },
        { label: '所属', value: estateBelong(estate) || '顶层' },
        { label: '规模', value: estate.scale },
        { label: '状况', value: estate.status },
        { label: '产品', value: fmtList(estate.product) },
        { label: '经营', value: estate.business }
    ]);

    // 产出块（单独成栏）：月营收（商业/手工业）或 月产（农事）
    var outInfo = formatEstateOutput(estate);
    if (outInfo) {
        var outputWrap = document.createElement('div');
        outputWrap.className = 'output-block';
        var outputRow = document.createElement('div');
        outputRow.className = 'output-row';
        var ol = document.createElement('span');
        ol.className = 'output-label';
        ol.textContent = outInfo.label + '：';
        var ov = document.createElement('span');
        ov.className = 'output-value';
        ov.textContent = outInfo.value;
        outputRow.appendChild(ol);
        outputRow.appendChild(ov);
        outputWrap.appendChild(outputRow);
        card.appendChild(outputWrap);
    }

    // 就职人员（软门控提示）
    if (gatedType) {
        var staffWrap = document.createElement('div');
        staffWrap.className = 'staff-row';
        var staffLabel = document.createElement('span');
        staffLabel.className = 'staff-label';
        staffLabel.textContent = '就职：' + (staffCount || 0) + ' 人';
        staffWrap.appendChild(staffLabel);
        if (blocked) {
            var staffHint = document.createElement('span');
            staffHint.className = 'staff-hint';
            staffHint.textContent = '无人经营，无法操作';
            staffWrap.appendChild(staffHint);
        } else if (assignmentList && assignmentList.length) {
            var staffNames = document.createElement('span');
            staffNames.className = 'staff-names';
            staffNames.style.cssText = 'opacity:0.85;margin-left:8px;font-size:0.85em;';
            staffNames.textContent = assignmentList.map(function(a) { return a.name; }).join('、');
            staffWrap.appendChild(staffNames);
        }
        card.appendChild(staffWrap);
    }

    // 收款（商业/手工业 revenue）
    if (estate.revenue) {
        var wrap = document.createElement('div');
        wrap.className = 'collect-row';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'collect-btn';
        btn.textContent = '收款';
        if (blocked || (estate.last_collected && estate.last_collected === todayISO)) {
            btn.disabled = true;
        }
        var info = document.createElement('span');
        info.className = 'collect-info';
        info.textContent = estate.last_collected ? ('上次收款：' + estate.last_collected) : '';
        btn.addEventListener('click', function() {
            collectEstateRevenue(name, estate, todayISO, currentWealth, btn, info);
        });
        wrap.appendChild(btn);
        wrap.appendChild(info);
        card.appendChild(wrap);
    }

    // 收获（农事）
    if (estate.output) {
        var hwrap = document.createElement('div');
        hwrap.className = 'collect-row';
        var hbtn = document.createElement('button');
        hbtn.type = 'button';
        hbtn.className = 'collect-btn';
        hbtn.textContent = '收获';
        var hinfo = document.createElement('span');
        hinfo.className = 'collect-info';
        hinfo.textContent = estate.last_harvested ? ('上次收获：' + estate.last_harvested) : '';
        if (blocked) hbtn.disabled = true;
        if (estate.last_harvested) {
            var hdays = daysBetween(estate.last_harvested, todayISO);
            if (!isNaN(hdays) && hdays < HARVEST_MIN_DAYS) hbtn.disabled = true;
        }
        hbtn.addEventListener('click', function() {
            collectEstateHarvest(name, estate, todayISO, warehouse, region, hbtn, hinfo);
        });
        hwrap.appendChild(hbtn);
        hwrap.appendChild(hinfo);
        card.appendChild(hwrap);
    }

    // 生产转化（手工业且有产品）：生产方式 / 转化方针 / 开始生产（每步标签 + 正下方明细）
    if (estate.type === '手工业' && estate.product) {
        var productName = Array.isArray(estate.product) ? estate.product[0] : estate.product;
        var regionItems = Object.keys((warehouse && warehouse[region]) || {}).filter(function(n) { return (warehouse[region][n] || 0) > 0; });

        var convWrap = document.createElement('div');
        convWrap.className = 'conv-block';

        // ① 生产方式：原料下拉（点击出现本大洲仓库内容）→ 产物
        var step1 = document.createElement('div');
        step1.className = 'conv-step';
        var matLabel = document.createElement('div');
        matLabel.className = 'conv-step-label';
        matLabel.textContent = '生产方式';
        step1.appendChild(matLabel);
        var matCol = document.createElement('div');
        matCol.className = 'conv-detail-col';
        var matSelect = document.createElement('select');
        matSelect.className = 'collect-btn';
        matSelect.title = '选择原料（本大洲仓库现有物品）';
        if (regionItems.length) {
            regionItems.forEach(function(item) {
                var o = document.createElement('option');
                o.value = item; o.textContent = item;
                matSelect.appendChild(o);
            });
        } else {
            var emptyOpt = document.createElement('option');
            emptyOpt.value = ''; emptyOpt.textContent = '仓库无原料';
            matSelect.appendChild(emptyOpt);
            matSelect.disabled = true;
        }
        if (blocked) matSelect.disabled = true;
        matCol.appendChild(matSelect);
        var arrow = document.createElement('span');
        arrow.className = 'conv-arrow';
        arrow.textContent = '→ ' + productName;
        matCol.appendChild(arrow);
        step1.appendChild(matCol);

        // ② 转化方针：方针：下拉（仅显示方针名）
        var step2 = document.createElement('div');
        step2.className = 'conv-step';
        var polLabel = document.createElement('div');
        polLabel.className = 'conv-step-label';
        polLabel.textContent = '转化方针';
        step2.appendChild(polLabel);
        var polCol = document.createElement('div');
        polCol.className = 'conv-detail-col';
        var polTag = document.createElement('span');
        polTag.className = 'conv-policy-label';
        polTag.textContent = '方针：';
        polCol.appendChild(polTag);
        var polSelect = document.createElement('select');
        polSelect.className = 'conv-policy-select';
        polSelect.title = '选择转化方针';
        function fillPolicySelectLocal() {
            polSelect.innerHTML = '';
            var p = getConversionPolicies();
            p.defaults.forEach(function(policy, i) {
                var o = document.createElement('option');
                o.value = 'd' + i; o.textContent = policy.name;
                polSelect.appendChild(o);
            });
            p.customs.forEach(function(policy, i) {
                var o = document.createElement('option');
                o.value = 'c' + i; o.textContent = policy.name;
                polSelect.appendChild(o);
            });
            polSelect.value = p.activeKey;
        }
        fillPolicySelectLocal();
        polSelect.addEventListener('change', function() {
            var p = getConversionPolicies();
            var pol = convPolicyByIdx(p, polSelect.value);
            p.activeKey = polSelect.value;
            if (pol && pol.limits && pol.limits.length) p.activeLimit = pol.limits[0];
            saveConversionPolicies();
        });
        if (blocked) polSelect.disabled = true;
        polCol.appendChild(polSelect);
        step2.appendChild(polCol);

        // ③ 开始生产：生产（可点）[数量框] 磅 产物名
        var step3 = document.createElement('div');
        step3.className = 'conv-step';
        var startLabel = document.createElement('div');
        startLabel.className = 'conv-step-label';
        startLabel.textContent = '开始生产';
        step3.appendChild(startLabel);
        var prodCol = document.createElement('div');
        prodCol.className = 'conv-detail-col';
        var prodBtn = document.createElement('button');
        prodBtn.type = 'button';
        prodBtn.className = 'collect-btn';
        prodBtn.textContent = '生产';
        if (blocked) prodBtn.disabled = true;
        prodCol.appendChild(prodBtn);
        var qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '1';
        qtyInput.value = '100';
        qtyInput.className = 'recipe-batch';
        if (blocked) qtyInput.disabled = true;
        prodCol.appendChild(qtyInput);
        var unitSpan = document.createElement('span');
        unitSpan.className = 'conv-unit';
        unitSpan.textContent = '磅 ' + productName;
        prodCol.appendChild(unitSpan);
        step3.appendChild(prodCol);

        convWrap.appendChild(step1);
        convWrap.appendChild(step2);
        convWrap.appendChild(step3);

        var result = document.createElement('div');
        result.className = 'conv-result';
        convWrap.appendChild(result);

        // 生产按钮：按数量框数量执行转化（与收款/收获/出售一致的无则 insert、有则 update 写回）
        prodBtn.addEventListener('click', function() {
            var material = matSelect.value;
            if (!material) { alert('请先选择原料。'); return; }
            var p = getConversionPolicies();
            var pol = convActivePolicy(p);
            collectConversionByPolicy(name, estate, todayISO, warehouse, region, material, productName, pol, p.activeLimit || 100, qtyInput.value, prodBtn, result);
        });

        card.appendChild(convWrap);
    }

    // 出售（商业）：把该地区仓库商品按参考价卖成银币
    if (estate.type === '商业') {
        var swrap = document.createElement('div');
        swrap.className = 'collect-row';
        var sbtn = document.createElement('button');
        sbtn.type = 'button';
        sbtn.className = 'collect-btn';
        sbtn.textContent = '出售该区商品';
        if (blocked) sbtn.disabled = true;
        var sinfo = document.createElement('span');
        sinfo.className = 'collect-info';
        sbtn.addEventListener('click', function() {
            collectSell(name, estate, todayISO, currentWealth, warehouse, region, sbtn, sinfo);
        });
        swrap.appendChild(sbtn);
        swrap.appendChild(sinfo);
        card.appendChild(swrap);
    }

    return card;
}

// 货物表格：三列「货物 / 品质 / 数量」
function buildCargoTable(rows) {
    var table = document.createElement('table');
    table.className = 'cargo-table';
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['货物', '品质', '数量'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function(r) {
        var tr = document.createElement('tr');
        [r.name, r.quality, r.quantity].forEach(function(cell) {
            var td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

// 货物总览：逐条列出（名称 / 品质 / 原数量）
function buildCargoOverview(cargo) {
    var rows = [];
    Object.keys(cargo).forEach(function(cn) {
        var c = cargo[cn] || {};
        rows.push({ name: cn, quality: c.quality || c.type || '', quantity: c.count || '' });
    });
    return buildCargoTable(rows);
}

// 货物分类：按 category 聚合（分类名 / 加权品质 / 总数量「单位」）
function buildCargoByCategory(cargo) {
    var groups = {};
    Object.keys(cargo).forEach(function(name) {
        var c = cargo[name] || {};
        var cat = c.category || '未分类';
        var special = isSpecialCategory(cat);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({
            name: name,
            count: special ? extractCount(c.count) : convertToBase(c.count, cat),
            quality: c.quality,
            special: special
        });
    });
    var rows = [];
    Object.keys(groups).forEach(function(cat) {
        var items = groups[cat];
        var total = 0, weighted = 0, hasQuality = false;
        items.forEach(function(it) {
            total += it.count;
            if (!it.special && it.quality) {
                weighted += it.count * qualityToScore(it.quality);
                hasQuality = true;
            }
        });
        var qualityLabel = hasQuality ? scoreToQuality(total > 0 ? weighted / total : 0) : '—';
        rows.push({ name: cat, quality: qualityLabel, quantity: total + getCategoryBaseUnit(cat) });
    });
    return buildCargoTable(rows);
}

// 船只信息卡：按 uid27 船只结构渲染（crew/status/value/cargo），含货物估价按钮（暂无计算逻辑）
function buildShipCard(name, ship) {
    var card = document.createElement('div');
    card.className = 'entity-card';
    var nameEl = document.createElement('div');
    nameEl.className = 'entity-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);

    var crew = ship.crew || {};
    var st = ship.status || {};
    var value = ship.value || {};

    var crewStr = '';
    if (crew.count !== undefined && crew.count !== null && crew.count !== '') crewStr = String(crew.count) + ' 人';
    if (crew.morale) crewStr += (crewStr ? ' · ' : '') + crew.morale;

    // 字段仅在「有数据」时显示（船况/船损尤其如此）
    var rows = [];
    if (crewStr) rows.push({ label: '船员', value: crewStr });
    if (st.condition !== undefined && st.condition !== null && st.condition !== '') rows.push({ label: '船况', value: st.condition });
    if (st.speed) rows.push({ label: '航速', value: st.speed });
    if (st.damage) rows.push({ label: '船损', value: st.damage });
    if (value.cost) rows.push({ label: '造价', value: value.cost });
    var list = buildKVList(rows);
    if (list) card.appendChild(list);

    // 货物（ships.<船名>.status.cargo）：总览 / 分类 两种展示模式
    var cargo = st.cargo || {};
    if (Object.keys(cargo).length) {
        var cargoHeader = document.createElement('div');
        cargoHeader.className = 'cargo-header';
        var cargoLabel = document.createElement('span');
        cargoLabel.className = 'cargo-label';
        cargoLabel.textContent = '货物：';
        cargoHeader.appendChild(cargoLabel);

        var btnOverview = document.createElement('button');
        btnOverview.type = 'button';
        btnOverview.className = 'cargo-mode-btn active';
        btnOverview.textContent = '总览';

        var btnCategory = document.createElement('button');
        btnCategory.type = 'button';
        btnCategory.className = 'cargo-mode-btn';
        btnCategory.textContent = '分类';

        cargoHeader.appendChild(btnOverview);
        cargoHeader.appendChild(btnCategory);
        card.appendChild(cargoHeader);

        var cargoContent = document.createElement('div');
        cargoContent.className = 'cargo-content';
        card.appendChild(cargoContent);

        function renderCargo(mode) {
            cargoContent.innerHTML = '';
            if (mode === 'category') {
                cargoContent.appendChild(buildCargoByCategory(cargo));
            } else {
                cargoContent.appendChild(buildCargoOverview(cargo));
            }
            btnOverview.classList.toggle('active', mode === 'overview');
            btnCategory.classList.toggle('active', mode === 'category');
        }
        btnOverview.addEventListener('click', function() { renderCargo('overview'); });
        btnCategory.addEventListener('click', function() { renderCargo('category'); });
        renderCargo('overview');
    }

    // 货物估价按钮（方法 A：按分类加权品质插值计算货值）
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cargo-valuate-btn';
    btn.textContent = '点击对货物估价';
    btn.addEventListener('click', function() {
        if (btn.classList.contains('valued')) {
            btn.classList.remove('valued');
            btn.textContent = '点击对货物估价';
        } else {
            btn.classList.add('valued');
            btn.textContent = '估值：' + calculateCargoValue(cargo) + ' 银币';
        }
    });
    card.appendChild(btn);

    return card;
}

/* ---------------------------------------------------------------------
 * 关系界面：就职 / 薪资（assignment / payroll）
 * --------------------------------------------------------------------- */

// 汇总 relationship 里的所有人物 → [{name, data}]（扁平字典）
function getAllPersons(rel) {
    var list = [];
    Object.keys(rel || {}).forEach(function(n) {
        list.push({ name: n, data: rel[n] || {} });
    });
    return list;
}

// 就职人数索引：{ 目标名: 人数 }（从 employment 独立变量统计）
function buildStaffIndex(employment) {
    var index = {};
    Object.keys(employment || {}).forEach(function(personName) {
        var a = employment[personName];
        if (a && a.name) index[a.name] = (index[a.name] || 0) + 1;
    });
    return index;
}

// 就职名单索引：{ 目标名: [{name, data}] }（从 employment 独立变量统计）
function buildAssignmentIndex(employment) {
    var index = {};
    Object.keys(employment || {}).forEach(function(personName) {
        var a = employment[personName];
        if (a && a.name) {
            if (!index[a.name]) index[a.name] = [];
            index[a.name].push({ name: personName, data: a });
        }
    });
    return index;
}

// 按 name 找到某人物对象引用
function findPerson(rel, name) {
    return { name: name, data: (rel || {})[name] || {} };
}

// 性别符号（♂ 男性 / ♀ 伊芙 / ⚥ 伊菈）
function genderSymbol(gender) {
    if (gender === '男性') return '♂';
    if (gender === '伊芙') return '♀';
    if (gender === '伊菈') return '⚥';
    return gender || '';
}

// 角色统一字段（location，性别符号显示在姓名行右侧，薪资改为可编辑项单独渲染）
// 从角色世界书条目内容里剥离 <人物名>...</人物名> 包裹，仅保留内部内容
function extractCharEntryDesc(name, content) {
    if (!content) return '';
    var s = String(content).trim();
    var open = '<' + name + '>';
    var close = '</' + name + '>';
    var start = s.indexOf(open);
    var end = s.lastIndexOf(close);
    if (start !== -1 && end > start) return s.slice(start + open.length, end).trim();
    return s;
}

// 读取自定义角色条目（uid 125~149）内容，按条目名建立映射
async function fetchCharEntryContents() {
    var map = {};
    try {
        if (typeof getLorebookEntries !== 'function') return map;
        var entries = await getLorebookEntries('千叶的睡前小故事', { fields: ['uid', 'comment', 'content', 'order'] });
        (entries || []).forEach(function(e) {
            if (e.order >= 125 && e.order <= 149 && e.comment) {
                map[String(e.comment).trim()] = e.content || '';
            }
        });
    } catch (e) {}
    return map;
}

// 刷新角色条目缓存
async function refreshCharEntries() {
    CACHED_CHAR_ENTRIES = await fetchCharEntryContents();
}

// 只读人物卡：姓名/位置/性别同一行，描述（简介或世界书条目）单独一行，另有薪资编辑与当前就职
function buildPersonCard(name, person, employment, data) {
    var card = document.createElement('div');
    card.className = 'entity-card person-card';
    card.dataset.personName = name;
    if (SELECTED_PERSON === name) card.classList.add('person-selected');

    var topLine = document.createElement('div');
    topLine.className = 'person-top-line';
    var nameEl = document.createElement('span');
    nameEl.className = 'person-name';
    nameEl.textContent = name;
    topLine.appendChild(nameEl);
    var loc = person.location || '';
    if (loc) {
        var locEl = document.createElement('span');
        locEl.className = 'person-location';
        locEl.textContent = loc;
        topLine.appendChild(locEl);
    }
    var sym = document.createElement('span');
    sym.className = 'person-gender-symbol';
    sym.textContent = genderSymbol(person.gender);
    topLine.appendChild(sym);
    card.appendChild(topLine);

    var desc = person.desc || '';
    if (!desc) desc = extractCharEntryDesc(name, CACHED_CHAR_ENTRIES[name] || '');
    if (desc) {
        var descEl = document.createElement('div');
        descEl.className = 'person-desc';
        descEl.textContent = desc;
        card.appendChild(descEl);
    }

    // 薪资编辑：仅在角色有薪资（expense 非空且 > 0）时显示；不在身边工作/无需薪资者不显示
    var expenseVal = person.expense;
    var hasSalary = expenseVal !== undefined && expenseVal !== null && String(expenseVal).trim() !== '' && extractCount(expenseVal) > 0;
    if (hasSalary) {
        var salaryRow = document.createElement('div');
        salaryRow.className = 'salary-row';
        var salaryLabel = document.createElement('span');
        salaryLabel.className = 'salary-label';
        salaryLabel.textContent = '薪资：';
        salaryRow.appendChild(salaryLabel);
        var salaryInput = document.createElement('input');
        salaryInput.type = 'number';
        salaryInput.min = '0';
        salaryInput.value = extractCount(person.expense);
        salaryInput.className = 'recipe-batch';
        salaryInput.addEventListener('click', function(e) { e.stopPropagation(); });
        salaryRow.appendChild(salaryInput);
        var salaryUnit = document.createElement('span');
        salaryUnit.className = 'salary-unit';
        salaryUnit.textContent = '银币/月';
        salaryRow.appendChild(salaryUnit);
        var salaryConfirm = document.createElement('button');
        salaryConfirm.type = 'button';
        salaryConfirm.className = 'collect-btn salary-confirm';
        salaryConfirm.textContent = '确认';
        salaryConfirm.dataset.person = name;
        if ((SALARY_COOLDOWN[name] || 0) > Date.now()) salaryConfirm.disabled = true;
        salaryConfirm.addEventListener('click', function(e) {
            e.stopPropagation();
            if (salaryConfirm.disabled) return;
            updatePersonSalary(name, person, salaryInput, data);
            var exp = Date.now() + 2000;
            SALARY_COOLDOWN[name] = exp;
            salaryConfirm.disabled = true;
            setTimeout(function() {
                delete SALARY_COOLDOWN[name];
                document.querySelectorAll('.salary-confirm').forEach(function(b) {
                    if (b.getAttribute('data-person') === name) b.disabled = false;
                });
            }, 2000);
        });
        salaryRow.appendChild(salaryConfirm);
        card.appendChild(salaryRow);
    }

    var a = employment && employment[name];
    var line = document.createElement('div');
    line.className = 'assign-row';
    var lbl = document.createElement('span');
    lbl.className = 'assign-label';
    lbl.textContent = '就职：';
    line.appendChild(lbl);
    var val = document.createElement('span');
    val.className = 'assign-value';
    val.textContent = a && a.name ? ((a.type === 'estate' ? '家产 · ' : '船只 · ') + a.name) : '未就职';
    line.appendChild(val);
    card.appendChild(line);

    card.addEventListener('click', function() {
        if (!COMMAND_MODE) return;
        if (SELECTED_PERSON === name) {
            SELECTED_PERSON = null;
            card.classList.remove('person-selected');
            closeCommandPanel();
        } else {
            document.querySelectorAll('.entity-card.person-selected').forEach(function(el) { el.classList.remove('person-selected'); });
            SELECTED_PERSON = name;
            card.classList.add('person-selected');
            openCommandPanel(data, card);
        }
    });

    return card;
}

// 薪资月总额：所有人物 expense 数字求和
function computePayrollTotal(rel) {
    var total = 0;
    getAllPersons(rel).forEach(function(p) {
        total += extractCount(p.data && p.data.expense);
    });
    return Math.floor(total);
}

// 薪资明细表：姓名 / 薪资 / 就职地点（含 expense 者才列出）
function buildPayrollTable(rel, employment) {
    var rows = [];
    getAllPersons(rel).forEach(function(p) {
        var expense = p.data && p.data.expense;
        if (!expense || extractCount(expense) <= 0) return;
        var a = employment && employment[p.name];
        var place = a && a.name ? ((a.type === 'estate' ? '家产·' : '船只·') + a.name) : '未就职';
        rows.push({ name: p.name, salary: String(expense), place: place });
    });
    if (!rows.length) return buildEmptyHint('暂无薪资明细...');
    var table = document.createElement('table');
    table.className = 'payroll-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['姓名', '薪资', '就职地点'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.forEach(function(r) {
        var tr = document.createElement('tr');
        [r.name, r.salary, r.place].forEach(function(c) {
            var td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

// 未就职人员下拉框（按主标签分组，仅未就职者可选）
function buildUnassignedPersonSelect(data) {
    var sel = document.createElement('select');
    sel.className = 'assign-select';
    var none = document.createElement('option');
    none.value = '';
    none.textContent = '选择人员…';
    sel.appendChild(none);
    var rel = data.relationship || {};
    var employment = data.employment || {};
    var groups = {};
    Object.keys(rel).forEach(function(n) {
        if (employment[n] && employment[n].name) return;
        var tags = (rel[n] || {}).tags || [];
        var main = tags[0] || '其他';
        if (!groups[main]) groups[main] = [];
        groups[main].push(n);
    });
    Object.keys(groups).forEach(function(g) {
        var og = document.createElement('optgroup');
        og.label = g;
        groups[g].forEach(function(n) {
            var o = document.createElement('option');
            o.value = n;
            o.textContent = n;
            og.appendChild(o);
        });
        sel.appendChild(og);
    });
    return sel;
}

// 就职弹窗内容：显示就职者（可解职）+ 安排就职
function buildEmploymentCardBody(targetType, targetName, staffList, data, rerender) {
    var body = document.createElement('div');
    body.className = 'assign-popover-body';

    if (staffList && staffList.length) {
        staffList.forEach(function(p) {
            var row = document.createElement('div');
            row.className = 'staff-person-row';
            var label = document.createElement('span');
            label.className = 'staff-person-name';
            label.textContent = p.name;
            row.appendChild(label);
            var unBtn = document.createElement('button');
            unBtn.type = 'button';
            unBtn.className = 'collect-btn';
            unBtn.textContent = '解职';
            unBtn.addEventListener('click', function() { emitUnassign(p, data, rerender); });
            row.appendChild(unBtn);
            body.appendChild(row);
        });
    } else {
        var none = document.createElement('div');
        none.className = 'staff-hint';
        none.textContent = '无人就职';
        body.appendChild(none);
    }

    var ctrl = document.createElement('div');
    ctrl.className = 'assign-ctrl';
    var select = buildUnassignedPersonSelect(data);
    ctrl.appendChild(select);
    var goBtn = document.createElement('button');
    goBtn.type = 'button';
    goBtn.className = 'collect-btn';
    goBtn.textContent = '就职';
    goBtn.addEventListener('click', function() {
        var pname = select.value;
        if (!pname) return;
        var person = findPerson(data.relationship || {}, pname);
        if (person) emitAssign(person, data, targetType + ':' + targetName, rerender);
    });
    ctrl.appendChild(goBtn);
    body.appendChild(ctrl);
    return body;
}

// 人员安排弹窗：点击地块后从地块位置弹出
var ASSIGN_POPOVER = null;

function closeAssignPopover() {
    if (ASSIGN_POPOVER) {
        ASSIGN_POPOVER.remove();
        ASSIGN_POPOVER = null;
    }
}

function openAssignPopover(targetType, targetName, staffList, data, rerender) {
    closeAssignPopover();
    var anchor = document.querySelector('.asset-tile.selected');
    if (!anchor) return;

    var popover = document.createElement('div');
    popover.className = 'assign-popover';

    var head = document.createElement('div');
    head.className = 'assign-popover-head';
    var title = document.createElement('span');
    title.className = 'assign-popover-title';
    title.textContent = (targetType === 'estate' ? '家产 · ' : '船只 · ') + targetName;
    head.appendChild(title);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'assign-popover-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function() {
        CURRENT_ASSIGN_TARGET = null;
        closeAssignPopover();
        var sel = document.querySelector('.asset-tile.selected');
        if (sel) sel.classList.remove('selected');
    });
    head.appendChild(closeBtn);
    popover.appendChild(head);

    popover.appendChild(buildEmploymentCardBody(targetType, targetName, staffList, data, rerender));

    document.body.appendChild(popover);
    ASSIGN_POPOVER = popover;

    var rect = anchor.getBoundingClientRect();
    var popWidth = popover.offsetWidth;
    var popHeight = popover.offsetHeight;
    var viewW = window.innerWidth;
    var viewH = window.innerHeight;

    var left = rect.left;
    if (left + popWidth > viewW - 8) left = viewW - popWidth - 8;
    if (left < 8) left = 8;

    var top = rect.bottom + 6;
    if (top + popHeight > viewH - 8) {
        top = rect.top - popHeight - 6;
        if (top < 8) top = 8;
    }
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
}

// 船型尺寸映射（4 列棋盘：小船到大船）
var SHIP_SIZE = {
    '小艇': { w: 1, h: 1 },
    '渔船': { w: 1, h: 1 },
    '双桅帆船': { w: 2, h: 1 },
    '商船': { w: 2, h: 1 },
    '盖伦船': { w: 2, h: 2 },
    '大型商船': { w: 2, h: 2 },
    '护卫舰': { w: 2, h: 2 },
    '战列舰': { w: 4, h: 2 }
};

// 家产棋盘尺寸：PC 端小型 1×1、中型 2×1、大型 4×2；移动端小型 2×1、中型 3×1、大型 4×2；未指定 4×1
function estateSize(estate) {
    var s = estate.scale;
    var mobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (s === '大型') return { w: 4, h: 2 };
    if (s === '中型') return mobile ? { w: 3, h: 1 } : { w: 2, h: 1 };
    if (s === '小型') return mobile ? { w: 2, h: 1 } : { w: 1, h: 1 };
    return { w: 4, h: 1 };
}

function shipSize(ship) {
    return SHIP_SIZE[ship.type] || { w: 2, h: 1 };
}

// 地块颜色类（灰=待分配、黄=已就职、蓝=无需就职、红=荒废/重损）
function estateTileClass(estate, staffed) {
    var needsStaff = estate.type === '商业' || estate.type === '农事' || estate.type === '手工业';
    if (!needsStaff) return 'tile-neutral';
    if (estate.status === '荒废') return 'tile-derelict';
    return staffed ? 'tile-staffed' : 'tile-vacant';
}

function shipTileClass(ship, staffed) {
    var cond = ship.status && ship.status.condition;
    if (cond !== undefined && cond !== null && cond !== '' && cond <= 30) return 'tile-derelict';
    return staffed ? 'tile-staffed' : 'tile-vacant';
}

// 4 列网格装箱：按顺序贪心放置，返回 [{ name, w, h, row, col, asset }]
function layoutItems(items) {
    var grid = [];
    var result = [];
    function fits(row, col, w, h) {
        for (var r = row; r < row + h; r++) {
            for (var c = col; c < col + w; c++) {
                if (c >= 4) return false;
                if (grid[r] && grid[r][c]) return false;
            }
        }
        return true;
    }
    function mark(row, col, w, h, name) {
        for (var r = row; r < row + h; r++) {
            if (!grid[r]) grid[r] = {};
            for (var c = col; c < col + w; c++) grid[r][c] = name;
        }
    }
    items.forEach(function(it) {
        var placed = false;
        for (var row = 0; !placed; row++) {
            for (var col = 0; col < 4; col++) {
                if (fits(row, col, it.w, it.h)) {
                    mark(row, col, it.w, it.h, it.name);
                    result.push({ name: it.name, w: it.w, h: it.h, row: row, col: col, asset: it.asset });
                    placed = true;
                    break;
                }
            }
        }
    });
    return result;
}

// ===== 家产层级（belong）辅助 =====
// 地块归属：belong 为空/缺省视为顶层
function estateBelong(estate) {
    var b = estate && estate.belong;
    return (b === undefined || b === null) ? '' : String(b);
}

// 某地块的子地块名（belong 指向它的地块）
function childrenOfEstate(name, estate) {
    var out = [];
    Object.keys(estate || {}).forEach(function(k) {
        if (estateBelong(estate[k]) === name) out.push(k);
    });
    return out;
}

// 收集某地块及其所有子孙中「需要就职」（商业/农事/手工业）的叶子名
function collectNeedyEstateLeaves(name, estate, out, visiting) {
    out = out || [];
    visiting = visiting || {};
    if (visiting[name]) return out;
    visiting[name] = true;
    var children = childrenOfEstate(name, estate);
    if (!children.length) {
        var e = estate[name] || {};
        if (e.type === '商业' || e.type === '农事' || e.type === '手工业') out.push(name);
    } else {
        children.forEach(function(c) { collectNeedyEstateLeaves(c, estate, out, visiting); });
    }
    return out;
}

// 递归计算地块显示尺寸：叶子用自身 scale；容器 = 自身下限与子孙装箱包围盒取较大值（可被内部撑大、不能小于自身；优先撑宽到 4 再向下）
function plotTreeSize(name, estate, cache, visiting) {
    cache = cache || {};
    visiting = visiting || {};
    if (cache[name]) return cache[name];
    if (visiting[name]) { cache[name] = estateSize(estate[name] || {}); return cache[name]; }
    visiting[name] = true;
    var children = childrenOfEstate(name, estate);
    var selfSize = estateSize(estate[name] || {});
    var size;
    if (!children.length) {
        size = selfSize;
    } else {
        var items = children.map(function(c) {
            var s = plotTreeSize(c, estate, cache, visiting);
            return { name: c, w: s.w, h: s.h };
        });
        var layout = layoutItems(items);
        var rows = 0;
        layout.forEach(function(it) { if (it.row + it.h > rows) rows = it.row + it.h; });
        var innerH = rows || 1;
        size = { w: Math.max(selfSize.w, 4), h: Math.max(selfSize.h, innerH) };
    }
    delete visiting[name];
    cache[name] = size;
    return size;
}

// 地块颜色（含容器）：荒废→红；容器按子孙需就职叶子的就职情况取最严重档
function estateTileClassNested(name, estate, estateMap, ai) {
    var children = childrenOfEstate(name, estateMap);
    if (!children.length) {
        return estateTileClass(estate, !!(ai[name] && ai[name].length));
    }
    if ((estate && estate.status) === '荒废') return 'tile-derelict';
    var needy = collectNeedyEstateLeaves(name, estateMap);
    if (!needy.length) return 'tile-neutral';
    for (var i = 0; i < needy.length; i++) {
        if (!(ai[needy[i]] && ai[needy[i]].length)) return 'tile-vacant';
    }
    return 'tile-staffed';
}

// 当前层级下的地块名列表（顶层 = belong 为空；否则 = belong 指向路径末元素）
function currentEstateBoardNames(estate) {
    var parent = ESTATE_BOARD_PATH.length ? ESTATE_BOARD_PATH[ESTATE_BOARD_PATH.length - 1] : '';
    var keys = Object.keys(estate || {});
    return keys.filter(function(n) {
        var b = estateBelong(estate[n]);
        if (parent) return b === parent;
        // 顶层：belong 为空，或 belong 指向不存在的地块（孤儿兜底）
        return b === '' || keys.indexOf(b) === -1;
    });
}

// 面包屑：顶层 / 庄园 / 小院，各级可点击跳转
function buildEstateBreadcrumb(rerender) {
    var bar = document.createElement('div');
    bar.className = 'board-breadcrumb';
    function crumb(label, targetPath) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'board-crumb';
        b.textContent = label;
        b.addEventListener('click', function() {
            ESTATE_BOARD_PATH = targetPath.slice();
            CURRENT_ASSIGN_TARGET = null;
            closeOverlays();
            rerender();
        });
        return b;
    }
    bar.appendChild(crumb('顶层', []));
    ESTATE_BOARD_PATH.forEach(function(name, i) {
        var sep = document.createElement('span');
        sep.className = 'board-crumb-sep';
        sep.textContent = ' / ';
        bar.appendChild(sep);
        bar.appendChild(crumb(name, ESTATE_BOARD_PATH.slice(0, i + 1)));
    });
    return bar;
}

// 自适应地块字号：按字数确定性计算（全角汉字宽≈1em），保证完整显示不换行，文字尽量与边框同宽
function fitTileText(el) {
    var nameEl = el.querySelector('.asset-tile-name') || el;
    var chars = (nameEl.textContent || '').length;
    if (!chars) return;
    var avail = el.clientWidth - 8;
    if (avail <= 0) return;
    var size = Math.floor((avail - 1) / chars);
    if (size > 50) size = 50;
    if (size < 12) size = 12;
    nameEl.style.fontSize = size + 'px';
}

// 棋盘渲染：家产/船只共用，点击地块后由 rerender 在下方显示人员安排详情；家产复合地块带「展开」按钮下钻
function buildAssetBoard(type, names, assetMap, ai, data, rerender) {
    var sizeCache = {};
    var items = names.map(function(n) {
        var a = assetMap[n] || {};
        var size = type === 'estate' ? plotTreeSize(n, assetMap, sizeCache) : shipSize(a);
        return { name: n, w: size.w, h: size.h, asset: a };
    });
    var layout = layoutItems(items);

    var board = document.createElement('div');
    board.className = 'asset-board';

    var gridEl = document.createElement('div');
    gridEl.className = 'asset-grid';
    var tiles = [];
    layout.forEach(function(it) {
        var staffed = !!(ai[it.name] && ai[it.name].length);
        var cls = type === 'estate' ? estateTileClassNested(it.name, it.asset, assetMap, ai) : shipTileClass(it.asset, staffed);
        var cell = document.createElement('div');
        cell.className = 'asset-tile ' + cls;
        cell.style.gridColumn = (it.col + 1) + ' / span ' + it.w;
        cell.style.gridRow = (it.row + 1) + ' / span ' + it.h;

        var nameSpan = document.createElement('span');
        nameSpan.className = 'asset-tile-name';
        nameSpan.textContent = it.name;
        cell.appendChild(nameSpan);

        if (type === 'estate' && childrenOfEstate(it.name, assetMap).length) {
            var expandBtn = document.createElement('button');
            expandBtn.type = 'button';
            expandBtn.className = 'asset-tile-expand';
            expandBtn.setAttribute('title', '展开内部地块');
            expandBtn.setAttribute('aria-label', '展开内部地块');
            expandBtn.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1"/><rect x="9" y="9" width="12" height="12" rx="1"/></svg>';
            expandBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                ESTATE_BOARD_PATH.push(it.name);
                CURRENT_ASSIGN_TARGET = null;
                closeOverlays();
                rerender();
            });
            cell.appendChild(expandBtn);
        }

        if (CURRENT_ASSIGN_TARGET && CURRENT_ASSIGN_TARGET.type === type && CURRENT_ASSIGN_TARGET.name === it.name) {
            cell.classList.add('selected');
        }
        cell.addEventListener('click', function() {
            CURRENT_ASSIGN_TARGET = { type: type, name: it.name };
            rerender();
        });
        gridEl.appendChild(cell);
        tiles.push(cell);
    });
    board.appendChild(gridEl);
    return { board: board, gridEl: gridEl, tiles: tiles };
}

// 安排某人就职到目标（写回 employment 独立变量 + 本地即时反馈）
function emitAssign(p, data, selectValue, rerender) {
    var idx = selectValue.indexOf(':');
    var type = selectValue.slice(0, idx);
    var name = selectValue.slice(idx + 1);
    if (!name) return;
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return; }
    var assignment = { type: type, name: name };
    var empPayload = {};
    empPayload[p.name] = assignment;
    window.eventEmit('era:insertByObject', { employment: empPayload });
    window.eventEmit('era:updateByObject', { employment: empPayload });
    if (!data.employment) data.employment = {};
    data.employment[p.name] = assignment;
    if (getStatusApp()) syncLocalRender();
    else if (rerender) rerender();
}

// 解职（删除 employment 里的该人）
function emitUnassign(p, data, rerender) {
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return; }
    var empPayload = {};
    empPayload[p.name] = {};
    window.eventEmit('era:deleteByObject', { employment: empPayload });
    if (data.employment) delete data.employment[p.name];
    if (getStatusApp()) syncLocalRender();
    else if (rerender) rerender();
}

// 发薪：固定整月扣 monthly_total，写 last_paid
function paySalaries(monthlyTotal, todayISO, currentWealth, payroll, btn) {
    if (!todayISO) { alert('当前日期无法解析，无法发薪。'); return; }
    if (!monthlyTotal || monthlyTotal <= 0) { alert('没有需要支付的薪资。'); return; }
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return; }
    var newWealth = addWealthSilver(currentWealth, -monthlyTotal);
    var payload = { monthly_total: monthlyTotal, last_paid: todayISO };
    var isFirst = !(payroll && payroll.last_paid);
    if (isFirst) {
        window.eventEmit('era:updateByObject', { user: { wealth: newWealth } });
        window.eventEmit('era:insertByObject', { payroll: payload });
    } else {
        window.eventEmit('era:updateByObject', { user: { wealth: newWealth }, payroll: payload });
    }
    if (payroll) payroll.last_paid = todayISO;
    setLocalWealth(newWealth);
    appendStatusLog('发薪：给所有家人、手下、奴隶等共支付了薪资 ' + monthlyTotal + ' 银币');
    syncLocalRender();
    if (btn) { btn.textContent = '已发 ' + monthlyTotal + ' 银币'; btn.disabled = true; }
}

// 管理选项卡：薪资块 + 人员分配（棋盘 + 点击详情）
function renderManagementTab(data, content, rerender) {
    var rel = data.relationship || {};
    var monthlyTotal = computePayrollTotal(rel);
    var todayISO = worldDateToISO(data.world && data.world.date);
    var currentWealth = (data.user && data.user.wealth) || '';
    var payroll = data.payroll || {};

    var payBlock = document.createElement('div');
    payBlock.className = 'payroll-block';
    var payTitle = document.createElement('div');
    payTitle.className = 'entity-group-title';
    payTitle.textContent = '薪资';
    payBlock.appendChild(payTitle);
    var payInfo = document.createElement('div');
    payInfo.className = 'payroll-info';
    payInfo.textContent = '本月应发：' + monthlyTotal + ' 银币' + (payroll.last_paid ? '（上次发薪 ' + payroll.last_paid + '）' : '');
    payBlock.appendChild(payInfo);
    var payRow = document.createElement('div');
    payRow.className = 'collect-row';
    var payBtn = document.createElement('button');
    payBtn.type = 'button';
    payBtn.className = 'collect-btn';
    payBtn.textContent = '发薪';
    if (!monthlyTotal || monthlyTotal <= 0 || payroll.last_paid === todayISO) payBtn.disabled = true;
    payBtn.addEventListener('click', function() {
        paySalaries(monthlyTotal, todayISO, currentWealth, payroll, payBtn);
    });
    payRow.appendChild(payBtn);
    payBlock.appendChild(payRow);
    content.appendChild(payBlock);

    // 薪资明细（折叠，点击展开）
    var payDetail = document.createElement('div');
    payDetail.className = 'payroll-detail';
    var payDetailHeader = document.createElement('div');
    payDetailHeader.className = 'payroll-detail-header';
    payDetailHeader.textContent = '薪资明细 ▸';
    var payDetailBody = document.createElement('div');
    payDetailBody.className = 'payroll-detail-body';
    payDetailBody.style.display = 'none';
    payDetailBody.appendChild(buildPayrollTable(rel, data.employment || {}));
    payDetailHeader.addEventListener('click', function() {
        var collapsed = payDetailBody.style.display === 'none';
        payDetailBody.style.display = collapsed ? '' : 'none';
        payDetailHeader.textContent = '薪资明细 ' + (collapsed ? '▾' : '▸');
    });
    payDetail.appendChild(payDetailHeader);
    payDetail.appendChild(payDetailBody);
    content.appendChild(payDetail);

    var assignTitle = document.createElement('div');
    assignTitle.className = 'entity-group-title';
    assignTitle.textContent = '人员分配';
    content.appendChild(assignTitle);

    var ai = buildAssignmentIndex(data.employment || {});
    var estateNames = Object.keys(data.estate || {});
    var shipNames = Object.keys(data.ships || {});

    // 家产/船只 选项卡
    var tabBar = document.createElement('div');
    tabBar.className = 'entity-tabs';
    [['家产', estateNames.length], ['船只', shipNames.length]].forEach(function(bt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'entity-tab' + (bt[0] === CURRENT_BOARD_TAB ? ' active' : '');
        btn.textContent = bt[0] + bt[1];
        btn.dataset.tab = bt[0];
        tabBar.appendChild(btn);
    });
    content.appendChild(tabBar);

    var allTiles = [];
    function appendBoard(type, names, assetMap) {
        var result = buildAssetBoard(type, names, assetMap, ai, data, rerender);
        content.appendChild(result.board);
        allTiles = allTiles.concat(result.tiles);
        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(function() { result.tiles.forEach(fitTileText); });
            ro.observe(result.gridEl);
        }
    }
    if (CURRENT_BOARD_TAB === '家产') {
        if (ESTATE_BOARD_PATH.length) {
            content.appendChild(buildEstateBreadcrumb(rerender));
        }
        var boardEstateNames = currentEstateBoardNames(data.estate || {});
        if (boardEstateNames.length) {
            if (!ESTATE_BOARD_PATH.length) {
                // 顶层才显示按地区分类勾选项
                var regionToggle = document.createElement('label');
                regionToggle.className = 'region-toggle';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = GROUP_BY_REGION;
                cb.addEventListener('change', function() {
                    GROUP_BY_REGION = cb.checked;
                    closeOverlays();
                    rerender();
                });
                regionToggle.appendChild(cb);
                regionToggle.appendChild(document.createTextNode('按地区分类'));
                content.appendChild(regionToggle);

                if (GROUP_BY_REGION) {
                    var groups = {};
                    boardEstateNames.forEach(function(n) {
                        var region = getRegion((data.estate[n] || {}).location);
                        if (!groups[region]) groups[region] = [];
                        groups[region].push(n);
                    });
                    var orderedRegions = [];
                    CONTINENTS.forEach(function(c) { if (groups[c]) orderedRegions.push(c); });
                    Object.keys(groups).forEach(function(r) { if (orderedRegions.indexOf(r) === -1) orderedRegions.push(r); });
                    orderedRegions.forEach(function(region) {
                        var regionTitle = document.createElement('div');
                        regionTitle.className = 'entity-group-title';
                        regionTitle.textContent = region;
                        content.appendChild(regionTitle);
                        appendBoard('estate', groups[region], data.estate || {});
                    });
                } else {
                    appendBoard('estate', boardEstateNames, data.estate || {});
                }
            } else {
                appendBoard('estate', boardEstateNames, data.estate || {});
            }
        } else {
            content.appendChild(buildEmptyHint('暂无家产...'));
        }
    } else {
        if (shipNames.length) appendBoard('ship', shipNames, data.ships || {});
        else content.appendChild(buildEmptyHint('暂无船只...'));
    }
    allTiles.forEach(fitTileText);

    tabBar.addEventListener('click', function(e) {
        var btn = e.target.closest('.entity-tab');
        if (!btn) return;
        if (CURRENT_BOARD_TAB === btn.dataset.tab) return;
        CURRENT_BOARD_TAB = btn.dataset.tab;
        closeOverlays();
        rerender();
    });

    // 点击地块后：打开人员安排弹窗（定位到选中地块）
    var t = CURRENT_ASSIGN_TARGET;
    if (t && ((t.type === 'estate' && data.estate && data.estate[t.name]) || (t.type === 'ship' && data.ships && data.ships[t.name]))) {
        openAssignPopover(t.type, t.name, ai[t.name] || [], data, rerender);
    }
}

// 相关人员选项卡：所有角色按主标签分组显示（家人/手下/奴隶/朋友/其他）
function renderRelatedPersonsTab(data, content) {
    var rel = data.relationship || {};
    var employment = data.employment || {};
    var priority = ['家人', '朋友', '手下', '奴隶'];
    var groups = {};
    Object.keys(rel).forEach(function(n) {
        var tags = (rel[n] || {}).tags || [];
        tags.forEach(function(tag) {
            if (!groups[tag]) groups[tag] = [];
            groups[tag].push(n);
        });
    });
    var orderedTags = [];
    priority.forEach(function(t) { if (groups[t]) orderedTags.push(t); });
    Object.keys(groups).forEach(function(t) { if (orderedTags.indexOf(t) === -1) orderedTags.push(t); });
    if (!orderedTags.length) { content.appendChild(buildEmptyHint('暂无相关人员...')); return; }
    orderedTags.forEach(function(tag) {
        var names = groups[tag];
        var grp = document.createElement('div');
        grp.className = 'entity-group';
        var header = document.createElement('div');
        header.className = 'entity-group-title rel-group-header';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'rel-group-name';
        nameSpan.textContent = tag;
        var arrow = document.createElement('span');
        arrow.className = 'rel-arrow';
        var isOpen = REL_GROUP_OPEN[tag] === true;
        arrow.textContent = isOpen ? '▾' : '▸';
        nameSpan.appendChild(arrow);
        var countSpan = document.createElement('span');
        countSpan.className = 'rel-count';
        countSpan.textContent = names.length;
        header.appendChild(nameSpan);
        header.appendChild(countSpan);
        var body = document.createElement('div');
        body.className = 'rel-group-body';
        if (!isOpen) body.style.display = 'none';
        names.forEach(function(n) { body.appendChild(buildPersonCard(n, rel[n] || {}, employment, data)); });
        header.addEventListener('click', function() {
            var collapsed = body.style.display === 'none';
            body.style.display = collapsed ? '' : 'none';
            arrow.textContent = collapsed ? '▾' : '▸';
            REL_GROUP_OPEN[tag] = collapsed;
        });
        grp.appendChild(header);
        grp.appendChild(body);
        content.appendChild(grp);
    });
}

/* ---------------------------------------------------------------------
 * 指令系统：按钮 + 面板 + 占位符替换 + 常用角色
 * --------------------------------------------------------------------- */

// 替换指令模板占位符：{角色}→目标名，{TA}→代词（男性→他，其余→她）
function renderCommandText(text, personName, person) {
    var gender = (person && person.gender) || '';
    var ta = gender === '男性' ? '他' : '她';
    return String(text).replace(/\{角色\}/g, personName).replace(/\{TA\}/g, ta);
}

// 发送玩家发言：写入 SillyTavern 聊天输入框（HTML 注入 iframe 通过 parent 访问），失败则弹窗提示已复制到剪贴板
function sendPlayerMessage(text) {
    var textarea = null;
    try {
        if (window.parent && window.parent.document) {
            textarea = window.parent.document.getElementById('send_textarea');
        }
    } catch (e) { textarea = null; }
    if (!textarea) {
        try { textarea = document.getElementById('send_textarea'); } catch (e) { textarea = null; }
    }
    if (textarea) {
        textarea.value = text;
        try { textarea.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        try { textarea.focus(); } catch (e) {}
        return;
    }
    // 兜底：复制到剪贴板，并用删除物品同款弹窗提示
    var app = getStatusApp();
    function showNotice() {
        if (app && app.actions && app.actions.openClipboardNotice) {
            app.actions.openClipboardNotice(text);
        } else {
            alert('已生成发言并复制到剪贴板：\n\n' + text);
        }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showNotice).catch(showNotice);
    } else {
        showNotice();
    }
}

// 记录角色被指令使用的次数（command_usage 状态栏内部变量，AI 不维护）
function recordCommandUsage(data, name) {
    var usage = data.command_usage || {};
    var count = (usage[name] || 0) + 1;
    usage[name] = count;
    data.command_usage = usage;
    if (typeof window.eventEmit === 'function') {
        var payload = {};
        payload[name] = count;
        if (count === 1) window.eventEmit('era:insertByObject', { command_usage: payload });
        else window.eventEmit('era:updateByObject', { command_usage: payload });
    }
}

function closeCommandPanel() {
    if (COMMAND_POPOVER) {
        COMMAND_POPOVER.remove();
        COMMAND_POPOVER = null;
    }
}

// 打开指令面板（定位到触发按钮下方）
function openCommandPanel(data, anchorEl) {
    closeCommandPanel();
    var rel = data.relationship || {};
    var usage = data.command_usage || {};

    var popover = document.createElement('div');
    popover.className = 'command-popover';

    var head = document.createElement('div');
    head.className = 'command-popover-head';
    var title = document.createElement('span');
    title.className = 'command-popover-title';
    title.textContent = '指令';
    head.appendChild(title);
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'assign-popover-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', closeCommandPanel);
    head.appendChild(closeBtn);
    popover.appendChild(head);

    var target = document.createElement('div');
    target.className = 'command-target';
    target.textContent = '目标角色：' + (SELECTED_PERSON || '未选择（请在相关人员里点击角色）');
    popover.appendChild(target);

    var favorites = Object.keys(usage).filter(function(n) { return usage[n] >= 3; });
    if (favorites.length) {
        var favWrap = document.createElement('div');
        favWrap.className = 'command-fav';
        var favTitle = document.createElement('div');
        favTitle.className = 'command-fav-title';
        favTitle.textContent = '常用角色';
        favWrap.appendChild(favTitle);
        favorites.forEach(function(n) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'command-fav-chip' + (SELECTED_PERSON === n ? ' selected' : '');
            chip.textContent = n;
            chip.addEventListener('click', function() {
                SELECTED_PERSON = n;
                target.textContent = '目标角色：' + n;
                favWrap.querySelectorAll('.command-fav-chip').forEach(function(c) { c.classList.remove('selected'); });
                chip.classList.add('selected');
                document.querySelectorAll('.person-card.person-selected').forEach(function(el) { el.classList.remove('person-selected'); });
                var pc = document.querySelector('.person-card[data-person-name="' + n + '"]');
                if (pc) pc.classList.add('person-selected');
            });
            favWrap.appendChild(chip);
        });
        popover.appendChild(favWrap);
    }

    COMMAND_GROUPS.forEach(function(grp) {
        var g = document.createElement('div');
        g.className = 'command-group';
        var gTitle = document.createElement('div');
        gTitle.className = 'command-group-title';
        gTitle.textContent = grp.name;
        g.appendChild(gTitle);
        grp.commands.forEach(function(cmd) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'command-item';
            btn.textContent = cmd.name;
            btn.addEventListener('click', function() {
                if (!SELECTED_PERSON) { alert('请先在相关人员里点击选择一个角色，或点击常用角色。'); return; }
                var person = rel[SELECTED_PERSON] || {};
                var text = renderCommandText(cmd.text, SELECTED_PERSON, person);
                recordCommandUsage(data, SELECTED_PERSON);
                sendPlayerMessage(text);
            });
            g.appendChild(btn);
        });
        popover.appendChild(g);
    });

    document.body.appendChild(popover);
    COMMAND_POPOVER = popover;

    if (anchorEl) {
        var rect = anchorEl.getBoundingClientRect();
        var popWidth = popover.offsetWidth || 320;
        var popHeight = popover.offsetHeight;
        var viewW = window.innerWidth;
        var viewH = window.innerHeight;

        var left = rect.left;
        if (left + popWidth > viewW - 8) left = viewW - popWidth - 8;
        if (left < 8) left = 8;

        var top = rect.bottom + 6;
        if (popHeight && top + popHeight > viewH - 8) {
            top = rect.top - popHeight - 6;
            if (top < 8) top = 8;
        }
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    } else {
        popover.style.right = '20px';
        popover.style.top = '80px';
    }
}

/* ---------------------------------------------------------------------
 * 区块渲染器注册表（key 与 STATUS_WORLDVIEWS[..].pages 对应）
 * 每个渲染器签名：function(parsedData, container)
 * parsedData 为解析后的数据（含 .raw 原始变量，供各世界观按需读取）
 * --------------------------------------------------------------------- */
var SECTION_RENDERERS = {
    // 家产 estate：先按大洲切换，再按类型分选项卡（居所/商铺/农事/手工业/其他）
    estate: function(data, container) {
        var estate = data.estate || {};
        var todayISO = worldDateToISO(data.world && data.world.date);
        var currentWealth = (data.user && data.user.wealth) || '';
        var warehouse = data.warehouse || {};
        var staffIndex = buildStaffIndex(data.employment || {});
        var assignmentIndex = buildAssignmentIndex(data.employment || {});
        var section = document.createElement('div');
        section.className = 'section';
        container.appendChild(section);

        // 收集所有大洲（按固定顺序 南美/欧洲/西非，未知的追加到末尾）
        var continents = [];
        Object.keys(estate).forEach(function(name) {
            var c = getRegion(estate[name].location);
            if (continents.indexOf(c) === -1) continents.push(c);
        });
        var ordered = [];
        CONTINENTS.forEach(function(c) { if (continents.indexOf(c) !== -1) ordered.push(c); });
        continents.forEach(function(c) { if (ordered.indexOf(c) === -1) ordered.push(c); });
        if (!ordered.length) ordered = ['本地'];
        if (ordered.indexOf(CURRENT_CONTINENT) === -1) CURRENT_CONTINENT = ordered[0];

        function continentCount(c) {
            return Object.keys(estate).filter(function(n) { return getRegion(estate[n].location) === c; }).length;
        }

        function render() {
            section.innerHTML = '';
            section.appendChild(buildSectionTitle('&#x1F3E0;', '家产'));
            section.appendChild(buildWarehouseBlock(warehouse, CURRENT_CONTINENT, data));

            // 大洲切换栏
            var contBar = document.createElement('div');
            contBar.className = 'entity-tabs';
            ordered.forEach(function(c) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'entity-tab' + (c === CURRENT_CONTINENT ? ' active' : '');
                btn.textContent = c + continentCount(c);
                btn.dataset.continent = c;
                contBar.appendChild(btn);
            });
            section.appendChild(contBar);

            // 按类型分组（仅当前大洲）
            var groups = {};
            ESTATE_TYPES.forEach(function(et) { groups[et.label] = []; });
            Object.keys(estate).forEach(function(name) {
                var e = estate[name] || {};
                if (getRegion(e.location) !== CURRENT_CONTINENT) return;
                var t = e.type;
                var cat = '其他';
                ESTATE_TYPES.forEach(function(et) { if (et.key === t) cat = et.label; });
                if (!groups[cat]) groups[cat] = [];
                groups[cat].push({ name: name, data: e });
            });

            // 类型选项卡栏
            var tabBar = document.createElement('div');
            tabBar.className = 'entity-tabs';
            ESTATE_TYPES.forEach(function(et) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'entity-tab' + (et.label === CURRENT_ESTATE_TAB ? ' active' : '');
                btn.textContent = et.label + (groups[et.label] ? groups[et.label].length : 0);
                btn.dataset.type = et.label;
                tabBar.appendChild(btn);
            });
            section.appendChild(tabBar);

            // 转化方针编辑与命名（仅手工业选项卡下显示）
            var policyEditBtn = document.createElement('button');
            policyEditBtn.type = 'button';
            policyEditBtn.className = 'collect-btn';
            policyEditBtn.textContent = '转化方针编辑与命名';
            policyEditBtn.style.display = (CURRENT_ESTATE_TAB === '手工业') ? '' : 'none';
            policyEditBtn.addEventListener('click', function() {
                openPolicyModal(function() { refreshPolicySelects(); });
            });
            section.appendChild(policyEditBtn);

            // 内容区
            var content = document.createElement('div');
            content.className = 'entity-tab-content';
            section.appendChild(content);

            function renderContent() {
                var list = groups[CURRENT_ESTATE_TAB] || [];
                content.innerHTML = '';
                if (!list.length) {
                    content.appendChild(buildEmptyHint('暂无' + CURRENT_CONTINENT + '·' + CURRENT_ESTATE_TAB + '类家产...'));
                    return;
                }
                list.forEach(function(item) {
                    content.appendChild(buildEstateCard(item.name, item.data, todayISO, currentWealth, warehouse, staffIndex[item.name] || 0, assignmentIndex[item.name] || []));
                });
            }
            renderContent();

            // 大洲切换
            contBar.addEventListener('click', function(e) {
                var btn = e.target.closest('.entity-tab');
                if (!btn) return;
                if (CURRENT_CONTINENT === btn.dataset.continent) return;
                CURRENT_CONTINENT = btn.dataset.continent;
                closeOverlays();
                render();
            });

            // 类型切换
            tabBar.addEventListener('click', function(e) {
                var btn = e.target.closest('.entity-tab');
                if (!btn) return;
                CURRENT_ESTATE_TAB = btn.dataset.type;
                tabBar.querySelectorAll('.entity-tab').forEach(function(b) {
                    b.classList.toggle('active', b === btn);
                });
                policyEditBtn.style.display = (CURRENT_ESTATE_TAB === '手工业') ? '' : 'none';
                closeOverlays();
                renderContent();
            });
        }

        render();
    },

    // 船只 ships：按 uid27 type 枚举（SHIP_TYPES）分选项卡，信息卡不重复显示 type 字段
    ships: function(data, container) {
        var ships = data.ships || {};
        var section = document.createElement('div');
        section.className = 'section';
        section.appendChild(buildSectionTitle('&#x1F6A2;', '船只'));

        // 按固定类型枚举分组；未知类型归入「其他」（追加到选项卡末尾）
        var tabTypes = SHIP_TYPES.slice();
        var groups = {};
        SHIP_TYPES.forEach(function(t) { groups[t] = []; });
        var hasUnknown = false;
        Object.keys(ships).forEach(function(name) {
            var s = ships[name] || {};
            var t = s.type;
            var cat = SHIP_TYPES.indexOf(t) !== -1 ? t : '其他';
            if (cat === '其他') {
                if (!groups['其他']) groups['其他'] = [];
                hasUnknown = true;
            }
            groups[cat].push({ name: name, data: s });
        });
        if (hasUnknown) tabTypes.push('其他');

        if (!Object.keys(ships).length) {
            section.appendChild(buildEmptyHint('暂无船只...'));
            container.appendChild(section);
            return;
        }

        // 当前选项卡无效（未初始化或类型消失）时，回退到第一个有船的类型
        if (tabTypes.indexOf(CURRENT_SHIP_TAB) === -1 || !(groups[CURRENT_SHIP_TAB] && groups[CURRENT_SHIP_TAB].length)) {
            var firstHasShips = tabTypes.filter(function(t) { return groups[t] && groups[t].length; })[0];
            CURRENT_SHIP_TAB = firstHasShips || tabTypes[0];
        }

        // 选项卡栏（显示各类型数量）
        var tabBar = document.createElement('div');
        tabBar.className = 'entity-tabs';
        tabTypes.forEach(function(t) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'entity-tab' + (t === CURRENT_SHIP_TAB ? ' active' : '');
            btn.textContent = t + (groups[t] ? groups[t].length : 0);
            btn.dataset.type = t;
            tabBar.appendChild(btn);
        });
        section.appendChild(tabBar);

        // 内容区
        var content = document.createElement('div');
        content.className = 'entity-tab-content';
        section.appendChild(content);

        function renderContent() {
            var list = groups[CURRENT_SHIP_TAB] || [];
            content.innerHTML = '';
            if (!list.length) {
                content.appendChild(buildEmptyHint('暂无' + CURRENT_SHIP_TAB + '类船只...'));
                return;
            }
            list.forEach(function(item) {
                content.appendChild(buildShipCard(item.name, item.data));
            });
        }
        renderContent();

        // 选项卡点击切换
        tabBar.addEventListener('click', function(e) {
            var btn = e.target.closest('.entity-tab');
            if (!btn) return;
            CURRENT_SHIP_TAB = btn.dataset.type;
            tabBar.querySelectorAll('.entity-tab').forEach(function(b) {
                b.classList.toggle('active', b === btn);
            });
            closeOverlays();
            renderContent();
        });

        container.appendChild(section);
    },

    // 关系 relationship：三选项卡（管理 / 家人 / 下属）
    relationship: function(data, container) {
        var section = document.createElement('div');
        section.className = 'section';
        container.appendChild(section);

        function render() {
            section.innerHTML = '';
            section.appendChild(buildSectionTitle('&#x1F465;', '关系'));

            var topRow = document.createElement('div');
            topRow.className = 'rel-top-row';
            var tabBar = document.createElement('div');
            tabBar.className = 'entity-tabs';
            ['管理', '相关人员'].forEach(function(t) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'entity-tab' + (t === CURRENT_REL_TAB ? ' active' : '');
                btn.textContent = t;
                btn.dataset.tab = t;
                tabBar.appendChild(btn);
            });
            topRow.appendChild(tabBar);
            var cmdToggle = document.createElement('label');
            cmdToggle.className = 'command-toggle';
            var cmdCb = document.createElement('input');
            cmdCb.type = 'checkbox';
            cmdCb.checked = COMMAND_MODE;
            cmdCb.addEventListener('change', function() {
                COMMAND_MODE = cmdCb.checked;
                if (!COMMAND_MODE) {
                    SELECTED_PERSON = null;
                    closeCommandPanel();
                    document.querySelectorAll('.person-card.person-selected').forEach(function(el) { el.classList.remove('person-selected'); });
                }
            });
            cmdToggle.appendChild(cmdCb);
            cmdToggle.appendChild(document.createTextNode('指令'));
            topRow.appendChild(cmdToggle);
            section.appendChild(topRow);

            var content = document.createElement('div');
            content.className = 'entity-tab-content';
            section.appendChild(content);

            if (CURRENT_REL_TAB === '相关人员') renderRelatedPersonsTab(data, content);
            else renderManagementTab(data, content, render);

            tabBar.addEventListener('click', function(e) {
                var btn = e.target.closest('.entity-tab');
                if (!btn) return;
                if (CURRENT_REL_TAB === btn.dataset.tab) return;
                CURRENT_REL_TAB = btn.dataset.tab;
                closeOverlays();
                render();
            });
        }
        render();
    },

    // 地区（背景信息.地区）：{ 名称: { 描述, 民俗风情 } }
    region: function(data, container) {
        var region = data.region || {};
        var section = document.createElement('div');
        section.className = 'section';
        section.appendChild(buildSectionTitle('&#x1F5FA;', '地区'));
        var names = Object.keys(region);
        if (!names.length) { section.appendChild(buildEmptyHint('暂无地区信息...')); }
        else names.forEach(function(name) {
            section.appendChild(buildRegionCard(name, region[name] || {}));
        });
        container.appendChild(section);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var App = {
        state: {
            parsedData: { user: {}, stageData: null, currentStageData: null },
            prevRenderData: { title: null, psyche: null, surroundings: null, inventory: null, stageData: null, currentStageData: null, bodyState: null, world: null, wealth: null, gold: null, mode: null, isStageExpanded: null, isTaskPanelCollapsed: null, modeExtra: null, modeForSections: null, worldviewForSections: null },
            settings: {},
            uniqueId: '{{user}}',
            db: null,
            currentAvatarUrl: null,
            throttleTimers: {},
            pendingDeleteItem: null,
            isEditMode: false,
            editOriginalData: null,
            activePages: [],
            worldInfoValues: {}
        },

        uiStateConfig: {
            data: {
                isPanelCollapsed: false,
                isStageDetailsExpanded: false,
                isTaskPanelCollapsed: false,
                worldInfoTop: 'date',
                controlPanelOnLastPage: false
            },
            getStorageKey: function() { return 'state_uiconfig_' + App.state.uniqueId; },
            load: function() {
                var self = this;
                try {
                    var saved = JSON.parse(localStorage.getItem(self.getStorageKey()));
                    if (saved) { self.data = Object.assign({}, self.data, saved); }
                } catch(e) {}
                self.applyCollapse();
            },
            save: function() {
                localStorage.setItem(this.getStorageKey(), JSON.stringify(this.data));
            },
            togglePanel: function() {
                this.data.isPanelCollapsed = !this.data.isPanelCollapsed;
                this.save();
                this.applyCollapse();
            },
            toggleStage: function() {
                this.data.isStageDetailsExpanded = !this.data.isStageDetailsExpanded;
                this.save();
                App.ui.renderStagePanel();
            },
            toggleTaskPanel: function() {
                this.data.isTaskPanelCollapsed = !this.data.isTaskPanelCollapsed;
                if (this.data.isTaskPanelCollapsed) {
                    App.state.isEditMode = false;
                    App.state.editOriginalData = null;
                }
                this.save();
                App.ui.renderStagePanel();
            },
            applyCollapse: function() {
                if (this.data.isPanelCollapsed) {
                    App.elements.statusCard.classList.add('global-collapsed');
                    setTimeout(function() {
                        document.body.style.paddingTop = '11px';
                        document.body.offsetHeight;
                        document.body.style.paddingTop = '';
                    }, 30);
                } else {
                    App.elements.statusCard.classList.remove('global-collapsed');
                    // 展开后强制重排，确保侧边书签回到底部正确位置、不覆盖主内容
                    setTimeout(function() {
                        document.body.offsetHeight;
                    }, 30);
                }
            }
        },

        elements: {
            root: document.documentElement,
            body: document.body,
            statusCard: document.getElementById('status-card-wrapper'),
            collapsePanelBtn: document.getElementById('collapse-panel-btn'),
            avatar: document.getElementById('avatar'),
            avatarPlaceholder: document.getElementById('avatar-placeholder'),
            text: {
                title: document.getElementById('char-title'),
                psyche: document.getElementById('psyche-bubble'),
                tagContainer: document.getElementById('identity-tags-container')
            },
            containers: {
                surroundings: document.getElementById('surroundings-list'),
                inventory: document.getElementById('inventory-grid'),
                inventoryWrapper: document.getElementById('inventory-wrapper'),
                taskPanel: document.getElementById('task-panel'),
                stageCollapseToggle: document.getElementById('stage-collapse-toggle-area'),
                headerBtnArea: document.getElementById('header-stage-btn-area'),
                userHeader: document.getElementById('user-header'),
                modeSections2: document.getElementById('mode-sections-2'),
                modeSections3: document.getElementById('mode-sections-3'),
                modeSections4: document.getElementById('mode-sections-4'),
                modeSections5: document.getElementById('mode-sections-5'),
                modeSections6: document.getElementById('mode-sections-6'),
                worldInfo: document.getElementById('world-info'),
                worldInfoTop: document.getElementById('wib-top'),
                worldInfoExpand: document.getElementById('wib-expand'),
                pages: document.querySelectorAll('.page')
            },
            settings: {
                toggle: document.getElementById('settings-toggle'),
                panel: document.getElementById('settings-panel'),
                sliders: { spacing: document.getElementById('spacing-slider'), fontSize: document.getElementById('font-size-slider'), avatarSize: document.getElementById('avatar-size-slider'), panelHeight: document.getElementById('panel-height-slider') },
                values: { spacing: document.getElementById('spacing-value'), fontSize: document.getElementById('font-size-value'), avatarSize: document.getElementById('avatar-size-value'), panelHeight: document.getElementById('panel-height-value') },
                fontSelector: document.getElementById('font-selector'),
                themeSelector: document.getElementById('theme-selector'),
                themeValue: document.getElementById('theme-value'),
                buttons: { reset: document.getElementById('reset-settings-btn') }
            },
            deleteConfirm: { panel: document.getElementById('delete-confirm-panel'), msgContent: document.getElementById('delete-msg-content'), btnConfirm: document.getElementById('confirm-delete-btn'), btnCancel: document.getElementById('cancel-delete-btn') },
            itemDetail: {
                panel: document.getElementById('item-detail-panel'),
                nameElem: document.getElementById('detail-item-name'),
                descElem: document.getElementById('detail-item-description'),
                btnDelete: document.getElementById('detail-delete-btn'),
                btnClose: document.getElementById('detail-close-btn')
            },
            clipboardNotice: {
                panel: document.getElementById('clipboard-notice-panel'),
                text: document.getElementById('clipboard-notice-text'),
                btnClose: document.getElementById('clipboard-notice-close-btn')
            },
            pageTurnBtn: document.getElementById('page-turn-bookmark'),
            pagePrevBtn: document.getElementById('page-prev-bookmark'),
            controlPanelPage: document.getElementById('page-7')
        },

        throttle: function(func, limit) {
            return function() {
                var args = arguments;
                if (!App.state.throttleTimers[func]) {
                    func.apply(App, args);
                    App.state.throttleTimers[func] = setTimeout(function() { delete App.state.throttleTimers[func]; }, limit);
                }
            };
        },

        db: {
            DB_NAME: 'UISettingsDB', DB_VERSION: 1, AVATAR_STORE_NAME: 'avatars',
            init: function() {
                if (App.state.db) return Promise.resolve(App.state.db);
                var self = this;
                return new Promise(function(resolve, reject) {
                    var request = indexedDB.open(self.DB_NAME, self.DB_VERSION);
                    request.onerror = function() { reject('数据库读写错误'); };
                    request.onsuccess = function(event) { App.state.db = event.target.result; resolve(App.state.db); };
                    request.onupgradeneeded = function(event) { var db = event.target.result; if (!db.objectStoreNames.contains(self.AVATAR_STORE_NAME)) db.createObjectStore(self.AVATAR_STORE_NAME); };
                });
            },
            save: function(key, data) {
                var self = this;
                return this.init().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var tx = db.transaction([self.AVATAR_STORE_NAME], 'readwrite');
                        tx.objectStore(self.AVATAR_STORE_NAME).put(data, key).onsuccess = resolve;
                        tx.onerror = function(e) { reject(e.target.error); };
                    });
                });
            },
            load: function(key) {
                var self = this;
                return this.init().then(function(db) {
                    return new Promise(function(resolve, reject) {
                        var req = db.transaction([self.AVATAR_STORE_NAME], 'readonly').objectStore(self.AVATAR_STORE_NAME).get(key);
                        req.onsuccess = function() { resolve(req.result); };
                        req.onerror = function(e) { reject(e.target.error); };
                    });
                });
            }
        },

        settings: {
            DEFAULTS: { spacing: 1.5, fontSize: 16, avatarSize: 60, panelHeight: 480, fontFamily: "'ZCOOL XiaoWei', sans-serif", theme: 'light' },
            getStorageKey: function() { return 'uiSettings_' + App.state.uniqueId; },
            load: function() {
                var saved = {};
                try { saved = JSON.parse(localStorage.getItem(this.getStorageKey())) || {}; } catch (e) {}
                App.state.settings = Object.assign({}, this.DEFAULTS, saved);
                this.apply(App.state.settings); this.updateUIControls(App.state.settings);
            },
            applyTheme: function(theme) {
                var effective = theme || 'light';
                if (effective === 'auto') {
                    effective = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                }
                App.elements.root.setAttribute('data-theme', effective);
                var themeValue = App.elements.settings.themeValue;
                if (themeValue) themeValue.textContent = (effective === 'dark' ? '夜间模式' : '日间模式');
            },
            apply: function(s) {
                var e = App.elements;
                requestAnimationFrame(function() {
                    e.root.style.setProperty('--section-gap', s.spacing + 'rem');
                    e.root.style.setProperty('--base-font-size', s.fontSize + 'px');
                    e.root.style.setProperty('--avatar-size', s.avatarSize + 'px');
                    e.root.style.setProperty('--panel-height', s.panelHeight + 'px');
                    e.root.style.setProperty('--font-main', s.fontFamily);
                    App.settings.applyTheme(s.theme);
                    Object.keys(e.settings.values).forEach(function(key) {
                        if (e.settings.values[key]) {
                            var val = s[key]; var unit = key.indexOf('spacing') !== -1 ? 'rem' : 'px';
                            e.settings.values[key].textContent = val + unit;
                        }
                    });
                });
            },
            updateUIControls: function(s) {
                Object.keys(App.elements.settings.sliders).forEach(function(k) { if (App.elements.settings.sliders[k]) App.elements.settings.sliders[k].value = s[k]; });
                App.elements.settings.fontSelector.value = s.fontFamily;
                if (App.elements.settings.themeSelector) App.elements.settings.themeSelector.value = s.theme;
            },
            save: function() {
                var sliders = App.elements.settings.sliders;
                var fontSelector = App.elements.settings.fontSelector;
                var newS = Object.assign({}, App.state.settings);
                Object.keys(sliders).forEach(function(k) { if(sliders[k]) newS[k] = parseFloat(sliders[k].value); });
                newS.fontFamily = fontSelector.value;
                if (App.elements.settings.themeSelector) newS.theme = App.elements.settings.themeSelector.value;
                App.state.settings = newS; localStorage.setItem(this.getStorageKey(), JSON.stringify(newS)); this.apply(newS);
            },
            reset: function() { if(confirm('确定要恢复默认设置吗？操作不可逆。')) { App.state.settings = Object.assign({}, this.DEFAULTS); localStorage.removeItem(this.getStorageKey()); this.apply(App.state.settings); this.updateUIControls(App.state.settings); } }
        },

        ui: {
            updateAvatar: function(file) {
                if (App.state.currentAvatarUrl) { URL.revokeObjectURL(App.state.currentAvatarUrl); App.state.currentAvatarUrl = null; }
                if (file) {
                    var url = URL.createObjectURL(file); App.state.currentAvatarUrl = url;
                    App.elements.avatar.style.backgroundImage = 'url(' + url + ')'; App.elements.avatarPlaceholder.style.display = 'none';
                } else { App.elements.avatar.style.backgroundImage = 'none'; App.elements.avatarPlaceholder.style.display = 'flex'; }
            },

            renderSurroundings: function(container, tagsStr) {
                var fragment = document.createDocumentFragment(); container.innerHTML = '';
                if (tagsStr) {
                    tagsStr.split(/[,\，]/).forEach(function(tag) {
                        if (!tag.trim()) return; var span = document.createElement('span');
                        span.className = 'person-tag'; span.textContent = tag.trim(); fragment.appendChild(span);
                    });
                    container.appendChild(fragment);
                } else { container.innerHTML = '<span style="color:var(--color-text-light);font-style:italic;">暂无环境信息...</span>'; }
            },

            renderWorldInfo: function(world, gold, wealth) {
                var el = App.elements.containers.worldInfo;
                world = world || {};
                var hasAny = !!(world.date || world.position || world.time || gold || wealth);
                if (el) { el.style.display = hasAny ? '' : 'none'; }
                if (!hasAny) return;

                // 本子世界没有金币/财富变量 → 传空串，让小挂件里不出现「财富」这一项
                var wv = (App.state.parsedData && App.state.parsedData.worldview) || '';
                var wealthText = (wv === 'hentai') ? '' : formatWealth(gold, wealth);

                App.state.worldInfoValues = {
                    date: world.date || '',
                    position: world.position || '',
                    time: formatTime(world.time),
                    wealth: wealthText
                };
                App.ui.renderWorldInfoWidget();
            },

            // 渲染可折叠彩灯组件：置顶项 + 其余项 + 排序选择器
            // 值为空的项目直接不显示（例：本子世界没有财富/金币变量，就不出现「财富」这一项）
            renderWorldInfoWidget: function() {
                var top = App.elements.containers.worldInfoTop;
                var expand = App.elements.containers.worldInfoExpand;
                if (!top || !expand) return;
                var values = App.state.worldInfoValues || {};

                var items = WIB_ITEMS.filter(function(it) {
                    var v = values[it.key];
                    return v !== undefined && v !== null && String(v).trim() !== '';
                });
                if (!items.length) items = [WIB_ITEMS[0]];

                var topKey = App.uiStateConfig.data.worldInfoTop || 'date';
                var topItem = items[0];
                items.forEach(function(it) { if (it.key === topKey) topItem = it; });

                top.innerHTML = '<span class="wib-top-label">' + topItem.label + '</span>' +
                    '<span class="wib-top-value">' + (values[topItem.key] || '') + '</span>' +
                    '<span class="wib-arrow">\u25BE</span>';

                var html = '';
                items.forEach(function(it) {
                    if (it.key === topItem.key) return;
                    html += '<div class="wib-item"><span class="wib-item-label">' + it.label + '</span><span class="wib-item-value">' + (values[it.key] || '') + '</span></div>';
                });
                html += '<div class="wib-picker"><span class="wib-picker-title">置顶</span>';
                items.forEach(function(it) {
                    html += '<label class="wib-picker-opt"><input type="radio" name="wib-top-pick" value="' + it.key + '"' + (it.key === topItem.key ? ' checked' : '') + '>' + it.label + '</label>';
                });
                html += '</div>';
                expand.innerHTML = html;
            },

            toggleWorldInfo: function() {
                var el = App.elements.containers.worldInfo;
                if (el) el.classList.toggle('expanded');
            },

            renderInventory: function(container, inventoryData) {
                container.innerHTML = '';
                if (!inventoryData || Object.keys(inventoryData).length === 0) {
                    container.innerHTML = '<div style="color:var(--color-accent);font-size:0.85rem;grid-column:1/-1;text-align:center;font-style:italic;margin-top:20px;">物品栏目前为空...</div>'; return;
                }
                var fragment = document.createDocumentFragment();
                Object.entries(inventoryData).forEach(function(entry) {
                    var name = entry[0], count = entry[1];
                    var item = document.createElement('div'); item.className = 'inventory-item'; item.dataset.key = name;
                    item.innerHTML = '<div class="inventory-name">' + name + '</div>';
                    item.addEventListener('click', function(e) {
                        e.stopPropagation();
                        App.actions.openItemDetail(name, count);
                    });
                    fragment.appendChild(item);
                });
                container.appendChild(fragment);
            },

            // 按 setting.mode × setting.worldview 渲染各页的动态区块（骨架核心入口）
            renderModeSections: function() {
                var containers = App.elements.containers;
                var d = App.state.parsedData;
                if (!d) return;
                var view = getStatusView(d.mode, d.worldview);
                var pages = view.pages || [];
                // 清空第 2~N 页的动态容器
                for (var i = 2; i <= App.elements.containers.pages.length; i++) {
                    var c = containers['modeSections' + i];
                    if (c) c.innerHTML = '';
                }
                pages.forEach(function(pageKeys, idx) {
                    var container = containers['modeSections' + (idx + 2)];
                    if (!container) return;
                    (pageKeys || []).forEach(function(key) {
                        var renderer = SECTION_RENDERERS[key];
                        if (renderer) renderer(d, container);
                    });
                });
            },

            renderStagePanel: function() {
                var taskPanel = App.elements.containers.taskPanel;
                var toggleArea = App.elements.containers.stageCollapseToggle;
                taskPanel.innerHTML = '';

                // 由模式维度决定是否显示剧情面板（自由模式隐藏）
                var view = getStatusView(App.state.parsedData.mode, App.state.parsedData.worldview);
                var headerBtn = App.elements.containers.headerBtnArea;
                var userHeader = App.elements.containers.userHeader;
                headerBtn.innerHTML = '';
                headerBtn.style.display = 'none';
                userHeader.classList.remove('no-border');
                if (!view.showStage) {
                    toggleArea.innerHTML = '';
                    toggleArea.style.display = 'none';
                    taskPanel.style.display = 'none';
                    return;
                }
                // 剧情模式：恢复显示
                toggleArea.style.display = '';
                taskPanel.style.display = '';

                var nextStage = App.state.parsedData.stageData;
                var currentStage = App.state.parsedData.currentStageData;
                var isEditing = App.state.isEditMode;
                var editableAttr = isEditing ? ' contenteditable="true"' : '';

                // 编辑 / 保存按钮（靠右显示，与右上角展示栏错开）
                if (nextStage || currentStage) {
                    toggleArea.innerHTML = '' +
                        (isEditing ? '<span id="stage-save-btn" class="stage-action-btn stage-save-btn">\uD83D\uDCBE \u4FDD\u5B58</span>' : '') +
                        '<span id="stage-edit-btn" class="stage-action-btn stage-edit-btn' + (isEditing ? ' active' : '') + '">' + (isEditing ? '\u2716 \u7F16\u8F91\u4E2D' : '\u270F\uFE0F \u7F16\u8F91') + '</span>';
                    var editBtn = document.getElementById('stage-edit-btn');
                    if (editBtn) {
                        editBtn.addEventListener('click', function() { App.actions.toggleEditMode(); });
                    }
                    var saveBtn = document.getElementById('stage-save-btn');
                    if (saveBtn) {
                        saveBtn.addEventListener('click', function() { App.actions.saveEdit(); });
                    }
                } else {
                    toggleArea.innerHTML = '';
                }

                // 无数据时
                if (!nextStage && !currentStage) {
                    taskPanel.innerHTML = '<div class="task-container"><div class="task-header">\u2726 \u5267\u60C5\u72B6\u6001 \u2726</div><div style="text-align: center; color: var(--color-accent); padding: 1.5rem; font-style:italic;">暂未开始剧情，若你正在进行自定义生成，可以在正则中暂时关闭状态栏显示</div></div>';
                    return;
                }

                // 展开状态：正常渲染
                var fragment = document.createDocumentFragment();
                var container = document.createElement('div');
                container.className = 'task-container';

                var isExpanded = App.uiStateConfig.data.isStageDetailsExpanded;

                var html = '';

                if (currentStage) {
                    var csKey = currentStage.stageName;
                    var csDesc = currentStage.description || '';
                    var csCond = currentStage.condition || '';
                    var csGuide = currentStage.guide || '';
                    html += '<div style="border-bottom: 1px dashed rgba(184, 134, 11, 0.3);">' +
                        '<div style="padding: 0.5rem 1rem; font-family: var(--font-tech); font-size: 1rem; color: var(--color-primary-dark); display: flex; justify-content: space-between; align-items: center;">' +
                            '<span>\u2726 \u5F53\u524D\u9636\u6BB5 \u2726</span>' +
                        '</div>' +
                        '<div class="stage-box">' +
                            '<div class="stage-title" style="color: var(--color-accent);">剧情描述：</div>' +
                            '<div class="stage-text" data-stage-key="' + csKey + '" data-field="\u63CF\u8FF0"' + editableAttr + '>' + (isEditing ? csDesc : (csDesc || '无描述')) + '</div>' +
                        '</div>' +
                        '<div id="current-stage-details" style="display: ' + (isExpanded || isEditing ? 'block' : 'none') + ';">' +
                            (isEditing || currentStage.condition ? '<div class="stage-box"><div class="stage-title">触发条件（已完成）:</div><div class="stage-text" data-stage-key="' + csKey + '" data-field="\u89E6\u53D1\u6761\u4EF6"' + editableAttr + '>' + csCond + '</div></div>' : '') +
                            (isEditing || currentStage.guide ? '<div class="stage-box" style="background: rgba(212, 175, 55, 0.05);"><div class="stage-title">剧情指引:</div><div class="stage-text italic" data-stage-key="' + csKey + '" data-field="\u9636\u6BB5\u6307\u5BFC"' + editableAttr + '>' + csGuide + '</div></div>' : '') +
                        '</div>' +
                    '</div>';
                }

                if (nextStage) {
                    var nsKey = nextStage.stageName;
                    var nsDesc = nextStage.description || '';
                    var nsCond = nextStage.condition || '';
                    var nsGuide = nextStage.guide || '';
                    html += '<div>' +
                        '<div style="padding: 0.5rem 1rem; font-family: var(--font-tech); font-size: 1rem; color: var(--color-primary-dark); display: flex; justify-content: space-between; align-items: center;">' +
                            '<span>\u2726 \u4E0B\u4E00\u9636\u6BB5 \u2726</span>' +
                            (isEditing ? '' : '<span id="toggle-stage-view" style="font-size: 0.8em; opacity: 0.85; cursor: pointer; border: 1px dotted currentColor; padding: 2px 6px; border-radius: 4px;">' +
                                (isExpanded ? '\u25B5 \u6536\u8D77\u8BE6\u60C5' : '\u25BF \u5C55\u5F00\u8BE6\u60C5') +
                            '</span>') +
                        '</div>' +
                        '<div class="stage-box">' +
                            '<div class="stage-title">触发条件：</div>' +
                            '<div class="stage-text" data-stage-key="' + nsKey + '" data-field="\u89E6\u53D1\u6761\u4EF6"' + editableAttr + '>' + (isEditing ? nsCond : (nsCond || '无特定条件')) + '</div>' +
                        '</div>' +
                        '<div id="stage-details-wrapper" style="display: ' + (isExpanded || isEditing ? 'block' : 'none') + ';">' +
                            '<div class="stage-box"><div class="stage-title">阶段任务：</div><div class="stage-text" data-stage-key="' + nsKey + '" data-field="\u63CF\u8FF0"' + editableAttr + '>' + (isEditing ? nsDesc : (nsDesc || '任务描述未提供...')) + '</div></div>' +
                            (isEditing || nextStage.guide ? '<div class="stage-box" style="background: rgba(212, 175, 55, 0.05);"><div class="stage-title">剧情指引：</div><div class="stage-text italic" data-stage-key="' + nsKey + '" data-field="\u9636\u6BB5\u6307\u5BFC"' + editableAttr + '>' + nsGuide + '</div></div>' : '') +
                        '</div>' +
                    '</div>';
                }

                container.innerHTML = html;
                fragment.appendChild(container);
                taskPanel.appendChild(fragment);

                var toggleBtn = document.getElementById('toggle-stage-view');
                if (toggleBtn) {
                    toggleBtn.addEventListener('click', function() { App.uiStateConfig.toggleStage(); });
                }
            },

            renderBodyState: function(statesStr) {
                var container = App.elements.text.tagContainer;
                var oldStates = container.querySelectorAll('.body-state-tag');
                oldStates.forEach(function(el) { el.remove(); });
                if (!statesStr) return;
                var fragment = document.createDocumentFragment();
                statesStr.split(/[\u3001,\uFF0C]/).map(function(s) { return s.trim(); }).filter(function(s) { return s; }).forEach(function(s) {
                    var tag = document.createElement('div'); tag.className = 'body-state-tag'; tag.textContent = s; fragment.appendChild(tag);
                });
                container.appendChild(fragment);
            },

            updateAll: function() {
                var d = App.state.parsedData; var prev = App.state.prevRenderData; var text = App.elements.text; var containers = App.elements.containers;
                if (!d || !d.user) return;
                requestAnimationFrame(function() {
                    if (d.user.identity !== prev.title) { text.title.textContent = d.user.identity || '...'; prev.title = d.user.identity; }
                    if (d.user.bodyState !== prev.bodyState) { App.ui.renderBodyState(d.user.bodyState); prev.bodyState = d.user.bodyState; }
                    if (d.user.psyche !== prev.psyche) { text.psyche.textContent = d.user.psyche || '没有特殊的情绪波澜...'; prev.psyche = d.user.psyche; }
                    if (d.user.surroundings !== prev.surroundings) { App.ui.renderSurroundings(containers.surroundings, d.user.surroundings); prev.surroundings = d.user.surroundings; }

                    var worldJson = JSON.stringify(d.world);
                    var goldVal = d.user.gold || '';
                    var wealthVal = d.user.wealth || '';
                    if (worldJson !== prev.world || wealthVal !== prev.wealth || goldVal !== prev.gold) { App.ui.renderWorldInfo(d.world, goldVal, wealthVal); prev.world = worldJson; prev.wealth = wealthVal; prev.gold = goldVal; }

                    var invJson = JSON.stringify(d.user.inventory);
                    if (invJson !== prev.inventory) { App.ui.renderInventory(containers.inventory, d.user.inventory); prev.inventory = invJson; }

                    // 模式/世界观切换：mode、worldview 或区块数据变化时重渲染动态区块
                    var extraJson = JSON.stringify({
                        estate: d.estate, ships: d.ships, relationship: d.relationship,
                        region: d.region, payroll: d.payroll, warehouse: d.warehouse,
                        employment: d.employment, command_usage: d.command_usage
                    });
                    if (d.mode !== prev.modeForSections || d.worldview !== prev.worldviewForSections || extraJson !== prev.modeExtra) {
                        App.ui.renderModeSections();
                        prev.modeForSections = d.mode;
                        prev.worldviewForSections = d.worldview;
                        prev.modeExtra = extraJson;
                    }

                    var stageJson = JSON.stringify(d.stageData);
                    var currentStageJson = JSON.stringify(d.currentStageData);
                    var expandedNow = App.uiStateConfig.data.isStageDetailsExpanded;
                    var taskPanelCollapsed = App.uiStateConfig.data.isTaskPanelCollapsed;
                    if (d.mode !== prev.mode || stageJson !== prev.stageData || currentStageJson !== prev.currentStageData || expandedNow !== prev.isStageExpanded || taskPanelCollapsed !== prev.isTaskPanelCollapsed) {
                        App.ui.renderStagePanel();
                        prev.mode = d.mode;
                        prev.stageData = stageJson;
                        prev.currentStageData = currentStageJson;
                        prev.isStageExpanded = expandedNow;
                        prev.isTaskPanelCollapsed = taskPanelCollapsed;
                    }

                    // 依据最终渲染结果刷新各页显隐与翻页范围
                    App.actions.refreshPages();
                });
            }
        },

        actions: {
            turnPage: function() {
                closeOverlays();
                var actives = App.state.activePages || [];
                if (actives.length <= 1) return;
                var current = null;
                actives.forEach(function(p) { if (p.classList.contains('active')) current = p; });
                var idx = actives.indexOf(current);
                if (idx === -1) idx = 0;
                App.actions.showPage(actives[(idx + 1) % actives.length]);
            },

            turnPageBack: function() {
                closeOverlays();
                var actives = App.state.activePages || [];
                if (actives.length <= 1) return;
                var current = null;
                actives.forEach(function(p) { if (p.classList.contains('active')) current = p; });
                var idx = actives.indexOf(current);
                if (idx === -1) idx = 0;
                App.actions.showPage(actives[(idx - 1 + actives.length) % actives.length]);
            },

            showPage: function(pageEl) {
                if (!pageEl) return;
                App.elements.containers.pages.forEach(function(p) { p.classList.remove('active'); });
                pageEl.classList.add('active');
                var isFirst = (pageEl === App.elements.containers.pages[0]);
                var settingsToggle = App.elements.settings.toggle;
                if (isFirst) {
                    settingsToggle.style.opacity = '1'; settingsToggle.style.pointerEvents = 'auto';
                } else {
                    settingsToggle.style.opacity = '0'; settingsToggle.style.pointerEvents = 'none';
                }
            },

            // 计算激活页（有内容才显示），并回到首个激活页（若当前页仍激活则保留）
            refreshPages: function() {
                var pages = App.elements.containers.pages;
                var d = App.state.parsedData;
                var view = d ? getStatusView(d.mode, d.worldview) : { showStage: false, pages: [] };
                var wp = view.pages || [];
                var controlPage = App.elements.controlPanelPage;
                var currentActive = null;
                pages.forEach(function(p) { if (p.classList.contains('active')) currentActive = p; });

                var actives = [pages[0]]; // 第 1 页（个人信息）始终激活
                // 第 2 页：剧情（剧情模式）或世界观第一页有区块
                if (view.showStage || (wp[0] && wp[0].length)) actives.push(pages[1]);
                // 控制面板默认置于第二页
                if (controlPage && !App.uiStateConfig.data.controlPanelOnLastPage) actives.push(controlPage);
                for (var i = 2; i < pages.length; i++) {
                    if (pages[i] === controlPage) continue; // 控制面板页单独处理
                    var wpi = i - 1;
                    if (wp[wpi] && wp[wpi].length) actives.push(pages[i]);
                }
                // 勾选「置于末页」时，控制面板移到末页
                if (controlPage && App.uiStateConfig.data.controlPanelOnLastPage) actives.push(controlPage);
                App.state.activePages = actives;

                pages.forEach(function(p) { p.classList.remove('active'); });
                var target = (currentActive && actives.indexOf(currentActive) !== -1) ? currentActive : actives[0];
                App.actions.showPage(target);
            },

            openItemDetail: function(name, data) {
                App.state.pendingDeleteItem = name;
                App.elements.itemDetail.nameElem.textContent = name;
                var descStr = '';
                if (typeof data === 'object' && data !== null) {
                    descStr = data.desc || data['\u63CF\u8FF0'] || data.description || data.info || JSON.stringify(data);
                } else if (typeof data === 'string' && isNaN(Number(data))) {
                    descStr = data;
                }
                if(App.elements.itemDetail.descElem) {
                   App.elements.itemDetail.descElem.textContent = descStr || "暂无特别需要留意的详细描述。";
                }
                App.elements.itemDetail.panel.classList.add('active');
            },
            closeItemDetail: function() {
                App.elements.itemDetail.panel.classList.remove('active');
            },

            deleteInventoryItem: function(itemName) {
                App.state.pendingDeleteItem = itemName;
                App.elements.deleteConfirm.msgContent.textContent = '确认操作：你确定要彻底丢弃物品 [ ' + itemName + ' ] 吗？\n一旦删除，该操作将无法撤回。';
                App.elements.deleteConfirm.panel.classList.add('active');
            },
            confirmDelete: async function() {
                var itemName = App.state.pendingDeleteItem; if (!itemName) return;
                var payload = { user: { inventory: {} } };
                payload.user.inventory[itemName] = {};
                try {
                    if (window.eventEmit) {
                        await window.eventEmit('era:deleteByObject', payload);
                        var itemEl = document.querySelector('.inventory-item[data-key="' + itemName.replace(/"/g, '\\"') + '"]');
                        if (itemEl) { itemEl.style.transition = 'all 0.2s'; itemEl.style.opacity = '0'; itemEl.style.transform = 'scale(0.8)'; setTimeout(function() { itemEl.remove(); }, 200); }
                    } else {
                        alert('\u65E0\u6CD5\u6B63\u5E38\u63A5\u5165SillyTavern\u7684\u6307\u4EE4\u901A\u9053\u3002');
                    }
                } catch (e) { alert('\u5220\u9664\u64CD\u4F5C\u53D1\u751F\u672A\u77E5\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\u3002'); }
                App.elements.deleteConfirm.panel.classList.remove('active'); App.state.pendingDeleteItem = null;
            },
            cancelDelete: function() { App.elements.deleteConfirm.panel.classList.remove('active'); App.state.pendingDeleteItem = null; },

            openClipboardNotice: function(text) {
                if (App.elements.clipboardNotice.text) App.elements.clipboardNotice.text.textContent = text;
                App.elements.clipboardNotice.panel.classList.add('active');
            },
            closeClipboardNotice: function() {
                App.elements.clipboardNotice.panel.classList.remove('active');
            },

            toggleEditMode: function() {
                var self = App;
                self.state.isEditMode = !self.state.isEditMode;
                if (self.state.isEditMode) {
                    self.state.editOriginalData = null;
                }
                self.ui.renderStagePanel();
                if (self.state.isEditMode) {
                    self.state.editOriginalData = self.actions._getEditSnapshot();
                }
            },

            saveEdit: async function() {
                var self = App;
                var currentSnapshot = self.actions._getEditSnapshot();
                if (self.state.editOriginalData === currentSnapshot) {
                    return;
                }
                var payload = { '\u5267\u60C5\u7EBF': {} };
                var editables = document.querySelectorAll('.stage-text[contenteditable="true"]');
                editables.forEach(function(el) {
                    var key = el.getAttribute('data-stage-key');
                    var field = el.getAttribute('data-field');
                    var value = el.textContent.trim();
                    if (!payload['\u5267\u60C5\u7EBF'][key]) {
                        payload['\u5267\u60C5\u7EBF'][key] = {};
                    }
                    payload['\u5267\u60C5\u7EBF'][key][field] = value;
                });
                try {
                    if (window.eventEmit) {
                        await window.eventEmit('era:updateByObject', payload);
                        // 立即更新本地 parsedData，避免退出编辑时回退到旧内容
                        var editedStages = payload['\u5267\u60C5\u7EBF'];
                        var cur = self.state.parsedData.currentStageData;
                        var nxt = self.state.parsedData.stageData;
                        for (var sk in editedStages) {
                            if (editedStages.hasOwnProperty(sk)) {
                                var fields = editedStages[sk];
                                if (cur && cur.stageName === sk) {
                                    if (fields['\u63CF\u8FF0'] !== undefined) cur.description = fields['\u63CF\u8FF0'];
                                    if (fields['\u89E6\u53D1\u6761\u4EF6'] !== undefined) cur.condition = fields['\u89E6\u53D1\u6761\u4EF6'];
                                    if (fields['\u9636\u6BB5\u6307\u5BFC'] !== undefined) cur.guide = fields['\u9636\u6BB5\u6307\u5BFC'];
                                }
                                if (nxt && nxt.stageName === sk) {
                                    if (fields['\u63CF\u8FF0'] !== undefined) nxt.description = fields['\u63CF\u8FF0'];
                                    if (fields['\u89E6\u53D1\u6761\u4EF6'] !== undefined) nxt.condition = fields['\u89E6\u53D1\u6761\u4EF6'];
                                    if (fields['\u9636\u6BB5\u6307\u5BFC'] !== undefined) nxt.guide = fields['\u9636\u6BB5\u6307\u5BFC'];
                                }
                            }
                        }
                        self.state.prevRenderData.stageData = null;
                        self.state.prevRenderData.currentStageData = null;
                    } else {
                        alert('\u65E0\u6CD5\u6B63\u5E38\u63A5\u5165SillyTavern\u7684\u6307\u4EE4\u901A\u9053\u3002');
                        return;
                    }
                } catch(e) {
                    alert('\u4FDD\u5B58\u64CD\u4F5C\u53D1\u751F\u672A\u77E5\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\u3002');
                    return;
                }
                self.state.editOriginalData = currentSnapshot;
                var saveBtn = document.getElementById('stage-save-btn');
                if (saveBtn) {
                    saveBtn.textContent = '\u2714 \u5DF2\u4FDD\u5B58';
                    saveBtn.classList.add('saved');
                    setTimeout(function() {
                        saveBtn.textContent = '\uD83D\uDCBE \u4FDD\u5B58';
                        saveBtn.classList.remove('saved');
                    }, 1500);
                }
            },

            _getEditSnapshot: function() {
                var editables = document.querySelectorAll('.stage-text[contenteditable="true"]');
                var snapshot = {};
                editables.forEach(function(el) {
                    var key = el.getAttribute('data-stage-key');
                    var field = el.getAttribute('data-field');
                    if (!snapshot[key]) snapshot[key] = {};
                    snapshot[key][field] = el.textContent.trim();
                });
                return JSON.stringify(snapshot);
            }
        },

        parsers: {
            getVariableData: async function() {
                try {
                    if (typeof window.getVariables !== 'function') {
                        // 非 SillyTavern 环境：若有演示数据（demo/demo-data.js）则用于本地预览，否则返回空
                        return (typeof window.DEMO_DATA !== 'undefined') ? window.DEMO_DATA : {};
                    }
                    var vars = await window.getVariables();
                    var raw = vars['stat_data']; if (typeof raw === 'string') raw = JSON.parse(raw); return raw || {};
                } catch (e) { return {}; }
            },
            cleanStr: function(str) { return typeof str === 'string' ? str.replace(/__DOT__/g, '.').replace(/__SPACE__/g, ' ') : str; },

            parseData: function(data) {
                var p = { user: {}, world: {}, stageData: null, currentStageData: null, mode: 'script', worldview: 'medieval', estate: {}, ships: {}, relationship: {}, region: {}, warehouse: {}, story_log: [], raw: null };
                if (!data) return p;
                var clean = this.cleanStr;

                // 保留原始变量，供各世界观区块渲染器按需读取（五个世界观变量各不相同）
                p.raw = data;

                var s = data.setting || {};
                p.mode = clean(s.mode || 'script');
                p.worldview = clean(s.worldview || 'medieval');

                var w = data.world || {};
                p.world = {
                    position: clean(w.position || ''),
                    date: clean(w.date || ''),
                    time: clean(w.time || '')
                };

                var u = data.user || {};
                p.user = {
                    name: clean(u.name || u.identity || '{{user}}'),
                    identity: clean(u.identity || ''),
                    bodyState: clean(u.body_state || ''),
                    gold: clean(u.gold || ''),
                    wealth: clean(u.wealth || ''),
                    surroundings: clean(u.surroundings || ''),
                    psyche: clean(u.psychological_description || u.Psychological_description || ''),
                    inventory: u.inventory || u.Inventory || {}
                };

                // 开拓新大陆（colony）世界观用到的变量（其余世界观从 p.raw 自行读取）
                p.estate = data.estate || {};
                p.ships = data.ships || {};
                p.relationship = data.relationship || {};
                p.employment = data.employment || {};
                p.command_usage = data.command_usage || {};
                p.warehouse = data.warehouse || {};
                p.payroll = data.payroll || {};
                p.region = (data['背景信息'] && data['背景信息'].地区) || {};
                p.story_log = normalizeStoryLog(data.story_log);

                var currentStageKey = data.write ? (data.write.stage || data.stage || '\u9636\u6BB50') : '\u9636\u6BB50';
                var nextStageKey = data.write ? data.write.next_stage : '';

                // 当前阶段（已触发）
                if (currentStageKey && data['\u5267\u60C5\u7EBF'] && data['\u5267\u60C5\u7EBF'][currentStageKey]) {
                    var info = data['\u5267\u60C5\u7EBF'][currentStageKey];
                    p.currentStageData = {
                        stageName: clean(currentStageKey),
                        description: clean(info['\u63CF\u8FF0'] || ''),
                        condition: clean(info['\u89E6\u53D1\u6761\u4EF6'] || ''),
                        guide: clean(info['\u9636\u6BB5\u6307\u5BFC'] || '')
                    };
                }

                // 下一阶段（待触发）
                if (nextStageKey && data['\u5267\u60C5\u7EBF'] && data['\u5267\u60C5\u7EBF'][nextStageKey]) {
                    var stageInfo = data['\u5267\u60C5\u7EBF'][nextStageKey];
                    p.stageData = {
                        stageName: clean(nextStageKey),
                        description: clean(stageInfo['\u63CF\u8FF0'] || ''),
                        condition: clean(stageInfo['\u89E6\u53D1\u6761\u4EF6'] || '\u672A\u8BBE\u7F6E\u89E6\u53D1\u6761\u4EF6'),
                        guide: clean(stageInfo['\u9636\u6BB5\u6307\u5BFC'] || '')
                    };
                }
                return p;
            }
        },

        bindEvents: function() {
            var statusCard = App.elements.statusCard;
            var collapsePanelBtn = App.elements.collapsePanelBtn;
            var settings = App.elements.settings;
            var avatar = App.elements.avatar;
            var deleteConfirm = App.elements.deleteConfirm;
            var itemDetail = App.elements.itemDetail;
            var clipboardNotice = App.elements.clipboardNotice;
            var pageTurnBtn = App.elements.pageTurnBtn;

            function toggleModal(panel) { panel.classList.toggle('active'); }

            [settings.panel, deleteConfirm.panel, itemDetail.panel, clipboardNotice.panel].forEach(function(panel) {
                panel.addEventListener('click', function(e) {
                    if (e.target === panel) {
                        if (panel === deleteConfirm.panel) App.actions.cancelDelete();
                        else if (panel === itemDetail.panel) App.actions.closeItemDetail();
                        else if (panel === clipboardNotice.panel) App.actions.closeClipboardNotice();
                        else toggleModal(panel);
                    }
                });
            });

            settings.toggle.addEventListener('click', function() {
                toggleModal(settings.panel);
            });

            if (collapsePanelBtn) {
                collapsePanelBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    App.uiStateConfig.togglePanel();
                });
            }

            statusCard.addEventListener('click', function() {
                if (App.uiStateConfig.data.isPanelCollapsed) {
                    App.uiStateConfig.togglePanel();
                }
            });

            deleteConfirm.btnConfirm.addEventListener('click', App.actions.confirmDelete);
            deleteConfirm.btnCancel.addEventListener('click', App.actions.cancelDelete);

            itemDetail.btnClose.addEventListener('click', App.actions.closeItemDetail);
            itemDetail.btnDelete.addEventListener('click', function() {
                App.actions.closeItemDetail();
                App.actions.deleteInventoryItem(App.state.pendingDeleteItem);
            });

            clipboardNotice.btnClose.addEventListener('click', App.actions.closeClipboardNotice);

            pageTurnBtn.addEventListener('click', App.actions.turnPage);
            App.elements.pagePrevBtn.addEventListener('click', App.actions.turnPageBack);

            // 故事日志面板：侧栏按钮切换、关闭按钮与背景点击关闭
            var storyLogBtn = document.getElementById('story-log-bookmark');
            if (storyLogBtn) {
                storyLogBtn.addEventListener('click', function() {
                    var panel = document.getElementById('story-log-panel');
                    if (!panel) return;
                    if (panel.classList.contains('open')) panel.classList.remove('open');
                    else openStoryLogPanel();
                });
            }
            var storyLogCloseBtn = document.getElementById('story-log-close-btn');
            if (storyLogCloseBtn) {
                storyLogCloseBtn.addEventListener('click', function() {
                    var panel = document.getElementById('story-log-panel');
                    if (panel) panel.classList.remove('open');
                });
            }
            var storyLogBackdrop = document.getElementById('story-log-backdrop');
            if (storyLogBackdrop) {
                storyLogBackdrop.addEventListener('click', function() {
                    var panel = document.getElementById('story-log-panel');
                    if (panel) panel.classList.remove('open');
                });
            }

            // 控制面板「置于末页」勾选项：默认第二页，勾选后移到末页
            var controlOnLastPageCb = document.getElementById('control-on-last-page');
            if (controlOnLastPageCb) {
                controlOnLastPageCb.checked = !!App.uiStateConfig.data.controlPanelOnLastPage;
                controlOnLastPageCb.addEventListener('change', function() {
                    App.uiStateConfig.data.controlPanelOnLastPage = controlOnLastPageCb.checked;
                    App.uiStateConfig.save();
                    App.actions.refreshPages();
                });
            }

            // 世界信息条：点击置顶项展开/收起，选择器里改置顶项
            if (App.elements.containers.worldInfoTop) {
                App.elements.containers.worldInfoTop.addEventListener('click', function() {
                    App.ui.toggleWorldInfo();
                });
            }
            if (App.elements.containers.worldInfoExpand) {
                App.elements.containers.worldInfoExpand.addEventListener('change', function(e) {
                    if (e.target && e.target.name === 'wib-top-pick') {
                        App.uiStateConfig.data.worldInfoTop = e.target.value;
                        App.uiStateConfig.save();
                        App.ui.renderWorldInfoWidget();
                    }
                });
            }

            Object.values(settings.sliders).forEach(function(s) { if(s) s.addEventListener('input', App.throttle(function() { App.settings.save(); }, 100)); });
            settings.fontSelector.addEventListener('change', function() { App.settings.save(); });
            if (settings.themeSelector) settings.themeSelector.addEventListener('change', function() { App.settings.save(); });
            if (window.matchMedia) {
                var mq = window.matchMedia('(prefers-color-scheme: dark)');
                var onSchemeChange = function() { if (App.state.settings.theme === 'auto') App.settings.apply(App.state.settings); };
                if (mq.addEventListener) mq.addEventListener('change', onSchemeChange); else if (mq.addListener) mq.addListener(onSchemeChange);
            }

            settings.buttons.reset.addEventListener('click', function() { App.settings.reset(); });

            avatar.addEventListener('click', function() {
                var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
                input.onchange = async function(e) {
                    var file = e.target.files[0];
                    if (file) { try { await App.db.save(App.state.uniqueId, file); App.ui.updateAvatar(file); } catch (err) { alert('头像图片保存失败，请重试。'); } }
                }; input.click();
            });

            window.addEventListener('beforeunload', function() { if (App.state.currentAvatarUrl) URL.revokeObjectURL(App.state.currentAvatarUrl); });
        },

        init: async function() {
            try {
                var rawVarData = await this.parsers.getVariableData();
                this.state.parsedData = this.parsers.parseData(rawVarData);
                if(this.state.parsedData.user.name && this.state.parsedData.user.name !== '{{user}}') {
                     this.state.uniqueId = this.state.parsedData.user.name.replace(/\s/g, '');
                }
                await refreshCharEntries();
                this.uiStateConfig.load();
                this.settings.load(); this.bindEvents(); await this.db.init();
                var avatarFile = await this.db.load(this.state.uniqueId);
                this.ui.updateAvatar(avatarFile); this.ui.updateAll();
            } catch(error) { console.error("数据加载时发生错误:", error); }
        }
    };
    /* =====================================================================
     * 本子世界：世界观调整（第 2 页）／特殊规则（第 3 页）／角色状态（第 4 页）
     * ---------------------------------------------------------------------
     * 世界观调整：读世界书 uid 54（世界观正文）＋ uid 69（社会生态），
     *   既可整套切换（预置来自 window.WORLDVIEW_PRESETS），也可逐条改／删／加子项，
     *   点「应用」写回 uid 54／69／28（变量规则，取预置里同名世界观的 varRulesFree）。
     * 特殊规则／角色状态：本轮只搭框架（渲染器已注册、变量已定），内容后续再做。
     * ===================================================================== */
    (function () {
        var UID_WORLD = 54, UID_ECO = 69, UID_VARRULES = 28;
        var LABELS = { '世界风格': '风格', '社会与法治': '社会与法治', '民俗风情': '民俗风情' };
        var st = { draft: null, source: '', editing: false, ecoSel: 0, err: '', busy: false, loadedOnce: false };
        var cachedHost = null;

        /* ---------- 世界书读写（优先新 API，退回旧接口） ---------- */
        function hostList() {
            var out = [];
            try { out.push(window); } catch (e) {}
            try { if (window.parent && window.parent !== window) out.push(window.parent); } catch (e) {}
            try { if (window.top && out.indexOf(window.top) === -1) out.push(window.top); } catch (e) {}
            return out;
        }
        function pickHost() {
            if (cachedHost) return cachedHost;
            var hs = hostList();
            for (var i = 0; i < hs.length; i++) {
                var w = hs[i];
                try {
                    if (w.TavernHelper) { cachedHost = w.TavernHelper; return cachedHost; }
                    if (typeof w.updateWorldbookWith === 'function') { cachedHost = w; return cachedHost; }
                    if (typeof w.getLorebookEntries === 'function') { cachedHost = w; return cachedHost; }
                } catch (e) {}
            }
            return null;
        }
        function bookName(h) {
            try {
                if (h && typeof h.getCharWorldbookNames === 'function') {
                    var c = h.getCharWorldbookNames('current');
                    if (c && c.primary) return c.primary;
                }
            } catch (e) {}
            return '千叶的睡前小故事';
        }
        async function readEntry(uid) {
            var h = pickHost(); if (!h) return '';
            var name = bookName(h);
            try {
                if (typeof h.getWorldbook === 'function') {
                    var arr = await h.getWorldbook(name), hit = '';
                    (arr || []).forEach(function (e) { if (String(e.uid) === String(uid)) hit = e.content || ''; });
                    return hit;
                }
            } catch (e) {}
            try {
                if (typeof h.getLorebookEntries === 'function') {
                    var es = await h.getLorebookEntries(name, { fields: ['uid', 'content'] }), hit2 = '';
                    (es || []).forEach(function (e) { if (String(e.uid) === String(uid)) hit2 = e.content || ''; });
                    return hit2;
                }
            } catch (e) {}
            return '';
        }
        async function writeEntry(uid, content) {
            var h = pickHost();
            if (!h) return { ok: false, msg: '没找到世界书接口（Tavern Helper / 兼容脚本不可用）' };
            var name = bookName(h);
            if (typeof h.updateWorldbookWith === 'function') {
                try {
                    await h.updateWorldbookWith(name, function (wb) {
                        var arr = Array.isArray(wb) ? wb : [], hit = false;
                        var out = arr.map(function (e) {
                            if (String(e && e.uid) === String(uid)) {
                                hit = true;
                                var c = {}; for (var k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k]; }
                                c.content = content; return c;
                            }
                            return e;
                        });
                        if (!hit) throw new Error('世界书里没有 uid ' + uid);
                        return out;
                    }, { render: 'debounced' });
                    return { ok: true, msg: 'updateWorldbookWith' };
                } catch (e) { console.warn('状态栏·世界观页：updateWorldbookWith 失败，改试旧接口', e); }
            }
            if (typeof h.setLorebookEntries === 'function') {
                try { await h.setLorebookEntries(name, [{ uid: uid, content: content }]); return { ok: true, msg: 'setLorebookEntries' }; }
                catch (e) { return { ok: false, msg: 'setLorebookEntries 抛错：' + ((e && e.message) || e) }; }
            }
            return { ok: false, msg: '可用接口不支持写入条目 content' };
        }

        /* ---------- 解析 / 拼装（规则与前端 fh1Assemble、生成脚本完全一致） ---------- */
        function normItem(t) { var s = String(t == null ? '' : t).trim(); return s.charAt(0) === '-' ? s : '- ' + s; }
        function isBlank(t) { return String(t == null ? '' : t).replace(/^-\s*/, '').trim() === ''; }
        function parseWorldText(text) {
            var d = { name: '', segments: [], background: [] };
            var t = String(text || '').replace(/\r\n/g, '\n');
            if (!t) return d;
            var mm = /<本子>([\s\S]*?)<\/本子>/.exec(t);
            var bgm = /<背景设定>([\s\S]*?)<\/背景设定>/.exec(t);
            var cur = null;
            (mm ? mm[1] : t).split('\n').forEach(function (line) {
                var s = line.trim();
                if (/^##\s+/.test(s)) { cur = { key: s.replace(/^##\s+/, '').trim(), items: [] }; d.segments.push(cur); return; }
                if (!cur) return;
                if (s === '---' || /^#/.test(s)) return;
                var lb = /^(风格|社会与法治|民俗风情)：(.+)$/.exec(s);
                if (lb) { d.name = lb[2].trim(); return; }
                if (/^-\s?/.test(s)) cur.items.push(normItem(s));
            });
            var curG = null;
            (bgm ? bgm[1] : '').split('\n').forEach(function (line) {
                var s = line.trim();
                if (/^#\s+/.test(s)) { if (!d.name) d.name = s.replace(/^#\s+/, '').trim(); return; }
                if (/^##\s+/.test(s)) { curG = { title: s.replace(/^##\s+/, '').trim(), items: [] }; d.background.push(curG); return; }
                if (!curG) return;
                if (/^-\s?/.test(s)) curG.items.push(normItem(s));
            });
            return d;
        }
        function parseEcoText(text, wname) {
            var blocks = [], cur = null;
            String(text || '').replace(/\r\n/g, '\n').split('\n').forEach(function (line) {
                var s = line.trim(), m = /^【(.+)】$/.exec(s);
                if (m) {
                    var label = m[1];
                    var title = label.indexOf(wname + '-') === 0 ? label.slice(wname.length + 1) : label;
                    cur = { label: label, title: title, items: [] };
                    blocks.push(cur); return;
                }
                if (cur && /^-\s?/.test(s)) cur.items.push(normItem(s));
            });
            return blocks;
        }
        function assembleWorld(d) {
            var L = ['<本子>', '# 世界观与基调设定', ''];
            (d.segments || []).forEach(function (s) {
                L.push('## ' + s.key);
                var items = (s.items || []).filter(function (t) { return !isBlank(t); });
                var lab = LABELS[s.key] || null;
                if (items.length) {
                    if (lab) { L.push('---'); L.push(lab + '：' + d.name); }
                    items.forEach(function (t) { L.push(normItem(t)); });
                    if (lab) { L.push('---'); }
                }
                L.push('');
            });
            L.push('</本子>', '', '<背景设定>');
            var bgLines = [];
            (d.background || []).forEach(function (g) {
                var items = (g.items || []).filter(function (t) { return !isBlank(t); });
                if (!items.length) return;
                bgLines.push('## ' + g.title);
                items.forEach(function (t) { bgLines.push(normItem(t)); });
            });
            if (bgLines.length) { L.push('# ' + d.name); bgLines.forEach(function (x) { L.push(x); }); }
            L.push('</背景设定>');
            return L.join('\n');
        }
        function assembleEco(d) {
            var blocks = (d.ecology && d.ecology.blocks) || [];
            if (!blocks.length) return '';
            var L = ['<社会生态>'];
            blocks.forEach(function (b) {
                L.push('', '【' + b.label + '】');
                (b.items || []).filter(function (t) { return !isBlank(t); }).forEach(function (t) { L.push(normItem(t)); });
            });
            L.push('</社会生态>');
            return L.join('\n');
        }

        /* ---------- 数据 ---------- */
        function presets() { return (window.WORLDVIEW_PRESETS && window.WORLDVIEW_PRESETS.worldviews) || {}; }
        function order() { return (window.WORLDVIEW_PRESETS && window.WORLDVIEW_PRESETS.order) || []; }
        function esc(s) {
            return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        function loadFromPreset(name) {
            var p = presets()[name]; if (!p) return;
            st.draft = JSON.parse(JSON.stringify(p));
            st.source = name; st.ecoSel = 0; st.editing = false; st.err = '';
        }
        async function loadFromBook(force) {
            if (st.loadedOnce && !force) return;
            st.busy = true;
            try {
                var wt = await readEntry(UID_WORLD), et = await readEntry(UID_ECO);
                if (wt) {
                    var d = parseWorldText(wt);
                    d.ecology = { blocks: parseEcoText(et, d.name) };
                    var p = presets()[d.name];
                    d.varRulesFree = p ? (p.varRulesFree || '') : '';
                    st.draft = d; st.source = d.name || ''; st.ecoSel = 0; st.editing = false;
                } else {
                    st.draft = null; st.err = '世界书 uid ' + UID_WORLD + ' 还是空的——先在下面选一套世界观，点「应用」写进去。';
                }
                st.loadedOnce = true;
            } catch (e) { st.err = '读取世界书失败：' + ((e && e.message) || e); }
            st.busy = false;
        }

        /* ---------- 从 DOM 收回编辑 ---------- */
        function syncFromDom(container) {
            var d = st.draft; if (!d) return;
            container.querySelectorAll('[data-item-text]').forEach(function (el) {
                var kind = el.getAttribute('data-kind'), i = +el.getAttribute('data-i'), j = +el.getAttribute('data-j');
                var txt = normItem(el.textContent);
                if (kind === 'seg' && d.segments[i]) d.segments[i].items[j] = txt;
                else if (kind === 'bg' && d.background[i]) d.background[i].items[j] = txt;
                else if (kind === 'eco' && d.ecology && d.ecology.blocks[i]) d.ecology.blocks[i].items[j] = txt;
            });
        }

        /* ---------- 渲染 ---------- */
        function itemRow(kind, i, j, text) {
            return '<div class="fh1-wv-item-row">' +
                '<div class="fh1-wv-item"' + (st.editing ? ' contenteditable="true"' : '') +
                    ' data-item-text data-kind="' + kind + '" data-i="' + i + '" data-j="' + j + '">' + esc(text) + '</div>' +
                (st.editing ? '<button class="fh1-item-del" data-act="item-del" data-kind="' + kind + '" data-i="' + i + '" data-j="' + j + '" title="删去这一项">\u2715</button>' : '') +
            '</div>';
        }
        function subStrip(kind, titles, sel) {
            var chips = titles.map(function (t, i) {
                return '<span class="fh1-sub-chip' + (i === sel ? ' active' : '') + '" data-act="sub-pick" data-kind="' + kind + '" data-i="' + i + '">' + esc(t) + '</span>';
            }).join('');
            return '<div class="fh1-sub-strip" data-strip="' + kind + '">' +
                '<span class="fh1-sub-arrow" data-act="sub-scroll" data-kind="' + kind + '" data-dir="-1">\u2039</span>' +
                '<div class="fh1-sub-track">' + chips + '</div>' +
                '<span class="fh1-sub-arrow" data-act="sub-scroll" data-kind="' + kind + '" data-dir="1">\u203A</span>' +
            '</div>';
        }
        function subActions(kind, i, count) {
            if (!st.editing) return '';
            return '<div class="fh1-sub-actions">' +
                '<button class="fh1-sub-add" data-act="sub-add" data-kind="' + kind + '" data-i="' + i + '">\uFF0B 子项</button>' +
                '<button class="fh1-sub-del" data-act="group-del" data-kind="' + kind + '" data-i="' + i + '">\u2715 删去本标题及子项' + (count ? '（' + count + '）' : '') + '</button>' +
            '</div>';
        }
        /* ---------- 附录抽屉：复用「故事日志」面板框架 ---------- */
        function ensureGroup(segKey, title) {
            var d = st.draft; if (!d) return null;
            if (segKey === '背景设定') {
                d.background = d.background || [];
                var g = null; d.background.forEach(function (x) { if (x.title === title) g = x; });
                if (!g) { g = { title: title, items: [] }; d.background.push(g); }
                return g;
            }
            if (segKey === '社会生态') {
                d.ecology = d.ecology || { blocks: [] };
                d.ecology.blocks = d.ecology.blocks || [];
                var b = null; d.ecology.blocks.forEach(function (x) { if ((x.title || x.label) === title) b = x; });
                if (!b) { b = { label: (d.name || '') + '-' + title, title: title, items: [] }; d.ecology.blocks.push(b); }
                return b;
            }
            var seg = null; (d.segments || []).forEach(function (s) { if (s.key === segKey) seg = s; });
            return seg;
        }
        function apBoxes(items, hasMap, gtitle) {
            if (!items || !items.length) return '<div class="fh1-ap-empty">（没有附录内容）</div>';
            return items.map(function (t) {
                var text = String(t).replace(/^-\s*/, '').trim(), added = !!hasMap[text];
                return '<label class="fh1-ap-item' + (added ? ' added' : '') + '">' +
                    '<input type="checkbox" value="' + esc(text) + '" data-ap-g="' + esc(gtitle || '') + '"' + (added ? ' disabled checked' : '') + '>' +
                    '<span>' + esc(text) + '</span>' + (added ? '<em class="fh1-ap-tag">已添加</em>' : '') + '</label>';
            }).join('');
        }
        function openAppendix(segKey) {
            var panel = document.getElementById('story-log-panel'), content = document.getElementById('story-log-content');
            if (!panel || !content) { rvAlert('找不到「故事日志」面板'); return; }
            var d = st.draft; if (!d) return;
            var isGroup = (segKey === '背景设定' || segKey === '社会生态');
            var p = presets()[d.name] || {}, hasMap = {};
            if (!isGroup) (d.segments || []).forEach(function (s) { if (s.key === segKey) (s.items || []).forEach(function (x) { hasMap[String(x).replace(/^-\s*/, '').trim()] = true; }); });
            var html = '<div class="fh1-ap-note">附录是可选项：勾选后点「点击添加」加进当前世界观；也可在此新建小标题。</div>';
            if (isGroup) {
                var gs = (p.appendix && p.appendix.groups && p.appendix.groups[segKey]) || [];
                html += gs.length ? gs.map(function (g) {
                    return '<div class="fh1-ap-sec open"><div class="fh1-ap-sec-head"><span class="fh1-ap-sec-title">' + esc(g.title) + '</span></div>' +
                        '<div class="fh1-ap-sec-body">' + apBoxes(g.items, {}, g.title) + '</div></div>';
                }).join('') : '<div class="fh1-ap-empty">（这一段还没有附录内容）</div>';
            } else {
                html += apBoxes((p.appendix && p.appendix.sections && p.appendix.sections[segKey]) || [], hasMap, '');
            }
            order().forEach(function (n) {
                if (n === d.name) return;
                var o = presets()[n] || {};
                if (isGroup) {
                    var og = (o.appendix && o.appendix.groups && o.appendix.groups[segKey]) || [];
                    if (!og.length) return;
                    html += '<div class="fh1-ap-sec"><div class="fh1-ap-sec-head"><span class="fh1-ap-sec-title">' + esc(n) + '-' + esc(segKey) + '</span></div><div class="fh1-ap-sec-body">' +
                        og.map(function (g) { return '<div class="fh1-sub-chip">' + esc(g.title) + '</div>' + apBoxes(g.items, {}, g.title); }).join('') + '</div></div>';
                } else {
                    var oi = (o.appendix && o.appendix.sections && o.appendix.sections[segKey]) || [];
                    if (!oi.length) return;
                    html += '<div class="fh1-ap-sec"><div class="fh1-ap-sec-head"><span class="fh1-ap-sec-title">' + esc(n) + '-' + esc(segKey) + '</span></div><div class="fh1-ap-sec-body">' + apBoxes(oi, hasMap, '') + '</div></div>';
                }
            });
            html += (isGroup ? '<input type="text" id="ap-new-group" class="rule-input" placeholder="新建小标题名称（给已有小标题加子项时也要填它）">' : '') +
                '<input type="text" id="ap-custom" class="rule-input" placeholder="' + (isGroup ? '子项内容，一行一条' : '自定义一条内容') + '">' +
                '<button class="wv-apply" data-ap-add="1" data-ap-seg="' + esc(segKey) + '">点击添加</button>';
            var tEl = panel.querySelector('.story-log-panel-title');
            if (tEl) tEl.textContent = '附录 · ' + segKey;
            content.innerHTML = html;
            panel.classList.add('open');
            bindAppendixPanel(panel);
        }
        function bindAppendixPanel(panel) {
            if (panel.getAttribute('data-ap-bound')) return;
            panel.setAttribute('data-ap-bound', '1');
            panel.addEventListener('click', async function (ev) {
                var _head = ev.target.closest ? ev.target.closest('.fh1-ap-sec-head') : null;
                if (_head && ev.target.tagName !== 'INPUT') { var _sec = _head.parentElement; if (_sec) _sec.classList.toggle('open'); return; }
                var btn = ev.target.closest ? ev.target.closest('[data-ap-add]') : null;
                if (!btn) return;
                var segKey = btn.getAttribute('data-ap-seg');
                var content = document.getElementById('story-log-content');
                var isGroup = (segKey === '背景设定' || segKey === '社会生态');
                var newG = content.querySelector('#ap-new-group');
                var gtitle = newG ? String(newG.value || '').trim() : '';
                var picked = [];
                content.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)').forEach(function (b) { picked.push({ g: b.getAttribute('data-ap-g') || '', t: b.value }); });
                var custom = content.querySelector('#ap-custom');
                var text = custom ? String(custom.value || '').trim() : '';
                if (isGroup && !gtitle && !picked.length) { await rvAlert('请先填「新建小标题名称」，或勾选附录里的条目'); return; }
                var addTo = function (gname, item) {
                    var g = ensureGroup(segKey, gname || segKey);
                    if (!g) return 0;
                    g.items = g.items || [];
                    var dup = false; g.items.forEach(function (x) { if (String(x).replace(/^-\s*/, '').trim() === item) dup = true; });
                    if (dup) return 0;
                    g.items.push('- ' + item); return 1;
                };
                var n = 0;
                picked.forEach(function (x) { n += addTo(x.g, x.t); });
                if (text) {
                    (isGroup ? text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : [text]).forEach(function (line) { n += addTo(gtitle, line); });
                }
                if (!n) { await rvAlert('没有新增内容（可能都已存在）'); return; }
                panel.classList.remove('open');
                var c2 = document.getElementById('mode-sections-2');
                if (c2) renderPage(null, c2);
            });
        }

        function plusBtn(k) { return '<button class="fh1-seg-plus" data-act="appendix" data-seg="' + esc(k) + '">＋ 添加</button>'; }
        function buildHtml() {
            var d = st.draft;
            var html = '';
            // 顶部：只有「世界观调整」标题 + 编辑模式（不再显示"世界书当前"，也没有顶部应用按钮）
            html += '<div class="section">';
            html += '<div class="wv-head"><span class="wv-title">世界观调整</span>' +
                '<label class="wv-edit"><input type="checkbox" data-act="edit"' + (st.editing ? ' checked' : '') + '>编辑模式</label>' +
                '</div>';
            if (st.err) html += '<div class="wv-err">' + esc(st.err) + '</div>';
            html += '</div>';
            if (!d) return html;
            // 详情头（与前端展开态一致：名字 + 时代标签 + 时代全文 + 一句话简介）
            html += '<div class="fh1-wv-detail-head">' +
                '<div class="fh1-wv-card-top"><span class="fh1-wv-name">' + esc(d.name || '') + '</span>' +
                '<span class="fh1-wv-era-tag">' + esc(d.eraShort || '') + '</span></div>' +
                '<div class="fh1-wv-era-full">' + esc(d.era || '') + '</div>' +
                '<div class="fh1-wv-sum">' + esc(d.summary || '') + '</div>' +
            '</div>';

            // 平铺段落
            (d.segments || []).forEach(function (s, i) {
                html += '<div class="section"><div class="fh1-wv-seg">' +
                    '<div class="fh1-wv-seg-title"><span>' + esc(s.key) + '</span>' + plusBtn(s.key) + '</div>' +
                    ((s.items || []).map(function (t, j) { return itemRow('seg', i, j, t.replace(/^-\s*/, '')); }).join('') ||
                        '<div class="fh1-hint">（这一段还没有条目）</div>') +
                    '</div></div>';
            });
            // 背景设定（小标题带 + 当前小标题的子项）
            var bg = d.background || [];
            html += '<div class="section"><div class="fh1-wv-seg"><div class="fh1-wv-seg-title"><span>背景设定</span>' + plusBtn('背景设定') + '</div>';
            if (bg.length) {
                var bi = Math.min(Math.max(state_bg(), 0), bg.length - 1);
                set_bg(bi);
                html += subStrip('bg', bg.map(function (g) { return g.title; }), bi) +
                    subActions('bg', bi, (bg[bi].items || []).length) +
                    ((bg[bi].items || []).map(function (t, j) { return itemRow('bg', bi, j, t.replace(/^-\s*/, '')); }).join('') ||
                        '<div class="fh1-hint">（这个小标题下还没有子项）</div>');
            } else {
                html += '<div class="fh1-hint">（这套世界观还没有背景设定小标题）</div>';
            }
            html += '</div></div>';
            // 社会生态
            var blocks = (d.ecology && d.ecology.blocks) || [];
            html += '<div class="section"><div class="fh1-wv-seg"><div class="fh1-wv-seg-title"><span>社会生态</span>' + plusBtn('社会生态') + '</div>';
            if (blocks.length) {
                var ei = Math.min(Math.max(st.ecoSel | 0, 0), blocks.length - 1);
                st.ecoSel = ei;
                html += subStrip('eco', blocks.map(function (b) { return b.title || b.label; }), ei) +
                    subActions('eco', ei, (blocks[ei].items || []).length) +
                    ((blocks[ei].items || []).map(function (t, j) { return itemRow('eco', ei, j, t.replace(/^-\s*/, '')); }).join('') ||
                        '<div class="fh1-hint">（这一块还没有子项）</div>');
            } else {
                html += '<div class="fh1-hint">（这套世界观还没有生态内容）</div>';
            }
            html += '</div></div>';
            // 变量规则提示（只读，来自预置）
            html += '<button class="fh1-apply-btn" data-act="apply">\u25B6 应用（写入世界书）</button>';
            ;
            return html;
        }
        function state_bg() { return (App.state.wvBgSel | 0); }
        function set_bg(i) { App.state.wvBgSel = i; }

        function renderPage(data, container) {
            if (!st.loadedOnce && !st.busy) {
                container.innerHTML = '<div class="section"><div class="wv-note">正在读取世界书…</div></div>';
                loadFromBook().then(function () { renderPage(data, container); });
                return;
            }
            if (!window.WORLDVIEW_PRESETS) {
                container.innerHTML = '<div class="section">' +
                    '<div class="wv-err">状态栏侧预置没加载：请确认 <code>js/worldview-presets.js</code> 已上传，' +
                    '并且 <code>index.html</code> 里有这一行、且排在 <code>js/status.js</code> 之前：<br>' +
                    '<code>&lt;script src="js/worldview-presets.js"&gt;&lt;/script&gt;</code></div>' +
                    '<div class="wv-bar"><button class="wv-apply" data-act="retry">重新读取</button></div>' +
                '</div>';
                container.setAttribute('data-wv-bound', '');
                bind(container);
                return;
            }
            container.innerHTML = buildHtml();
            bind(container);
            bindTracks(container);
        }

        // 标题带拖动滑动（每次重画都会产生新元素，所以每次都要重挂）
        function bindTracks(container) {
            container.querySelectorAll('.fh1-sub-track').forEach(function (track) {
                var down = false, startX = 0, startLeft = 0, moved = false;
                track.addEventListener('mousedown', function (e) {
                    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
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

        function bind(container) {
            if (container.getAttribute('data-wv-bound')) return;
            container.setAttribute('data-wv-bound', '1');
            container.addEventListener('click', async function (ev) {
                var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
                if (!el || !container.contains(el)) return;
                var act = el.getAttribute('data-act'), kind = el.getAttribute('data-kind'), i = +el.getAttribute('data-i');
                if (act === 'appendix') { syncFromDom(container); openAppendix(el.getAttribute('data-seg')); return; }
                else if (act === 'retry') { renderPage(null, container); }
                else if (act === 'edit') { syncFromDom(container); st.editing = !st.editing; renderPage(null, container); }
                else if (act === 'apply') { syncFromDom(container); applyAll(container); }
                else if (act === 'sub-pick') { syncFromDom(container); if (kind === 'eco') st.ecoSel = i; else App.state.wvBgSel = i; renderPage(null, container); }
                else if (act === 'sub-scroll') {
                    var track = el.parentElement.querySelector('.fh1-sub-track');
                    if (track) track.scrollLeft += (+el.getAttribute('data-dir')) * 140;
                }
                else if (act === 'sub-add') {
                    syncFromDom(container);
                    var g = kind === 'eco' ? (st.draft.ecology.blocks[i]) : (kind === 'bg' ? st.draft.background[i] : st.draft.segments[i]);
                    if (g) { g.items = (g.items || []).concat(['- ']); }
                    renderPage(null, container);
                }
                else if (act === 'item-del') {
                    syncFromDom(container);
                    var j = +el.getAttribute('data-j');
                    if (kind === 'seg' && st.draft.segments[i]) st.draft.segments[i].items.splice(j, 1);
                    else if (kind === 'bg' && st.draft.background[i]) st.draft.background[i].items.splice(j, 1);
                    else if (kind === 'eco' && st.draft.ecology && st.draft.ecology.blocks[i]) st.draft.ecology.blocks[i].items.splice(j, 1);
                    renderPage(null, container);
                }
                else if (act === 'group-del') {
                    syncFromDom(container);
                    var arr = kind === 'eco' ? (st.draft.ecology ? st.draft.ecology.blocks : null) : st.draft.background;
                    if (arr && arr[i]) {
                        var title = arr[i].title || arr[i].label || '';
                        if (!await rvConfirm('删去小标题「' + title + '」及它下面的 ' + ((arr[i].items || []).length) + ' 条子项？')) return;
                        arr.splice(i, 1);
                        if (kind === 'eco') st.ecoSel = 0; else App.state.wvBgSel = 0;
                        renderPage(null, container);
                    }
                }
            });
        }

        async function applyAll(container) {
            if (!st.draft) return;
            if (!st.draft.name) { await rvAlert('这套世界观没有名字（正文里缺少「风格：xxx」标签），先补上再应用。'); return; }
            var ok = await rvConfirm('把当前内容写入世界书？');
            if (!ok) return;
            var r1 = await writeEntry(UID_WORLD, assembleWorld(st.draft));
            if (!r1.ok) { await rvAlert('世界观写入失败：' + r1.msg); return; }
            var r2 = await writeEntry(UID_ECO, assembleEco(st.draft));
            if (!r2.ok) { await rvAlert('世界观已写入，但生态写入失败：' + r2.msg); return; }
            if (st.draft.varRulesFree) {
                var r3 = await writeEntry(UID_VARRULES, st.draft.varRulesFree);
                if (!r3.ok) { await rvAlert('世界观与生态已写入，但变量规则写入失败：' + r3.msg); return; }
            }
            st.source = st.draft.name;
            st.loadedOnce = true;
            chSt.fields = null;   // 刚刚可能换了变量规则（uid 28）→ 角色页下次进来重读字段表
            await rvAlert('已写入世界书：\n世界观 uid ' + UID_WORLD + '（' + assembleWorld(st.draft).length + ' 字）' +
                '\n社会生态 uid ' + UID_ECO +
                (st.draft.varRulesFree ? '\n变量规则 uid ' + UID_VARRULES : ''));
            renderPage(null, container);
        }

        /* ---------- 注册三个渲染器 ---------- */
        SECTION_RENDERERS.worldview = function (data, container) { renderPage(data, container); };
        // 故事日志书签只在「开拓新大陆（航海）」世界观出现
        (function () {
            var orig = App.ui.renderModeSections;
            if (typeof orig === 'function' && !orig.__wvBmPatched) {
                App.ui.renderModeSections = function () {
                    var r = orig.apply(this, arguments);
                    try {
                        var bm = document.getElementById('story-log-bookmark');
                        if (bm) {
                            var wv = (App.state.parsedData && App.state.parsedData.worldview) || '';
                            // 航海有结算日志；本子世界现在也会往里写「玩家改了某个角色的什么」
                            bm.style.display = (wv === 'colony' || wv === 'hentai') ? '' : 'none';
                        }
                    } catch (e) {}
                    return r;
                };
                App.ui.renderModeSections.__wvBmPatched = true;
            }
        })();

        /* ---------- 第 3 页：特殊规则（数据在变量 rules 里，只由状态栏写；AI 看不到） ---------- */
        /* ---------- 自定义弹窗（移植前端的深色卡片样式，替代浏览器原生 alert/confirm/prompt） ---------- */
        function rvDialog(msg, opts) {
            opts = opts || {};
            return new Promise(function (resolve) {
                var d = document.createElement('div');
                d.className = 'rv-modal';
                var isPrompt = opts.prompt === true;
                d.innerHTML = '<div class="rv-backdrop"></div><div class="rv-box">' +
                    '<div class="rv-msg">' + String(msg == null ? '' : msg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>' +
                    (isPrompt ? '<input class="rv-input" type="text" value="' + String(opts.value || '').replace(/"/g, '&quot;') + '">' : '') +
                    (opts.alert === true
                        ? '<div class="rv-btns"><button class="rv-btn primary" data-rv="ok">知道了</button></div>'
                        : '<div class="rv-btns"><button class="rv-btn" data-rv="cancel">取消</button><button class="rv-btn primary" data-rv="ok">确定</button></div>') +
                    '</div>';
                document.body.appendChild(d);
                var input = d.querySelector('.rv-input');
                if (input) { try { input.focus(); input.select(); } catch (e) {} }
                var close = function (ok) {
                    if (d.parentNode) d.parentNode.removeChild(d);
                    resolve(ok ? (isPrompt ? (input ? input.value : '') : true) : (isPrompt ? null : false));
                };
                d.addEventListener('click', function (e) {
                    var b = e.target.closest ? e.target.closest('[data-rv]') : null;
                    if (b) { close(b.getAttribute('data-rv') === 'ok'); return; }
                    if (e.target.classList && e.target.classList.contains('rv-backdrop')) close(false);
                });
                if (input) {
                    input.addEventListener('keydown', function (e) {
                        if (e.key === 'Enter') { e.preventDefault(); close(true); }
                        if (e.key === 'Escape') { e.preventDefault(); close(false); }
                    });
                }
            });
        }
        function rvConfirm(msg) { return rvDialog(msg, {}); }
        function rvAlert(msg) { return rvDialog(msg, { alert: true }); }
        function rvPrompt(msg, value) { return rvDialog(msg, { prompt: true, value: value || '' }); }

        /* ---------- 规则指导 → 世界书 uid 5（<世界观内化协议细节指导> 包裹，块间用 --- 分隔） ---------- */
        var UID_INNER = 5;
        var INNER_TAG = '世界观内化协议细节指导';
        async function writeInnerGuidance() {
            var R = rulesVar(), presets = rulePresets(), blocks = [];
            presets.forEach(function (p) { if (R[p.name] !== undefined && p.guide) blocks.push(String(p.guide).trim()); });
            var text = '<' + INNER_TAG + '>\n' + (blocks.length ? blocks.join('\n---\n') : '') + '\n</' + INNER_TAG + '>';
            var r = await writeEntry(UID_INNER, text);
            if (!r.ok) { await rvAlert('规则指导写入 uid ' + UID_INNER + ' 失败：' + r.msg + '\n（规则变量已生效，但 AI 那边拿不到指导）'); return false; }
            console.log('状态栏·特殊规则：已把 ' + blocks.length + ' 条启用规则的指导覆写进 uid ' + UID_INNER);
            return true;
        }

        function rulesVar() { var raw = (App.state.parsedData && App.state.parsedData.raw) || {}; return raw.rules || {}; }
        function rulePresets() { return (window.RULES_PRESETS && window.RULES_PRESETS.rules) || []; }

        async function rulesWrite(act, payload) {
            try {
                if (typeof window.eventEmit !== 'function') { await rvAlert('eventEmit 不可用，无法写入变量'); return false; }
                window.eventEmit('era:' + act + 'ByObject', payload);
                await new Promise(function (r) { setTimeout(r, 300); });  // 等变量落盘
                return true;
            } catch (e) { await rvAlert('写入变量失败：' + ((e && e.message) || e)); return false; }
        }
        async function rulesRefresh(container) {
            try {
                var raw = await App.parsers.getVariableData();
                App.state.parsedData = App.parsers.parseData(raw);
            } catch (e) { console.warn('刷新变量失败', e); }
            await writeInnerGuidance();   // 规则一变动就把启用条目的指导覆写进 uid 5
            renderRules(container);
        }

        var rulesOpen = {};   // 哪几张规则卡被展开了（重画后保留）

        function renderRules(container) {
            var R = rulesVar(), presets = rulePresets(), names = Object.keys(R);
            var html = '<div class="section"><div class="wv-head"><span class="wv-title">特殊规则</span>' +
                '<span class="wv-cur">已启用 ' + names.length + ' 条' +
                '<button class="wv-refresh" data-rules-act="refresh" title="重新读取变量（新加的常识会立刻出现）">\u21BB 刷新</button>' +
                '</span></div>';
            if (!presets.length) {
                html += '<div class="wv-err">规则预置没加载：确认 <code>js/rules-presets.js</code> 已上传，' +
                    '且 <code>index.html</code> 里有它、排在 <code>js/status.js</code> 之前。</div>';
            }
            presets.forEach(function (p) {
                var v = R[p.name], on = (v !== undefined), open = !!rulesOpen[p.name];
                var hasModes = !!(p.modes && p.modes.length);
                html += '<div class="rule-card' + (on ? ' on' : '') + (open ? ' open' : '') + '">';
                // 卡头：默认只显示规则名（点击展开）
                html += '<div class="rule-card-head" data-rules-act="expand" data-name="' + esc(p.name) + '">' +
                    '<span class="rule-card-name">' + esc(p.name) + '</span>' +
                    (on ? '<span class="rule-card-on">已启用</span>' : '') +
                    '<span class="rule-card-arrow">' + (open ? '\u25BE' : '\u25B8') + '</span>' +
                '</div>';
                if (!open) { html += '</div>'; return; }
                // 展开后：简介 + 勾选框 + 模式（有才显示）+ 填写框
                html += '<div class="rule-card-body">';
                if (p.intro) html += '<div class="rule-intro">' + esc(p.intro) + '</div>';
                html += '<label class="rule-enable"><input type="checkbox" data-rules-act="toggle" data-name="' + esc(p.name) + '"' +
                    (on ? ' checked' : '') + '>启用这条规则</label>';
                if (hasModes) {
                    html += '<div class="rule-modes">' + p.modes.map(function (m) {
                        var sel = (v && v.模式 === m);
                        return '<label class="rule-mode"><input type="radio" name="rm-' + esc(p.name) + '" data-rules-act="mode" data-name="' + esc(p.name) + '" data-mode="' + esc(m) + '"' + (sel ? ' checked' : '') + '>' + esc(m) + '</label>';
                    }).join('') + '</div>';
                }
                if (p.fill) {
                    html += '<div class="rule-fillbar">' +
                        '<input type="text" class="rule-input" data-rules-input="' + esc(p.name) + '" placeholder="' + esc(p.fill) + '">' +
                        '<button class="rule-add" data-rules-act="add-entry" data-name="' + esc(p.name) + '">添加</button></div>';
                    var ks = on ? Object.keys(v).filter(function (k) { return k !== '模式'; }) : [];
                    if (ks.length) {
                        html += '<div class="rule-entries">' + ks.map(function (k) {
                            return '<div class="rule-entry"><span class="rule-entry-text">' + esc(k) + '</span>' +
                                '<button class="rule-mini" data-rules-act="edit-entry" data-name="' + esc(p.name) + '" data-text="' + esc(k) + '">编辑</button>' +
                                '<button class="rule-mini del" data-rules-act="del-entry" data-name="' + esc(p.name) + '" data-text="' + esc(k) + '">删除</button></div>';
                        }).join('') + '</div>';
                    }
                }
                html += '</div></div>';
            });
            html += '</div>';
            container.innerHTML = html;
            bindRules(container);
        }

        function bindRules(container) {
            if (container.getAttribute('data-rules-bound')) return;
            container.setAttribute('data-rules-bound', '1');
            container.addEventListener('click', async function (ev) {
                var el = ev.target.closest ? ev.target.closest('[data-rules-act]') : null;
                if (!el || !container.contains(el)) return;
                var act = el.getAttribute('data-rules-act'), name = el.getAttribute('data-name') || '';
                var R = rulesVar(), cur = R[name];
                var preset = null; rulePresets().forEach(function (p) { if (p.name === name) preset = p; });

                if (act === 'refresh') { await rulesRefresh(container); return; }

                // 点卡片头 → 从下方拉出/收起（默认只显示规则名）
                if (act === 'expand') { rulesOpen[name] = !rulesOpen[name]; renderRules(container); return; }

                if (act === 'toggle') {
                    if (cur !== undefined) {
                        if (!await rvConfirm('取消「' + name + '」？')) { renderRules(container); return; }
                        if (await rulesWrite('delete', { rules: (function () { var o = {}; o[name] = {}; return o; })() })) await rulesRefresh(container);
                    } else {
                        if (preset && preset.modes && preset.modes.length) { await rvAlert('「' + name + '」需要先选一个模式才生效'); renderRules(container); return; }
                        if (preset && preset.fill) { await rvAlert('「' + name + '」需要先在框里填内容，再点「添加」'); renderRules(container); return; }
                        if (await rulesWrite('insert', { rules: (function () { var o = {}; o[name] = {}; return o; })() })) await rulesRefresh(container);
                    }
                    return;
                }
                if (act === 'mode') {
                    var mode = el.getAttribute('data-mode');
                    var payload = { rules: (function () { var o = {}; o[name] = { '模式': mode }; return o; })() };
                    var okM = (cur === undefined) ? await rulesWrite('insert', payload) : await rulesWrite('update', payload);
                    if (okM) await rulesRefresh(container);
                    return;
                }
                if (act === 'add-entry' || act === 'edit-entry') {
                    var box = container.querySelector('[data-rules-input="' + name + '"]');
                    var text = (act === 'add-entry') ? (box ? String(box.value || '').trim() : '') : (el.getAttribute('data-text') || '');
                    if (act === 'edit-entry') { var nv = await rvPrompt('修改这条：', text); if (nv === null) return; text = String(nv).trim(); if (text === (el.getAttribute('data-text') || '')) return; }
                    if (!text) { await rvAlert('先填内容'); return; }
                    if (act === 'edit-entry') {
                        var delPay = { rules: (function () { var o = {}; var inner = {}; inner[el.getAttribute('data-text')] = {}; o[name] = inner; return o; })() };
                        if (!(await rulesWrite('delete', delPay))) return;
                    }
                    var inner2 = {}; inner2[text] = {};
                    var pay2 = { rules: (function () { var o = {}; o[name] = inner2; return o; })() };
                    var okE = (cur === undefined) ? await rulesWrite('insert', pay2) : await rulesWrite('insert', pay2);
                    if (okE) { if (box) box.value = ''; await rulesRefresh(container); }
                    return;
                }
                if (act === 'del-entry') {
                    if (!await rvConfirm('删掉这条常识？\n' + (el.getAttribute('data-text') || ''))) return;
                    var innerD = {}; innerD[el.getAttribute('data-text')] = {};
                    var payD = { rules: (function () { var o = {}; o[name] = innerD; return o; })() };
                    if (await rulesWrite('delete', payD)) await rulesRefresh(container);
                    return;
                }
            });
        }
        SECTION_RENDERERS.rules = function (data, container) { renderRules(container); };

        /* ================= 第 4 页：角色状态（变量 characters，AI 维护） =================
         * 默认**只读**：角色由 AI 在剧情里记录，状态栏只负责看。
         * 想让玩家在状态栏里直接改，需要在「特殊规则」里开启一条带 `解锁：角色编辑` 的规则
         * （规则 txt 里加一行，走生成器进 rules-presets.js 的 unlock 字段）——**不用改代码**，
         * 这样"能不能改"这件事本身也由规则说了算，和「修改他人和自己的关系」这类规则是同一套机制。
         * ============================================================================ */

        // #region 角色页纯逻辑（工具\测试角色状态页.js 按这两个标记切出来离线跑）
        // 字段表**以变量规则为准**：从 uid 28「角色变量规则」的「二级路径」行解析（键 ＋ 中文标签）。
        // 每套世界观写自己的字段表（伊菈优待没有受精手环；大小之争有教派与 dio 大小），页面跟着变。
        // CHAR_FALLBACK_FIELDS 只在读不到变量规则时兜底（＝少子化那套），改变量规则时这里也一起改。
        var CHAR_FALLBACK_FIELDS = [
            ['gender', '性别'],
            ['age', '年龄'],
            ['role', '身份或职务'],
            ['affiliation', '所属单位'],
            ['relation', '与用户的关系'],
            ['ring', '受精手环'],
            ['pregnancy', '受孕状态'],
            ['state', '当前状态'],
            ['location', '位置'],
            ['present', '是否在场'],
            ['favor', '对用户的好感度'],
            ['attitude', '对用户的态度'],
            ['desc', '性格与外貌']
        ];
        // 玩家私有字段：**故意不写进变量规则**，好让 AI 不知道有它们；永远追加在字段表最后
        var CHAR_PLAYER_ONLY = [['note', '小笔记（只有你看得到）']];
        var CHAR_BRIEF_FIELDS = ['gender', 'age', 'role'];   // 卡头那一行只显示这几项

        // 少数「不能随便填」的字段用选择器编辑（其余字段都是普通文本框）。
        // ⚠️ 字段表本身跟着变量规则走，但**编辑器形态**目前写死在这张表里：
        //    以后要给别的字段也换成选择器／数字框，就在这里加一条。
        var CHAR_ENUM_FIELDS = {
            pregnancy: {
                options: ['未受孕', '受孕X月', '即将分娩'],
                optionMonth: '受孕X月',                              // 选它 → 还要填月数
                month: { min: 1, max: 10, unit: '月', placeholder: '月数 1-10' },
                match: /^受孕\s*(\d+)\s*个?月$/,                     // 认已有值（兼容旧的「受孕2个月」写法）
                build: function (n) { return '受孕' + n + '月'; }
            }
        };
        function charEnumSpec(key) { return CHAR_ENUM_FIELDS[key] || null; }

        // 现有值 → { sel, month, raw }；认不出来的原值原样留成一项，绝不悄悄丢掉
        function charEnumParse(spec, value) {
            var v = String(value == null ? '' : value).trim();
            if (!v) { return { sel: spec.options[0], month: '', raw: '' }; }
            for (var i = 0; i < spec.options.length; i++) {
                if (spec.options[i] === v) { return { sel: v, month: '', raw: '' }; }
            }
            var m = spec.match.exec(v);
            if (m) { return { sel: spec.optionMonth, month: m[1], raw: '' }; }
            return { sel: v, month: '', raw: v };
        }

        // 选择器 ＋ 月数 → 存进变量的值；月数不合法就返回空串（等于这一项不写）
        function charEnumCompose(spec, sel, month) {
            if (String(sel) === spec.optionMonth) {
                var n = parseInt(month, 10);
                if (isNaN(n) || n < spec.month.min || n > spec.month.max) { return ''; }
                return spec.build(n);
            }
            return String(sel == null ? '' : sel).trim();
        }

        function charEnumHtml(spec, key, name, value) {
            var p = charEnumParse(spec, value);
            var opts = spec.options.slice();
            if (p.raw && opts.indexOf(p.raw) === -1) { opts.push(p.raw); }
            var showMonth = (p.sel === spec.optionMonth);
            return '<span class="ch-enum" data-ch-enum="' + esc(key) + '" data-ch-name="' + esc(name) + '">' +
                '<select class="ch-select" data-ch-sel>' + opts.map(function (o) {
                    return '<option value="' + esc(o) + '"' + (o === p.sel ? ' selected' : '') + '>' + esc(o) + '</option>';
                }).join('') + '</select>' +
                '<input class="ch-month" type="number" data-ch-month min="' + spec.month.min + '" max="' + spec.month.max +
                    '" step="1" value="' + esc(p.month) + '" placeholder="' + esc(spec.month.placeholder) + '"' +
                    (showMonth ? '' : ' style="display:none"') + '>' +
                '<span class="ch-unit"' + (showMonth ? '' : ' style="display:none"') + '>' + esc(spec.month.unit) + '</span>' +
            '</span>';
        }

        // 从变量规则正文里取「角色变量规则」那一段的「二级路径」行 → [[键, 中文标签], ...]
        // 行格式：gender (性别), age (年龄), ……；括号可省略，那就标签＝键
        function parseCharFields(varRulesText) {
            var t = String(varRulesText || '').replace(/\r\n/g, '\n');
            var m = /角色变量规则[\s\S]*?二级路径:\s*([^\n]+)/.exec(t);
            if (!m) { return null; }
            var out = [];
            m[1].split(',').forEach(function (part) {
                var hit = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[(（]([^)）]*)[)）])?\s*$/.exec(part);
                if (hit) { out.push([hit[1], String(hit[2] || hit[1]).trim()]); }
            });
            return out.length ? out : null;
        }

        // 最终字段表 ＝ 变量规则里的字段 ＋ 永远追加的玩家私有字段（同名不重复加）
        function mergeCharFields(fromRules) {
            var base = (fromRules && fromRules.length ? fromRules : CHAR_FALLBACK_FIELDS)
                .map(function (f) { return [f[0], f[1]]; });
            var keys = base.map(function (f) { return f[0]; });
            CHAR_PLAYER_ONLY.forEach(function (f) {
                if (keys.indexOf(f[0]) === -1) { base.push([f[0], f[1]]); }
            });
            return base;
        }

        // 卡头那一行：只挑有值的项用 ・ 连起来
        function charBrief(ch) {
            var parts = [];
            CHAR_BRIEF_FIELDS.forEach(function (k) {
                var v = (ch || {})[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') parts.push(String(v).trim());
            });
            return parts.join(' · ');
        }

        // 哪几条**已启用**的规则解锁了某个能力；cap 省略时只问「有没有解锁角色编辑」
        function charUnlockedBy(rulesObj, presets, cap) {
            var want = cap || '角色编辑', R = rulesObj || {}, out = [];
            (presets || []).forEach(function (p) {
                if (R[p.name] === undefined) return;
                var u = p.unlock || [];
                for (var i = 0; i < u.length; i++) {
                    if (String(u[i]).trim() === want) { out.push(p.name); return; }
                }
            });
            return out;
        }

        // 只保留与旧值不同的字段；没有变化返回 null（避免无谓写变量）
        // keys 省略时用兜底字段表
        function charDiff(oldCh, newCh, keys) {
            var out = {}, any = false;
            var ks = keys || CHAR_FALLBACK_FIELDS.map(function (f) { return f[0]; });
            ks.forEach(function (k) {
                var a = String((oldCh || {})[k] === undefined || (oldCh || {})[k] === null ? '' : oldCh[k]).trim();
                var b = String((newCh || {})[k] === undefined || (newCh || {})[k] === null ? '' : newCh[k]).trim();
                if (a !== b) { out[k] = b; any = true; }
            });
            return any ? out : null;
        }

        // 一批改动 → 故事日志文本（一条改动一行）。玩家私有字段（note）不记——那是玩家自己的备忘。
        function charChangeLogs(oldCh, newCh, fields, who) {
            var out = [], skip = {}, label = {};
            CHAR_PLAYER_ONLY.forEach(function (f) { skip[f[0]] = 1; });
            (fields || []).forEach(function (f) { label[f[0]] = f[1]; });
            var keys = Object.keys(label);
            Object.keys(newCh || {}).forEach(function (n) {
                if ((oldCh || {})[n] === undefined) { out.push(who + '新增了角色：' + n); return; }
                var d = charDiff(oldCh[n], newCh[n], keys);
                if (!d) { return; }
                keys.forEach(function (k) {
                    if (d[k] === undefined || skip[k]) { return; }
                    out.push(who + '将' + n + '的' + label[k] + '改为：' + (d[k] === '' ? '（清空）' : d[k]));
                });
            });
            Object.keys(oldCh || {}).forEach(function (n) {
                if ((newCh || {})[n] === undefined) { out.push(who + '删去了角色：' + n); }
            });
            return out;
        }

        // 一个角色一张卡：卡头＝名字＋性别・年龄・身份；点开才铺该世界观字段表里的每一项
        function charCardHtml(name, ch, open, editing, fields) {
            var h = '<div class="ch-card' + (open ? ' open' : '') + '">';
            h += '<div class="ch-head" data-act="ch-open" data-name="' + esc(name) + '">' +
                    '<span class="ch-name">' + esc(name) + '</span>' +
                    '<span class="ch-brief">' + esc(charBrief(ch)) + '</span>' +
                    '<span class="ch-arrow">' + (open ? '\u25BE' : '\u25B8') + '</span>' +
                 '</div>';
            if (!open) { return h + '</div>'; }
            h += '<div class="ch-body">';
            (fields && fields.length ? fields : mergeCharFields(null)).forEach(function (f) {
                var k = f[0], v = (ch || {})[k];
                var has = (v !== undefined && v !== null && String(v).trim() !== '');
                h += '<div class="ch-row"><span class="ch-label">' + esc(f[1]) + '</span>' +
                    (editing
                        ? (charEnumSpec(k)
                            ? charEnumHtml(charEnumSpec(k), k, name, has ? v : '')
                            : '<input class="ch-input" type="text" data-ch-field="' + k + '" data-ch-name="' + esc(name) + '"' +
                              ' value="' + esc(has ? v : '') + '" placeholder="待更新">')
                        : '<span class="ch-value">' + (has ? esc(v) : '<i>待更新</i>') + '</span>') +
                    '</div>';
            });
            if (editing) {
                h += '<div class="ch-row ch-row-del">' +
                    '<button class="ch-del" data-act="ch-del" data-name="' + esc(name) + '">\u2715 删去这个角色</button></div>';
            }
            h += '</div></div>';
            return h;
        }
        // #endregion 角色页纯逻辑

        var chSt = { open: {}, editing: false, draft: null, fields: null };   // 展开状态 / 编辑模式 / 编辑草稿 / 当前字段表

        function charsVar() {
            var raw = (App.state.parsedData && App.state.parsedData.raw) || {};
            return raw.characters || {};
        }
        function charsCanEdit() { return charUnlockedBy(rulesVar(), rulePresets()).length > 0; }
        function charsSource() { return (chSt.editing && chSt.draft) ? chSt.draft : charsVar(); }
        function charsFields() { return chSt.fields || mergeCharFields(null); }
        function charsFieldKeys() { return charsFields().map(function (f) { return f[0]; }); }

        // 字段表从世界书 uid 28「角色变量规则」读 —— 每次进这一页读一次，之后点卡片不再重复读
        async function loadCharFields() {
            var text = '';
            try { text = await readEntry(UID_VARRULES); } catch (e) { console.warn('读变量规则失败', e); }
            var parsed = parseCharFields(text);
            chSt.fields = mergeCharFields(parsed);
            if (!parsed) { console.warn('状态栏·角色状态：没从 uid ' + UID_VARRULES + ' 读到「角色变量规则」，先用兜底字段表'); }
            return chSt.fields;
        }

        function renderChars(container) {
            var canEdit = charsCanEdit();
            if (!canEdit) { chSt.editing = false; chSt.draft = null; }
            var chars = charsSource();
            var names = Object.keys(chars);
            var fields = charsFields();
            var unlocked = canEdit ? charUnlockedBy(rulesVar(), rulePresets()) : [];

            var html = '<div class="section"><div class="wv-head">' +
                '<span class="wv-title">角色状态</span>' +
                '<span class="wv-cur">共 ' + names.length + ' 人' +
                    (canEdit ? '<label class="ch-edit-switch"><input type="checkbox" data-act="ch-edit"' +
                        (chSt.editing ? ' checked' : '') + '>编辑模式</label>' : '') +
                '</span></div>';

            if (canEdit) {
                html += '<div class="ch-unlock">已由规则解锁编辑：' + esc(unlocked.join('、')) +
                    '　改完记得点下面的「保存（写入变量）」。</div>';
            }

            if (!names.length) {
                html += '<div class="wv-note">还没有角色。等剧情里结识了人，AI 会把它们记进变量 <code>characters</code>。</div>';
            } else {
                names.forEach(function (n) { html += charCardHtml(n, chars[n], !!chSt.open[n], chSt.editing, fields); });
            }

            if (canEdit && chSt.editing) {
                html += '<div class="wv-bar">' +
                    '<button class="wv-apply" data-act="ch-add">\uFF0B 新增角色</button>' +
                    '<button class="wv-apply" data-act="ch-save">\u25B6 保存（写入变量）</button>' +
                    '<button class="wv-apply" data-act="ch-cancel">放弃改动</button>' +
                '</div>';
            }

            html += '</div>';
            container.innerHTML = html;
        }

        // 把界面上的输入收回草稿（收起状态的卡没有 input，自然保持原值）
        function syncChars(container) {
            if (!chSt.editing || !chSt.draft) return;
            container.querySelectorAll('[data-ch-field]').forEach(function (inp) {
                var n = inp.getAttribute('data-ch-name'), k = inp.getAttribute('data-ch-field');
                if (chSt.draft[n]) chSt.draft[n][k] = inp.value;
            });
            // 选择器型字段（如受孕状态）：选择器 ＋ 月数 合成一个值
            container.querySelectorAll('[data-ch-enum]').forEach(function (box) {
                var n = box.getAttribute('data-ch-name'), k = box.getAttribute('data-ch-enum');
                var spec = charEnumSpec(k);
                if (!spec || !chSt.draft[n]) return;
                var sel = box.querySelector('[data-ch-sel]'), mon = box.querySelector('[data-ch-month]');
                chSt.draft[n][k] = charEnumCompose(spec, sel ? sel.value : '', mon ? mon.value : '');
            });
        }

        async function charsRefresh(container) {
            try {
                var raw = await App.parsers.getVariableData();
                App.state.parsedData = App.parsers.parseData(raw);
            } catch (e) { console.warn('刷新变量失败', e); }
            chSt.editing = false; chSt.draft = null;
            renderChars(container);
        }

        // 日志里写谁：优先酒馆里的玩家名（name1），退回变量里的 user.name（＝identity）
        function playerName() {
            try {
                var ctx = window.SillyTavern && window.SillyTavern.getContext ? window.SillyTavern.getContext() : null;
                if (ctx && ctx.name1) { return String(ctx.name1); }
            } catch (e) {}
            var pd = App.state.parsedData || {};
            return (pd.user && pd.user.name) ? String(pd.user.name) : '{{user}}';
        }

        async function saveChars(container) {
            syncChars(container);
            var oldCh = charsVar(), newCh = chSt.draft || {};
            var upd = {}, ins = {}, del = {};
            Object.keys(newCh).forEach(function (n) {
                if (oldCh[n] === undefined) { ins[n] = newCh[n]; return; }
                var d = charDiff(oldCh[n], newCh[n], charsFieldKeys());
                if (d) { upd[n] = d; }
            });
            Object.keys(oldCh).forEach(function (n) { if (newCh[n] === undefined) { del[n] = {}; } });
            var nu = Object.keys(upd).length, ni = Object.keys(ins).length, nd = Object.keys(del).length;
            if (!nu && !ni && !nd) { await rvAlert('没有改动。'); return; }
            if (!await rvConfirm('写回变量 characters？\n修改 ' + nu + ' 人 ／ 新增 ' + ni + ' 人 ／ 删去 ' + nd + ' 人')) return;
            var logs = charChangeLogs(oldCh, newCh, charsFields(), playerName());
            try {
                if (nu) window.eventEmit('era:updateByObject', { characters: upd });
                if (ni) window.eventEmit('era:insertByObject', { characters: ins });
                if (nd) window.eventEmit('era:deleteByObject', { characters: del });
            } catch (e) { await rvAlert('写入变量失败：' + ((e && e.message) || e)); return; }
            await new Promise(function (r) { setTimeout(r, 300); });   // 等变量落盘
            // 同一批改动也写进「故事日志」：一条改动一行（航海那套发薪日志走的是同一个 appendStoryLog）
            logs.forEach(function (t) { appendStatusLog(t); });
            await charsRefresh(container);
            await rvAlert('已写回变量：修改 ' + nu + ' 人 ／ 新增 ' + ni + ' 人 ／ 删去 ' + nd + ' 人' +
                (logs.length ? '\n故事日志已记 ' + logs.length + ' 条。' : ''));
        }

        function bindChars(container) {
            if (container.getAttribute('data-ch-bound')) return;
            container.setAttribute('data-ch-bound', '1');

            // 编辑模式开关是 checkbox；选择器型字段的下拉也用 change
            container.addEventListener('change', function (ev) {
                var t = ev.target;
                if (!t || !t.getAttribute) return;
                // 选择器型字段：切到「受孕X月」才露出月数输入框（就地显隐，不重画）
                if (t.getAttribute('data-ch-sel') !== null) {
                    var box = t.closest ? t.closest('[data-ch-enum]') : null;
                    if (box) {
                        var spec = charEnumSpec(box.getAttribute('data-ch-enum'));
                        var on = !!(spec && t.value === spec.optionMonth);
                        var mon = box.querySelector('[data-ch-month]'), unit = box.querySelector('.ch-unit');
                        if (mon) { mon.style.display = on ? '' : 'none'; }
                        if (unit) { unit.style.display = on ? '' : 'none'; }
                        if (on && mon) { try { mon.focus(); } catch (e) {} }
                    }
                    return;
                }
                if (t.getAttribute('data-act') !== 'ch-edit') return;
                syncChars(container);
                chSt.editing = !!t.checked;
                chSt.draft = chSt.editing ? JSON.parse(JSON.stringify(charsVar())) : null;
                renderChars(container);
            });

            container.addEventListener('click', async function (ev) {
                var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
                if (!el || !container.contains(el)) return;
                var act = el.getAttribute('data-act');
                if (act.indexOf('ch-') !== 0 || act === 'ch-edit') return;
                var name = el.getAttribute('data-name') || '';

                if (act === 'ch-open') { syncChars(container); chSt.open[name] = !chSt.open[name]; renderChars(container); return; }

                if (act === 'ch-del') {
                    syncChars(container);
                    if (!await rvConfirm('从变量里删去角色「' + name + '」？\n（要点「保存」才会真正写入）')) { renderChars(container); return; }
                    if (chSt.draft) { delete chSt.draft[name]; }
                    delete chSt.open[name];
                    renderChars(container);
                    return;
                }

                if (act === 'ch-add') {
                    syncChars(container);
                    var nm = await rvPrompt('新角色的名字（变量里的键）：', '');
                    if (nm === null) return;
                    nm = String(nm).trim();
                    if (!nm) { await rvAlert('名字不能为空。'); return; }
                    if (chSt.draft && chSt.draft[nm]) { await rvAlert('已经有「' + nm + '」了。'); return; }
                    var blank = {};
                    charsFieldKeys().forEach(function (k) { blank[k] = '待更新'; });
                    blank.gender = '';
                    chSt.draft[nm] = blank;
                    chSt.open[nm] = true;
                    renderChars(container);
                    return;
                }

                if (act === 'ch-save') { await saveChars(container); return; }

                if (act === 'ch-cancel') {
                    if (!await rvConfirm('放弃这一轮的改动？')) { renderChars(container); return; }
                    chSt.editing = false; chSt.draft = null;
                    renderChars(container);
                    return;
                }
            });
        }

        SECTION_RENDERERS.characters = function (data, container) {
            // 字段表来自世界书 uid 28，而每套世界观的字段不一样 → 第一次进来读一次，之后缓存
            // （点开/收起卡片走 renderChars，不会再读世界书）
            bindChars(container);
            if (chSt.fields) { renderChars(container); return; }
            container.innerHTML = '<div class="section"><div class="wv-note">正在读取变量规则…</div></div>';
            loadCharFields().then(function () { renderChars(container); });
        };

        // 页键：第 2 页世界观调整／第 3 页特殊规则／第 4 页角色状态
        STATUS_WORLDVIEWS.hentai.pages = [['worldview'], ['rules'], ['characters']];
    })();

    App.init();
    window.STATUS_APP = App;
});
