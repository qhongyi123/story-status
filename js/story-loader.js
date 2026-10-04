// 故事清单：每个故事对应一个 JSON 文件
var STORY_MANIFEST = [
    { id: "SM1", name: "灰姑娘",            file: "data/stories/灰姑娘.json", mode: "script", worldview: "medieval", headers: ["背景信息", "剧情线", "参数调整", "开始剧情"] },
    { id: "SM2", name: "小红帽",            file: "data/stories/小红帽.json", mode: "script", worldview: "medieval", headers: ["背景信息", "剧情线", "参数调整", "开始剧情"] },
    { id: "SM3", name: "卖火柴的小女孩",    file: "data/stories/卖火柴的小女孩.json", mode: "script", worldview: "medieval", headers: ["背景信息", "剧情线", "参数调整", "开始剧情"] },
    { id: "SM4", name: "小裁缝一次干七个！", file: "data/stories/小裁缝一次干七个！.json", mode: "script", worldview: "medieval", headers: ["背景信息", "剧情线", "参数调整", "开始剧情"] },
    { id: "SM5", name: "白雪公主（制作中）", file: "data/stories/白雪公主.json", mode: "script", worldview: "medieval", headers: ["背景信息", "剧情线", "参数调整", "开始剧情"] },
    { id: "FC1", name: "自由模式-贩奴贸易",  file: null, mode: "free", worldview: "colony", headers: ["世界观概览", "区域选择", "初始设定", "开始剧情"] },
    { id: "FH1", name: "自由模式-本子世界",  file: null, mode: "free", worldview: "hentai", headers: ["世界观概览", "世界观", "特殊规则", "开局选择"] },
    { id: "tab5", name: "自定义开局",        file: null, headers: ["背景信息", "人物信息", "参数调整", "开始剧情"] },
    { id: "tab6", name: "自定义剧本",        file: null, headers: ["背景信息", "剧情线", "人物信息", "参数调整", "开始剧情"] }
];

// 根据当前模式 + 世界观动态插入/移除故事选项卡按钮（插入到「模式选择与世界观调整」之后、「角色管理」之前）
// 自定义开局(tab5)/自定义剧本(tab6) 仅剧情模式显示，且位于剧本按钮之后
window.refreshConditionalStoryTabs = function() {
    var header = document.querySelector('.tabs-header');
    if (!header) return;
    var isScript = (__currentMode === 'script');

    // 移除旧的动态剧本按钮
    header.querySelectorAll('.tab-btn.dynamic-story').forEach(function(btn) { btn.remove(); });

    var anchor = header.querySelector('.tab-btn[data-target="tab7"]');
    if (!anchor) return;

    // 插入匹配的剧本按钮（位于 tab7 之前）
    var matched = STORY_MANIFEST.filter(function(s) {
        return s.mode && s.worldview && s.mode === __currentMode && s.worldview === __currentWorldviewId;
    });
    matched.forEach(function(s) {
        var btn = document.createElement('button');
        btn.className = 'tab-btn dynamic-story';
        btn.setAttribute('data-target', s.id);
        btn.textContent = s.name;
        header.insertBefore(btn, anchor);
    });

    // 自定义开局 / 自定义剧本 按钮：仅剧情模式显示，插在剧本之后
    ['tab5', 'tab6'].forEach(function(tid) {
        var btn = header.querySelector('.tab-btn[data-target="' + tid + '"]');
        if (btn) {
            header.removeChild(btn);
        }
        if (isScript) {
            var nb = document.createElement('button');
            nb.className = 'tab-btn custom-start';
            nb.setAttribute('data-target', tid);
            nb.textContent = (tid === 'tab5' ? '自定义开局' : '自定义剧本');
            header.insertBefore(nb, anchor);
        }
    });

    // 目录弹窗中自定义开局/剧本按钮同步显示隐藏
    document.querySelectorAll('.toc-corner-btn.custom-start').forEach(function(b) {
        b.style.display = isScript ? '' : 'none';
    });
};

var originalDataCache = {};
var tabsDataMap = {};

// 加载所有故事 JSON
async function loadAllStories() {
    var promises = STORY_MANIFEST.map(function(cfg) {
        if (cfg.file) {
            return fetch(cfg.file)
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    // JSON 文件中已有 story/variable 顶层字段
                    tabsDataMap[cfg.id] = {
                        headers: cfg.headers,
                        data: {
                            story: data.story,
                            variable: data.variable
                        }
                    };
                })
                .catch(function(err) {
                    console.warn("加载故事失败: " + cfg.file, err);
                    // 回退到空模板
                    tabsDataMap[cfg.id] = {
                        headers: cfg.headers,
                        data: JSON.parse(JSON.stringify(emptyTemplateInfo))
                    };
                });
        } else {
            // 自定义开局/剧本使用空模板
            tabsDataMap[cfg.id] = {
                headers: cfg.headers,
                data: JSON.parse(JSON.stringify(emptyTemplateInfo))
            };
        }
    });
    await Promise.all(promises);
}

