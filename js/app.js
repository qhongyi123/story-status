// ===== 控制面板 =====
function renderControlPanelDynamicArea() {
    Object.keys(CONTROL_PANEL_CONFIG).forEach(function(panelId) {
        var conf = CONTROL_PANEL_CONFIG[panelId];
        var panelEl = document.getElementById(panelId);
        if(!panelEl) return;
        var itemsHtml = "";
        conf.items.forEach(function(it) {
            var checkedAttr = it.defaultChecked ? "checked" : "";
            itemsHtml +=
                '<div class="control-item-row">' +
                    '<div style="flex:1;">' +
                        '<div style="font-weight:bold; color:var(--color-primary-dark); font-size:1.05rem; margin-bottom:4px;">' + mtH(it.name) + '</div>' +
                        '<div style="font-size:0.85em; color:var(--color-text-dark); opacity:0.9;">' + mtH(it.desc) + '</div>' +
                    '</div>' +
                    '<div style="display:flex; align-items:center; margin-left:15px; flex-shrink:0;">' +
                        '<label class="switch-ui" style="transform:scale(1.1);">' +
                            '<input type="checkbox" id="' + it.id + '" class="cp-checkbox" onchange="handleControlPanelItemChange(\'' + panelId + '\', \'' + it.id + '\')" ' + checkedAttr + '>' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>';
        });
        panelEl.innerHTML =
            '<div class="cp-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px dashed rgba(212,175,55,0.4); padding-bottom:10px;">' +
                '<div style="font-style:italic; font-size:0.95em; color:#8b5a2b; font-weight:bold;">' +
                    '\u2756 ' + conf.title + ' \u2756 <br>' +
                    '<span style="font-weight:normal; font-size:0.8em; opacity:0.9; color:var(--color-text-dark);">部分界面只能单选，请注意</span>' +
                '</div>' +
            '</div>' +
            '<div style="flex:1; overflow-y:auto; padding-right:5px; margin-bottom:10px;" class="sub-panels-wrapper">' +
                itemsHtml +
            '</div>';
    });
}

function renderModeAndWorldviewPanel() {
    var panelEl = document.getElementById('tab4-sub1');
    if (!panelEl) return;

    var modeItemsHtml = "";
    [["script", "剧情模式"], ["free", "自由模式"]].forEach(function(m) {
        var isActive = (__currentMode === m[0]);
        modeItemsHtml +=
            '<div class="worldview-item' + (isActive ? ' active' : '') + '" data-mode-id="' + m[0] + '" onclick="selectMode(\'' + m[0] + '\')">' +
                '<span class="worldview-radio"></span>' +
                '<span class="worldview-name">' + m[1] + '</span>' +
            '</div>';
    });

    var wvItemsHtml = "";
    WORLDVIEWS.forEach(function(wv) {
        var isComingSoon = isWorldviewComingSoon(__currentMode, wv.id);
        var isCurrent = (wv.id === __currentWorldviewId) && !isComingSoon;
        var nameText = mtH(wv.name) + (isComingSoon ? '（敬请期待）' : '');
        var clickAttr = isComingSoon ? '' : ' onclick="selectWorldview(\'' + wv.id + '\')"';
        var itemCls = 'worldview-item' + (isCurrent ? ' active' : '') + (isComingSoon ? ' disabled' : '');
        wvItemsHtml +=
            '<div class="' + itemCls + '" data-wv-id="' + wv.id + '"' + clickAttr + '>' +
                '<span class="worldview-radio"></span>' +
                '<span class="worldview-name">' + nameText + '</span>' +
            '</div>';
    });

    panelEl.innerHTML =
        '<div class="cp-header-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px dashed rgba(212,175,55,0.4); padding-bottom:10px;">' +
            '<div style="font-style:italic; font-size:0.95em; color:#8b5a2b; font-weight:bold;">' +
                '\u2756 模式与世界观 \u2756 <br>' +
                '<span style="font-weight:normal; font-size:0.8em; opacity:0.9; color:var(--color-text-dark);">先选模式，再选世界观，按选择开关对应条目</span>' +
            '</div>' +
        '</div>' +
        '<div style="font-weight:bold; color:var(--color-primary-dark); margin:5px 0 8px; font-size:0.95rem;">\u2756 模式</div>' +
        '<div class="worldview-list" style="margin-bottom:15px;">' + modeItemsHtml + '</div>' +
        '<div style="font-weight:bold; color:var(--color-primary-dark); margin:5px 0 8px; font-size:0.95rem;">\u2756 世界观</div>' +
        '<div class="worldview-list">' + wvItemsHtml + '</div>';
}

function renderTocModeWorldview() {
    var el = document.getElementById('toc-mode-worldview');
    if (!el) return;
    var modeHtml = "";
    [["script", "剧情模式"], ["free", "自由模式"]].forEach(function(m) {
        var isActive = (__currentMode === m[0]);
        modeHtml += '<span class="toc-mw-item' + (isActive ? ' active' : '') + '" data-mode-id="' + m[0] + '" onclick="selectMode(\'' + m[0] + '\')">' + m[1] + '</span>';
    });
    var wvHtml = "";
    WORLDVIEWS.forEach(function(wv) {
        var isComingSoon = isWorldviewComingSoon(__currentMode, wv.id);
        var isActive = (wv.id === __currentWorldviewId) && !isComingSoon;
        var nameText = mtH(wv.name) + (isComingSoon ? '（敬请期待）' : '');
        var clickAttr = isComingSoon ? '' : ' onclick="selectWorldview(\'' + wv.id + '\')"';
        var itemCls = 'toc-mw-item' + (isActive ? ' active' : '') + (isComingSoon ? ' disabled' : '');
        wvHtml += '<span class="' + itemCls + '" data-wv-id="' + wv.id + '"' + clickAttr + '>' + nameText + '</span>';
    });
    el.innerHTML =
        '<div class="toc-mw-label">\u2756 模式</div>' +
        '<div class="toc-mw-row">' + modeHtml + '</div>' +
        '<div class="toc-mw-label">\u2756 世界观</div>' +
        '<div class="toc-mw-row">' + wvHtml + '</div>';
}

window.selectWorldview = function(worldviewId) {
    if (isWorldviewComingSoon(__currentMode, worldviewId)) return;
    __currentWorldviewId = worldviewId;
    __updateSelectionConfirmed();
    renderModeAndWorldviewPanel();
    renderTocModeWorldview();
    refreshTocGallery();
    if (typeof refreshConditionalStoryTabs === 'function') refreshConditionalStoryTabs();
    syncWorldviewLorebook(true);   // 点选世界观后立刻按新组合开关条目
};

window.selectMode = function(mode) {
    __currentMode = mode;
    __updateSelectionConfirmed();
    renderModeAndWorldviewPanel();
    renderTocModeWorldview();
    refreshTocGallery();
    if (typeof refreshConditionalStoryTabs === 'function') refreshConditionalStoryTabs();
    syncWorldviewLorebook(true);   // 点选模式后立刻按新组合开关条目
};

window.__updateSelectionConfirmed = function() {
    __selectionConfirmed = (__currentMode !== "" && __currentWorldviewId !== "");
};

// ===== 世界书条目与当前「模式 + 世界观」保持同步 =====
// 原先只在点选模式/世界观那一刻开关条目；但玩家可能直接翻页、或从目录点卡片进入某个界面，
// 那之后条目就跟当前选择脱节了。这里统一提供 syncWorldviewLorebook()：
//   · 切页（翻页 / 目录卡片 / 角色 / 返回）时调用（带缓存，不重复写）
//   · 点选模式或世界观时用 force=true 强制同步一次
var __appliedCombo = "";              // 已应用过的组合缓存，形如 "free|hentai"
var __lorebookChain = Promise.resolve();  // 串行队列：保证多次切换按顺序写，不交错

window.syncWorldviewLorebook = function(force) {
    if (!__currentMode || !__currentWorldviewId) return __lorebookChain;   // 还没选完，不动条目
    var combo = __currentMode + '|' + __currentWorldviewId;
    if (!force && combo === __appliedCombo) return __lorebookChain;        // 组合没变，跳过重复写
    __appliedCombo = combo;

    // 取值当下立刻定格，入队后即使玩家又改了选择也不会串味
    var mode = __currentMode, wv = __currentWorldviewId;
    __lorebookChain = __lorebookChain.then(function() {
        if (typeof applyWorldviewLorebook === 'function') return applyWorldviewLorebook(wv, mode);
    }).catch(function(e) {
        console.warn('同步世界书条目失败：', e);
        __appliedCombo = "";                                            // 失败就当没应用过，下次切页再试
    });
    return __lorebookChain;
};

window.refreshTocGallery = function() {
    var gallery = document.querySelector('.toc-gallery');
    if (!gallery) return;
    var show = (__currentMode !== "" && __currentWorldviewId !== "");
    gallery.style.display = show ? '' : 'none';
    if (show) {
        document.querySelectorAll('.toc-img-card').forEach(function(card) {
            var m = card.getAttribute('data-mode');
            var w = card.getAttribute('data-worldview');
            var match = (m === __currentMode && w === __currentWorldviewId);
            card.style.display = match ? '' : 'none';
        });
    }
};

