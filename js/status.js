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
    western:  { name: '西部',     pages: [] },  // TODO 待定变量区块
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
var COIN_RATIO = 100; // 1 金币 = 100 银币（按需调整）

function parseCoins(wealthStr) {
    var r = { gold: 0, silver: 0 };
    if (!wealthStr) return r;
    var s = String(wealthStr);
    var gm = s.match(/(\d+(?:\.\d+)?)\s*(?:金|金币)/);
    var sm = s.match(/(\d+(?:\.\d+)?)\s*(?:银|银币)/);
    if (gm) r.gold = parseFloat(gm[1]);
    if (sm) r.silver = parseFloat(sm[1]);
    if (!gm && !sm) {
        var nm = s.match(/(\d+(?:\.\d+)?)/);
        if (nm) r.silver = parseFloat(nm[1]);
    }
    return r;
}

function normalizeCoins(c) {
    if (c.silver >= COIN_RATIO) {
        c.gold += Math.floor(c.silver / COIN_RATIO);
        c.silver = c.silver % COIN_RATIO;
    }
    return c;
}

function formatWealth(wealthStr) {
    var c = normalizeCoins(parseCoins(wealthStr));
    return '金币' + c.gold + '枚，银币' + c.silver + '枚';
}

function formatTime(t) {
    if (!t) return '--:--';
    var s = String(t).trim();
    if (/^\d{1,2}:\d{2}$/.test(s)) return s;
    return s;
}

function formatDatetime(world) {
    var parts = [];
    if (world && world.date) parts.push(world.date);
    if (world && world.position) parts.push(world.position);
    return parts.length ? parts.join(' · ') : '';
}

// 世界信息条的可切换项（顺序即默认展示顺序）
var WIB_ITEMS = [
    { key: 'datetime', label: '日期·位置' },
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

// 人员分配当前选中的资产 { type: 'estate'|'ship', name }
var CURRENT_ASSIGN_TARGET = null;

// 人员分配当前选中的棋盘选项卡（'家产' | '船只'）
var CURRENT_BOARD_TAB = '家产';

// 家产棋盘是否按地区（大洲）分类
var GROUP_BY_REGION = false;

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
        if (oldRegionWarehouse && oldRegionWarehouse[k] !== undefined) update[k] = newRegionWarehouse[k];
        else insert[k] = newRegionWarehouse[k];
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
        var amt = o.monthlyPound * ratio;
        newWarehouse[o.crop] = (newWarehouse[o.crop] || 0) + amt;
        totalGain += amt;
    });

    if (!syncRegionWarehouse(region, regionWarehouse, newWarehouse)) return;

    var estatePayload = {};
    estatePayload[name] = { last_harvested: todayISO };
    if (isFirst) window.eventEmit('era:insertByObject', { estate: estatePayload });
    else window.eventEmit('era:updateByObject', { estate: estatePayload });

    estate.last_harvested = todayISO;
    if (info) info.textContent = '上次收获：' + todayISO;
    if (btn) { btn.textContent = '已收 ' + Math.round(totalGain) + ' 磅'; btn.disabled = true; }
}

// 配方显示：{input:{甘蔗:10}} → {output:{糖:7}}
function fmtRecipe(recipe) {
    function fmt(obj) {
        return Object.keys(obj || {}).map(function(k) { return k + ' ' + obj[k] + '磅'; }).join(' + ');
    }
    return fmt(recipe.input) + ' → ' + fmt(recipe.output);
}