// 初始化动态标签页
async function initDynamicTabs() {
    var container = document.getElementById('dynamic-tabs-area');

    renderControlPanelDynamicArea();
    renderModeAndWorldviewPanel();
    renderTocModeWorldview();
    refreshTocGallery();
    refreshConditionalStoryTabs();

    // 加载所有故事数据
    await loadAllStories();

    // 加载 FC1 世界观预设（地区/物品/人物/家产/船只）
    if (typeof loadFc1Presets === 'function') { await loadFc1Presets(); }
    // 加载 FH1 世界观预设（本子世界：三套可切换的世界观，来自 data/fh1-presets/worldviews.json）
    if (typeof loadFh1Presets === 'function') { await loadFh1Presets(); }

    // 从目录卡片中同步封面图
    document.querySelectorAll('.toc-img-card').forEach(function(card) {
        var btnOnClick = card.getAttribute('onclick');
        var tabIdMatch = btnOnClick.match(/selectFromToc\('([^']+)'\)/);
        if(tabIdMatch) {
            var imgNode = card.querySelector('img');
            var src = imgNode ? imgNode.getAttribute('src') : "";
            var tid = tabIdMatch[1];
            if(tabsDataMap[tid] && src) { tabsDataMap[tid].data.story.coverImg = src; }
        }
    });

    var refNodeTab7 = document.getElementById('tab7');

    Object.keys(tabsDataMap).forEach(function(tabId) {
        var cfg = tabsDataMap[tabId];
        originalDataCache[tabId] = JSON.parse(JSON.stringify(cfg.data));

        var tabNode = document.createElement('div');
        tabNode.id = tabId;
        tabNode.className = 'tab-panel';

        var headerHTML = '<div class="sub-tabs-header">';
        cfg.headers.forEach(function(h, i) { headerHTML += '<button class="sub-tab-btn ' + (i === 0 ? 'active' : '') + '" data-sub="' + tabId + '-sub' + (i+1) + '" onclick="switchSubTab(this, \'' + tabId + '-sub' + (i+1) + '\')">' + h + '</button>'; });

        if (tabId !== 'tab5' && tabId !== 'tab6' && tabId !== 'FC1' && tabId !== 'FH1') {
            headerHTML += '<div class="edit-switch-container"><span>修改模式</span><label class="switch-ui"><input type="checkbox" onchange="toggleEditMode(this, \'' + tabId + '\')"><span class="slider"></span></label></div>';
        }
        if (tabId === 'FH1') {
            // 编辑模式开关：只有「世界观」子页显示（由 fh1OnSubTabChange 控制显隐）
            headerHTML += '<div class="edit-switch-container" id="fh1-edit-switch" style="display:none;"><span>编辑模式</span><label class="switch-ui"><input type="checkbox" id="fh1-edit-chk" onchange="fh1ToggleEditMode(this)"><span class="slider"></span></label></div>';
        }
        headerHTML += '</div>';

        var sd = cfg.data.story;
        var vd = cfg.data.variable;
        var panelsHTML = '<div class="sub-panels-wrapper">';

        cfg.headers.forEach(function(h, idx) {
            var contentStr = "";
            var isSubActive = idx === 0 ? "active" : "";
            var thisSubId = tabId + '-sub' + (idx+1);

            if (h === "背景信息") {
                var regionsHTML = "";
                var regions = (vd["背景信息"] && vd["背景信息"]["地区"]) ? vd["背景信息"]["地区"] : {};
                Object.keys(regions).forEach(function(rk) {
                    var rt = regions[rk];
                    var customsHTML = "";
                    if(rt["民俗风情"]) {
                        Object.keys(rt["民俗风情"]).forEach(function(ck) {
                            customsHTML += '<div class="custom-row custom-item" data-ditem><span class="editable-key editable-field" style="color:#8b5a2b;" data-dkey>' + mtH(ck) + '</span>:<span class="editable-field" data-dval>' + mtH(rt["民俗风情"][ck]) + '</span></div>';
                        });
                    }
                    customsHTML += '<div class="add-custom-btn" onclick="addNewCustom(this)">+ 添加风情词条</div>';
                    regionsHTML += '<div class="area-box area-item"><div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;">\u27A4 <span class="editable-field editable-key region-name" style="color:var(--color-accent);">' + mtH(rk) + '</span></div><div class="custom-row" style="margin-bottom:8px;"><span class="param-label" style="flex-shrink:0;">描述:</span><div class="editable-field editable-textarea region-desc" style="flex:1;">' + mtH(rt["描述"] || '') + '</div></div><div class="customs-box"><div class="param-label" style="display:block; margin-bottom:4px;">\u2756 民俗风情:</div>' + customsHTML + '</div></div>';
                });

                var imgWidgetHTML = "";
                if (sd.coverImg && sd.coverImg.trim() !== "") {
                    imgWidgetHTML = '<div class="tab-cover-container"><div class="tab-cover-img-wrapper" id="img-wrapper-' + tabId + '" style="width: 140px;"><img src="' + sd.coverImg + '" alt="渊卷遗像"></div><div class="tab-cover-controls"><div class="zoom-btn" onclick="zoomTabImage(\'' + tabId + '\', 1)">+</div><div class="zoom-btn" onclick="zoomTabImage(\'' + tabId + '\', -1)">-</div></div></div>';
                }

                var ptStyle1 = imgWidgetHTML ? 'border-bottom:none; margin-bottom:0; padding-bottom:0;' : '';

                var infoIntroHTML = '<div class="data-block" style="' + ptStyle1 + '"><div class="data-field-title">\uD83D\uDCD6 卷目指印</div><div>名称：<span class="editable-field" data-path="story.name">' + mtH(sd.name) + '</span></div><div style="font-size:0.9em; margin-top:2px;">又名：<span class="editable-field" data-path="story.alias" style="opacity:0.8;">' + mtH(sd.alias) + '</span></div></div>' + imgWidgetHTML + '<div class="data-block"><div class="data-field-title">\uD83D\uDD78\uFE0F 渊源底本</div><div class="editable-textarea editable-field data-story-text" data-path="story.background">' + mtH(sd.background) + '</div></div>';

                var presetBtnHTML = '<button class="add-preset-btn custom-alert-btn" onclick="openPresetModal(\'' + tabId + '\')" style="margin-top:10px; width:100%; border-style:dashed; padding:8px; background:rgba(138, 43, 226, 0.08); color:var(--color-primary-dark); font-size:1.05rem;">\u2727 预设内容加载 \u2727</button>';

                var importBtnHTML = (tabId === 'tab5' || tabId === 'tab6') ? '<button class="custom-alert-btn" onclick="openImportModal(\'' + tabId + '\')" style="margin-top:10px; width:100%; border-style:dashed; padding:8px; background:rgba(184, 134, 11, 0.08); color:var(--color-primary-dark); font-size:1.05rem;">\u2727 导入预设开局 \u2727</button>' : "";

                contentStr = infoIntroHTML + '<div class="data-block" style="border-bottom:none;"><div class="data-field-title">\uD83D\uDDFA\uFE0F 地域与风土物志</div><div data-region-container id="regions-' + tabId + '">' + regionsHTML + '</div><button class="add-region-btn custom-alert-btn" onclick="addNewRegion(\'' + tabId + '\')" style="margin-top:10px; width:100%; border-style:dashed; padding:8px;">+ 新 建 地 域 </button>' + presetBtnHTML + importBtnHTML + '</div>';
            }
            else if (h === "剧情线") {
                contentStr = '<div class="data-block" style="border-bottom:1px dashed rgba(184, 134, 11, 0.3);"><div class="data-field-title" style="display:flex; justify-content:space-between; align-items:center;"><span>\uD83D\uDCDC 剧情阶段一览</span><span style="font-size:0.75rem; font-weight:normal; display:flex; gap:4px;"><button class="view-mode-btn active" onclick="switchStoryView(\'' + tabId + '\',\'doc\',this)" style="padding:2px 6px; border:1px solid var(--color-primary-dark); border-radius:3px; background:var(--bg-content); color:var(--color-primary-dark); cursor:pointer; font-size:0.7rem;">\uD83D\uDCC4 文档流</button><button class="view-mode-btn" onclick="switchStoryView(\'' + tabId + '\',\'timeline\',this)" style="padding:2px 6px; border:1px solid var(--color-primary-dark); border-radius:3px; background:var(--bg-content); color:var(--color-primary-dark); cursor:pointer; font-size:0.7rem;">\uD83D\uDD17 脉络式</button></span></div><ul style="padding-left:15px; color:var(--color-text-dark); margin-top:10px;" data-complex-dict="variable.剧情线" data-tab-id="' + tabId + '">' + generateComplexStorylines(vd["剧情线"] || {}) + '</ul><div class="add-custom-btn" onclick="addNewStoryline(this, \'stage\')">+ 添加剧情阶段</div></div>' +
                             '<div class="data-block" style="border:none; margin-top:15px;"><div class="data-field-title">\u270D\uFE0F 笔触用户偏好</div><ul style="padding-left:15px; color:var(--color-text-dark); margin-top:10px;" data-dict="variable.用户偏好">' + generateStorylines(vd["用户偏好"] || {}) + '</ul><div class="add-custom-btn" onclick="addNewStoryline(this, \'guide\')">+ 添加用户偏好</div></div>';
            }
            else if (h === "人物信息") {
                contentStr = '<div class="data-block" style="border:none; height:100%; display:flex; flex-direction:column;"><div class="data-field-title">\uD83C\uDFAD 世界书读取</div><div style="background:rgba(212,175,55,0.06); border:1px solid rgba(212,175,55,0.15); padding:12px; border-radius:6px; margin-top:10px; flex:1; display:flex; flex-direction:column;"><select id="char-select-' + tabId + '" onchange="loadCharEntry(this, \'' + tabId + '\')" style="width:100%; padding:8px; margin-bottom:12px; border-radius:4px; background:var(--bg-content); color:var(--color-text-dark); border:1px solid var(--color-primary-dark); outline:none; font-family:inherit; box-shadow:inset 1px 1px 3px rgba(0,0,0,0.05);"><option value="">载入世间灵魄中，请稍候...</option></select><span class="param-label" style="display:block; margin-bottom:4px;">化身名号 (即神魂封卷语):</span><input type="text" id="char-name-' + tabId + '" placeholder="填写条目名称(例如角色名、称号等)..." style="width:100%; margin-bottom:12px; padding:6px; box-sizing:border-box; background:rgba(253,246,227,0.5); border:1px solid rgba(184,134,11,0.4); outline:none;"><span class="param-label" style="display:block; margin-bottom:4px; flex-shrink:0;">命途轨痕 (世界书人物条目内容):</span><textarea id="char-content-' + tabId + '" placeholder="描摹深层性格法则、种族特质、隐秘喜好等..." style="flex:1; width:100%; resize:none; padding:6px; box-sizing:border-box; background:rgba(253,246,227,0.5); border:1px solid rgba(184,134,11,0.4); outline:none;"></textarea><div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px; flex-shrink:0;"><button onclick="saveCharEntry(\'' + tabId + '\')" style="background:linear-gradient(135deg, #ffffff 0%, #fdf6e3 100%); border:1px solid var(--color-primary-dark); color:var(--color-text-dark); padding:6px 16px; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.15);">\u2727 写入 \u2727</button><button onclick="populateCharSelectors()" style="background:transparent; border:1px dashed var(--color-accent); color:var(--color-text-dark); padding:6px 12px; border-radius:4px; cursor:pointer;">\u21BB 刷新列表</button></div></div></div>';
            }
            else if (h === "参数调整") {
                contentStr = '';
                // 角色选择按钮
                if (vd.characterSelect && vd.characterSelect.options && vd.characterSelect.options.length > 0) {
                    var cs = vd.characterSelect;
                    contentStr += '<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; align-items:center; padding:8px; background:rgba(212,175,55,0.06); border-radius:6px; border:1px solid rgba(212,175,55,0.15);"><span style="font-weight:bold; color:var(--color-primary-dark); font-size:0.95em; margin-right:6px;">' + mtH(cs.label || '\uD83C\uDFAE 选择角色') + '</span>';
                    cs.options.forEach(function(cname) {
                        var isAct = (cname === cs.active);
                        contentStr += '<button class="char-select-btn' + (isAct ? ' active' : '') + '" data-char="' + cname + '" onclick="switchCharProfile(this, \'' + tabId + '\')" style="padding:5px 14px; border-radius:6px; border:1px solid ' + (isAct ? 'var(--color-primary-dark)' : 'rgba(212,175,55,0.4)') + '; background:' + (isAct ? 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(253,246,227,0.6))' : 'rgba(253,246,227,0.3)') + '; color:var(--color-text-dark); cursor:pointer; font-weight:' + (isAct ? 'bold' : 'normal') + '; font-family:inherit; font-size:0.9em;">' + cname + '</button>';
                    });
                    contentStr += '</div>';
                }
                contentStr += '<div class="param-group" style="background:rgba(212,175,55,0.06); padding:10px; border-radius:6px; border:1px solid rgba(212,175,55,0.15);"><div class="data-field-title" style="margin-bottom:8px;">\uD83C\uDF10 世界信息</div><div style="display:flex; flex-wrap:wrap; gap:10px; line-height:1.8;"><div style="flex:1; min-width:120px;"><span class="param-label">\uD83D\uDCC5 日期:</span> <span class="editable-field" data-path="variable.world.date">' + mtH(vd.world && vd.world.date || '') + '</span></div><div style="flex:1; min-width:120px;"><span class="param-label">\u23F1\uFE0F 时间:</span> <span class="editable-field" data-path="variable.world.time">' + mtH(vd.world && vd.world.time || '') + '</span></div><div style="width:100%;"><span class="param-label">\uD83D\uDCCD 地点:</span> <span class="editable-field" style="width:calc(100% - 50px);" data-path="variable.world.position">' + mtH(vd.world && vd.world.position || '') + '</span></div></div></div>' +
                    '<div class="param-group" style="padding:10px; border:1px solid rgba(212,175,55,0.1); border-radius:6px;"><div class="data-field-title" style="margin-bottom:8px;">\uD83C\uDFAD 角色信息</div><div style="display:flex; flex-wrap:wrap; gap:10px; line-height:1.8;"><div style="width:100%;"><span class="param-label">\uD83D\uDC64 身份:</span> <span class="editable-field" style="width:calc(100% - 50px);" data-path="variable.user.identity">' + mtH(vd.user && vd.user.identity || '') + '</span></div><div style="flex:1; min-width:120px;"><span class="param-label">\u26A7\uFE0F 性别:</span> <span class="editable-field" data-path="variable.user.gender">' + mtH(vd.user && vd.user.gender || '') + '</span></div><div style="width:100%;"><span class="param-label">\uD83E\uDEC0 身体状态:</span> <div class="editable-field editable-textarea" data-path="variable.user.body_state" style="display:inline-block; vertical-align:top; width:70%;">' + mtH(vd.user && vd.user.body_state || '') + '</div></div></div>' +
                    '<div style="margin-top:12px;"><span class="param-label" style="display:block;">\uD83E\uDEBA 行囊:</span><ul data-dict="variable.user.inventory" style="padding-left:15px; margin:5px 0;">' + generateInventoryList(vd.user && vd.user.inventory || {}) + '</ul><div class="add-custom-btn" onclick="addNewInventoryItem(this)">+ 添加物品</div></div>' +
                    '<div style="margin-top:12px;"><span class="param-label" style="display:block;">\uD83C\uDF03 周围环境:</span> <div class="editable-field editable-textarea" data-path="variable.user.surroundings">' + mtH(vd.user && vd.user.surroundings || '') + '</div></div>' +
                    '<div style="margin-top:12px;"><span class="param-label" style="display:block;">\uD83E\uDDE0 心理描写:</span> <div class="editable-field editable-textarea" data-path="variable.user.psychological_description">' + mtH(vd.user && vd.user.psychological_description || '') + '</div></div></div>';
            }
            else if (h === "开始剧情" && tabId !== 'FC1') {
                contentStr = '<div class="data-block" style="border-bottom:none;"><div class="data-field-title">\u2728 幕启词刻</div><button class="start-game-btn" data-tid="' + tabId + '" style="margin-top:10px; margin-bottom:10px;">开启童话物语</button><div class="editable-field editable-textarea data-story-text" data-path="story.startContent" style="min-height:100px;">' + mtH(sd.startContent) + '</div></div>';
            }
            else if (h === "开始剧情") {
                contentStr = '<div class="fc1-start-wrap">' +
                    '<div class="fc1-region-title">\u2756 开始剧情 \u2756</div>' +
                    '<div class="fc1-start-mode">' +
                        '<button id="fc1-start-auto-btn" class="fc1-start-mode-btn" onclick="fc1SelectStartMode(\'auto\')">方式一：自动生成开场白</button>' +
                        '<button id="fc1-start-manual-btn" class="fc1-start-mode-btn" onclick="fc1SelectStartMode(\'manual\')">方式二：自定义开局</button>' +
                    '</div>' +
                    '<div class="fc1-start-panel" id="fc1-start-auto-panel" style="display:none;">' +
                        '<div class="fc1-start-label">将发送的提示词：</div>' +
                        '<div class="fc1-start-preview" id="fc1-start-preview"></div>' +
                    '</div>' +
                    '<div class="fc1-start-panel" id="fc1-start-manual-panel" style="display:none;">' +
                        '<div class="fc1-start-label">填写你的开局内容：</div>' +
                        '<textarea class="fc1-start-manual" id="fc1-start-manual-text" placeholder="在此填写自定义开局，发送时仍会附带变量"></textarea>' +
                    '</div>' +
                    '<button class="start-game-btn" onclick="fc1StartGame()">\u2728 开始自由模式 \u2728</button>' +
                '</div>';
            }
            else if (h === "世界观概览" && tabId === 'FH1') {
                contentStr = '<div class="fc1-overview">' +
                    '<div class="fc1-overview-title">\u2727 本子世界 \u2727</div>' +
                    '<div class="fc1-overview-text">' +
                        '<p>这是一个由各种色情化的世界观与规则组成的世界。你可以随心所欲地游玩——挑一套世界观、改几条规则，世界便随之改变。</p>' +
                        '<p>开局前先在「世界观」里挑一套；游玩中还可以在状态栏里继续调整。</p>' +
                    '</div>' +
                    '<button class="fc1-continue-btn" onclick="goToSubTab(\'FH1\',\'FH1-sub2\')">\u25B6 进入本子世界</button>' +
                '</div>';
            }
            else if (h === "世界观" && tabId === 'FH1') {
                contentStr = '<div class="fh1-wv-wrap"><div class="fh1-wv-list" id="fh1-wv-list"></div></div>';
            }
            else if (h === "特殊规则" && tabId === 'FH1') {
                contentStr = '<div class="fh1-rules-wrap">' +
                    '<div class="fh1-rules-gate" id="fh1-rules-gate"></div>' +
                    '<div class="fh1-rules-body" id="fh1-rules-body" style="display:none;">' +
                        '<div class="fh1-empty">特殊规则 · 待编写</div>' +
                    '</div>' +
                '</div>';
            }
            else if (h === "开局选择" && tabId === 'FH1') {
                contentStr = '<div class="fh1-start-wrap"><div class="fh1-start-list" id="fh1-start-list"></div></div>';
            }
            else if (h === "世界观概览") {
                contentStr = '<div class="fc1-overview">' +
                    '<div class="fc1-overview-title">\u2727 开拓新大陆与殖民贸易 \u2727</div>' +
                    '<div class="fc1-overview-text">' +
                        '<p>十七世纪至十八世纪（1600—1800），大西洋上的三角贸易如日中天：欧洲母国的制成品、军火与朗姆酒运往西非，换取深色奴横渡大西洋运往美洲，再以糖、烟草、棉花满载而归。</p>' +
                        '<p>这是一片由风帆、火器、银元与胆识主宰的海域。你将以自由之身，或逐利海上、或经营种植园、或穿行于奴隶市场，凭一己之力在这殖民时代立足。</p>' +
                    '</div>' +
                    '<div class="fc1-music-row">' +
                        '<button class="fc1-music-btn" id="fc1-music-btn" onclick="toggleMusic()" title="播放 / 暂停背景音乐">\u266A</button>' +
                    '</div>' +
                    '<button class="fc1-continue-btn" onclick="goToSubTab(\'' + tabId + '\', \'' + tabId + '-sub2\')">\u25B6 继 续</button>' +
                '</div>';
            }
            else if (h === "区域选择") {
                contentStr = '<div class="fc1-region-wrap">' +
                    '<div class="fc1-region-title">\u2756 选择你的起始之地 \u2756</div>' +
                    '<div class="fc1-carousel">' +
                        '<button class="fc1-arrow fc1-arrow-left" onclick="fc1PrevRegion()" title="上一个地区">' +
                            '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</button>' +
                        '<div class="fc1-carousel-view" id="fc1-carousel-view"></div>' +
                        '<button class="fc1-arrow fc1-arrow-right" onclick="fc1NextRegion()" title="下一个地区">' +
                            '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 5 L16 12 L9 19" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>';
            }
            else if (h === "角色背景") {
                contentStr = '<div class="fc1-char-wrap">' +
                    '<div class="fc1-char-top">' +
                        '<div class="fc1-area fc1-area-1">' +
                            '<div class="fc1-area-title">\u2756 基础设定 \u2756</div>' +
                            '<div class="fc1-area1-inner">' +
                                '<div class="fc1-field-block"><div class="fc1-field-label-center">性别</div><select id="fc1-gender-select" class="fc1-gender-select" onchange="fc1SelectGender(this.value)"><option value="">请选择</option><option value="男性">男性</option><option value="伊芙">伊芙</option><option value="伊菈">伊菈</option></select></div>' +
                                '<div class="fc1-field-block"><div class="fc1-field-label-center">身份</div><input type="text" id="fc1-identity-input" class="fc1-identity-input" placeholder="选择下方身份组或自行填写" oninput="fc1OnIdentityInput(this.value)"></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="fc1-area fc1-area-2">' +
                            '<div class="fc1-area-title fc1-area-title-setting">\u2756 自定义设定（写入世界书） \u2756</div>' +
                            '<button class="fc1-goto-char-btn" onclick="gotoCharFromFC1()">\u2756 前往角色界面 \u2756</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="fc1-setting-popup" id="fc1-setting-popup" style="display:none;">' +
                        '<div class="fc1-setting-popup-header"><span class="fc1-area-title" id="fc1-popup-title">世界书条目设定</span><button class="fc1-area3-close" onclick="fc1ClosePopup()">\u2715 关闭</button></div>' +
                        '<div class="fc1-setting-popup-body" id="fc1-setting-popup-body"></div>' +
                    '</div>' +
                    '<div class="fc1-area fc1-area-4">' +
                        '<div class="fc1-area-title">\u2756 身份组设定 \u2756</div>' +
                        '<div class="fc1-identity-list" id="fc1-identity-list"></div>' +
                    '</div>' +
                '</div>';
            }
            else if (h === "初始设定") {
                contentStr = '<div class="fc1-init-wrap" id="fc1-init-root"></div>';
            }

            panelsHTML += '<div id="' + thisSubId + '" class="sub-panel ' + isSubActive + '">' + contentStr + '</div>';
        });

        panelsHTML += '</div>';
        tabNode.innerHTML = headerHTML + panelsHTML;
        container.insertBefore(tabNode, refNodeTab7);

        if (tabId === 'FC1') { fc1InitCharacterBackground(); }
        if (tabId === 'FH1' && typeof fh1InitOverview === 'function') { fh1InitOverview(); }

        if (tabId === 'tab5' || tabId === 'tab6') {
            tabNode.classList.add('is-edit-mode');
            tabNode.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
        }
    });

    // 绑定开始剧情按钮
    document.querySelectorAll('.start-game-btn').forEach(function(btn) {
        if(!btn.getAttribute('data-tid')) return;

        btn.addEventListener('click', async function(e) {
            var tid = this.getAttribute('data-tid');
            if(!tid) return;

            var pContainer = document.getElementById(tid);
            var baseFullData = JSON.parse(JSON.stringify(originalDataCache[tid]));

            pContainer.querySelectorAll('[data-path]').forEach(function(el) {
                var paths = el.getAttribute('data-path').split('.');
                var currentObj = baseFullData;
                for (var i = 0; i < paths.length - 1; i++) {
                    if (currentObj[paths[i]] === undefined) currentObj[paths[i]] = {};
                    currentObj = currentObj[paths[i]];
                }
                currentObj[paths[paths.length - 1]] = window.extractMdFromNode(el).trim();
            });

            pContainer.querySelectorAll('[data-dict]').forEach(function(dictBox) {
                var paths = dictBox.getAttribute('data-dict').split('.');
                var currentObj = baseFullData;
                for(var i = 0; i < paths.length - 1; i++) currentObj = currentObj[paths[i]];
                var targetName = paths[paths.length - 1];
                var dynamicDict = {};
                var ignoreKeys = ["新增民俗风情", "相关民俗传闻", "空空如也", "新增物品", "- 行囊空空如也 -", "- 前路尚未明晰 -", "新增地域"];
                dictBox.querySelectorAll(':scope > [data-ditem]').forEach(function(item) {
                    var kNode = item.querySelector('[data-dkey]');
                    var vNode = item.querySelector('[data-dval]');
                    if(kNode && vNode) {
                        var k = window.extractMdFromNode(kNode).trim();
                        var v = window.extractMdFromNode(vNode).trim();
                        if(k !== "" && ignoreKeys.indexOf(k) === -1 && k.indexOf("阶段") === -1) { dynamicDict[k] = v; }
                    }
                });
                currentObj[targetName] = dynamicDict;
            });

            pContainer.querySelectorAll('[data-complex-dict]').forEach(function(dictBox) {
                var paths = dictBox.getAttribute('data-complex-dict').split('.');
                var currentObj = baseFullData;
                for(var i = 0; i < paths.length - 1; i++) currentObj = currentObj[paths[i]];
                var targetName = paths[paths.length - 1];
                var dynamicDict = {};
                dictBox.querySelectorAll(':scope > [data-citem]').forEach(function(item) {
                    var ckNode = item.querySelector('[data-ckey]');
                    if(ckNode) {
                        var k = window.extractMdFromNode(ckNode).trim();
                        if(k !== "" && k !== "- 前路尚未明晰 -") {
                            var sObj = {};
                            item.querySelectorAll('.custom-row').forEach(function(row) {
                                var snode = row.querySelector('[data-skey]');
                                var vnode = row.querySelector('[data-sval]');
                                if(snode && vnode) {
                                    var sn = window.extractMdFromNode(snode).trim();
                                    var sv = window.extractMdFromNode(vnode).trim();
                                    if(sn) sObj[sn] = sv;
                                }
                            });
                            dynamicDict[k] = sObj;
                        }
                    }
                });
                currentObj[targetName] = dynamicDict;
            });

            var rCont = pContainer.querySelector('[data-region-container]');
            if(rCont) {
                var reDataDict = {};
                var ignoreCustomKeys = ["增添民俗风情", "相关描述", "新增民俗风情"];
                rCont.querySelectorAll('.area-item').forEach(function(ae) {
                    var rnEl = ae.querySelector('.region-name');
                    if(!rnEl) return;
                    var rn = window.extractMdFromNode(rnEl).trim();
                    if(rn && rn !== "新增地域" && rn !== "新的地域") {
                        var rdescEl = ae.querySelector('.region-desc');
                        var rdesc = rdescEl ? window.extractMdFromNode(rdescEl).trim() : "";
                        var rcustom = {};
                        ae.querySelectorAll('.custom-item, .custom-row').forEach(function(ce) {
                            var ckEl = ce.querySelector('.custom-key') || ce.querySelector('[data-dkey]');
                            var cvEl = ce.querySelector('.custom-val') || ce.querySelector('[data-dval]');
                            if(ckEl && cvEl && !ce.querySelector('[data-skey]')) {
                                var ckt = window.extractMdFromNode(ckEl).trim();
                                var cvt = window.extractMdFromNode(cvEl).trim();
                                if(ckt !== "" && ignoreCustomKeys.indexOf(ckt) === -1) rcustom[ckt] = cvt;
                            }
                        });
                        reDataDict[rn] = { "描述": rdesc, "民俗风情": rcustom };
                    }
                });
                baseFullData.variable["背景信息"] = { "地区": reDataDict };
            }

            var agreeRun = await showCustomConfirm("即将开始剧情");
            if (agreeRun) {
                baseFullData.variable.setting = baseFullData.variable.setting || {};
                baseFullData.variable.setting.worldview = __currentWorldviewId;
                baseFullData.variable.setting.mode = __currentMode;
                var storyHeadlines = baseFullData.story.startContent || "";
                triggerSTSlashSend(storyHeadlines, baseFullData.variable);
            }
        });
    });
}