window.handleControlPanelItemChange = async function(panelId, currentItemId) {
    var panelConf = CONTROL_PANEL_CONFIG[panelId];
    var isSingleMode = !!(panelConf && panelConf.defaultSingle);
    var cbNode = document.getElementById(currentItemId);
    if (isSingleMode && cbNode && cbNode.checked) {
        panelConf.items.forEach(function(it) {
            if (it.id !== currentItemId) {
                var otherCb = document.getElementById(it.id);
                if (otherCb && otherCb.checked) { otherCb.checked = false; }
            }
        });
    }
    var updatesMap = {};
    panelConf.items.forEach(function(it) {
        var checkEl = document.getElementById(it.id);
        if (checkEl && !checkEl.checked) {
            if (it.enableUids) it.enableUids.forEach(function(uid) { updatesMap[uid] = { uid: uid, enabled: false }; });
        }
    });
    panelConf.items.forEach(function(it) {
        var checkEl = document.getElementById(it.id);
        if (checkEl && checkEl.checked) {
            if (it.enableUids) it.enableUids.forEach(function(uid) { updatesMap[uid] = { uid: uid, enabled: true }; });
            if (it.disableUids) it.disableUids.forEach(function(uid) { updatesMap[uid] = { uid: uid, enabled: false }; });
        }
    });
    if (typeof setLorebookEntries === 'function') {
        var updatePayload = Object.values(updatesMap);
        if(updatePayload.length > 0) {
            try { await setLorebookEntries(LOREBOOK_NAME, updatePayload); } catch(e) { showCustomAlert("试图写入世界书属性时遭拒。"); }
        }
    }
};

// ===== 弹窗系统 =====
window.showCustomConfirm = function(msg, isAlertOnly) {
    if (isAlertOnly === undefined) isAlertOnly = false;
    return new Promise(function(resolve) {
        document.getElementById('customAlertMsg').innerText = msg;
        var overlay = document.getElementById('customAlertOverlay');
        var cancelBtn = document.getElementById('customAlertCancelBtn');
        cancelBtn.style.display = isAlertOnly ? 'none' : 'inline-block';
        window.__alertConfirmResolve = resolve;
        overlay.classList.add('active');
    });
};

window.handleAlertAction = function(result) {
    document.getElementById('customAlertOverlay').classList.remove('active');
    if (typeof window.__alertConfirmResolve === 'function') {
        window.__alertConfirmResolve(result);
        window.__alertConfirmResolve = null;
    }
};

window.showCustomAlert = function(msg) { showCustomConfirm(msg, true); };

// ===== 界面底层操作 =====
function openBook() {
    var coverScene = document.getElementById('scene-cover');
    var innerScene = document.getElementById('scene-inner');
    coverScene.classList.add('is-fading-out');
    setTimeout(function() { innerScene.classList.add('is-fading-in'); }, 150);
}

function goBackCover() {
    var coverScene = document.getElementById('scene-cover');
    var innerScene = document.getElementById('scene-inner');
    document.getElementById('tocMenu').classList.remove('active');
    innerScene.classList.remove('is-fading-in');
    setTimeout(function() { coverScene.classList.remove('is-fading-out'); }, 150);
}

function switchTab(tabId, btnElement) {
    // 每次切页（翻页 / 目录卡片 / 角色 / 返回）都按当前「模式 + 世界观」对一次世界书条目
    if (typeof syncWorldviewLorebook === 'function') syncWorldviewLorebook();
    // 空值保护：动态界面（故事/FC1/FH1/tab5/tab6）要等资源加载完才创建，
    // 但故事选项卡按钮与目录卡片在那之前就已经可点。原先直接操作 null 会抛错，
    // 而那时已经把全部面板的 active 摘掉了 → 内容区一片空白（表现为"卡死"）。
    var targetPanel = document.getElementById(tabId);
    if (!targetPanel) {
        showCustomAlert('这个界面还在加载，请稍等几秒再点。');
        return;
    }
    document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
    if(btnElement) btnElement.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(function(panel) { panel.classList.remove('active'); });
    targetPanel.classList.add('active');
    if (tabId !== 'tab7') {
        var returnBtn = document.getElementById('bookmark-return');
        if (returnBtn) returnBtn.style.display = 'none';
    }
    if (tabId === 'FC1') tryAutoPlayMusic();
    // 切换主选项卡时恢复被「隐藏」的书签（FH1 世界观页）
    if (typeof fh1RestoreBookmarks === 'function') fh1RestoreBookmarks();
}