// 转化：手工业按配方把原料（磅）转化为成品（磅），原料从该地区仓库扣、成品加回
function collectConversion(name, estate, todayISO, warehouse, region, recipe, batches, btn) {
    batches = parseInt(batches, 10);
    if (!batches || batches <= 0) { alert('请输入有效批数。'); return; }
    var input = recipe && recipe.input ? recipe.input : {};
    var output = recipe && recipe.output ? recipe.output : {};
    if (!Object.keys(input).length || !Object.keys(output).length) { alert('配方无效。'); return; }

    var regionWarehouse = (warehouse && warehouse[region]) || {};
    var need = {};
    Object.keys(input).forEach(function(item) { need[item] = input[item] * batches; });
    var lack = Object.keys(need).filter(function(item) { return (regionWarehouse[item] || 0) < need[item]; });
    if (lack.length) { alert('原料不足：' + lack.join('、')); return; }

    var newWarehouse = {};
    Object.keys(regionWarehouse).forEach(function(k) { newWarehouse[k] = regionWarehouse[k]; });
    Object.keys(need).forEach(function(item) {
        newWarehouse[item] = (newWarehouse[item] || 0) - need[item];
        if (newWarehouse[item] <= 0) delete newWarehouse[item];
    });
    Object.keys(output).forEach(function(item) {
        newWarehouse[item] = (newWarehouse[item] || 0) + output[item] * batches;
    });

    if (!syncRegionWarehouse(region, regionWarehouse, newWarehouse)) return;
    if (btn) { btn.textContent = '已转化 ' + batches + ' 批'; }
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
function buildWarehouseBlock(warehouse, onlyRegion) {
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
        title.textContent = '仓库 · ' + region;
        block.appendChild(title);
        block.appendChild(buildWarehouseTable(warehouse[region]));
    });
    return block;
}