// ===== 角色切换函数 =====
window.switchCharProfile = function(btn, tabId) {
    var panel = btn.closest('.tab-panel');
    var profName = btn.getAttribute('data-char');
    if (!profName) return;

    var dm = tabsDataMap[tabId];
    if (!dm) return;
    var vd = dm.data.variable;
    var cs = vd.characterSelect;
    if (!cs || !vd.profiles || !vd.profiles[profName]) return;

    // 更新选中状态
    cs.active = profName;

    // 从 profiles 复制到顶层 variable
    var prof = vd.profiles[profName];
    vd.world.date = prof.world.date;
    vd.world.time = prof.world.time;
    vd.world.position = prof.world.position;
    vd.user.identity = prof.user.identity;
    vd.user.gender = prof.user.gender;
    vd.user.body_state = prof.user.body_state;
    vd.user.surroundings = prof.user.surroundings;
    vd.user.psychological_description = prof.user.psychological_description;
    vd.user.inventory = JSON.parse(JSON.stringify(prof.user.inventory || {}));

    // 同步到 originalDataCache（开始游戏时从此处读取）
    if (originalDataCache[tabId]) {
        var oc = originalDataCache[tabId].variable;
        oc.world.date = vd.world.date;
        oc.world.time = vd.world.time;
        oc.world.position = vd.world.position;
        oc.user.identity = vd.user.identity;
        oc.user.gender = vd.user.gender;
        oc.user.body_state = vd.user.body_state;
        oc.user.surroundings = vd.user.surroundings;
        oc.user.psychological_description = vd.user.psychological_description;
        oc.user.inventory = JSON.parse(JSON.stringify(vd.user.inventory));
    }

    // 更新按钮样式
    panel.querySelectorAll('.char-select-btn').forEach(function(b) {
        b.classList.remove('active');
        b.style.border = '1px solid rgba(212,175,55,0.4)';
        b.style.background = 'rgba(253,246,227,0.3)';
        b.style.fontWeight = 'normal';
    });
    btn.classList.add('active');
    btn.style.border = '1px solid var(--color-primary-dark)';
    btn.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(253,246,227,0.6))';
    btn.style.fontWeight = 'bold';

    // 更新 DOM 中的可编辑字段
    var fields = {
        'variable.world.date': vd.world.date,
        'variable.world.time': vd.world.time,
        'variable.world.position': vd.world.position,
        'variable.user.identity': vd.user.identity,
        'variable.user.gender': vd.user.gender,
        'variable.user.body_state': vd.user.body_state,
        'variable.user.surroundings': vd.user.surroundings,
        'variable.user.psychological_description': vd.user.psychological_description
    };
    panel.querySelectorAll('[data-path]').forEach(function(el) {
        var p = el.getAttribute('data-path');
        if (fields[p] !== undefined) {
            el.innerHTML = mtH(fields[p]);
        }
    });

    // 重新渲染行囊
    var invUl = panel.querySelector('[data-dict="variable.user.inventory"]');
    if (invUl) {
        invUl.innerHTML = generateInventoryList(vd.user.inventory || {});
    }
};