function switchSubTab(btnElement, subTabId) {
    var headerContainer = btnElement.parentElement;
    headerContainer.querySelectorAll('.sub-tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
    btnElement.classList.add('active');
    var mainPanelContainer = headerContainer.parentElement;
    mainPanelContainer.querySelectorAll('.sub-panel').forEach(function(panel) { panel.classList.remove('active'); });
    mainPanelContainer.querySelector('#' + subTabId).classList.add('active');
    if (subTabId === 'FC1-sub3' && typeof fc1InitRender === 'function') { fc1InitRender(); }
    if (subTabId === 'FC1-sub4' && typeof fc1InitStartMode === 'function') { fc1InitStartMode(); }
    if (subTabId === 'FH1-sub1' && typeof fh1InitOverview === 'function') { fh1InitOverview(); }
    if (subTabId === 'FH1-sub2' && typeof fh1InitWorldviewPage === 'function') { fh1InitWorldviewPage(); }
    if (subTabId.indexOf('FH1-') === 0) {
        if (typeof fh1RestoreBookmarks === 'function') fh1RestoreBookmarks();
        if (typeof fh1OnSubTabChange === 'function') fh1OnSubTabChange(subTabId);
    }
}

window.goToSubTab = function(tabId, subTabId) {
    var panel = document.getElementById(tabId);
    if (!panel) return;
    var btn = panel.querySelector('.sub-tab-btn[data-sub="' + subTabId + '"]');
    if (btn) switchSubTab(btn, subTabId);
};

// ===== FC1 音乐与区域选择 =====
var __fc1Audio = null;
var __fc1Region = null;

window.toggleMusic = function() {
    if (!FC1_MUSIC_URL) { showCustomAlert("背景音乐暂未配置"); return; }
    if (!__fc1Audio) {
        __fc1Audio = new Audio(FC1_MUSIC_URL);
        __fc1Audio.loop = true;
    }
    if (__fc1Audio.paused) {
        __fc1Audio.play().catch(function() {});
    } else {
        __fc1Audio.pause();
    }
    fc1UpdateMusicBtnState();
};

window.fc1UpdateMusicBtnState = function() {
    var btn = document.getElementById('fc1-music-btn');
    if (!btn) return;
    if (__fc1Audio && !__fc1Audio.paused) {
        btn.classList.add('playing');
    } else {
        btn.classList.remove('playing');
    }
};

window.tryAutoPlayMusic = function() {
    if (!FC1_MUSIC_URL) return;
    if (!__fc1Audio) {
        __fc1Audio = new Audio(FC1_MUSIC_URL);
        __fc1Audio.loop = true;
    }
    if (__fc1Audio.paused) {
        __fc1Audio.play().then(function() {
            fc1UpdateMusicBtnState();
        }).catch(function() {});
    }
};

var FC1_REGIONS = [
    { id: "europe", name: "欧洲", img: "https://qianyedoufu.dpdns.org/欧洲.png", desc: "三角贸易的起点与终点：输出制成品、军火与朗姆酒，回收糖、烟草与棉花。" },
    { id: "west_africa", name: "西非", img: "https://qianyedoufu.dpdns.org/西非.png", desc: "深色奴的供应地：用制成品换取人力，是横渡大西洋的中段航程起点。" },
    { id: "south_america", name: "南美", img: "https://qianyedoufu.dpdns.org/南美.png", desc: "种植园腹地：吸收奴隶、产出糖与烟草，是回程货源的起点。" },
    { id: "sea", name: "海洋", img: "https://qianyedoufu.dpdns.org/海洋.png", desc: "横贯大西洋的漫漫航程，风浪、疫病与反抗都潜伏在这一程。" }
];
var __fc1RegionIndex = 0;

window.fc1RenderRegion = function() {
    var view = document.getElementById('fc1-carousel-view');
    if (!view) return;
    var html = '';
    FC1_REGIONS.forEach(function(r, i) {
        var sel = (__fc1Region === r.id) ? ' selected' : '';
        html += '<div class="fc1-slide' + (i === __fc1RegionIndex ? ' active' : '') + '" data-region="' + r.id + '">' +
            '<div class="fc1-slide-img' + sel + '" onclick="selectRegion(\'' + r.id + '\')"><img src="' + r.img + '" alt="' + r.name + '"></div>' +
            '<div class="fc1-bubble"><div class="fc1-bubble-header">' + r.name + '</div><div class="fc1-bubble-body">' + r.desc + '</div></div>' +
        '</div>';
    });
    view.innerHTML = html;
};

window.fc1PrevRegion = function() {
    __fc1RegionIndex = (__fc1RegionIndex - 1 + FC1_REGIONS.length) % FC1_REGIONS.length;
    fc1RenderRegion();
};

window.fc1NextRegion = function() {
    __fc1RegionIndex = (__fc1RegionIndex + 1) % FC1_REGIONS.length;
    fc1RenderRegion();
};

window.selectRegion = function(region) {
    __fc1Region = region;
    __fc1Identity = null;
    var input = document.getElementById('fc1-identity-input');
    if (input) input.value = "";
    fc1SyncUserVariable();
    fc1RenderRegion();
    fc1RenderIdentity();
    fc1ClosePopup();
    fc1RenderVariables();
    fc1RenderStartPreview();
    goToSubTab('FC1', 'FC1-sub3');
};

var FC1_IDENTITIES = [
    { id: "privateer", name: "私掠船长", region: "base", desc: "出身水手或退伍军官，持有一纸母国签发的私掠许可证，战时合法劫掠敌国商船，战利品与母国分成，与海盗只隔着一张许可证。", res: "1 艘武装船 + 船员 + 少量银币" },
    { id: "merchant_captain", name: "商船船长", region: "base", desc: "家学渊源或从水手做起，拥有一艘跑三角贸易的商船，往返于欧洲、西非与美洲之间倒买倒卖，逐利海上。", res: "1 艘商船 + 货物本金" },
    { id: "indentured", name: "契约劳工", region: "base", desc: "为偿还横渡大西洋的船费，以数年劳作抵债，期满后有望获得自由与一块土地，眼下却一无所有。", res: "无资产 + 债务" },
    { id: "maroon", name: "逃奴·玛戎", region: "base", desc: "从奴隶制下逃亡，躲进深山密林或自由港，无合法身份却拥有自由，靠胆识在夹缝中求生。", res: "无资产 + 无合法身份 + 自由" },

    { id: "company_agent", name: "特许公司代理人", region: "europe", desc: "受母国特许公司委派，在殖民地与航线间经营垄断贸易，靠官商关系与佣金立足。", res: "本金 + 母国特许关系" },
    { id: "noble_second_son", name: "没落贵族次子", region: "europe", desc: "出身贵族却无继承权，携家中余钱漂洋过海，指望在新大陆挣出一份属于自己的家业与名号。", res: "家产余钱" },
    { id: "shipwright", name: "造船商·船坞主", region: "europe", desc: "祖辈经营船坞，熟谙船价、木料与改装门道，守着港口船坞，为往来船只造新补旧。", res: "船坞 + 银币" },

    { id: "slave_fort_agent", name: "奴隶要塞代理", region: "west_africa", desc: "受雇于欧洲奴隶商人，驻守西非海岸的奴隶要塞与商站，用制成品从部落酋长处换取深色奴。", res: "商站 + 奴隶货源" },
    { id: "tribal_middleman", name: "部落中间商", region: "west_africa", desc: "西非本地酋长或掮客，组织掳掠与贩奴，把同族人卖给欧洲人换取火器、布匹与铜器。", res: "西非人脉 + 掳奴渠道" },
    { id: "arms_dealer", name: "军火贩子", region: "west_africa", desc: "往来西非海岸，向部落兜售火器与弹药，以此换取奴隶与黄金，游走在血腥的贸易链上。", res: "军火货物 + 本金" },

    { id: "pirate", name: "海盗", region: "sea", desc: "无国界的海上亡命徒，选举船长、按份分赃，悬骷髅旗劫掠商船，被各国海军悬赏通缉。", res: "1 艘船 + 船员 + 被悬赏通缉" },
    { id: "navigator", name: "领航员·舵手", region: "sea", desc: "自幼在海上长大，熟记加勒比群岛的水道、洋流与暗礁，凭一手过硬的领航手艺被船长争相雇佣。", res: "航海技术（被雇佣）" },
    { id: "ship_doctor", name: "船医·外科医生", region: "sea", desc: "略通医术，会截肢、放血、缝合伤口，也会治坏血病与船热，是长航程中船员们不敢得罪的救命人。", res: "医术 + 药品" }
];
var __fc1Identity = null;

window.fc1RenderIdentity = function() {
    var list = document.getElementById('fc1-identity-list');
    if (!list) return;
    if (!__fc1Region) {
        list.innerHTML = '<div class="fc1-identity-empty">请先在上一页选择起始之地</div>';
        return;
    }
    var html = '';
    FC1_IDENTITIES.forEach(function(it) {
        if (it.region !== 'base' && it.region !== __fc1Region) return;
        var sel = (__fc1Identity === it.id) ? ' selected' : '';
        html += '<div class="fc1-identity-card' + sel + '" data-identity="' + it.id + '" onclick="selectIdentity(\'' + it.id + '\')">' +
            '<div class="fc1-identity-name">' + it.name + '</div>' +
            '<div class="fc1-identity-desc">' + it.desc + '</div>' +
            '<div class="fc1-identity-res">起始：' + it.res + '</div>' +
        '</div>';
    });
    list.innerHTML = html;
};

window.selectIdentity = function(id) {
    __fc1Identity = id;
    var it = FC1_IDENTITIES.find(function(x) { return x.id === id; });
    if (it) {
        var input = document.getElementById('fc1-identity-input');
        if (input) input.value = it.name;
    }
    fc1RenderIdentity();
    fc1SyncUserVariable();
    fc1RenderVariables();
    fc1RenderStartPreview();
};

// ===== FC1 角色背景（性别身份 / 角色设定 / 身份组设定） =====
var __fc1Gender = "";
var __fc1SettingEntries = [];
var __fc1ActiveSettingUid = null;

function fc1EscapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fc1EscapeAttr(s) {
    return fc1EscapeHtml(s).replace(/"/g, "&quot;");
}

window.fc1InitCharacterBackground = function() {
    fc1RenderRegion();
    var sel = document.getElementById('fc1-gender-select');
    if (sel) sel.value = __fc1Gender;
    fc1RenderSettingGrid();
    fc1RenderIdentity();
    fc1ClosePopup();
    fc1RenderVariables();
    fc1RenderStartPreview();
};

window.fc1SelectGender = function(val) {
    __fc1Gender = val;
    fc1SyncUserVariable();
};

window.fc1OnIdentityInput = function(val) {
    fc1SyncUserVariable();
};

window.fc1SyncUserVariable = function() {
    var dm = tabsDataMap['FC1'];
    if (!dm) return;
    dm.data.variable.user = dm.data.variable.user || {};
    if (__fc1Gender) dm.data.variable.user.gender = __fc1Gender;
    var input = document.getElementById('fc1-identity-input');
    if (input) dm.data.variable.user.identity = input.value.trim();
};

window.fc1OnShowSettingToggle = function(chk) {
    // 勾选态由 fc1ClickSetting 读取
};

window.fetchFc1SettingEntries = async function() {
    try {
        if (typeof getLorebookEntries === 'function') {
            var entries = await getLorebookEntries(LOREBOOK_NAME, {fields:['uid','comment','content','enabled','order']});
            return entries.filter(function(e) { return e.order >= 126 && e.order <= 148; });
        }
    } catch(e) { console.warn("读取角色设定条目失败：", e); }
    return [];
};

window.fc1RenderSettingGrid = async function() {
    var grid = document.getElementById('fc1-setting-grid');
    if (!grid) return;
    if (__fc1SettingEntries.length === 0) {
        __fc1SettingEntries = await fetchFc1SettingEntries();
    }
    var html = '';
    if (__fc1SettingEntries.length === 0) {
        html = '<div class="fc1-setting-empty">未找到世界书角色设定条目</div>';
    } else {
        __fc1SettingEntries.forEach(function(e) {
            var fullName = (e.comment && e.comment.trim()) ? e.comment.trim() : '';
            var label = fullName.charAt(0);
            var onCls = e.enabled ? ' on' : '';
            html += '<button class="fc1-setting-btn' + onCls + '" data-uid="' + e.uid + '" title="' + fc1EscapeAttr(fullName) + '" onclick="fc1ClickSetting(' + e.uid + ')">' + mtH(label) + '</button>';
        });
    }
    grid.innerHTML = html;
};

window.fc1ClickSetting = async function(uid) {
    var entry = __fc1SettingEntries.find(function(e) { return e.uid === uid; });
    if (!entry) return;
    var newEnabled = !entry.enabled;
    entry.enabled = newEnabled;
    fc1RenderSettingGrid();
    if (typeof setLorebookEntries === 'function') {
        try {
            await setLorebookEntries(LOREBOOK_NAME, [{ uid: uid, enabled: newEnabled }]);
        } catch(e) {
            entry.enabled = !newEnabled;
            fc1RenderSettingGrid();
            showCustomAlert("切换条目状态失败，请重试");
        }
    }
    var chk = document.getElementById('fc1-show-setting-chk');
    if (chk && chk.checked) {
        fc1OpenPopup(uid);
    }
};

window.fc1OpenPopup = function(uid) {
    var entry = __fc1SettingEntries.find(function(e) { return e.uid === uid; });
    if (!entry) return;
    __fc1ActiveSettingUid = uid;
    var popup = document.getElementById('fc1-setting-popup');
    var titleEl = document.getElementById('fc1-popup-title');
    var bodyEl = document.getElementById('fc1-setting-popup-body');
    var nameText = (entry.comment && entry.comment.trim()) ? entry.comment.trim() : ('#' + entry.uid);
    if (titleEl) titleEl.textContent = '世界书条目设定 · ' + nameText;
    if (bodyEl) {
        bodyEl.innerHTML =
            '<div class="fc1-setting-editor">' +
                '<div class="fc1-setting-name-row"><span class="fc1-field-label">名称</span><input type="text" id="fc1-setting-name" value="' + fc1EscapeAttr(entry.comment || '') + '"></div>' +
                '<textarea id="fc1-setting-content" class="fc1-setting-content">' + fc1EscapeHtml(entry.content || '') + '</textarea>' +
                '<div class="fc1-setting-actions">' +
                    '<button class="fc1-setting-save" onclick="fc1SaveSetting()">保存</button>' +
                    '<button class="fc1-setting-cancel" onclick="fc1ClosePopup()">关闭</button>' +
                '</div>' +
            '</div>';
    }
    if (popup) popup.style.display = '';
};

window.fc1SaveSetting = async function() {
    if (typeof setLorebookEntries !== 'function') { showCustomAlert("提示：请确认正处于兼容脚本运行的次元环境节点！"); return; }
    var uid = __fc1ActiveSettingUid;
    if (uid === null) return;
    var nameInput = document.getElementById('fc1-setting-name');
    var contentInput = document.getElementById('fc1-setting-content');
    var nameVal = nameInput ? nameInput.value.trim() : "";
    var contentVal = contentInput ? contentInput.value : "";
    var isGranted = await showCustomConfirm("确认保存该角色设定吗");
    if (!isGranted) return;
    try {
        await setLorebookEntries(LOREBOOK_NAME, [{ uid: uid, comment: nameVal, content: contentVal }]);
        showCustomAlert("\u2728 已保存设定");
        __fc1SettingEntries = [];
        await fc1RenderSettingGrid();
        fc1ClosePopup();
    } catch(e) { showCustomAlert("保存失败，请刷新或重新连接世界书"); }
};

window.fc1ClosePopup = function() {
    __fc1ActiveSettingUid = null;
    var popup = document.getElementById('fc1-setting-popup');
    if (popup) popup.style.display = 'none';
};

// ===== FC1 变量设定（根据身份组生成初始变量） =====
var __fc1Variables = null;

var FC1_REGION_POSITIONS = {
    "europe": "欧洲 - 港口码头",
    "west_africa": "西非海岸 - 奴隶要塞",
    "south_america": "南美 - 港口城镇",
    "sea": "加勒比海 - 船上"
};

function fc1MakeShip(type, cost, crewCount, condition, crewWeapons, shipGuns, morale) {
    return {
        type: type,
        crew: { count: crewCount, morale: morale || "平稳" },
        status: { condition: (condition != null ? condition : 90), damage: "", speed: "停泊", cargo: {} },
        value: { cost: cost, cargo_value: "" },
        armament: {
            crew_weapons: crewWeapons || {},
            ship_guns: shipGuns || {}
        },
        combat_power: 0
    };
}

function fc1EmptyRelationship() {
    return {};
}

window.fc1BuildVariablePreset = function(identityId, regionId) {
    var pos = FC1_REGION_POSITIONS[regionId] || "";
    var base = {
        position: pos,
        wealth: "银币 100 枚",
        body_state: "精力充沛",
        ships: {},
        estate: {},
        relationship: fc1EmptyRelationship()
    };

    function addShip(name, type, cost, crewCount, condition, cw, sg, morale) {
        base.ships[name] = fc1MakeShip(type, cost, crewCount, condition, cw, sg, morale);
    }
    function addEstate(name, type, location, extra) {
        var e = { type: type, location: location || pos };
        if (extra) { for (var k in extra) e[k] = extra[k]; }
        base.estate[name] = e;
    }
    function addHand(name, gender, expense) {
        base.relationship[name] = { tags: ["手下"], gender: gender || "男性", location: pos, expense: expense };
    }
    function addSlave(name, gender, expense) {
        base.relationship[name] = { tags: ["奴隶"], gender: gender || "男性", location: pos, expense: expense };
    }

    switch (identityId) {
        case "privateer":
            base.wealth = "银币 80 枚";
            addShip("私掠船", "双桅帆船", "2000 银币", 40, 90,
                { "弯刀": { count: "30把", category: "冷兵器" }, "燧发枪": { count: "15支", category: "轻火器" } },
                { "前膛炮": { count: "8门", category: "标准舰炮" } });
            break;
        case "merchant_captain":
            base.wealth = "银币 500 枚";
            addShip("商船", "盖伦船", "4000 银币", 30, 95,
                { "弯刀": { count: "10把", category: "冷兵器" } },
                { "前膛炮": { count: "4门", category: "轻型舰炮" } });
            break;
        case "indentured":
            base.wealth = "银币 5 枚";
            base.body_state = "疲惫";
            break;
        case "maroon":
            base.wealth = "银币 3 枚";
            base.body_state = "机警";
            break;
        case "company_agent":
            base.wealth = "银币 800 枚";
            break;
        case "noble_second_son":
            base.wealth = "银币 1200 枚";
            base.relationship["母亲"] = { tags: ["家人"], gender: "伊芙", location: "欧洲 - 布里斯托", expense: "10 银币/月" };
            break;
        case "shipwright":
            base.wealth = "银币 600 枚";
            addEstate("船坞", "手工业", pos, { status: "营业中", product: "造船与修船" });
            break;
        case "slave_fort_agent":
            base.wealth = "银币 400 枚";
            addEstate("奴隶商站", "商业", "西非海岸 - 奴隶要塞", { status: "营业中", business: "奴隶贸易" });
            addHand("翻译掮客", "男性", "15 银币/月");
            break;
        case "tribal_middleman":
            base.wealth = "银币 300 枚";
            addHand("部落武士", "男性", "8 银币/月");
            break;
        case "arms_dealer":
            base.wealth = "银币 700 枚";
            addShip("货船", "双桅帆船", "1500 银币", 20, 90,
                { "弯刀": { count: "10把", category: "冷兵器" } },
                {});
            base.ships["货船"].status.cargo = {
                "燧发枪": { count: "50支", quality: "良", category: "军火" },
                "火药": { count: "20桶", quality: "良", category: "军火" }
            };
            break;
        case "overseer":
            base.wealth = "银币 30 枚";
            break;
        case "free_colored":
            base.wealth = "银币 150 枚";
            addEstate("小作坊", "手工业", pos, { status: "营业中", product: "木工与裁缝" });
            break;
        case "sugar_mill_owner":
            base.wealth = "银币 500 枚";
            addEstate("制糖坊", "手工业", pos, { status: "营业中", product: "糖" });
            addSlave("库姆巴", "男性", "4 银币/月");
            addSlave("阿玛拉", "伊芙", "3 银币/月");
            break;
        case "noble_scion":
            base.wealth = "银币 3000 枚";
            addEstate("大型庄园", "居所", pos, { belong: "", scale: "大型", status: "营业中", description: "一座带花园与田产的殖民大庄园" });
            addEstate("庄园宅邸", "居所", pos, { belong: "大型庄园", scale: "中型", status: "石柱木宅，仆役往来" });
            addEstate("庄园田地", "农事", pos, { belong: "大型庄园", scale: "大型", product: "甘蔗", output: "500担/月" });
            addEstate("庄园制糖坊", "手工业", pos, { belong: "大型庄园", scale: "小型", product: ["糖", "糖蜜"] });
            addHand("管家", "男性", "40 银币/月");
            break;
        case "pirate":
            base.wealth = "银币 40 枚";
            addShip("海盗船", "双桅帆船", "1500 银币", 45, 85,
                { "弯刀": { count: "35把", category: "冷兵器" }, "燧发枪": { count: "20支", category: "轻火器" } },
                { "前膛炮": { count: "6门", category: "标准舰炮" } });
            break;
        case "navigator":
            base.wealth = "银币 60 枚";
            break;
        case "ship_doctor":
            base.wealth = "银币 100 枚";
            break;
        default:
            break;
    }
    return base;
};

window.fc1RenderVariables = function() {
    var box = document.getElementById('fc1-variable-editor');
    if (!box) return;
    if (!__fc1Identity) {
        box.innerHTML = '<div class="fc1-var-empty">请先在「初始设定」中选择一个身份组，再回来配置变量</div>';
        return;
    }
    var preset = fc1BuildVariablePreset(__fc1Identity, __fc1Region);
    __fc1Variables = preset;

    var it = FC1_IDENTITIES.find(function(x) { return x.id === __fc1Identity; });
    var identityName = it ? it.name : '';
    var gender = __fc1Gender || '未选择';
    var identityInput = document.getElementById('fc1-identity-input');
    var identityVal = identityInput ? identityInput.value.trim() : identityName;

    var html = '';
    html += '<div class="fc1-var-summary">身份组：' + mtH(identityName) + '　|　性别：' + mtH(gender) + '　|　身份：' + mtH(identityVal) + '</div>';

    html += '<div class="fc1-var-section"><div class="fc1-var-title">世界信息</div>' +
        '<div class="fc1-var-row"><span class="fc1-var-label">position 地点</span><input id="fc1-var-position" value="' + fc1EscapeAttr(preset.position) + '"></div></div>';

    html += '<div class="fc1-var-section"><div class="fc1-var-title">用户信息</div>' +
        '<div class="fc1-var-row"><span class="fc1-var-label">wealth 财富</span><input id="fc1-var-wealth" value="' + fc1EscapeAttr(preset.wealth) + '"></div>' +
        '<div class="fc1-var-row"><span class="fc1-var-label">body_state 身体状态</span><input id="fc1-var-body" value="' + fc1EscapeAttr(preset.body_state) + '"></div></div>';

    html += '<div class="fc1-var-section"><div class="fc1-var-title">ships 船只</div><textarea id="fc1-var-ships" class="fc1-var-json" spellcheck="false">' + fc1EscapeHtml(JSON.stringify(preset.ships, null, 2)) + '</textarea></div>';
    html += '<div class="fc1-var-section"><div class="fc1-var-title">estate 家产</div><textarea id="fc1-var-estate" class="fc1-var-json" spellcheck="false">' + fc1EscapeHtml(JSON.stringify(preset.estate, null, 2)) + '</textarea></div>';
    html += '<div class="fc1-var-section"><div class="fc1-var-title">relationship 关系</div><textarea id="fc1-var-relationship" class="fc1-var-json" spellcheck="false">' + fc1EscapeHtml(JSON.stringify(preset.relationship, null, 2)) + '</textarea></div>';

    html += '<div class="fc1-var-actions">' +
        '<button class="fc1-setting-save" onclick="fc1SaveVariables()">保存变量</button>' +
        '<button class="fc1-setting-cancel" onclick="fc1RenderVariables()">重置为预设</button>' +
        '</div>';

    box.innerHTML = html;
};

window.fc1CollectVariable = function() {
    var dm = tabsDataMap['FC1'];
    if (!dm) return null;
    var v = dm.data.variable;
    v.world = v.world || {};
    v.user = v.user || {};

    var idInput = document.getElementById('fc1-identity-input');
    if (idInput) v.user.identity = idInput.value.trim();
    v.user.gender = __fc1Gender || v.user.gender;

    var posEl = document.getElementById('fc1-var-position');
    if (posEl) {
        v.world.position = posEl.value.trim();
        var wealthEl = document.getElementById('fc1-var-wealth');
        var bodyEl = document.getElementById('fc1-var-body');
        if (wealthEl) v.user.wealth = wealthEl.value.trim();
        if (bodyEl) v.user.body_state = bodyEl.value.trim();

        function readJSON(id) {
            var el = document.getElementById(id);
            if (!el) return null;
            var val = JSON.parse(el.value);
            return (val && typeof val === 'object' && !Array.isArray(val)) ? val : null;
        }
        var ships = readJSON('fc1-var-ships');
        var estate = readJSON('fc1-var-estate');
        var relationship = readJSON('fc1-var-relationship');
        if (ships !== null) v.ships = ships;
        if (estate !== null) v.estate = estate;
        if (relationship !== null) v.relationship = relationship;
    } else if (__fc1Variables) {
        v.world.position = __fc1Variables.position || v.world.position;
        v.user.wealth = __fc1Variables.wealth || v.user.wealth;
        v.user.body_state = __fc1Variables.body_state || v.user.body_state;
        if (__fc1Variables.ships) v.ships = __fc1Variables.ships;
        if (__fc1Variables.estate) v.estate = __fc1Variables.estate;
        if (__fc1Variables.relationship) v.relationship = __fc1Variables.relationship;
    }

    v.setting = v.setting || {};
    v.setting.mode = __currentMode || "free";
    v.setting.worldview = __currentWorldviewId || "colony";

    // 自由模式输出：剔除剧情模式专属字段（write 三格传送带 / 剧情线），保留地区信息与用户偏好
    var out = {};
    Object.keys(v).forEach(function(k) { out[k] = v[k]; });
    delete out.write;
    delete out["剧情线"];
    return out;
};

window.fc1SaveVariables = function() {
    var v;
    try {
        v = fc1CollectVariable();
    } catch(e) {
        showCustomAlert("存在 JSON 格式有误的变量，请检查后重试");
        return;
    }
    if (!v) { showCustomAlert("请先选择身份组"); return; }
    showCustomAlert("\u2728 变量已保存，可在「开始剧情」时投递");
};

// ===== FC1 开始剧情 =====
var __fc1StartMode = "";

window.fc1HasPresetIdentity = function() {
    if (typeof __fc1Identity !== 'string' || !__fc1Identity) return false;
    var it = (typeof FC1_PRESETS !== 'undefined' && FC1_PRESETS.identities ? FC1_PRESETS.identities.find(function(x) { return x.id === __fc1Identity; }) : null)
        || (FC1_IDENTITIES || []).find(function(x) { return x.id === __fc1Identity; });
    return !!it;
};

window.fc1BuildAutoPrompt = function() {
    var it = (typeof FC1_PRESETS !== 'undefined' && FC1_PRESETS.identities ? FC1_PRESETS.identities.find(function(x) { return x.id === __fc1Identity; }) : null)
        || (FC1_IDENTITIES || []).find(function(x) { return x.id === __fc1Identity; });
    if (!it) return null;
    var v = (typeof fc1isGetVar === 'function') ? fc1isGetVar() : null;
    var identity = (v && v.user && v.user.identity) || it.name;
    if (!identity) return null;
    return '生成开场白，这是一个关于{{user}}的故事......\n' + it.desc;
};

window.fc1RenderStartPreview = function() {
    var el = document.getElementById('fc1-start-preview');
    if (!el) return;
    var prompt = fc1BuildAutoPrompt();
    el.textContent = prompt !== null ? prompt : '请先在「初始设定」中选择预设身份组（方式一）';
};

// 进入「开始剧情」页时初始化：默认两方式均未选，方式一无预设身份组时变灰
window.fc1InitStartMode = function() {
    __fc1StartMode = "";
    var autoBtn = document.getElementById('fc1-start-auto-btn');
    var manualBtn = document.getElementById('fc1-start-manual-btn');
    var autoPanel = document.getElementById('fc1-start-auto-panel');
    var manualPanel = document.getElementById('fc1-start-manual-panel');
    var hasPreset = fc1HasPresetIdentity();
    if (autoBtn) {
        autoBtn.className = 'fc1-start-mode-btn' + (hasPreset ? '' : ' disabled');
        autoBtn.disabled = !hasPreset;
    }
    if (manualBtn) {
        manualBtn.className = 'fc1-start-mode-btn';
        manualBtn.disabled = false;
    }
    if (autoPanel) autoPanel.style.display = 'none';
    if (manualPanel) manualPanel.style.display = 'none';
    fc1RenderStartPreview();
};

window.fc1SelectStartMode = function(mode) {
    if (mode === 'auto' && !fc1HasPresetIdentity()) {
        showCustomAlert("方式一需要先在「初始设定」中选择预设身份组");
        return;
    }
    __fc1StartMode = mode;
    var autoBtn = document.getElementById('fc1-start-auto-btn');
    var manualBtn = document.getElementById('fc1-start-manual-btn');
    var autoPanel = document.getElementById('fc1-start-auto-panel');
    var manualPanel = document.getElementById('fc1-start-manual-panel');
    if (autoBtn) autoBtn.className = 'fc1-start-mode-btn' + (mode === 'auto' ? ' active' : '');
    if (manualBtn) manualBtn.className = 'fc1-start-mode-btn' + (mode === 'manual' ? ' active' : '');
    if (autoPanel) autoPanel.style.display = (mode === 'auto' ? '' : 'none');
    if (manualPanel) manualPanel.style.display = (mode === 'manual' ? '' : 'none');
    if (mode === 'auto') fc1RenderStartPreview();
};

window.fc1StartGame = async function() {
    if (!__fc1StartMode) { showCustomAlert("请先选择开局方式（方式一或方式二）"); return; }

    var v;
    try {
        v = (typeof fc1CollectInitialVars === 'function') ? fc1CollectInitialVars() : fc1CollectVariable();
    } catch(e) {
        showCustomAlert("存在 JSON 格式有误的变量，请到「初始设定」检查后重试");
        return;
    }
    if (!v) return;

    var prompt;
    if (__fc1StartMode === 'manual') {
        var ta = document.getElementById('fc1-start-manual-text');
        prompt = ta ? ta.value.trim() : "";
        if (!prompt) { showCustomAlert("请先填写你的自定义开局"); return; }
    } else {
        prompt = fc1BuildAutoPrompt();
        if (prompt === null) { showCustomAlert("方式一需要先在「初始设定」中选择预设身份组，或改用方式二自定义开局"); return; }
    }

    var agree = await showCustomConfirm("确认开始自由模式并发送开局信息吗");
    if (!agree) return;
    triggerSTSlashSend(prompt, v);
};



function nextPage() {
    var btns = Array.from(document.querySelectorAll('.tab-btn')).filter(function(btn) { return btn.style.display !== 'none'; });
    var currentIndex = btns.findIndex(function(btn) { return btn.classList.contains('active'); });
    if (currentIndex !== -1) {
        var nextIndex = (currentIndex + 1) % btns.length;
        var gateIndex = btns.findIndex(function(btn) { return btn.getAttribute('data-target') === 'tab4'; });
        if (!__selectionConfirmed && gateIndex !== -1 && nextIndex > gateIndex) {
            nextIndex = gateIndex;
            showCustomAlert("请先选择模式和世界观");
        }
        switchTab(btns[nextIndex].getAttribute('data-target'), btns[nextIndex]);
    }
}

function toggleToc() { document.getElementById('tocMenu').classList.toggle('active'); }

function selectFromToc(tabId) {
    var btn = document.querySelector('.tab-btn[data-target="' + tabId + '"]');
    if (btn) {
        switchTab(tabId, btn);
    } else {
        showCustomAlert("该内容需先选择对应的模式与世界观");
    }
    toggleToc();
    var preview = document.getElementById('global-img-preview');
    if (preview) preview.classList.remove('active');
}

function goToRoleTab() {
    var activeBtn = document.querySelector('.tab-btn.active');
    __roleReturnTab = activeBtn ? activeBtn.getAttribute('data-target') : null;
    var returnBtn = document.getElementById('bookmark-return');
    if (returnBtn) returnBtn.style.display = '';
    var targetBtn = document.querySelector('.tab-btn[data-target="tab7"]');
    if(targetBtn) { switchTab('tab7', targetBtn); }
}

var __roleReturnTab = null;

window.gotoCharFromFC1 = function() {
    __roleReturnTab = 'FC1';
    var returnBtn = document.getElementById('bookmark-return');
    if (returnBtn) returnBtn.style.display = '';
    goToRoleTab();
};

window.returnFromChar = function() {
    var returnBtn = document.getElementById('bookmark-return');
    if (returnBtn) returnBtn.style.display = 'none';
    var target = __roleReturnTab || 'FC1';
    __roleReturnTab = null;
    var targetBtn = document.querySelector('.tab-btn[data-target="' + target + '"]');
    if (targetBtn) { switchTab(target, targetBtn); }
};

// ===== 导入功能 =====
var __currentImportTabId = "";

window.openImportModal = function(sourceTabId) {
    __currentImportTabId = sourceTabId;
    var domInput = document.getElementById('importDataInput');
    if(domInput) domInput.value = "";
    document.getElementById('importModalOverlay').classList.add('active');
};

window.closeImportModal = function() {
    document.getElementById('importModalOverlay').classList.remove('active');
};

window.commitImportData = async function() {
    var rawData = document.getElementById('importDataInput').value.trim();
    if(!rawData) { showCustomAlert("输入为空！"); return; }
    var parsed;
    try { parsed = JSON.parse(rawData); }
    catch(e) { showCustomAlert("导入失败！请确保输入的内容是正常格式。"); return; }
    var container = document.getElementById(__currentImportTabId);
    if(!container) return;
    closeImportModal();

    function _safeAssignPath(pathStr, fallbackVal) {
        if (fallbackVal === undefined) return;
        var tg = container.querySelector('[data-path="' + pathStr + '"]');
        if(tg) tg.innerHTML = mtH(typeof fallbackVal === 'string' ? fallbackVal : String(fallbackVal));
    }

    if(parsed.story) {
        _safeAssignPath("story.name", parsed.story.name);
        _safeAssignPath("story.alias", parsed.story.alias);
        _safeAssignPath("story.background", parsed.story.background);
        _safeAssignPath("story.startContent", parsed.story.startContent);
    }

    if(parsed.variable) {
        if(parsed.variable.world) {
            _safeAssignPath("variable.world.date", parsed.variable.world.date);
            _safeAssignPath("variable.world.time", parsed.variable.world.time);
            _safeAssignPath("variable.world.position", parsed.variable.world.position);
        }
        if(parsed.variable.user) {
            var u = parsed.variable.user;
            _safeAssignPath("variable.user.identity", u.identity);
            _safeAssignPath("variable.user.gender", u.gender);
            _safeAssignPath("variable.user.body_state", u.body_state);
            _safeAssignPath("variable.user.surroundings", u.surroundings);
            _safeAssignPath("variable.user.psychological_description", u.psychological_description);
            if(u.inventory && typeof u.inventory === 'object') {
                var invUl = container.querySelector('[data-dict="variable.user.inventory"]');
                if(invUl) invUl.innerHTML = generateInventoryList(u.inventory);
            }
        }
        if(parsed.variable["剧情线"] !== undefined) {
            var stUl = container.querySelector('[data-complex-dict="variable.剧情线"]');
            if(!stUl) {
                stUl = container.querySelector('[data-dict="variable.剧情线"]');
                if(stUl) stUl.setAttribute('data-complex-dict', 'variable.剧情线');
            }
            if(stUl) { stUl.innerHTML = generateComplexStorylines(parsed.variable["剧情线"]); }
        }
        if(parsed.variable["用户偏好"] !== undefined) {
            var gdUl = container.querySelector('[data-dict="variable.用户偏好"]');
            if(gdUl) gdUl.innerHTML = generateStorylines(parsed.variable["用户偏好"]);
        }
        if(parsed.variable["背景信息"] && parsed.variable["背景信息"]["地区"]) {
            var targetRC = container.querySelector('#regions-' + __currentImportTabId);
            if(targetRC) {
                var rgDatas = parsed.variable["背景信息"]["地区"];
                var htmlStr = "";
                var editAttr = container.classList.contains('is-edit-mode') ? "contenteditable='true'" : "";
                Object.keys(rgDatas).forEach(function(rk) {
                    var rt = rgDatas[rk];
                    var cuSt = "";
                    if(rt["民俗风情"] && typeof rt["民俗风情"] === 'object') {
                        Object.keys(rt["民俗风情"]).forEach(function(ck) {
                            cuSt += '<div class="custom-row custom-item" data-ditem>' +
                                '<span class="editable-key editable-field" style="color:#8b5a2b;" data-dkey ' + editAttr + '>' + mtH(ck) + '</span>: ' +
                                '<span class="editable-field" data-dval ' + editAttr + '>' + mtH(rt["民俗风情"][ck]) + '</span>' +
                            '</div>';
                        });
                    }
                    cuSt += '<div class="add-custom-btn" onclick="addNewCustom(this)">+ 添加风情词条</div>';
                    htmlStr +=
                        '<div class="area-box area-item">' +
                            '<div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;">' +
                                '\u27A4 <span class="editable-field editable-key region-name" style="color:var(--color-accent);" ' + editAttr + '>' + mtH(rk) + '</span>' +
                            '</div>' +
                            '<div class="custom-row" style="margin-bottom:8px;">' +
                                '<span class="param-label" style="flex-shrink:0;">描述:</span>' +
                                '<div class="editable-field editable-textarea region-desc" style="flex:1;" ' + editAttr + '>' + mtH(rt["描述"] || '') + '</div>' +
                            '</div>' +
                            '<div class="customs-box">' +
                                '<div class="param-label" style="display:block; margin-bottom:4px;">\u2756 民俗风情:</div>' + cuSt +
                            '</div>' +
                        '</div>';
                });
                targetRC.innerHTML = htmlStr;
            }
        }
    }

    if (container.classList.contains('is-edit-mode')) {
        container.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
    }
    showCustomAlert("导入成功！");
};

// ===== 图片缩放 =====
window.zoomTabImage = function(tabId, dir) {
    var wrapper = document.getElementById('img-wrapper-' + tabId);
    if(wrapper) {
        var currentWidth = parseInt(wrapper.style.width || "200", 10);
        var newWidth = currentWidth + dir * 100;
        if (newWidth < 60) newWidth = 60;
        if (newWidth > 600) newWidth = 600;
        wrapper.style.width = newWidth + "px";
    }
};

// ===== 编辑模式 =====
window.toggleEditMode = function(chkboxEl, tabId) {
    var panel = document.getElementById(tabId);
    if(chkboxEl.checked) {
        panel.classList.add('is-edit-mode');
        panel.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
    } else {
        panel.classList.remove('is-edit-mode');
        panel.querySelectorAll('.editable-field').forEach(function(el) { el.removeAttribute('contenteditable'); });
    }

    // 同步脉络式覆盖层中的编辑开关
    var tlChk = document.getElementById('timeline-edit-chk');
    if (tlChk && tlChk.checked !== chkboxEl.checked) {
        tlChk.checked = chkboxEl.checked;
    }

    // 同步脉络式保存按钮
    var saveBtn = document.getElementById('timeline-save-btn');
    if (saveBtn) saveBtn.style.display = chkboxEl.checked ? '' : 'none';

    // 刷新已打开卡片的编辑状态（保持变暗/亮起不变）
    if (typeof _refreshAllCardsEditMode === 'function') {
        _refreshAllCardsEditMode(chkboxEl.checked);
    }
};

// ===== 地域 / 民俗 / 道具管理 =====
window.addNewRegion = function(tabId) {
    var container = document.getElementById('regions-' + tabId);
    if (!container) return;
    var newAreaBox = document.createElement('div');
    newAreaBox.className = "area-box area-item";
    newAreaBox.innerHTML =
        '<div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;">' +
            '\u27A4 <span class="editable-field editable-key region-name" style="color:var(--color-accent);">新的地域</span>' +
        '</div>' +
        '<div class="custom-row" style="margin-bottom:8px;">' +
            '<span class="param-label" style="flex-shrink:0;">描述:</span>' +
            '<div class="editable-field editable-textarea region-desc" style="flex:1;">关于此地的相关描述...</div>' +
        '</div>' +
        '<div class="customs-box">' +
            '<div class="param-label" style="display:block; margin-bottom:4px;">\u2756 民俗风情:</div>' +
            '<div class="custom-row custom-item" data-ditem>' +
                '<span class="editable-key editable-field" style="color:#8b5a2b;" data-dkey>新增民俗风情</span>:' +
                '<span class="editable-field" data-dval>相关描述。</span>' +
            '</div>' +
            '<div class="add-custom-btn" onclick="addNewCustom(this)">+ 添加风情词条</div>' +
        '</div>';
    container.appendChild(newAreaBox);
    var tabEl = document.getElementById(tabId);
    if (tabEl.classList.contains('is-edit-mode')) {
        newAreaBox.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
    }
};

window.addNewCustom = function(btnElem) {
    var box = btnElem.parentElement;
    var newRow = document.createElement('div');
    newRow.className = "custom-row custom-item";
    newRow.setAttribute('data-ditem', '');
    newRow.innerHTML = '<span class="editable-key editable-field" style="color:#8b5a2b;" data-dkey>新的民俗风情</span>:<span class="editable-field" data-dval>相关描述。</span>';
    box.insertBefore(newRow, btnElem);
    if (btnElem.closest('.tab-panel').classList.contains('is-edit-mode')) {
        newRow.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
    }
};

window.addNewInventoryItem = function(btnElem) {
    var list = btnElem.previousElementSibling;
    var newRow = document.createElement('li');
    newRow.className = "custom-row";
    newRow.setAttribute('data-ditem', '');
    newRow.innerHTML = '<span class="editable-key editable-field" data-dkey style="color:#8b5a2b;">新增物品</span>:<span class="editable-field" data-dval>物品描述</span>';
    list.appendChild(newRow);
    if (btnElem.closest('.tab-panel').classList.contains('is-edit-mode')) {
        newRow.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
    }
};

window.addNewStoryline = function(btnElem, type) {
    var list = btnElem.previousElementSibling;
    var emptyHint = list.querySelector('.empty-hint');
    if(emptyHint) list.removeChild(emptyHint);
    if(type === 'stage') {
        var items = list.querySelectorAll(':scope > [data-citem]');
        var count = items.length;
        if(count >= 30) { showCustomAlert("剧情阶段至多添加三十个！"); return; }
        var idx = count + 1;
        var titleStr = '阶段' + idx;
        var newRow = document.createElement('li');
        newRow.className = "complex-stage-block";
        newRow.style.cssText = "margin-bottom:12px; border:1px solid rgba(184,134,11,0.2); padding:8px; border-radius:6px; background:rgba(255,255,255,0.3);";
        newRow.setAttribute('data-citem', '');
        newRow.innerHTML =
            '<div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;" class="editable-key editable-field" data-ckey>' + titleStr + '</div>' +
            '<div style="display:flex; flex-direction:column; gap:6px;">' +
                '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>描述</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">设定此处的发展...</div></div>' +
                '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>触发条件</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">抵达此阶段之条件...</div></div>' +
                '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>阶段指导</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">相关演绎准则...</div></div>' +
            '</div>';
        list.appendChild(newRow);
        if (btnElem.closest('.tab-panel').classList.contains('is-edit-mode')) {
            newRow.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
        }
    } else {
        var items2 = list.querySelectorAll(':scope > [data-ditem]');
        var count2 = items2.length;
        if(count2 >= 30) { showCustomAlert("用户偏好至多添加三十个！"); return; }
        var idx2 = count2 + 1;
        var titleStr2 = '指导' + idx2;
        var newRow2 = document.createElement('li');
        newRow2.className = "custom-row";
        newRow2.style.marginBottom = "8px";
        newRow2.setAttribute('data-ditem', '');
        newRow2.innerHTML = '<div class="editable-key editable-field" data-dkey style="color:var(--color-primary-dark); flex-shrink:0;">' + titleStr2 + '</div><div class="editable-field" data-dval style="flex:1;">在此刻画相应的命运轨迹...</div>';
        list.appendChild(newRow2);
        if (btnElem.closest('.tab-panel').classList.contains('is-edit-mode')) {
            newRow2.querySelectorAll('.editable-field').forEach(function(el) { el.setAttribute('contenteditable', 'true'); });
        }
    }
};

// ===== 预设弹窗 =====
var __currentPresetTabId = "";
var __presetStageData = [];
var __presetMode = "loc";
var __tempAddingCustom = null;

window.openPresetModal = function(sourceTabId) {
    __currentPresetTabId = sourceTabId;
    __presetStageData = [];
    __tempAddingCustom = null;
    document.getElementById('presetModalOverlay').classList.add('active');
    switchPresetType('loc');
};

window.closePresetModal = function() {
    document.getElementById('presetModalOverlay').classList.remove('active');
    __presetStageData = [];
};

window.switchPresetType = function(type) {
    __presetMode = type;
    __tempAddingCustom = null;
    document.querySelectorAll('.preset-list-btn').forEach(function(b){b.classList.remove('active');});
    var btns = document.getElementById('presetMenuArea').children;
    if(type==='loc') btns[0].classList.add('active');
    else if(type==='custom') btns[1].classList.add('active');
    else if(type==='combo') btns[2].classList.add('active');
    renderPresetMidPanel();
    renderPresetRightPanel();
};

function toggleDescView(el) {
    var d = el.nextElementSibling;
    d.style.display = d.style.display === 'block' ? 'none' : 'block';
}

window.actionAddLocation = function(idx) {
    var locConf = PRESET_DATA_CONFIG.locations[idx];
    __presetStageData.push({ name: locConf.name, desc: locConf.desc, customs:[] });
    renderPresetRightPanel();
};

window.actionTriggerCustomBind = function(idx, btnElem) {
    var cusConf = PRESET_DATA_CONFIG.customs[idx];
    __tempAddingCustom = { name: cusConf.name, desc: cusConf.desc };
    document.querySelectorAll('.preset-btn-small').forEach(function(e){e.classList.remove('highlight-add');});
    btnElem.classList.add('highlight-add');
    renderPresetRightPanel();
};

window.actionInjectCustomToLoc = function(locIndex) {
    if(__tempAddingCustom) {
        __presetStageData[locIndex].customs.push(__tempAddingCustom);
        __tempAddingCustom = null;
        document.querySelectorAll('.preset-btn-small').forEach(function(e){e.classList.remove('highlight-add');});
        renderPresetRightPanel();
    }
};

window.actionAddCombo = function(idx) {
    var cbConf = PRESET_DATA_CONFIG.combos[idx];
    cbConf.data.forEach(function(item) {
        var pureCustoms = [];
        if(item.customs) item.customs.forEach(function(c) { pureCustoms.push({name: c.name, desc: c.desc}); });
        __presetStageData.push({name: item.name, desc: item.desc, customs: pureCustoms});
    });
    renderPresetRightPanel();
};

window.actionRemoveStageItem = function(locIdx) {
    __presetStageData.splice(locIdx, 1);
    renderPresetRightPanel();
};

window.actionRemoveStageCustom = function(locIdx, cusIdx) {
    __presetStageData[locIdx].customs.splice(cusIdx, 1);
    renderPresetRightPanel();
};

function renderPresetMidPanel() {
    var midTitle = document.getElementById('presetMidTitle');
    var midC = document.getElementById('presetMidContent');
    var htmlStr = "";
    if(__presetMode === 'loc') {
        midTitle.innerText = "预设地点记录列册";
        PRESET_DATA_CONFIG.locations.forEach(function(l, idx) {
            htmlStr +=
                '<div class="preset-item-card">' +
                    '<div class="preset-item-head" onclick="toggleDescView(this)">' +
                        '<span>\u27A4 ' + mtH(l.name) + '</span>' +
                        '<button class="preset-btn-small" onclick="event.stopPropagation(); actionAddLocation(' + idx + ')">\u2795 独建区域</button>' +
                    '</div>' +
                    '<div class="preset-item-desc">' + mtH(l.desc) + '</div>' +
                '</div>';
        });
    }
    else if(__presetMode === 'custom') {
        midTitle.innerText = "民俗风情独立志";
        PRESET_DATA_CONFIG.customs.forEach(function(c, idx) {
            htmlStr +=
                '<div class="preset-item-card">' +
                    '<div class="preset-item-head" onclick="toggleDescView(this)">' +
                        '<span>\u2756 ' + mtH(c.name) + '</span>' +
                        '<button class="preset-btn-small" onclick="event.stopPropagation(); actionTriggerCustomBind(' + idx + ', this)">绑定选中</button>' +
                    '</div>' +
                    '<div class="preset-item-desc">' + mtH(c.desc) + '</div>' +
                '</div>';
        });
    }
    else if(__presetMode === 'combo') {
        midTitle.innerText = "预设套件连携法";
        PRESET_DATA_CONFIG.combos.forEach(function(c, idx) {
            htmlStr +=
                '<div class="preset-item-card">' +
                    '<div class="preset-item-head" onclick="toggleDescView(this)">' +
                        '<span>\uD83D\uDCDA ' + mtH(c.name) + '</span>' +
                        '<button class="preset-btn-small" onclick="event.stopPropagation(); actionAddCombo(' + idx + ')">一键并拢装载</button>' +
                    '</div>' +
                    '<div class="preset-item-desc">' + mtH(c.desc) + '</div>' +
                '</div>';
        });
    }
    midC.innerHTML = htmlStr || "<div style='opacity:0.6; text-align:center; padding:10px;'>尚未设定内容</div>";
}

function renderPresetRightPanel() {
    var rigC = document.getElementById('presetRightContent');
    if(__presetStageData.length === 0) {
        rigC.innerHTML = '<div style="opacity:0.6; text-align:center; padding:20px; font-style:italic;">右侧仍为空寂的沙丘。<br><br>你可以直接将【地点】加入此域界。若是加入【民俗组合】请进入附加装配绑定状态。</div>';
        return;
    }
    var htmlStr = "";
    __presetStageData.forEach(function(sd, idx) {
        var cusLines = "";
        sd.customs.forEach(function(cu, cid){
            cusLines += '<li style="display:flex; justify-content:space-between; margin-bottom:4px;">' +
                '<span><b>' + mtH(cu.name) + '</b></span>' +
                '<span style="color:var(--color-primary-dark); cursor:pointer;" onclick="actionRemoveStageCustom(' + idx + ', ' + cid + ')" title="卸除该风情">\u2716</span>' +
            '</li>';
        });
        var showInjectBtn = (__presetMode === 'custom' && __tempAddingCustom) ? "display:block;" : "display:none;";
        htmlStr +=
            '<div class="staged-loc-card">' +
                '<div class="staged-loc-title">' +
                    '<span>' + mtH(sd.name) + '</span>' +
                    '<span style="color:red; cursor:pointer;" onclick="actionRemoveStageItem(' + idx + ')" title="根除此项">\u2716</span>' +
                '</div>' +
                '<div style="font-size:0.85em; color:#666; margin-bottom:5px;">附辖属民俗 (共' + sd.customs.length + '类)：</div>' +
                '<ul class="staged-custom-list">' + cusLines + '</ul>' +
                '<div class="target-drop-btn" style="' + showInjectBtn + '" onclick="actionInjectCustomToLoc(' + idx + ')">\u2795 确立投聚于此处</div>' +
            '</div>';
    });
    rigC.innerHTML = htmlStr;
}

window.commitPresetData = function() {
    if(__presetStageData.length === 0) { showCustomAlert("请至少选择一项预设内容。"); return; }
    var regionSuperBox = document.getElementById('regions-' + __currentPresetTabId);
    if(!regionSuperBox) return;
    var mainTabEl = document.getElementById(__currentPresetTabId);
    var forceEditorProp = mainTabEl.classList.contains('is-edit-mode') ? "contenteditable='true'" : "";
    __presetStageData.forEach(function(loc) {
        var wrapBox = document.createElement('div');
        wrapBox.className = "area-box area-item";
        var customHtmlFlow = "";
        loc.customs.forEach(function(cus) {
            customHtmlFlow +=
                '<div class="custom-row custom-item" data-ditem>' +
                    '<span class="editable-key editable-field" style="color:#8b5a2b;" data-dkey ' + forceEditorProp + '>' + mtH(cus.name) + '</span>: ' +
                    '<span class="editable-field" data-dval ' + forceEditorProp + '>' + mtH(cus.desc) + '</span>' +
                '</div>';
        });
        wrapBox.innerHTML =
            '<div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;">' +
                '\u27A4 <span class="editable-field editable-key region-name" style="color:var(--color-accent);" ' + forceEditorProp + '>' + mtH(loc.name) + '</span>' +
            '</div>' +
            '<div class="custom-row" style="margin-bottom:8px;">' +
                '<span class="param-label" style="flex-shrink:0;">描述:</span>' +
                '<div class="editable-field editable-textarea region-desc" style="flex:1;" ' + forceEditorProp + '>' + mtH(loc.desc) + '</div>' +
            '</div>' +
            '<div class="customs-box">' +
                '<div class="param-label" style="display:block; margin-bottom:4px;">\u2756 民俗风情:</div>' +
                customHtmlFlow +
                '<div class="add-custom-btn" onclick="addNewCustom(this)">+ 添加风情词条</div>' +
            '</div>';
        regionSuperBox.appendChild(wrapBox);
    });
    showCustomAlert("预设已加载");
    closePresetModal();
    setTimeout(function() { regionSuperBox.scrollIntoView({behavior: "smooth", block: "end"}); }, 300);
};

// ===== 角色管理 =====
var __cachedEntries = [];

async function fetchCharEntries() {
    try {
        if(typeof getLorebookEntries === 'function') {
            var entries = await getLorebookEntries(LOREBOOK_NAME, {fields:['uid','comment','content','enabled','order']});
            return entries.filter(function(e) { return e.order >= 125 && e.order <= 149; });
        }
    } catch(e) { console.warn("未能读取世界书记录：", e); }
    return [];
}

window.populateCharSelectors = async function() {
    var chars = await fetchCharEntries();
    __cachedEntries = chars;
    document.querySelectorAll('select[id^="char-select-"]').forEach(function(sel) {
        var html = '<option value="">- 请从下列条目中选择一个 -</option>';
        chars.forEach(function(c) {
            var displayMark = c.comment && c.comment.trim() !== '' ? c.comment : '未命名条目';
            html += '<option value="' + c.uid + '">' + mtH(displayMark) + '</option>';
        });
        sel.innerHTML = html;
    });
};

window.ifConfirmThenPopulate = async function() {
    if(await showCustomConfirm("是否重新加载世界书？")) {
        populateCharSelectors();
        refreshCharManager();
    }
};

window.loadCharEntry = function(selElem, tabId) {
    var uid = parseInt(selElem.value, 10);
    var entry = __cachedEntries.find(function(e) { return e.uid === uid; });
    var nameInput = document.getElementById('char-name-' + tabId);
    var contentArea = document.getElementById('char-content-' + tabId);
    if (entry) {
        nameInput.value = entry.comment || "";
        contentArea.value = entry.content || "";
    } else {
        nameInput.value = ""; contentArea.value = "";
    }
};

window.saveCharEntry = async function(tabId) {
    if (typeof setLorebookEntries !== 'function') { showCustomAlert("提示：请确认正处于兼容脚本运行的次元环境节点！"); return; }
    var selElem = document.getElementById('char-select-' + tabId);
    if (!selElem.value) { showCustomAlert("写入失败，请先选择可用的条目"); return; }
    var isGranted = await showCustomConfirm("确认写入该角色吗");
    if (!isGranted) return;
    var uid = parseInt(selElem.value, 10);
    var nameVal = document.getElementById('char-name-' + tabId).value.trim();
    var contentVal = document.getElementById('char-content-' + tabId).value.trim();
    try {
        await setLorebookEntries(LOREBOOK_NAME, [{ uid: uid, comment: nameVal, content: contentVal }]);
        showCustomAlert("\u2728 已写入世界书");
        await populateCharSelectors();
        await refreshCharManager();
    } catch(e) { showCustomAlert("写入失败，请刷新或重新连接世界书"); }
};

window.refreshCharManager = async function() {
    var charListBox = document.getElementById('char-manage-list');
    if(!charListBox) return;
    charListBox.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.7;'>寻找中...</div>";
    var chars = await fetchCharEntries();
    if(chars.length === 0) {
        charListBox.innerHTML = "<div style='text-align:center; padding:20px; opacity:0.7;'>找不到《千叶的睡前小故事》的世界书。</div>";
        return;
    }
    var listHTML = "";
    chars.forEach(function(c) {
        var cname = c.comment && c.comment.trim() ? c.comment : '(空)';
        listHTML +=
            '<div style="background:rgba(212,175,55,0.05); border:1px solid rgba(212,175,55,0.2); margin-bottom:10px; border-radius:6px; overflow:hidden;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; cursor:pointer; background:rgba(255,255,255,0.7); border-bottom:1px solid rgba(212,175,55,0.15);" onclick="toggleCharDetail(' + c.uid + ')">' +
                    '<span style="font-weight:bold; color:var(--color-primary-dark);">' + mtH(cname) + '</span>' +
                    '<div style="display:flex; align-items:center; gap:8px;" onclick="event.stopPropagation();">' +
                        '<span style="font-size:0.85rem; color:' + (c.enabled ? 'var(--color-primary-dark)' : '#666') + '; font-weight:bold;">激活</span>' +
                        '<label class="switch-ui" style="transform:scale(0.8); margin-bottom:0;">' +
                            '<input type="checkbox" ' + (c.enabled ? 'checked' : '') + ' onchange="toggleCharStatus(' + c.uid + ', this)">' +
                            '<span class="slider"></span>' +
                        '</label>' +
                    '</div>' +
                '</div>' +
                '<div id="char-detail-body-' + c.uid + '" style="display:none; padding:10px; background:rgba(253,246,227,0.8);">' +
                    '<span class="param-label" style="display:block; margin-bottom:4px;">条目名:</span>' +
                    '<input type="text" id="charmgr-name-' + c.uid + '" class="charmgr-name-input" value="' + fc1EscapeAttr(c.comment || '') + '">' +
                    '<span class="param-label" style="display:block; margin:8px 0 4px;">条目内容:</span>' +
                    '<textarea id="charmgr-content-' + c.uid + '" class="charmgr-content-input">' + fc1EscapeHtml(c.content || '') + '</textarea>' +
                    '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">' +
                        '<button class="charmgr-save-btn" onclick="saveCharManagerEntry(' + c.uid + ')">\u2727 保存 \u2727</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
    });
    charListBox.innerHTML = listHTML;
};

window.saveCharManagerEntry = async function(uid) {
    if (typeof setLorebookEntries !== 'function') { showCustomAlert("提示：请确认正处于兼容脚本运行的次元环境节点！"); return; }
    var nameInput = document.getElementById('charmgr-name-' + uid);
    var contentInput = document.getElementById('charmgr-content-' + uid);
    if (!nameInput || !contentInput) return;
    var nameVal = nameInput.value.trim();
    var contentVal = contentInput.value;
    var isGranted = await showCustomConfirm("确认写入该角色吗");
    if (!isGranted) return;
    try {
        await setLorebookEntries(LOREBOOK_NAME, [{ uid: uid, comment: nameVal, content: contentVal }]);
        showCustomAlert("\u2728 已写入世界书");
        await populateCharSelectors();
        await refreshCharManager();
    } catch(e) { showCustomAlert("写入失败，请刷新或重新连接世界书"); }
};

window.toggleCharDetail = function(uid) {
    var detailBox = document.getElementById('char-detail-body-' + uid);
    detailBox.style.display = detailBox.style.display === "none" ? "block" : "none";
};

window.toggleCharStatus = async function(uid, checkboxEl) {
    var isEnabled = checkboxEl.checked;
    var confirm = await showCustomConfirm(isEnabled ? "确认开启该人物？" : "确认关闭该人物？");
    if (!confirm) { checkboxEl.checked = !isEnabled; return; }
    if (typeof setLorebookEntries === 'function') {
        try { await setLorebookEntries(LOREBOOK_NAME, [{ uid: uid, enabled: isEnabled }]); } catch(e) {}
    } else { showCustomAlert("未侦察到界限执行API支持！"); }
};

// ===== 投递输出 =====
function triggerSTSlashSend(storyText, finalJsonObj) {
    var compactJSONStr = JSON.stringify(finalJsonObj, null, 0);
    var tokenTagOpen = "<VariableInsert>";
    var tokenTagClose = "</VariableInsert>";
    var finalMsg = storyText + '\n' + tokenTagOpen + '\n' + compactJSONStr + '\n' + tokenTagClose;
    console.log("即将投递出的世界讯息：\n", finalMsg);
    try {
        if (typeof triggerSlash === 'function') { triggerSlash('/sendas name="千叶的睡前小故事" ' + finalMsg); }
        else if (typeof window.parent.triggerSlash === 'function') { window.parent.triggerSlash('/sendas name="Frontend Assistant" ' + finalMsg); }
        else { showCustomAlert("\u26A0 脚本检测未连接到主核心，讯息将仅留刻在网页虚空(控制台输出)。"); }
    } catch(e) { console.error(e); showCustomAlert("通讯投递受阻！"); }
}

// ===== 工具：生成列表 HTML =====
function generateInventoryList(invObj) {
    var str = "";
    var keys = Object.keys(invObj);
    if(keys.length === 0) {
        str = '<li class="custom-row" data-ditem><span class="editable-key editable-field" data-dkey style="color:#8b5a2b;">新增物品</span>:<span class="editable-field" data-dval>物品描述。</span></li>';
    } else {
        keys.forEach(function(k) { str += '<li class="custom-row" data-ditem><span class="editable-key editable-field" data-dkey style="color:#8b5a2b;">' + mtH(k) + '</span>:<span class="editable-field" data-dval>' + mtH(invObj[k]) + '</span></li>'; });
    }
    return str;
}

function generateStorylines(lineObj) {
    var str = "";
    var keys = Object.keys(lineObj);
    if(keys.length === 0) {
        str = '<li class="empty-hint" style="opacity:0.7;">- 前路尚未明晰 -</li>';
    } else {
        keys.forEach(function(k) { str += '<li class="custom-row" style="margin-bottom:8px;" data-ditem><div class="editable-key editable-field" data-dkey style="color:var(--color-primary-dark); flex-shrink:0;">' + mtH(k) + '</div> <div class="editable-field" data-dval style="flex:1;">' + mtH(lineObj[k]) + '</div></li>'; });
    }
    return str;
}

function generateComplexStorylines(lineObj) {
    var str = "";
    var keys = Object.keys(lineObj);
    if(keys.length === 0) {
        str = '<li class="empty-hint" style="opacity:0.7;">- 前路尚未明晰 -</li>';
    } else {
        keys.forEach(function(k) {
            var subObj = lineObj[k];
            var desc = "", cond = "", guide = "";
            if(typeof subObj === 'string') {
                desc = subObj;
            } else if(typeof subObj === 'object' && subObj !== null) {
                desc = subObj["描述"] || "";
                cond = subObj["触发条件"] || "";
                guide = subObj["阶段指导"] || "";
            }
            str += '<li class="complex-stage-block" style="margin-bottom:12px; border:1px solid rgba(184,134,11,0.2); padding:8px; border-radius:6px; background:rgba(255,255,255,0.3);" data-citem>' +
                '<div style="font-weight:bold; color:var(--color-primary-dark); margin-bottom:5px; border-bottom:1px dashed rgba(184,134,11,0.3); padding-bottom:5px;" class="editable-key editable-field" data-ckey>' + mtH(k) + '</div>' +
                '<div style="display:flex; flex-direction:column; gap:6px;">' +
                    '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>描述</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">' + mtH(desc) + '</div></div>' +
                    '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>触发条件</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">' + mtH(cond) + '</div></div>' +
                    '<div class="custom-row" style="margin:0;"><span class="param-label" style="font-size:0.9em; flex-shrink:0;" data-skey>阶段指导</span>: <div class="editable-field editable-textarea" data-sval style="flex:1;">' + mtH(guide) + '</div></div>' +
                '</div>' +
            '</li>';
        });
    }
    return str;
}