// 家产信息卡：字段 + 产出块 + 收款/收获/转化/出售按钮（软门控：商业/农事/手工业需就职人员）
function buildEstateCard(name, estate, todayISO, currentWealth, warehouse, staffCount) {
    var region = getRegion(estate.location);
    var gatedType = estate.type === '商业' || estate.type === '农事' || estate.type === '手工业';
    var hasStaff = (staffCount || 0) >= 1;
    var blocked = gatedType && !hasStaff;
    var card = buildEntityCard(name, [
        { label: '位置', value: estate.location },
        { label: '规模', value: estate.scale },
        { label: '品质', value: estate.quality },
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

    // 配方（手工业）：每条配方一个 批数输入 + 转化按钮
    if (estate.recipes && estate.recipes.length) {
        var rwrap = document.createElement('div');
        rwrap.className = 'recipe-block';
        estate.recipes.forEach(function(recipe) {
            var row = document.createElement('div');
            row.className = 'recipe-row';
            var rlabel = document.createElement('span');
            rlabel.className = 'recipe-label';
            rlabel.textContent = fmtRecipe(recipe);
            row.appendChild(rlabel);
            var rinput = document.createElement('input');
            rinput.type = 'number';
            rinput.min = '1';
            rinput.value = '1';
            rinput.className = 'recipe-batch';
            row.appendChild(rinput);
            var rbtn = document.createElement('button');
            rbtn.type = 'button';
            rbtn.className = 'collect-btn';
            rbtn.textContent = '转化';
            if (blocked) rbtn.disabled = true;
            rbtn.addEventListener('click', function() {
                collectConversion(name, estate, todayISO, warehouse, region, recipe, rinput.value, rbtn);
            });
            row.appendChild(rbtn);
            rwrap.appendChild(row);
        });
        card.appendChild(rwrap);
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

// 角色统一字段（location / expense，性别符号显示在姓名行右侧，标签作为分组标题）
function personRows(person) {
    return [
        { label: '位置', value: person.location },
        { label: '薪资', value: person.expense }
    ];
}

// 只读人物卡：姓名行右侧显示性别符号 + 字段 + 当前就职（指令模式下点击选中为目标角色）
function buildPersonCard(name, person, employment, data) {
    var card = buildEntityCard(name, personRows(person));
    card.classList.add('person-card');
    card.dataset.personName = name;
    if (SELECTED_PERSON === name) card.classList.add('person-selected');
    var nameEl = card.querySelector('.entity-name');
    if (nameEl) {
        nameEl.classList.add('entity-name-with-symbol');
        var sym = document.createElement('span');
        sym.className = 'entity-gender-symbol';
        sym.textContent = genderSymbol(person.gender);
        nameEl.appendChild(sym);
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
    return total;
}

// 薪资明细表：姓名 / 薪资 / 就职地点（含 expense 者才列出）
function buildPayrollTable(rel, employment) {
    var rows = [];
    getAllPersons(rel).forEach(function(p) {
        var expense = p.data && p.data.expense;
        if (!expense) return;
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
    var sx = window.pageXOffset || 0;
    var sy = window.pageYOffset || 0;
    popover.style.left = (rect.left + sx) + 'px';
    popover.style.top = (rect.bottom + 6 + sy) + 'px';
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

// 家产棋盘尺寸：小型 1×1、中型 2×1、大型 2×2、未指定大中小型 4×1
function estateSize(estate) {
    var s = estate.scale;
    if (s === '小型') return { w: 1, h: 1 };
    if (s === '中型') return { w: 2, h: 1 };
    if (s === '大型') return { w: 2, h: 2 };
    return { w: 4, h: 1 };
}

function shipSize(ship) {
    return SHIP_SIZE[ship.type] || { w: 2, h: 1 };
}

// 地块颜色类（灰=待分配、黄=已就职、蓝=无需就职、红=荒废/重损）
function estateTileClass(estate, staffed) {
    var needsStaff = estate.type === '商业' || estate.type === '农事' || estate.type === '手工业';
    if (!needsStaff) return 'tile-neutral';
    if (estate.status === '荒废' || estate.status === '歇业') return 'tile-derelict';
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

// 自适应地块字号：按字数确定性计算（全角汉字宽≈1em），不换行地块统一 50px，换行地块缩到最接近边缘且不换行
function fitTileText(el) {
    var chars = (el.textContent || '').length;
    if (!chars) return;
    var avail = el.clientWidth - 8;
    if (avail <= 0) return;
    var size = Math.floor((avail - 1) / chars);
    if (size > 50) size = 50;
    if (size < 12) size = 12;
    el.style.fontSize = size + 'px';
}

// 棋盘渲染：家产/船只共用，点击地块后由 rerender 在下方显示人员安排详情
function buildAssetBoard(type, names, assetMap, ai, data, rerender) {
    var items = names.map(function(n) {
        var a = assetMap[n] || {};
        var size = type === 'estate' ? estateSize(a) : shipSize(a);
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
        var cls = type === 'estate' ? estateTileClass(it.asset, staffed) : shipTileClass(it.asset, staffed);
        var cell = document.createElement('div');
        cell.className = 'asset-tile ' + cls;
        cell.style.gridColumn = (it.col + 1) + ' / span ' + it.w;
        cell.style.gridRow = (it.row + 1) + ' / span ' + it.h;
        cell.textContent = it.name;
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
    if (rerender) rerender();
}

// 解职（删除 employment 里的该人）
function emitUnassign(p, data, rerender) {
    if (typeof window.eventEmit !== 'function') { alert('无法接入 ERA 指令通道。'); return; }
    var empPayload = {};
    empPayload[p.name] = {};
    window.eventEmit('era:deleteByObject', { employment: empPayload });
    if (data.employment) delete data.employment[p.name];
    if (rerender) rerender();
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
        if (estateNames.length) {
            // 按地区分类勾选项
            var regionToggle = document.createElement('label');
            regionToggle.className = 'region-toggle';
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = GROUP_BY_REGION;
            cb.addEventListener('change', function() {
                GROUP_BY_REGION = cb.checked;
                rerender();
            });
            regionToggle.appendChild(cb);
            regionToggle.appendChild(document.createTextNode('按地区分类'));
            content.appendChild(regionToggle);

            if (GROUP_BY_REGION) {
                var groups = {};
                estateNames.forEach(function(n) {
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
                appendBoard('estate', estateNames, data.estate || {});
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
        CURRENT_ASSIGN_TARGET = null;
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
        arrow.textContent = '▾';
        nameSpan.appendChild(arrow);
        var countSpan = document.createElement('span');
        countSpan.className = 'rel-count';
        countSpan.textContent = names.length;
        header.appendChild(nameSpan);
        header.appendChild(countSpan);
        var body = document.createElement('div');
        body.className = 'rel-group-body';
        names.forEach(function(n) { body.appendChild(buildPersonCard(n, rel[n] || {}, employment, data)); });
        header.addEventListener('click', function() {
            var collapsed = body.style.display === 'none';
            body.style.display = collapsed ? '' : 'none';
            arrow.textContent = collapsed ? '▾' : '▸';
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

// 发送玩家发言（SillyTavern 通道接入点；当前复制到剪贴板兜底）
function sendPlayerMessage(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            alert('已生成发言并复制到剪贴板：\n\n' + text);
        }).catch(function() {
            alert('已生成发言：\n\n' + text);
        });
    } else {
        alert('已生成发言：\n\n' + text);
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
        var cardEl = document.querySelector('.status-card');
        var cardRect = cardEl ? cardEl.getBoundingClientRect() : { left: 0, right: window.innerWidth };
        var popWidth = 320;
        var sx = window.pageXOffset || 0;
        var sy = window.pageYOffset || 0;
        var left = Math.max(cardRect.left + 8, Math.min(rect.left, cardRect.right - popWidth - 8));
        popover.style.left = (left + sx) + 'px';

        // 先放下方，若触底则改放上方
        var top = rect.bottom + 6 + sy;
        var popHeight = popover.offsetHeight;
        if (popHeight && top + popHeight > sy + window.innerHeight) {
            top = rect.top - 6 + sy - popHeight;
            if (top < sy + 8) top = sy + 8;
        }
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
            section.appendChild(buildWarehouseBlock(warehouse, CURRENT_CONTINENT));

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
                    content.appendChild(buildEstateCard(item.name, item.data, todayISO, currentWealth, warehouse, staffIndex[item.name] || 0));
                });
            }
            renderContent();

            // 大洲切换
            contBar.addEventListener('click', function(e) {
                var btn = e.target.closest('.entity-tab');
                if (!btn) return;
                if (CURRENT_CONTINENT === btn.dataset.continent) return;
                CURRENT_CONTINENT = btn.dataset.continent;
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
            var r = region[name] || {};
            section.appendChild(buildEntityCard(name, [
                { label: '描述', value: r['描述'] || r.description },
                { label: '民俗风情', value: r['民俗风情'] }
            ]));
        });
        container.appendChild(section);
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var App = {
        state: {
            parsedData: { user: {}, stageData: null, currentStageData: null },
            prevRenderData: { title: null, psyche: null, surroundings: null, inventory: null, stageData: null, currentStageData: null, bodyState: null, world: null, wealth: null, mode: null, isStageExpanded: null, isTaskPanelCollapsed: null, modeExtra: null, modeForSections: null, worldviewForSections: null },
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
                worldInfoTop: 'datetime',
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
                sliders: { spacing: document.getElementById('spacing-slider'), fontSize: document.getElementById('font-size-slider'), avatarSize: document.getElementById('avatar-size-slider') },
                values: { spacing: document.getElementById('spacing-value'), fontSize: document.getElementById('font-size-value'), avatarSize: document.getElementById('avatar-size-value') },
                fontSelector: document.getElementById('font-selector'),
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
            DEFAULTS: { spacing: 1.5, fontSize: 16, avatarSize: 60, fontFamily: "'ZCOOL XiaoWei', sans-serif" },
            getStorageKey: function() { return 'uiSettings_' + App.state.uniqueId; },
            load: function() {
                var saved = {};
                try { saved = JSON.parse(localStorage.getItem(this.getStorageKey())) || {}; } catch (e) {}
                App.state.settings = Object.assign({}, this.DEFAULTS, saved);
                this.apply(App.state.settings); this.updateUIControls(App.state.settings);
            },
            apply: function(s) {
                var e = App.elements;
                requestAnimationFrame(function() {
                    e.root.style.setProperty('--section-gap', s.spacing + 'rem');
                    e.root.style.setProperty('--base-font-size', s.fontSize + 'px');
                    e.root.style.setProperty('--avatar-size', s.avatarSize + 'px');
                    e.root.style.setProperty('--font-main', s.fontFamily);
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
            },
            save: function() {
                var sliders = App.elements.settings.sliders;
                var fontSelector = App.elements.settings.fontSelector;
                var newS = Object.assign({}, App.state.settings);
                Object.keys(sliders).forEach(function(k) { if(sliders[k]) newS[k] = parseFloat(sliders[k].value); });
                newS.fontFamily = fontSelector.value;
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

            renderWorldInfo: function(world, wealth) {
                var el = App.elements.containers.worldInfo;
                world = world || {};
                var hasAny = !!(world.date || world.position || world.time || wealth);
                if (el) { el.style.display = hasAny ? '' : 'none'; }
                if (!hasAny) return;

                App.state.worldInfoValues = {
                    datetime: formatDatetime(world),
                    time: formatTime(world.time),
                    wealth: formatWealth(wealth)
                };
                App.ui.renderWorldInfoWidget();
            },

            // 渲染可折叠彩灯组件：置顶项 + 其余项 + 排序选择器
            renderWorldInfoWidget: function() {
                var top = App.elements.containers.worldInfoTop;
                var expand = App.elements.containers.worldInfoExpand;
                if (!top || !expand) return;
                var topKey = App.uiStateConfig.data.worldInfoTop || 'datetime';
                var values = App.state.worldInfoValues || {};

                var topItem = WIB_ITEMS[0];
                WIB_ITEMS.forEach(function(it) { if (it.key === topKey) topItem = it; });

                top.innerHTML = '<span class="wib-top-label">' + topItem.label + '</span>' +
                    '<span class="wib-top-value">' + (values[topItem.key] || '') + '</span>' +
                    '<span class="wib-arrow">\u25BE</span>';

                var html = '';
                WIB_ITEMS.forEach(function(it) {
                    if (it.key === topKey) return;
                    html += '<div class="wib-item"><span class="wib-item-label">' + it.label + '</span><span class="wib-item-value">' + (values[it.key] || '') + '</span></div>';
                });
                html += '<div class="wib-picker"><span class="wib-picker-title">置顶</span>';
                WIB_ITEMS.forEach(function(it) {
                    html += '<label class="wib-picker-opt"><input type="radio" name="wib-top-pick" value="' + it.key + '"' + (it.key === topKey ? ' checked' : '') + '>' + it.label + '</label>';
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
                if (!view.showStage) {
                    toggleArea.innerHTML = '';
                    toggleArea.style.display = 'none';
                    taskPanel.style.display = 'none';
                    App.elements.containers.headerBtnArea.innerHTML = '';
                    App.elements.containers.headerBtnArea.style.display = 'none';
                    App.elements.containers.userHeader.classList.remove('no-border');
                    return;
                }
                // 剧情模式：恢复显示
                toggleArea.style.display = '';
                taskPanel.style.display = '';

                var nextStage = App.state.parsedData.stageData;
                var currentStage = App.state.parsedData.currentStageData;
                var isCollapsed = App.uiStateConfig.data.isTaskPanelCollapsed;
                var isEditing = App.state.isEditMode;
                var editableAttr = isEditing ? ' contenteditable="true"' : '';

                // 渲染折叠切换按钮
                var headerBtn = App.elements.containers.headerBtnArea;
                var userHeader = App.elements.containers.userHeader;
                if (nextStage || currentStage) {
                    if (isCollapsed) {
                        // 折叠状态：按钮移到用户信息栏右侧
                        headerBtn.innerHTML = '<span id="stage-collapse-toggle-btn" class="square-btn">\u5C55\u5F00<br>\u5267\u60C5</span>';
                        headerBtn.style.display = '';
                        toggleArea.innerHTML = '';
                        userHeader.classList.add('no-border');
                    } else {
                        // 展开状态：按钮在原位（虚线下方）
                        headerBtn.innerHTML = '';
                        headerBtn.style.display = 'none';
                        toggleArea.innerHTML = '' +
                            (isEditing ? '<span id="stage-save-btn" class="stage-action-btn stage-save-btn">\uD83D\uDCBE \u4FDD\u5B58</span>' : '') +
                            '<span id="stage-edit-btn" class="stage-action-btn stage-edit-btn' + (isEditing ? ' active' : '') + '">' + (isEditing ? '\u2716 \u7F16\u8F91\u4E2D' : '\u270F\uFE0F \u7F16\u8F91') + '</span>' +
                            '<span id="stage-collapse-toggle-btn">\u25B5 \u6536\u8D77\u5267\u60C5</span>';
                        userHeader.classList.remove('no-border');
                    }
                    var collapseToggleBtn = document.getElementById('stage-collapse-toggle-btn');
                    if (collapseToggleBtn) {
                        collapseToggleBtn.addEventListener('click', function() { App.uiStateConfig.toggleTaskPanel(); });
                    }
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
                    headerBtn.innerHTML = '';
                    headerBtn.style.display = 'none';
                    userHeader.classList.remove('no-border');
                }

                // 无数据时
                if (!nextStage && !currentStage) {
                    if (!isCollapsed) {
                        taskPanel.innerHTML = '<div class="task-container"><div class="task-header">\u2726 \u5267\u60C5\u72B6\u6001 \u2726</div><div style="text-align: center; color: var(--color-accent); padding: 1.5rem; font-style:italic;">暂未开始剧情，若你正在进行自定义生成，可以在正则中暂时关闭状态栏显示</div></div>';
                    }
                    return;
                }

                // 折叠状态：隐藏剧情内容
                if (isCollapsed) {
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
                    var wealthVal = d.user.wealth || '';
                    if (worldJson !== prev.world || wealthVal !== prev.wealth) { App.ui.renderWorldInfo(d.world, wealthVal); prev.world = worldJson; prev.wealth = wealthVal; }

                    var invJson = JSON.stringify(d.user.inventory);
                    if (invJson !== prev.inventory) { App.ui.renderInventory(containers.inventory, d.user.inventory); prev.inventory = invJson; }

                    // 模式/世界观切换：mode、worldview 或区块数据变化时重渲染动态区块
                    var extraJson = JSON.stringify({
                        estate: d.estate, ships: d.ships, relationship: d.relationship,
                        region: d.region, payroll: d.payroll,
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
                var actives = App.state.activePages || [];
                if (actives.length <= 1) return;
                var current = null;
                actives.forEach(function(p) { if (p.classList.contains('active')) current = p; });
                var idx = actives.indexOf(current);
                if (idx === -1) idx = 0;
                App.actions.showPage(actives[(idx + 1) % actives.length]);
            },

            turnPageBack: function() {
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
                var payload = { user: { Inventory: {} } };
                payload.user.Inventory[itemName] = {};
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
                var p = { user: {}, world: {}, stageData: null, currentStageData: null, mode: 'script', worldview: 'medieval', estate: {}, ships: {}, relationship: {}, region: {}, warehouse: {}, raw: null };
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
                    wealth: clean(u.wealth || ''),
                    surroundings: clean(u.surroundings || ''),
                    psyche: clean(u.Psychological_description || ''),
                    inventory: u.Inventory || {}
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
            var pageTurnBtn = App.elements.pageTurnBtn;

            function toggleModal(panel) { panel.classList.toggle('active'); }

            [settings.panel, deleteConfirm.panel, itemDetail.panel].forEach(function(panel) {
                panel.addEventListener('click', function(e) {
                    if (e.target === panel) {
                        if (panel === deleteConfirm.panel) App.actions.cancelDelete();
                        else if (panel === itemDetail.panel) App.actions.closeItemDetail();
                        else toggleModal(panel);
                    }
                });
            });

            settings.toggle.addEventListener('click', function() {
                toggleModal(settings.panel);
            });

            collapsePanelBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                App.uiStateConfig.togglePanel();
            });

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

            pageTurnBtn.addEventListener('click', App.actions.turnPage);
            App.elements.pagePrevBtn.addEventListener('click', App.actions.turnPageBack);

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
                this.uiStateConfig.load();
                this.settings.load(); this.bindEvents(); await this.db.init();
                var avatarFile = await this.db.load(this.state.uniqueId);
                this.ui.updateAvatar(avatarFile); this.ui.updateAll();
            } catch(error) { console.error("数据加载时发生错误:", error); }
        }
    };
    App.init();
});