// ===== 页面启动入口 =====
window.addEventListener('DOMContentLoaded', function() {
    // 静态页（前言/鸣谢）的 Markdown 立刻渲染，不等资源加载。
    // 原先这一步放在 initDynamicTabs().then() 里，要等 7 次远程 fetch 结束才跑，
    // 于是这两页会长时间显示裸的「#」和错误的字号。
    ['tab1', 'tab2'].forEach(function(tid) {
        var panelElem = document.getElementById(tid);
        if (panelElem && typeof window.safeRenderMdOnNodes === 'function') window.safeRenderMdOnNodes(panelElem);
    });

    initDynamicTabs().then(function() {
        populateCharSelectors();
        refreshCharManager();
    });

    // 图片悬浮预览
    var previewContainer = document.createElement('div');
    previewContainer.id = 'global-img-preview';
    var previewImg = document.createElement('img');
    previewContainer.appendChild(previewImg);
    document.body.appendChild(previewContainer);

    document.querySelectorAll('.toc-img-card').forEach(function(card) {
        var frameImg = card.querySelector('.toc-img-frame img');
        card.addEventListener('mousemove', function(e) {
            if (frameImg && frameImg.style.opacity === "1" && frameImg.getAttribute('src')) {
                previewImg.src = frameImg.getAttribute('src');
                previewContainer.classList.add('active');
                var boxW = previewContainer.offsetWidth || 200;
                var boxH = previewContainer.offsetHeight || (boxW * 16 / 9 + 10);
                var left = e.clientX + 20, top = e.clientY + 20;
                if (left + boxW > window.innerWidth) left = e.clientX - boxW - 20;
                if (top + boxH > window.innerHeight) top = e.clientY - boxH - 20;
                previewContainer.style.left = left + 'px';
                previewContainer.style.top = top + 'px';
            }
        });
        card.addEventListener('mouseleave', function() { previewContainer.classList.remove('active'); });
    });
});

// ===== 脉络式时间线系统 =====
var __timelineTabId = '';
var __timelineData = {};
var __timelineAllOpen = false;
var __timelineScrollTimer = null;

window.switchStoryView = function(tabId, mode, btn) {
    var subPanel = btn.closest('.sub-panel');
    if (!subPanel) return;

    var allBtns = btn.parentElement.querySelectorAll('.view-mode-btn');
    allBtns.forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    __timelineTabId = tabId;
    __timelineData = originalDataCache[tabId] ? (originalDataCache[tabId].variable['\u5267\u60C5\u7EBF'] || {}) : {};

    // 直接用 data 选择器找到剧情阶段列表和用户偏好
    var ul = subPanel.querySelector('ul[data-complex-dict="variable.\u5267\u60C5\u7EBF"]');
    var addBtn = ul ? ul.nextElementSibling : null;
    if (addBtn && !addBtn.classList.contains('add-custom-btn')) addBtn = null;

    // 也找到用户偏好区域
    var guideBlock = subPanel.querySelector('.data-block:last-of-type');
    var guideUI = guideBlock ? guideBlock.querySelector('ul[data-dict]') : null;
    var guideAddBtn = guideBlock ? guideBlock.querySelector('.add-custom-btn') : null;
    var guideTitle = guideBlock ? guideBlock.querySelector('.data-field-title') : null;

    if (mode === 'timeline') {
        if (ul) {
            if (!document.getElementById('timeline-prompt-' + tabId)) {
                var prompt = document.createElement('div');
                prompt.id = 'timeline-prompt-' + tabId;
                prompt.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;margin-top:10px;';
                prompt.innerHTML = '<p style="color:var(--color-accent);font-size:0.9rem;margin-bottom:16px;">建议手机端竖屏查看</p>' +
                    '<button onclick="openTimelineOverlay()" style="background:linear-gradient(135deg,var(--color-primary) 0%,var(--color-primary-dark) 100%);color:#1a0f2e;font-family:\'Ma Shan Zheng\',cursive;font-size:1.4rem;border:none;border-radius:8px;padding:14px 40px;cursor:pointer;box-shadow:0 4px 15px rgba(212,175,55,0.4);transition:all 0.3s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">\u2726 \u70B9\u51FB\u67E5\u770B\u8109\u7EDC \u2726</button>';
                ul.parentNode.insertBefore(prompt, ul.nextSibling);
            }
            ul.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
        }
        // 隐藏用户偏好区域（标题+列表+按钮）
        if (guideTitle) guideTitle.style.display = 'none';
        if (guideUI) guideUI.style.display = 'none';
        if (guideAddBtn) guideAddBtn.style.display = 'none';
    } else {
        var prompt = document.getElementById('timeline-prompt-' + tabId);
        if (ul) ul.style.display = '';
        if (addBtn) addBtn.style.display = '';
        if (prompt) prompt.remove();
        // 恢复用户偏好
        if (guideTitle) guideTitle.style.display = '';
        if (guideUI) guideUI.style.display = '';
        if (guideAddBtn) guideAddBtn.style.display = '';
    }
};

function openTimelineOverlay() {
    __timelineAllOpen = false;
    // 清除上一轮的卡片缓存，避免跨 tab 残留
    closeInfoCards();
    var overlay = document.getElementById('timeline-overlay');
    document.getElementById('timeline-init-screen').style.display = '';
    document.getElementById('timeline-canvas').style.display = 'none';
    overlay.classList.add('active');
    renderTimelineNodes();

    // 同步编辑模式开关状态
    var tabEl = document.getElementById(__timelineTabId);
    var tlChk = document.getElementById('timeline-edit-chk');
    if (tabEl && tlChk) {
        tlChk.checked = tabEl.classList.contains('is-edit-mode');
    }
    _updateSaveBtn(tabEl && tabEl.classList.contains('is-edit-mode'));

    // 请求浏览器全屏
    var el = overlay;
    if (el.requestFullscreen) {
        el.requestFullscreen().catch(function() {});
    } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
    }
}

window.closeTimeline = function() {
    closeInfoCards();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    document.getElementById('timeline-overlay').classList.remove('active');
};

// 监听 ESC 或系统退出全屏时同步关闭覆盖层
document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        closeInfoCards();
        document.getElementById('timeline-overlay').classList.remove('active');
    }
});
document.addEventListener('webkitfullscreenchange', function() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        closeInfoCards();
        document.getElementById('timeline-overlay').classList.remove('active');
    }
});

window.startTimeline = function() {
    document.getElementById('timeline-init-screen').style.display = 'none';
    document.getElementById('timeline-canvas').style.display = '';
    setupTimelineDrag();
    renderTimelineNodes();
    var tabEl = document.getElementById(__timelineTabId);
    _updateSaveBtn(tabEl && tabEl.classList.contains('is-edit-mode'));
};

// 脉络式内的编辑模式开关（与外部同步）
window.toggleTimelineEditMode = function(chkEl) {
    var tabEl = document.getElementById(__timelineTabId);
    if (!tabEl) return;
    var isChecked = chkEl.checked;

    // 找到外部 tab 的编辑开关
    var outerChk = tabEl.querySelector('.edit-switch-container input[type="checkbox"]');
    if (outerChk && outerChk.checked !== isChecked) {
        outerChk.checked = isChecked;
        window.toggleEditMode(outerChk, __timelineTabId);
    } else if (!outerChk) {
        // 外部没有开关时直接操作
        if (isChecked) {
            tabEl.classList.add('is-edit-mode');
            tabEl.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
        } else {
            tabEl.classList.remove('is-edit-mode');
            tabEl.querySelectorAll('.editable-field').forEach(function(el) { el.removeAttribute('contenteditable'); });
        }
    }

    // 刷新所有已打开卡片的编辑状态（保持变暗/亮起不变）
    _refreshAllCardsEditMode(isChecked);
    _updateSaveBtn(isChecked);
};

// ===== 桌面端鼠标拖拽滚动 =====
var __timelineDragging = false;
var __timelineStartX = 0;
var __timelineScrollLeft = 0;

function setupTimelineDrag() {
    var canvas = document.getElementById('timeline-canvas');
    if (!canvas || canvas.dataset.dragReady) return;
    canvas.dataset.dragReady = '1';

    canvas.addEventListener('mousedown', function(e) {
        if (e.target.closest && e.target.closest('.timeline-node')) return;
        closeInfoCards();
        __timelineDragging = true;
        __timelineStartX = e.pageX - canvas.offsetLeft;
        __timelineScrollLeft = canvas.scrollLeft;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    });

    // 手机端触摸：节点/卡片区域外的触摸关闭卡片；仅在中心横带内允许滑动
    canvas.addEventListener('touchstart', function(e) {
        var t = e.touches[0];
        var touchY = t.clientY - canvas.getBoundingClientRect().top;
        var canvasH = canvas.clientHeight;
        var bandMid = canvasH * 0.5;
        var bandHalf = canvasH * 0.2;

        if (e.target.closest && (e.target.closest('.timeline-node') || e.target.closest('.timeline-info-card'))) return;
        closeInfoCards();

        // 仅在节点横带范围内允许原生横向滑动
        if (touchY < bandMid - bandHalf || touchY > bandMid + bandHalf) {
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('mousemove', function(e) {
        if (!__timelineDragging) return;
        var canvas = document.getElementById('timeline-canvas');
        var x = e.pageX - canvas.offsetLeft;
        var walk = (x - __timelineStartX) * 1.5;
        canvas.scrollLeft = __timelineScrollLeft - walk;
    });

    window.addEventListener('mouseup', function() {
        if (__timelineDragging) {
            __timelineDragging = false;
            var canvas = document.getElementById('timeline-canvas');
            if (canvas) canvas.style.cursor = 'grab';
            updateNodeVisibility();
            _snapToNearestNode();
        }
    });

    // 手机端松手后吸附到最近节点
    canvas.addEventListener('touchend', function() {
        setTimeout(_snapToNearestNode, 60);
    });

    canvas.addEventListener('scroll', function() {
        if (!__timelineDragging) {
            if (__timelineScrollTimer) clearTimeout(__timelineScrollTimer);
            __timelineScrollTimer = setTimeout(updateNodeVisibility, 80);
        }
    });
}

function renderTimelineNodes() {
    closeInfoCards();
    var container = document.getElementById('timeline-nodes');
    if (!container) return;
    container.innerHTML = '';
    var keys = Object.keys(__timelineData);
    if (keys.length === 0) {
        container.innerHTML = '<div style="color:var(--color-text-light); padding:40px; font-size:1.2rem;">暂无剧情阶段数据</div>';
        return;
    }

    keys.forEach(function(key) {
        var node = document.createElement('div');
        node.className = 'timeline-node';
        node.textContent = key;
        node.addEventListener('click', function(e) {
            e.stopPropagation();
            showTimelinePopup(key, __timelineData[key]);
        });
        container.appendChild(node);
    });

    updateNodeVisibility();
}

function _snapToNearestNode() {
    var canvas = document.getElementById('timeline-canvas');
    if (!canvas || canvas.style.display === 'none') return;
    if (window.innerWidth > 768) return; // 仅手机端
    var nodes = document.querySelectorAll('.timeline-node');
    if (nodes.length === 0) return;
    var canvasRect = canvas.getBoundingClientRect();
    var centerX = canvasRect.left + canvasRect.width / 2;
    var closest = null, closestDist = Infinity;
    nodes.forEach(function(n) {
        var r = n.getBoundingClientRect();
        var dist = Math.abs(r.left + r.width / 2 - centerX);
        if (dist < closestDist) { closestDist = dist; closest = n; }
    });
    if (closest) {
        var r = closest.getBoundingClientRect();
        var target = canvas.scrollLeft + (r.left + r.width / 2) - centerX;
        target = Math.max(0, target);
        canvas.scrollTo({ left: target, behavior: 'smooth' });
    }
}

function updateNodeVisibility() {
    if (__timelineAllOpen) return;
    var canvas = document.getElementById('timeline-canvas');
    if (canvas.style.display === 'none') return;
    var nodes = document.querySelectorAll('.timeline-node');
    var canvasRect = canvas.getBoundingClientRect();
    var centerX = canvasRect.left + canvasRect.width / 2;

    if (window.innerWidth <= 768) {
        // 手机端：始终展开离中心最近的5个节点，其余缩成圆球
        var ranked = Array.from(nodes).map(function(node) {
            var r = node.getBoundingClientRect();
            return { node: node, dist: Math.abs(r.left + r.width / 2 - centerX) };
        });
        ranked.sort(function(a, b) { return a.dist - b.dist; });
        ranked.forEach(function(item, idx) {
            if (idx < 5) {
                item.node.classList.remove('shrunk');
                item.node.classList.add('expand-all');
            } else {
                item.node.classList.add('shrunk');
                item.node.classList.remove('expand-all');
            }
        });
    } else {
        nodes.forEach(function(node) {
            var rect = node.getBoundingClientRect();
            var nodeCenterX = rect.left + rect.width / 2;
            var distance = Math.abs(nodeCenterX - centerX);
            var threshold = canvasRect.width * 0.35;
            if (distance > threshold) {
                node.classList.add('shrunk');
                node.classList.remove('expand-all');
            } else {
                node.classList.remove('shrunk');
                node.classList.add('expand-all');
            }
        });
    }
}

window.toggleTimelineExpand = function() {
    __timelineAllOpen = !__timelineAllOpen;
    var btn = document.getElementById('timeline-expand-btn');
    var nodes = document.querySelectorAll('.timeline-node');
    if (__timelineAllOpen) {
        btn.textContent = '\u26F6 \u6536\u8D77';
        nodes.forEach(function(n) { n.classList.remove('shrunk'); n.classList.add('expand-all'); });
    } else {
        btn.textContent = '\u26F6 \u5168\u5F00';
        nodes.forEach(function(n) { n.classList.remove('expand-all'); });
        updateNodeVisibility();
    }
};

var __cardSets = {};
var __infoCardsDirty = false;
var __infoCardsStageName = '';

function _buildTimelineCard(label, content, isEdit, fieldName, stageName) {
    var card = document.createElement('div');
    card.className = 'timeline-info-card';
    var hdr = document.createElement('div');
    hdr.className = 'timeline-info-card-header';
    var lblSpan = document.createElement('span');
    lblSpan.textContent = label;
    hdr.appendChild(lblSpan);
    var expBtn = document.createElement('button');
    expBtn.className = 'info-card-expand';
    expBtn.textContent = '\u26F6';
    expBtn.title = '\u653E\u5927\u67E5\u770B/\u7F16\u8F91';
    expBtn.setAttribute('type', 'button');
    expBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-family:inherit;';
    var doZoom = function(e) { e.stopPropagation(); e.preventDefault(); openZoomCard(stageName, fieldName, label); };
    expBtn.addEventListener('click', doZoom);
    expBtn.addEventListener('touchend', doZoom);
    hdr.appendChild(expBtn);
    card.appendChild(hdr);
    var bd = document.createElement('div');
    bd.className = 'timeline-info-card-body';
    if (isEdit) {
        bd.innerHTML = '<div class="editable-field timeline-info-card-body" contenteditable="true" data-field="' + fieldName + '" oninput="__cardSets[\'' + stageName + '\'].dirty=true" style="border:1px solid rgba(184,134,11,0.3);border-radius:3px;padding:2px 6px;min-height:2em;max-width:100%;box-sizing:border-box;overflow-x:hidden;word-wrap:break-word;">' + content + '</div>';
    } else {
        bd.textContent = content;
    }
    card.appendChild(bd);
    card.onmousedown = function(e) { e.stopPropagation(); };
    return card;
}

function _buildConnectorLine(x1, y1, x2, y2) {
    var outer = document.createElement('div');
    outer.className = 'timeline-connector-line';
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    var deg = Math.atan2(dy, dx) * 180 / Math.PI;
    outer.style.left = x1 + 'px';
    outer.style.top  = y1 + 'px';
    outer.style.transform = 'rotate(' + deg + 'deg)';

    var inner = document.createElement('div');
    inner.className = 'timeline-connector-line-inner';
    inner.style.width = len + 'px';
    outer.appendChild(inner);

    return outer;
}

window.showGuidancePopup = function() {
    var guideData = originalDataCache[__timelineTabId] ? (originalDataCache[__timelineTabId].variable['\u7528\u6237\u504F\u597D'] || {}) : {};
    var keys = Object.keys(guideData);
    var text = '';
    if (keys.length === 0) {
        text = '\u6682\u65E0\u7528\u6237\u504F\u597D';
    } else {
        keys.forEach(function(k) {
            text += '\u25C6 ' + k + '\n' + (guideData[k] || '') + '\n\n';
        });
    }
    document.getElementById('zoomCardTitle').textContent = '\u7528\u6237\u504F\u597D';
    var bodyBox = document.getElementById('zoomCardBody');
    bodyBox.removeAttribute('contenteditable');
    bodyBox.className = 'zoom-card-body';
    bodyBox.textContent = text;
    document.getElementById('zoomCardFooter').style.display = 'none';
    document.getElementById('zoomCardOverlay').classList.add('active');
};

window.showTimelinePopup = function(stageName, stageData) {
    var desc  = (stageData && stageData['\u63CF\u8FF0'])     ? stageData['\u63CF\u8FF0']     : '\u65E0';
    var cond  = (stageData && stageData['\u89E6\u53D1\u6761\u4EF6']) ? stageData['\u89E6\u53D1\u6761\u4EF6'] : '\u65E0';
    var guide = (stageData && stageData['\u9636\u6BB5\u6307\u5BFC']) ? stageData['\u9636\u6BB5\u6307\u5BFC'] : '\u65E0';

    var tabEl = document.getElementById(__timelineTabId);
    var isEdit = tabEl && tabEl.classList.contains('is-edit-mode');
    __infoCardsStageName = stageName;

    // 如果该节点的卡片已激活且仍在 DOM 中，不做任何事
    if (__cardSets[stageName] && __cardSets[stageName].cards[0] &&
        document.body.contains(__cardSets[stageName].cards[0]) &&
        !__cardSets[stageName].cards[0].classList.contains('dimmed')) return;

    var canvas = document.getElementById('timeline-canvas');
    var targetNode = null;
    document.querySelectorAll('.timeline-node').forEach(function(n) {
        if (n.textContent.trim() === stageName) targetNode = n;
    });
    if (!targetNode) return;

    var nodeRect = targetNode.getBoundingClientRect();
    var canvasRect = canvas.getBoundingClientRect();
    var scrollLeft = canvas.scrollLeft;

    var nodeX = nodeRect.left - canvasRect.left + scrollLeft;
    var nodeY = nodeRect.top - canvasRect.top;
    var nodeW = nodeRect.width, nodeH = nodeRect.height;
    var nodeCX = nodeX + nodeW / 2;

    var isMobile = window.innerWidth <= 768;
    var cardW = isMobile ? Math.min(window.innerWidth * 0.82, 300) : 210;
    var gap = 16, margin = isMobile ? 75 : 280;
    var totalW = cardW * 3 + gap * 2;
    var startX = isMobile ? (nodeCX - cardW / 2) : (nodeX + nodeW / 2 - totalW / 2);
    // 手机端若节点太靠近顶部，强制所有卡片放下方
    var forceBelow = isMobile && nodeY < 300;

    function _getCardLayout(i) {
        var above;
        if (isMobile && forceBelow) {
            above = false;
        } else if (isMobile) {
            above = (i === 0); // 仅卡片0(描述)在上方，1+2在下方
        } else {
            above = (i !== 1);
        }
        var cx = isMobile ? startX : (i === 0 ? startX : (i === 1 ? startX + cardW + gap : startX + (cardW + gap) * 2));
        var lx = nodeCX;
        var ly = above ? nodeY : (nodeY + nodeH);
        var ccx = cx + cardW / 2;
        var hDist = ccx - nodeCX;
        var vertDist = Math.sqrt(Math.max(0, margin * margin - hDist * hDist));
        if (isNaN(vertDist)) vertDist = 0;
        var anchorY = above ? (ly - vertDist) : (ly + vertDist);
        return { x: cx, lineX: lx, lineY: ly, centerX: ccx, centerY: anchorY, above: above, anchorY: anchorY };
    }

    var cardLayouts = [_getCardLayout(0), _getCardLayout(1), _getCardLayout(2)];

    // 溢出调整（桌面端左右不出画布；手机端已居中无需调整）
    if (!isMobile) {
        var minX = 10, maxX = canvas.scrollWidth - totalW - 10;
        if (startX < minX) { var sh = minX - startX; startX += sh; cardLayouts.forEach(function(lo) { lo.x += sh; lo.centerX += sh; }); }
        else if (startX > maxX) { var sh = startX - maxX; startX -= sh; cardLayouts.forEach(function(lo) { lo.x -= sh; lo.centerX -= sh; }); }
    }

    // 变暗所有已有的卡片组（保留连线但变暗）
    Object.keys(__cardSets).forEach(function(k) {
        var s = __cardSets[k];
        s.cards.forEach(function(c) { c.classList.add('dimmed'); c.classList.remove('show'); });
        s.lines.forEach(function(l) { l.classList.add('dimmed'); });
        if (s.xBtn) s.xBtn.classList.remove('show');
    });

    // ---- 共享：测量卡片实际高度，修正位置，并据此生成连线端点 ----
    function _layoutCards(cards, layouts) {
        cards.forEach(function(c, i) {
            c.style.left = layouts[i].x + 'px';
            c.style.top = '0px';
            c.style.width = cardW + 'px';
            c.style.display = 'block';
            c.style.opacity = '0';
        });
        void cards[0].offsetHeight;
        var points = [];
        // 手机端纵向堆叠
        if (isMobile) {
            var gapM = 22;
            var h0 = cards[0].offsetHeight, h1 = cards[1].offsetHeight, h2 = cards[2].offsetHeight;

            if (forceBelow) {
                cardLayouts[0].above = false; cardLayouts[1].above = false; cardLayouts[2].above = false;
                cardLayouts[0].anchorY = nodeY + nodeH + margin; cardLayouts[0].centerY = cardLayouts[0].anchorY;
                cards[0].style.top = cardLayouts[0].anchorY + 'px';
                var btm0 = cardLayouts[0].anchorY + h0;
                cardLayouts[1].anchorY = btm0 + gapM; cardLayouts[1].centerY = cardLayouts[1].anchorY;
                cards[1].style.top = cardLayouts[1].anchorY + 'px';
                var btm1 = cardLayouts[1].anchorY + h1;
                cardLayouts[2].anchorY = btm1 + gapM; cardLayouts[2].centerY = cardLayouts[2].anchorY;
                cards[2].style.top = cardLayouts[2].anchorY + 'px';
            } else {
                // 卡片1(触发条件)下方、卡片2(阶段指导)紧贴1下方
                cards[1].style.top = cardLayouts[1].anchorY + 'px';
                var btm1b = cardLayouts[1].anchorY + h1;
                cardLayouts[2].anchorY = btm1b + gapM; cardLayouts[2].centerY = cardLayouts[2].anchorY;
                cardLayouts[2].above = false;
                cards[2].style.top = cardLayouts[2].anchorY + 'px';
            }

            // 限制卡片不超出屏幕上下（顶部留 bar 空间）
            cards.forEach(function(c, i) {
                c.style.opacity = '';
                var ct = parseFloat(c.style.top);
                if (ct < 60) c.style.top = '60px';
                var maxB = (window.innerHeight || document.documentElement.clientHeight) - 16;
                if (ct + c.offsetHeight > maxB) c.style.top = (maxB - c.offsetHeight) + 'px';
                var lo = cardLayouts[i];
                points.push({
                    x: c.offsetLeft + c.offsetWidth / 2,
                    y: lo.above ? (c.offsetTop + c.offsetHeight) : c.offsetTop
                });
            });
        } else {
            cards.forEach(function(c, i) {
                var lo = layouts[i];
                var realH = c.offsetHeight;
                c.style.top = (lo.above ? lo.anchorY - realH : lo.anchorY) + 'px';
                c.style.opacity = '';
                points.push({
                    x: c.offsetLeft + c.offsetWidth / 2,
                    y: lo.above ? c.offsetTop + realH : c.offsetTop
                });
            });
        }
        return points;
    }

    function _applyLines(lines, layouts, cardPoints) {
        lines.forEach(function(l, i) {
            var pt = cardPoints[i], lo = layouts[i];
            var dx = pt.x - lo.lineX, dy = pt.y - lo.lineY;
            l.style.left = lo.lineX + 'px';
            l.style.top  = lo.lineY + 'px';
            l.style.transform = 'rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI) + 'deg)';
            l.querySelector('.timeline-connector-line-inner').style.width = Math.sqrt(dx*dx + dy*dy) + 'px';
        });
    }
    // ----
    if (__cardSets[stageName]) {
        var set = __cardSets[stageName];
        // 测量实际高度并修正位置
        var cardPoints = _layoutCards(set.cards, cardLayouts);
        // 更新连线
        set.lines.forEach(function(l) { l.classList.remove('dimmed'); l.classList.add('show'); });
        _applyLines(set.lines, cardLayouts, cardPoints);
        // X 按钮
        if (set.xBtn) {
            var xMid = (cardLayouts[1].lineX + cardPoints[1].x) / 2;
            var yMid = (cardLayouts[1].lineY + cardPoints[1].y) / 2;
            set.xBtn.style.left = (xMid - 11) + 'px';
            set.xBtn.style.top  = (yMid - 11) + 'px';
        }
        requestAnimationFrame(function() {
            set.cards.forEach(function(c) { c.classList.remove('dimmed'); c.classList.add('show'); });
            if (set.xBtn) set.xBtn.classList.add('show');
        });
        set.dirty = false;
        __infoCardsDirty = false;

        if (isEdit !== set.isEdit) {
            set.isEdit = isEdit;
            set.cards.forEach(function(c, i) {
                var fieldName = i === 0 ? 'desc' : (i === 1 ? 'cond' : 'guide');
                var content = i === 0 ? desc : (i === 1 ? cond : guide);
                var bd = c.querySelector('.timeline-info-card-body');
                if (isEdit) {
                    bd.innerHTML = '<div class="editable-field timeline-info-card-body" contenteditable="true" data-field="' + fieldName + '" oninput="__cardSets[\'' + stageName + '\'].dirty=true" style="border:1px solid rgba(184,134,11,0.3);border-radius:3px;padding:2px 6px;min-height:2em;max-width:100%;box-sizing:border-box;overflow-x:hidden;word-wrap:break-word;">' + content + '</div>';
                } else {
                    bd.textContent = content;
                }
            });
            // 编辑模式切换后重新测量高度
            var pts2 = _layoutCards(set.cards, cardLayouts);
            _applyLines(set.lines, cardLayouts, pts2);
        }
        _updateSaveBtn(isEdit);
        return;
    }

    // 新建卡片和连线
    var newCards = [
        _buildTimelineCard('\u63CF\u8FF0', desc, isEdit, 'desc', stageName),
        _buildTimelineCard('\u89E6\u53D1\u6761\u4EF6', cond, isEdit, 'cond', stageName),
        _buildTimelineCard('\u9636\u6BB5\u6307\u5BFC', guide, isEdit, 'guide', stageName)
    ];

    newCards.forEach(function(c) { canvas.appendChild(c); });
    var cardPoints = _layoutCards(newCards, cardLayouts);

    var newLines = [];
    cardLayouts.forEach(function(lo) {
        var l = _buildConnectorLine(lo.lineX, lo.lineY, lo.centerX, lo.centerY);
        canvas.appendChild(l);
        newLines.push(l);
    });
    _applyLines(newLines, cardLayouts, cardPoints);

    var xBtn = document.createElement('div');
    xBtn.className = 'timeline-close-x';
    xBtn.textContent = '\u2715';
    xBtn.title = '\u5173\u95ED\u8BE5\u8282\u70B9\u5361\u7247';
    var xMid = (cardLayouts[1].lineX + cardPoints[1].x) / 2;
    var yMid = (cardLayouts[1].lineY + cardPoints[1].y) / 2;
    xBtn.style.left = (xMid - 11) + 'px';
    xBtn.style.top  = (yMid - 11) + 'px';
    xBtn.onclick = function(e) { e.stopPropagation(); _closeOneCardSet(stageName); };
    xBtn.onmousedown = function(e) { e.stopPropagation(); };
    canvas.appendChild(xBtn);

    __cardSets[stageName] = {
        cards: newCards, lines: newLines, xBtn: xBtn,
        stageName: stageName, isEdit: isEdit, dirty: false
    };
    __infoCardsDirty = false;

    requestAnimationFrame(function() {
        newCards.forEach(function(c) { c.classList.add('show'); });
        newLines.forEach(function(l) { l.classList.add('show'); });
        xBtn.classList.add('show');
    });

    _updateSaveBtn(isEdit);
};

function _updateSaveBtn(isEdit) {
    var btn = document.getElementById('timeline-save-btn');
    if (btn) btn.style.display = isEdit ? '' : 'none';
}

function _flashToast() {
    var btn = document.getElementById('timeline-save-btn');
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = '\u2714 \u5DF2\u4FDD\u5B58';
    btn.style.background = '#2d8a4e';
    btn.style.color = '#fff';
    clearTimeout(btn._ft);
    btn._ft = setTimeout(function() {
        btn.textContent = orig;
        btn.style.background = '';
        btn.style.color = '';
    }, 1500);
}

function _refreshAllCardsEditMode(isEdit) {
    Object.keys(__cardSets).forEach(function(key) {
        var set = __cardSets[key];
        if (!set.cards[0] || !document.body.contains(set.cards[0])) return;
        set.isEdit = isEdit;
        var data = __timelineData[key];
        if (!data) return;
        var fields = ['\u63CF\u8FF0', '\u89E6\u53D1\u6761\u4EF6', '\u9636\u6BB5\u6307\u5BFC'];
        var fieldKeys = ['desc', 'cond', 'guide'];
        set.cards.forEach(function(c, i) {
            var content = data[fields[i]] || '\u65E0';
            var bd = c.querySelector('.timeline-info-card-body');
            if (isEdit) {
                bd.innerHTML = '<div class="editable-field timeline-info-card-body" contenteditable="true" data-field="' + fieldKeys[i] + '" oninput="__cardSets[\'' + key + '\'].dirty=true" style="border:1px solid rgba(184,134,11,0.3);border-radius:3px;padding:2px 6px;min-height:2em;max-width:100%;box-sizing:border-box;overflow-x:hidden;word-wrap:break-word;">' + content + '</div>';
            } else {
                bd.textContent = content;
            }
        });
    });
}

function _closeOneCardSet(stageName) {
    var set = __cardSets[stageName];
    if (!set) return;
    set.cards.forEach(function(c) { c.remove(); });
    set.lines.forEach(function(l) { l.remove(); });
    if (set.xBtn) set.xBtn.remove();
    delete __cardSets[stageName];

    if (__infoCardsStageName === stageName) {
        __infoCardsDirty = false;
        __infoCardsStageName = '';
    }

    // 如果还有其他卡片组，亮起最近的一个
    var remaining = Object.keys(__cardSets);
    if (remaining.length > 0) {
        var lastKey = remaining[remaining.length - 1];
        var lastSet = __cardSets[lastKey];
        lastSet.cards.forEach(function(c) { c.classList.remove('dimmed'); c.classList.add('show'); });
        lastSet.lines.forEach(function(l) { l.classList.remove('dimmed'); l.classList.add('show'); });
        if (lastSet.xBtn) lastSet.xBtn.classList.add('show');
        lastSet.dirty = false;
        __infoCardsStageName = lastKey;
    }
}

var __zoomStageName = '', __zoomField = '';

window.openZoomCard = function(stageName, fieldName, label) {
    var set = __cardSets[stageName];
    if (!set) return;

    __zoomStageName = stageName;
    __zoomField = fieldName;

    var cardIdx = fieldName === 'desc' ? 0 : (fieldName === 'cond' ? 1 : 2);
    var card = set.cards[cardIdx];
    var bodyEl = card.querySelector('.timeline-info-card-body');
    var isEdit = set.isEdit;
    var content = bodyEl.textContent || bodyEl.innerText || '';

    document.getElementById('zoomCardTitle').textContent = label;
    var bodyBox = document.getElementById('zoomCardBody');
    if (isEdit) {
        bodyBox.innerHTML = '';
        bodyBox.setAttribute('contenteditable', 'true');
        bodyBox.className = 'zoom-card-body editable';
        bodyBox.textContent = content;
        document.getElementById('zoomCardFooter').style.display = 'flex';
    } else {
        bodyBox.removeAttribute('contenteditable');
        bodyBox.className = 'zoom-card-body';
        bodyBox.textContent = content;
        document.getElementById('zoomCardFooter').style.display = 'none';
    }
    document.getElementById('zoomCardOverlay').classList.add('active');
};

window.closeZoomCard = function(save) {
    if (save && __zoomStageName && __cardSets[__zoomStageName]) {
        var set = __cardSets[__zoomStageName];
        var cardIdx = __zoomField === 'desc' ? 0 : (__zoomField === 'cond' ? 1 : 2);
        var card = set.cards[cardIdx];
        var bodyEl = card.querySelector('.timeline-info-card-body');
        var zoomBody = document.getElementById('zoomCardBody');
        var newContent = zoomBody.textContent || zoomBody.innerText || '';
        if (set.isEdit) {
            bodyEl.innerHTML = '<div class="editable-field timeline-info-card-body" contenteditable="true" data-field="' + __zoomField + '" oninput="__cardSets[\'' + __zoomStageName + '\'].dirty=true" style="border:1px solid rgba(184,134,11,0.3);border-radius:3px;padding:2px 6px;min-height:2em;max-width:100%;box-sizing:border-box;overflow-x:hidden;word-wrap:break-word;">' + newContent + '</div>';
        } else {
            bodyEl.textContent = newContent;
        }
        set.dirty = true;
        __infoCardsDirty = true;
    }
    __zoomStageName = '';
    __zoomField = '';
    document.getElementById('zoomCardOverlay').classList.remove('active');
};

window.closeInfoCards = function() {
    Object.keys(__cardSets).forEach(function(k) {
        var set = __cardSets[k];
        set.cards.forEach(function(c) { c.remove(); });
        set.lines.forEach(function(l) { l.remove(); });
        if (set.xBtn) set.xBtn.remove();
        delete __cardSets[k];
    });
    __infoCardsDirty = false;
    __infoCardsStageName = '';
};

window.saveInfoCardEdit = function() {
    var stageName = __infoCardsStageName;
    if (!stageName || !__cardSets[stageName]) return;
    var tabEl = document.getElementById(__timelineTabId);
    if (!tabEl) return;

    var set = __cardSets[stageName];
    var newDesc  = (set.cards[0].querySelector('[data-field="desc"]')  || {}).innerText || set.cards[0].querySelector('[data-field="desc"]')  || { textContent: '' };
    var newCond  = (set.cards[1].querySelector('[data-field="cond"]')  || {}).innerText || set.cards[1].querySelector('[data-field="cond"]')  || { textContent: '' };
    var newGuide = (set.cards[2].querySelector('[data-field="guide"]') || {}).innerText || set.cards[2].querySelector('[data-field="guide"]') || { textContent: '' };
    newDesc  = (typeof newDesc  === 'string' ? newDesc  : (newDesc.textContent  || '')).trim();
    newCond  = (typeof newCond  === 'string' ? newCond  : (newCond.textContent  || '')).trim();
    newGuide = (typeof newGuide === 'string' ? newGuide : (newGuide.textContent || '')).trim();

    if (originalDataCache[__timelineTabId] && originalDataCache[__timelineTabId].variable['\u5267\u60C5\u7EBF']) {
        originalDataCache[__timelineTabId].variable['\u5267\u60C5\u7EBF'][stageName] = {
            '\u63CF\u8FF0': newDesc, '\u89E6\u53D1\u6761\u4EF6': newCond, '\u9636\u6BB5\u6307\u5BFC': newGuide
        };
    }

    var dictUl = tabEl.querySelector('ul[data-complex-dict]');
    if (dictUl) {
        dictUl.querySelectorAll('li[data-citem]').forEach(function(item) {
            var ckey = item.querySelector('[data-ckey]');
            if (ckey && ckey.textContent.trim() === stageName) {
                item.querySelectorAll('.custom-row').forEach(function(row) {
                    var sk = row.querySelector('[data-skey]'), sv = row.querySelector('[data-sval]');
                    if (sk && sv) {
                        var kt = sk.textContent.trim();
                        if (kt === '\u63CF\u8FF0') sv.innerHTML = mtH(newDesc);
                        else if (kt === '\u89E6\u53D1\u6761\u4EF6') sv.innerHTML = mtH(newCond);
                        else if (kt === '\u9636\u6BB5\u6307\u5BFC') sv.innerHTML = mtH(newGuide);
                    }
                });
            }
        });
    }

    set.dirty = false;
    _flashToast();
};
