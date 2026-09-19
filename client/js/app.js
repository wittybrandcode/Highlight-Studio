/**
 * ============================================================
 * HIGHLIGHT STUDIO — CLIENT CONTROLLER & MODULAR ENGINE
 * Architecture: Clean Namespaces (HS.Config, HS.State, HS.Bridge,
 *               HS.Sync, HS.Controls, HS.PhraseManager, HS.Actions)
 * Version: 2.1.0
 * ============================================================
 */

(function (window, document) {
    "use strict";

    var HS = window.HS || {};
    window.HS = HS;

    // ============================================================
    // 1. CONFIGURATION & PRESETS
    // ============================================================
    HS.Config = {
        defaults: {
            color: "#3C4BB9",
            style: "box",
            direction: "auto",
            paddingX: 10,
            paddingY: 10,
            roundness: 0,
            opacity: 100,
            animate: true,
            motion: "typewriter",
            sequential: true,
            lineDuration: 0.35,
            stagger: 0.00,
            outro: false,
            outTime: 1.50,
            outroOrder: "first",
            scope: "all",
            syncMarkers: false
        },
        presets: {
            typewriter: { name: "Typewriter Sync (Core)", color: "#3C4BB9", padX: 10, padY: 10, round: 0, opacity: 100, style: "box", motion: "typewriter", dur: 0.35, stagger: 0.00, sequential: true },
            vox:        { name: "Vox Documentary",       color: "#FFE600", padX: 8,  padY: 2,  round: 2,  opacity: 90,  style: "marker", motion: "wipe", dur: 0.35, stagger: 0.00, sequential: true },
            clean:      { name: "Clean Underline",       color: "#0D99FF", padX: 6,  padY: 2,  round: 0,  opacity: 100, style: "underline", motion: "wipe", dur: 0.25, stagger: 0.00, sequential: true }
        }
    };

    // ============================================================
    // 2. RUNTIME STATE
    // ============================================================
    HS.State = {
        scope: "all",               // "all" | "line"
        mainTab: "paragraph",       // "paragraph" | "phrases"
        outroOrder: "first",        // "first" (1->N) | "last" (N->1)
        lastUserInteraction: 0,
        lastSyncedLayer: "",
        lastTokensRawText: null,
        phraseTokens: [],
        selectedTokenIndices: [],
        lastClickedTokenIndex: -1,
        isDraggingTokenSelect: false,
        dragSelectActive: true,
        appliedPhrases: []
    };

    // Mark user interaction timestamp to prevent background polling overwrites
    HS.markInteraction = function () {
        HS.State.lastUserInteraction = Date.now();
    };

    // ============================================================
    // 3. CACHED DOM REPOSITORY
    // ============================================================
    HS.DOM = {
        // Header
        scopeBadge: document.getElementById("scope-badge"),
        btnReload: document.getElementById("btn-reload"),

        // Presets & Tabs
        presetSelect: document.getElementById("preset-select"),
        btnSavePreset: document.getElementById("btn-save-preset"),
        btnDeletePreset: document.getElementById("btn-delete-preset"),
        presetModal: document.getElementById("preset-modal"),
        btnClosePresetModal: document.getElementById("btn-close-preset-modal"),
        presetNameInput: document.getElementById("preset-name-input"),
        modalPresetColorPreview: document.getElementById("modal-preset-color-preview"),
        modalPresetDetails: document.getElementById("modal-preset-details"),
        btnCancelPreset: document.getElementById("btn-cancel-preset"),
        btnConfirmSavePreset: document.getElementById("btn-confirm-save-preset"),
        tabBtnParagraph: document.getElementById("tab-btn-paragraph"),
        tabBtnPhrases: document.getElementById("tab-btn-phrases"),
        viewParagraph: document.getElementById("view-paragraph"),
        viewPhrases: document.getElementById("view-phrases"),

        // Tab 1: Paragraph & Lines
        btnScopeAll: document.getElementById("btn-scope-all"),
        btnScopeLine: document.getElementById("btn-scope-line"),
        targetInfoName: document.getElementById("target-info-name"),
        styleSelect: document.getElementById("style-select"),
        alignSelect: document.getElementById("align-select"),
        colorPicker: document.getElementById("color-picker"),
        colorHex: document.getElementById("color-hex"),
        padXInput: document.getElementById("pad-x"),
        padYInput: document.getElementById("pad-y"),
        roundInput: document.getElementById("roundness"),
        opacityInput: document.getElementById("opacity-input"),
        animCheck: document.getElementById("anim-check"),
        animControls: document.getElementById("anim-controls"),
        motionSelect: document.getElementById("motion-select"),
        lineDurInput: document.getElementById("line-dur"),
        outTimeInput: document.getElementById("out-time"),
        outTimeCol: document.getElementById("out-time-col"),
        staggerInput: document.getElementById("stagger"),
        staggerLabel: document.getElementById("stagger-label"),
        sequentialCheck: document.getElementById("sequential-check"),
        outroCheck: document.getElementById("outro-check"),
        btnOutroOrder: document.getElementById("btn-outro-order"),
        orderLabel: document.getElementById("order-label"),
        markerSyncCheck: document.getElementById("marker-sync-check"),
        btnSmartApply: document.getElementById("btn-smart-apply"),
        btnClear: document.getElementById("btn-clear"),

        // Tab 2: Phrase Highlight
        phraseTargetName: document.getElementById("phrase-target-name"),
        phraseCountBadge: document.getElementById("phrase-count-badge"),
        btnPhraseClearSel: document.getElementById("btn-phrase-clear-sel"),
        tokensBoard: document.getElementById("tokens-board"),
        appliedPhrasesWrap: document.getElementById("applied-phrases-wrap"),
        appliedPhrasesCount: document.getElementById("applied-phrases-count"),
        appliedPhrasesList: document.getElementById("applied-phrases-list"),
        phraseStyleSelect: document.getElementById("phrase-style-select"),
        phraseMotionSelect: document.getElementById("phrase-motion-select"),
        phraseColorInput: document.getElementById("phrase-color-input"),
        phraseColorHex: document.getElementById("phrase-color-hex"),
        phrasePadX: document.getElementById("phrase-pad-x"),
        phrasePadY: document.getElementById("phrase-pad-y"),
        chipPhraseOutro: document.getElementById("chip-phrase-outro"),
        phraseOutroCheck: document.getElementById("phrase-outro-check"),
        chipPhraseSeq: document.getElementById("chip-phrase-seq"),
        phraseSeqCheck: document.getElementById("phrase-seq-check"),
        phraseHoldCol: document.getElementById("phrase-hold-col"),
        phraseHoldTime: document.getElementById("phrase-hold-time"),
        btnApplyPhrase: document.getElementById("btn-apply-phrase"),
        btnClearPhrase: document.getElementById("btn-clear-phrase"),

        // Global Status & Debug
        statusBar: document.getElementById("status-bar"),
        statusText: document.getElementById("status-text"),
        btnDebug: document.getElementById("btn-debug"),
        debugPanel: document.getElementById("debug-panel"),
        debugLog: document.getElementById("debug-log"),
        btnRefreshLog: document.getElementById("btn-refresh-log"),
        btnClearLog: document.getElementById("btn-clear-log")
    };

    // ============================================================
    // 4. AFTER EFFECTS BRIDGE (CSINTERFACE & EVALSCRIPT)
    // ============================================================
    var csInterface = new CSInterface();
    HS.csInterface = csInterface;

    HS.Bridge = {
        // Ensure hostscript.jsx is live loaded from disk
        ensureLoaded: function (callback) {
            try {
                var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
                if (extPath) {
                    var scriptPath = (extPath + "/host/hostscript.jsx").replace(/\\/g, "/");
                    csInterface.evalScript('$.evalFile("' + scriptPath + '")', function () {
                        if (callback) callback();
                    });
                    return;
                }
            } catch (e) {}
            if (callback) callback();
        },

        // Evaluate script with safety logging
        eval: function (cmd, cb) {
            csInterface.evalScript(cmd, function (res) {
                if (cb) cb(res);
            });
        },

        // Hex to RGBA array [0..1]
        hexToRgba: function (hex) {
            var c = (hex || "#FFFFFF").replace("#", "");
            if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            var r = parseInt(c.substring(0, 2), 16) / 255;
            var g = parseInt(c.substring(2, 4), 16) / 255;
            var b = parseInt(c.substring(4, 6), 16) / 255;
            return [r, g, b, 1.0];
        }
    };

    // Initialize host script on launch
    HS.Bridge.ensureLoaded();

    // ============================================================
    // 5. STATUS & MESSAGING
    // ============================================================
    HS.setStatus = function (msg, isError) {
        if (!HS.DOM.statusText || !HS.DOM.statusBar) return;
        HS.DOM.statusText.textContent = msg;
        HS.DOM.statusText.title = msg;
        HS.DOM.statusBar.classList.toggle("error", !!isError);
    };

    HS.showReport = function (res) {
        var msg = (res || "").replace("SUCCESS:", "").replace("SUCCESS", "").trim();
        HS.setStatus(msg || "Done.");
    };

    // ============================================================
    // 6. SCOPE & TABS MANAGEMENT
    // ============================================================
    HS.setScope = function (scope, fromAE) {
        HS.State.scope = scope;
        if (!fromAE) HS.markInteraction();

        if (HS.DOM.btnScopeAll) HS.DOM.btnScopeAll.classList.toggle("active", scope === "all");
        if (HS.DOM.btnScopeLine) HS.DOM.btnScopeLine.classList.toggle("active", scope === "line");

        if (HS.DOM.scopeBadge) {
            HS.DOM.scopeBadge.textContent = (scope === "line") ? "LOCAL" : "MASTER";
            HS.DOM.scopeBadge.classList.toggle("local", scope === "line");
        }

        if (!fromAE) {
            HS.setStatus(scope === "line" ? "Scope: Selected Line Only (Local)" : "Scope: All Lines (Master)");
        }
    };

    HS.switchMainTab = function (tab) {
        HS.State.mainTab = tab;
        var isPhrases = (tab === "phrases");

        if (HS.DOM.tabBtnParagraph) HS.DOM.tabBtnParagraph.classList.toggle("active", !isPhrases);
        if (HS.DOM.tabBtnPhrases) HS.DOM.tabBtnPhrases.classList.toggle("active", isPhrases);

        if (HS.DOM.viewParagraph) {
            HS.DOM.viewParagraph.style.display = isPhrases ? "none" : "block";
            HS.DOM.viewParagraph.classList.toggle("active", !isPhrases);
        }
        if (HS.DOM.viewPhrases) {
            HS.DOM.viewPhrases.style.display = isPhrases ? "block" : "none";
            HS.DOM.viewPhrases.classList.toggle("active", isPhrases);
        }

        if (isPhrases) {
            HS.Sync.fromAE(true);
            HS.setStatus("Phrase Highlight: Click words to select");
        } else {
            HS.setStatus("Paragraph & Lines: " + (HS.State.scope === "all" ? "Master (All Lines)" : "Single Line"));
        }
    };

    // ============================================================
    // 7. TWO-WAY SYNC CONTROLLER
    // ============================================================
    HS.Sync = {
        isSyncing: false,

        fromAE: function (force) {
            // Pause polling when tab is hidden or backgrounded
            if (document.hidden && !force) return;
            if (HS.Sync.isSyncing && !force) return;
            HS.Sync.isSyncing = true;

            // Protect active user input from being overwritten by background polling
            var isRecentEdit = (Date.now() - HS.State.lastUserInteraction < 2500);

            HS.Bridge.eval("$._smartHighlighter.getLayerState()", function (resStr) {
                HS.Sync.isSyncing = false;
                if (!resStr || resStr === "EvalScript error.") return;
                try {
                    var state = JSON.parse(resStr);
                    if (state && state.ok) {
                        var layerChanged = (state.layerName && state.layerName !== HS.State.lastSyncedLayer);
                        if (state.layerName) HS.State.lastSyncedLayer = state.layerName;

                        // Target Info Strip
                        if (HS.DOM.targetInfoName) {
                            var rawName = state.layerName || (state.type === "text" ? "Text Layer" : "Line Shape");
                            var truncName = rawName.length > 24 ? (rawName.substring(0, 22) + "...") : rawName;
                            var typeLabel = (state.type === "text") ? " (Master)" : (state.isLocal ? " (Local)" : " (Master Linked)");
                            HS.DOM.targetInfoName.textContent = truncName + typeLabel;
                            HS.DOM.targetInfoName.title = rawName + typeLabel;
                        }

                        // Auto scope detection
                        if (state.type === "shape" && HS.State.scope !== "line") {
                            HS.setScope("line", true);
                        } else if (state.type === "text" && HS.State.scope !== "all") {
                            HS.setScope("all", true);
                        }

                        // Parameter values update
                        if (state.hasHighlight) {
                            if (state.color && HS.DOM.colorPicker && document.activeElement !== HS.DOM.colorPicker && (!isRecentEdit || layerChanged || force)) {
                                HS.DOM.colorPicker.value = state.color;
                                if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = state.color.toUpperCase();
                            }
                            if (!isRecentEdit || layerChanged || force) {
                                if (typeof state.paddingX === "number" && HS.DOM.padXInput && document.activeElement !== HS.DOM.padXInput) {
                                    HS.DOM.padXInput.value = state.paddingX;
                                }
                                if (typeof state.paddingY === "number" && HS.DOM.padYInput && document.activeElement !== HS.DOM.padYInput) {
                                    HS.DOM.padYInput.value = state.paddingY;
                                }
                                if (typeof state.roundness === "number" && HS.DOM.roundInput && document.activeElement !== HS.DOM.roundInput) {
                                    HS.DOM.roundInput.value = state.roundness;
                                }
                                if (typeof state.opacity === "number" && HS.DOM.opacityInput && document.activeElement !== HS.DOM.opacityInput) {
                                    HS.DOM.opacityInput.value = state.opacity;
                                }
                            }
                        }

                        // Tokens board sync for Phrase Highlight tab
                        if (typeof state.text === "string") {
                            HS.PhraseManager.renderBoard(state.text, state.layerName);
                            HS.PhraseManager.syncAppliedPhrases();
                        }
                    } else {
                        if (HS.DOM.targetInfoName) {
                            HS.DOM.targetInfoName.textContent = "Select Text or Shape Layer";
                            HS.DOM.targetInfoName.title = "";
                        }
                        HS.PhraseManager.renderBoard("", "");
                        HS.PhraseManager.syncAppliedPhrases();
                    }
                } catch (e) {}
            });
        }
    };

    // Auto-polling when window is visible (Pauses when minimized or hidden)
    window.addEventListener("focus", function () { HS.Sync.fromAE(true); });
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) HS.Sync.fromAE(true);
    });
    setInterval(function () {
        if (!document.hidden && Date.now() - HS.State.lastUserInteraction > 2500) {
            HS.Sync.fromAE();
        }
    }, 2000);
    HS.Sync.fromAE();

    // ============================================================
    // 8. LIVE CONTROLS & STEPPER ENGINE
    // ============================================================
    HS.Controls = {
        applyLiveColor: function (hex) {
            HS.Bridge.eval("$._smartHighlighter.setQuickColor('" + hex + "', '" + HS.State.scope + "')", function (res) {
                if (res && res.indexOf("SUCCESS") !== -1) {
                    HS.setStatus(res.replace("SUCCESS:", "").trim());
                } else if (res && res.indexOf("ERROR") !== -1) {
                    HS.setStatus(res.replace("ERROR:", "").trim(), true);
                }
            });
        },

        applyLiveParam: function (paramName, val) {
            HS.markInteraction();
            HS.Bridge.eval("$._smartHighlighter.setQuickParam('" + paramName + "', " + val + ", '" + HS.State.scope + "')", function (res) {
                if (res && res.indexOf("SUCCESS") !== -1) {
                    HS.setStatus(res.replace("SUCCESS:", "").trim());
                }
            });
        },

        adjustStepper: function (input, isUp, multiplier) {
            HS.markInteraction();
            if (!input || input.disabled) return;
            multiplier = multiplier || 1;
            var step = (parseFloat(input.step) || 1) * multiplier;
            var val = parseFloat(input.value) || 0;
            val = isUp ? val + step : val - step;
            var min = input.min !== "" ? parseFloat(input.min) : -Infinity;
            var max = input.max !== "" ? parseFloat(input.max) : Infinity;
            val = Math.max(min, Math.min(max, val));

            var stepStr = input.step || "1";
            if (stepStr.indexOf(".") !== -1) {
                var decimals = stepStr.split(".")[1].length;
                input.value = val.toFixed(decimals);
            } else {
                input.value = Math.round(val);
            }

            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
        },

        syncChipClasses: function () {
            var chips = [
                { id: "chip-seq", chk: HS.DOM.sequentialCheck },
                { id: "chip-outro", chk: HS.DOM.outroCheck },
                { id: "chip-markers", chk: HS.DOM.markerSyncCheck },
                { id: "chip-phrase-outro", chk: HS.DOM.phraseOutroCheck },
                { id: "chip-phrase-seq", chk: HS.DOM.phraseSeqCheck }
            ];
            chips.forEach(function (item) {
                var el = document.getElementById(item.id);
                if (!el || !item.chk) return;
                var isActive = !!item.chk.checked;
                el.classList.toggle("active", isActive);
                el.setAttribute("data-active", isActive ? "true" : "false");
            });
        },

        setOutroOrder: function (order) {
            HS.State.outroOrder = order;
            if (HS.DOM.btnOutroOrder) HS.DOM.btnOutroOrder.dataset.order = order;
            if (HS.DOM.orderLabel) HS.DOM.orderLabel.textContent = (order === "last") ? "N➔1" : "1➔N";
            if (HS.DOM.btnOutroOrder) {
                HS.DOM.btnOutroOrder.title = (order === "last")
                    ? "Exit Order: Last Line First (N➔1). Click to toggle: 1➔N"
                    : "Exit Order: First Line First (1➔N). Click to toggle: N➔1";
            }
            HS.setStatus("Outro Order: " + (order === "last" ? "Last Line First (N➔1)" : "First Line First (1➔N)"));
        }
    };

    // ============================================================
    // ============================================================
    // 8.5. PRESETS MANAGER (Dropdown-based Presets & Persistence)
    // ============================================================
    HS.Presets = {
        STORAGE_KEY: "highlight_studio_custom_presets_v1",
        builtins: HS.Config.presets,
        custom: {},
        activePresetId: "typewriter",

        init: function () {
            HS.Presets.loadFromStorage();
            HS.Presets.populateDropdown();
        },

        loadFromStorage: function () {
            try {
                var raw = localStorage.getItem(HS.Presets.STORAGE_KEY);
                if (raw) {
                    HS.Presets.custom = JSON.parse(raw);
                }
            } catch (e) {
                console.warn("[Highlight-Studio] Could not load presets:", e);
                HS.Presets.custom = {};
            }
        },

        saveToStorage: function () {
            try {
                localStorage.setItem(HS.Presets.STORAGE_KEY, JSON.stringify(HS.Presets.custom));
            } catch (e) {
                console.warn("[Highlight-Studio] Could not save presets:", e);
            }
        },

        populateDropdown: function () {
            if (!HS.DOM.presetSelect) return;
            var sel = HS.DOM.presetSelect;
            sel.innerHTML = "";

            // 1. Built-in Core Presets
            var coreGroup = document.createElement("optgroup");
            coreGroup.label = "Default Presets";

            var builtinKeys = Object.keys(HS.Presets.builtins);
            builtinKeys.forEach(function (id) {
                var b = HS.Presets.builtins[id];
                var opt = document.createElement("option");
                opt.value = id;
                opt.textContent = b.name || id;
                if (id === HS.Presets.activePresetId) opt.selected = true;
                coreGroup.appendChild(opt);
            });
            sel.appendChild(coreGroup);

            // 2. Custom Presets
            var customKeys = Object.keys(HS.Presets.custom);
            if (customKeys.length > 0) {
                var custGroup = document.createElement("optgroup");
                custGroup.label = "Custom Presets";
                customKeys.forEach(function (id) {
                    var c = HS.Presets.custom[id];
                    var opt = document.createElement("option");
                    opt.value = id;
                    opt.textContent = c.name || "Custom";
                    if (id === HS.Presets.activePresetId) opt.selected = true;
                    custGroup.appendChild(opt);
                });
                sel.appendChild(custGroup);
            }

            sel.value = HS.Presets.activePresetId;
            HS.Presets.updateDeleteButton();
        },

        updateDeleteButton: function () {
            if (!HS.DOM.btnDeletePreset) return;
            var isCustom = !!(HS.Presets.custom && HS.Presets.custom[HS.Presets.activePresetId]);
            HS.DOM.btnDeletePreset.style.display = isCustom ? "inline-flex" : "none";
        },

        getPresetData: function (id) {
            if (HS.Presets.builtins[id]) {
                return HS.Presets.builtins[id];
            }
            if (HS.Presets.custom[id]) {
                return HS.Presets.custom[id].data;
            }
            return null;
        },

        apply: function (id) {
            var p = HS.Presets.getPresetData(id);
            if (!p) return;

            HS.Presets.activePresetId = id;
            if (HS.DOM.presetSelect && HS.DOM.presetSelect.value !== id) {
                HS.DOM.presetSelect.value = id;
            }
            HS.Presets.updateDeleteButton();

            if (HS.DOM.colorPicker && p.color) {
                HS.DOM.colorPicker.value = p.color;
                if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = p.color.toUpperCase();
                document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn").forEach(function (b) {
                    b.classList.toggle("active", b.dataset.color.toLowerCase() === p.color.toLowerCase());
                });
            }
            if (HS.DOM.padXInput && typeof p.padX === "number") HS.DOM.padXInput.value = p.padX;
            if (HS.DOM.padYInput && typeof p.padY === "number") HS.DOM.padYInput.value = p.padY;
            if (HS.DOM.roundInput && typeof p.round === "number") HS.DOM.roundInput.value = p.round;
            if (HS.DOM.opacityInput && typeof p.opacity === "number") HS.DOM.opacityInput.value = p.opacity;
            if (HS.DOM.lineDurInput && typeof p.dur === "number") HS.DOM.lineDurInput.value = p.dur;
            if (HS.DOM.staggerInput && typeof p.stagger === "number") HS.DOM.staggerInput.value = p.stagger;
            if (p.style && HS.DOM.styleSelect) HS.DOM.styleSelect.value = p.style;
            if (p.motion && HS.DOM.motionSelect) HS.DOM.motionSelect.value = p.motion;
            if (HS.DOM.sequentialCheck && typeof p.sequential === "boolean") {
                HS.DOM.sequentialCheck.checked = p.sequential;
            }
            if (HS.DOM.outroCheck && typeof p.outro === "boolean") {
                HS.DOM.outroCheck.checked = p.outro;
                if (HS.DOM.outTimeInput) HS.DOM.outTimeInput.disabled = !p.outro;
                if (HS.DOM.outTimeCol) HS.DOM.outTimeCol.classList.toggle("disabled", !p.outro);
            }
            if (HS.DOM.outTimeInput && typeof p.outTime === "number") HS.DOM.outTimeInput.value = p.outTime;

            HS.Controls.syncChipClasses();
            if (p.color) HS.Controls.applyLiveColor(p.color);
            if (typeof p.round === "number") HS.Controls.applyLiveParam("roundness", p.round);
            if (typeof p.padX === "number") HS.Controls.applyLiveParam("padX", p.padX);
            if (typeof p.padY === "number") HS.Controls.applyLiveParam("padY", p.padY);
            if (typeof p.opacity === "number") HS.Controls.applyLiveParam("opacity", p.opacity);

            var pName = (HS.Presets.custom[id] ? HS.Presets.custom[id].name : (p.name || id));
            HS.setStatus("Preset: '" + pName + "' applied");
        },

        getCurrentSettings: function () {
            var col = HS.DOM.colorPicker ? HS.DOM.colorPicker.value : "#3C4BB9";
            var st = HS.DOM.styleSelect ? HS.DOM.styleSelect.value : "box";
            var mot = HS.DOM.motionSelect ? HS.DOM.motionSelect.value : "typewriter";
            var px = HS.DOM.padXInput ? (parseFloat(HS.DOM.padXInput.value) || 10) : 10;
            var py = HS.DOM.padYInput ? (parseFloat(HS.DOM.padYInput.value) || 10) : 10;
            var rnd = HS.DOM.roundInput ? (parseFloat(HS.DOM.roundInput.value) || 0) : 0;
            var opac = HS.DOM.opacityInput ? (parseFloat(HS.DOM.opacityInput.value) || 100) : 100;
            var dur = HS.DOM.lineDurInput ? (parseFloat(HS.DOM.lineDurInput.value) || 0.35) : 0.35;
            var stag = HS.DOM.staggerInput ? (parseFloat(HS.DOM.staggerInput.value) || 0) : 0;
            var seq = HS.DOM.sequentialCheck ? HS.DOM.sequentialCheck.checked : true;
            var out = HS.DOM.outroCheck ? HS.DOM.outroCheck.checked : false;
            var outT = HS.DOM.outTimeInput ? (parseFloat(HS.DOM.outTimeInput.value) || 1.5) : 1.5;

            return {
                color: col,
                style: st,
                motion: mot,
                padX: px,
                padY: py,
                round: rnd,
                opacity: opac,
                dur: dur,
                stagger: stag,
                sequential: seq,
                outro: out,
                outTime: outT
            };
        },

        openSaveModal: function () {
            if (!HS.DOM.presetModal) return;
            var cur = HS.Presets.getCurrentSettings();

            if (HS.DOM.modalPresetColorPreview) {
                HS.DOM.modalPresetColorPreview.style.background = cur.color;
            }
            if (HS.DOM.modalPresetDetails) {
                HS.DOM.modalPresetDetails.textContent = cur.style.toUpperCase() + " • " + cur.padX + "px Pad • " + cur.motion;
            }
            if (HS.DOM.presetNameInput) {
                HS.DOM.presetNameInput.value = "";
            }
            HS.DOM.presetModal.style.display = "flex";
            if (HS.DOM.presetNameInput) {
                setTimeout(function () { HS.DOM.presetNameInput.focus(); }, 50);
            }
        },

        closeSaveModal: function () {
            if (HS.DOM.presetModal) HS.DOM.presetModal.style.display = "none";
        },

        saveCustomPreset: function () {
            var name = HS.DOM.presetNameInput ? HS.DOM.presetNameInput.value.trim() : "";
            if (!name) {
                name = "Custom " + (Object.keys(HS.Presets.custom).length + 1);
            }
            var id = "cust_" + Date.now();
            HS.Presets.custom[id] = {
                name: name,
                data: HS.Presets.getCurrentSettings()
            };
            HS.Presets.saveToStorage();
            HS.Presets.populateDropdown();
            HS.Presets.closeSaveModal();
            HS.Presets.apply(id);
            HS.setStatus("Preset '" + name + "' saved");
        },

        remove: function (id) {
            if (HS.Presets.custom[id]) {
                var name = HS.Presets.custom[id].name;
                delete HS.Presets.custom[id];
                HS.Presets.saveToStorage();
                HS.Presets.activePresetId = "typewriter";
                HS.Presets.populateDropdown();
                HS.Presets.apply("typewriter");
                HS.setStatus("Preset '" + name + "' deleted");
            }
        }
    };

    // ============================================================
    // 9. PHRASE MANAGER & INTERACTIVE BOARD
    // ============================================================
    HS.PhraseManager = {
        updateBadge: function () {
            if (!HS.DOM.phraseCountBadge) return;
            var numWords = HS.State.selectedTokenIndices.length;
            if (numWords === 0) {
                HS.DOM.phraseCountBadge.textContent = "0 words selected";
                return;
            }
            var phrases = HS.PhraseManager.getSelectedPhrases();
            var pCount = phrases.length;
            HS.DOM.phraseCountBadge.textContent = numWords + " word" + (numWords > 1 ? "s" : "") + " (" + pCount + " phrase" + (pCount > 1 ? "s" : "") + ")";
        },

        getSelectedPhrases: function () {
            if (HS.State.selectedTokenIndices.length === 0) return [];
            var sorted = HS.State.selectedTokenIndices.slice().sort(function (a, b) { return a - b; });
            var groups = [];
            var currentGroup = [sorted[0]];

            for (var i = 1; i < sorted.length; i++) {
                if (sorted[i] === sorted[i - 1] + 1) {
                    currentGroup.push(sorted[i]);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [sorted[i]];
                }
            }
            groups.push(currentGroup);

            var phrases = [];
            for (var g = 0; g < groups.length; g++) {
                var grp = groups[g];
                var firstT = HS.State.phraseTokens[grp[0]];
                var lastT = HS.State.phraseTokens[grp[grp.length - 1]];
                if (!firstT || !lastT) continue;
                var phraseWords = [];
                for (var w = 0; w < grp.length; w++) {
                    if (HS.State.phraseTokens[grp[w]]) phraseWords.push(HS.State.phraseTokens[grp[w]].text);
                }
                phrases.push({
                    charStart: firstT.charStart,
                    charEnd: lastT.charEnd,
                    text: phraseWords.join(" "),
                    tokens: grp
                });
            }
            return phrases;
        },

        renderBoard: function (rawText, layerName) {
            if (HS.DOM.phraseTargetName) {
                HS.DOM.phraseTargetName.textContent = layerName ? (layerName + " (Text)") : "Select Text Layer in AE";
            }

            if (!rawText || rawText.replace(/^\s+|\s+$/g, "").length === 0) {
                HS.State.lastTokensRawText = "";
                HS.State.phraseTokens = [];
                HS.State.selectedTokenIndices = [];
                if (HS.DOM.tokensBoard) {
                    HS.DOM.tokensBoard.innerHTML = '<div class="tokens-empty-state"><span>Select a Text Layer in After Effects to load words</span></div>';
                }
                HS.PhraseManager.updateBadge();
                return;
            }

            if (rawText === HS.State.lastTokensRawText && HS.DOM.tokensBoard && HS.DOM.tokensBoard.querySelectorAll(".word-token").length > 0) {
                return;
            }

            HS.State.lastTokensRawText = rawText;
            HS.State.phraseTokens = [];
            HS.State.selectedTokenIndices = [];
            HS.State.lastClickedTokenIndex = -1;

            if (!HS.DOM.tokensBoard) return;
            HS.DOM.tokensBoard.innerHTML = "";

            var lines = rawText.split(/\r\n|\r|\n/);
            var curCharOffset = 0;
            var tokenIdx = 0;

            for (var li = 0; li < lines.length; li++) {
                var lineText = lines[li];
                var wordRegex = /\S+/g;
                var match;

                while ((match = wordRegex.exec(lineText)) !== null) {
                    var wordStr = match[0];
                    var startInLine = match.index;
                    var endInLine = startInLine + wordStr.length;

                    var tokenObj = {
                        index: tokenIdx,
                        text: wordStr,
                        charStart: curCharOffset + startInLine,
                        charEnd: curCharOffset + endInLine,
                        lineIndex: li
                    };
                    HS.State.phraseTokens.push(tokenObj);

                    var btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "word-token";
                    btn.dataset.tokenIndex = tokenIdx;
                    btn.textContent = wordStr;
                    btn.title = 'Word #' + (tokenIdx + 1) + ' (Chars ' + tokenObj.charStart + '..' + tokenObj.charEnd + ')';

                    (function (idx, element) {
                        element.addEventListener("click", function (e) {
                            if (e.shiftKey && HS.State.lastClickedTokenIndex !== -1) {
                                var fromIdx = Math.min(HS.State.lastClickedTokenIndex, idx);
                                var toIdx = Math.max(HS.State.lastClickedTokenIndex, idx);
                                for (var k = fromIdx; k <= toIdx; k++) {
                                    if (HS.State.selectedTokenIndices.indexOf(k) === -1) {
                                        HS.State.selectedTokenIndices.push(k);
                                    }
                                }
                            } else {
                                var pos = HS.State.selectedTokenIndices.indexOf(idx);
                                if (pos === -1) {
                                    HS.State.selectedTokenIndices.push(idx);
                                } else {
                                    HS.State.selectedTokenIndices.splice(pos, 1);
                                }
                                HS.State.lastClickedTokenIndex = idx;
                            }
                            HS.PhraseManager.syncTokenStyles();
                            HS.PhraseManager.updateBadge();
                        });

                        element.addEventListener("mousedown", function (e) {
                            if (e.button === 0 && !e.shiftKey) {
                                HS.State.isDraggingTokenSelect = true;
                                HS.State.dragSelectActive = (HS.State.selectedTokenIndices.indexOf(idx) === -1);
                            }
                        });

                        element.addEventListener("mouseenter", function () {
                            if (HS.State.isDraggingTokenSelect) {
                                var p = HS.State.selectedTokenIndices.indexOf(idx);
                                if (HS.State.dragSelectActive && p === -1) {
                                    HS.State.selectedTokenIndices.push(idx);
                                } else if (!HS.State.dragSelectActive && p !== -1) {
                                    HS.State.selectedTokenIndices.splice(p, 1);
                                }
                                HS.PhraseManager.syncTokenStyles();
                                HS.PhraseManager.updateBadge();
                            }
                        });
                    })(tokenIdx, btn);

                    HS.DOM.tokensBoard.appendChild(btn);
                    tokenIdx++;
                }

                if (li < lines.length - 1) {
                    var brEl = document.createElement("div");
                    brEl.className = "token-line-break";
                    HS.DOM.tokensBoard.appendChild(brEl);
                }

                curCharOffset += lineText.length + 1;
            }

            HS.PhraseManager.updateBadge();
        },

        syncTokenStyles: function () {
            if (!HS.DOM.tokensBoard) return;
            var buttons = HS.DOM.tokensBoard.querySelectorAll(".word-token");
            buttons.forEach(function (b) {
                var idx = parseInt(b.dataset.tokenIndex, 10);
                var isSel = (HS.State.selectedTokenIndices.indexOf(idx) !== -1);
                b.classList.toggle("selected", isSel);
            });
        },

        syncAppliedPhrases: function () {
            HS.Bridge.eval("$._smartHighlighter.getAppliedPhrases()", function (resStr) {
                if (!resStr || resStr === "EvalScript error.") return;
                try {
                    var list = JSON.parse(resStr);
                    HS.State.appliedPhrases = (list instanceof Array) ? list : [];

                    if (!HS.DOM.appliedPhrasesWrap || !HS.DOM.appliedPhrasesList) return;
                    var count = HS.State.appliedPhrases.length;
                    if (HS.DOM.appliedPhrasesCount) HS.DOM.appliedPhrasesCount.textContent = count;
                    HS.DOM.appliedPhrasesWrap.style.display = (count > 0) ? "flex" : "none";
                    HS.DOM.appliedPhrasesList.innerHTML = "";

                    HS.State.appliedPhrases.forEach(function (phr) {
                        var tag = document.createElement("div");
                        tag.className = "applied-phrase-tag";
                        tag.dataset.phraseId = phr.id;

                        var dot = document.createElement("span");
                        dot.className = "applied-phrase-dot";
                        dot.style.background = phr.color || "#2ECC71";

                        var txt = document.createElement("span");
                        txt.className = "applied-phrase-text";
                        txt.textContent = phr.text || "Phrase";
                        txt.title = (phr.text || "") + " (" + (phr.boxCount || 1) + " box)";

                        var delBtn = document.createElement("button");
                        delBtn.type = "button";
                        delBtn.className = "applied-phrase-del";
                        delBtn.innerHTML = "&times;";
                        delBtn.title = "Remove this phrase highlight from AE";
                        delBtn.addEventListener("click", function (e) {
                            e.stopPropagation();
                            HS.PhraseManager.removePhrase(phr.id);
                        });

                        tag.appendChild(dot);
                        tag.appendChild(txt);
                        tag.appendChild(delBtn);
                        HS.DOM.appliedPhrasesList.appendChild(tag);
                    });

                    HS.PhraseManager.syncAppliedTokensHighlight();
                } catch (e) {}
            });
        },

        syncAppliedTokensHighlight: function () {
            if (!HS.DOM.tokensBoard) return;
            var buttons = HS.DOM.tokensBoard.querySelectorAll(".word-token");
            var applied = HS.State.appliedPhrases || [];

            buttons.forEach(function (b) {
                var idx = parseInt(b.dataset.tokenIndex, 10);
                var tokenObj = HS.State.phraseTokens[idx];
                if (!tokenObj) return;

                var matchedCol = null;
                for (var i = 0; i < applied.length; i++) {
                    var ap = applied[i];
                    if (tokenObj.charStart >= ap.charStart && tokenObj.charEnd <= ap.charEnd) {
                        matchedCol = ap.color;
                        break;
                    }
                }

                if (matchedCol) {
                    b.classList.add("applied-highlight");
                    b.style.setProperty("--applied-color", matchedCol);
                } else {
                    b.classList.remove("applied-highlight");
                    b.style.removeProperty("--applied-color");
                }
            });
        },

        removePhrase: function (phraseId) {
            HS.setStatus("Removing phrase highlight...");
            HS.Bridge.ensureLoaded(function () {
                HS.Bridge.eval("$._smartHighlighter.removeSinglePhrase('" + phraseId + "')", function (res) {
                    if (res && res.indexOf("SUCCESS") !== -1) {
                        HS.showReport(res);
                        HS.PhraseManager.syncAppliedPhrases();
                    } else {
                        HS.setStatus(res ? res.replace("ERROR:", "").trim() : "Failed to remove phrase", true);
                    }
                });
            });
        }
    };

    window.addEventListener("mouseup", function () {
        HS.State.isDraggingTokenSelect = false;
    });

    // ============================================================
    // 10. ACTIONS & DISPATCHERS
    // ============================================================
    HS.Actions = {
        getPayload: function () {
            var isSequential = HS.DOM.sequentialCheck ? HS.DOM.sequentialCheck.checked : true;
            var isOutro = HS.DOM.outroCheck ? HS.DOM.outroCheck.checked : false;
            var currentMotion = HS.DOM.motionSelect ? HS.DOM.motionSelect.value : "typewriter";

            return {
                direction: HS.DOM.alignSelect ? HS.DOM.alignSelect.value : "auto",
                mode: "lines",
                style: HS.DOM.styleSelect ? HS.DOM.styleSelect.value : "box",
                motion: currentMotion,
                syncMarkers: HS.DOM.markerSyncCheck ? HS.DOM.markerSyncCheck.checked : false,
                color: HS.DOM.colorPicker ? HS.Bridge.hexToRgba(HS.DOM.colorPicker.value) : [1, 0.9, 0, 1],
                opacity: HS.DOM.opacityInput ? (parseFloat(HS.DOM.opacityInput.value) || 100) : 100,
                paddingX: HS.DOM.padXInput ? (parseFloat(HS.DOM.padXInput.value) || 10) : 10,
                paddingY: HS.DOM.padYInput ? (parseFloat(HS.DOM.padYInput.value) || 10) : 10,
                roundness: HS.DOM.roundInput ? (parseFloat(HS.DOM.roundInput.value) || 0) : 0,
                animate: HS.DOM.animCheck ? HS.DOM.animCheck.checked : true,
                sequential: isSequential,
                outro: isOutro,
                outroOrder: HS.State.outroOrder,
                lineDuration: HS.DOM.lineDurInput ? (parseFloat(HS.DOM.lineDurInput.value) || 0.35) : 0.35,
                outTime: HS.DOM.outTimeInput ? (parseFloat(HS.DOM.outTimeInput.value) || 1.5) : 1.5,
                stagger: HS.DOM.staggerInput ? (parseFloat(HS.DOM.staggerInput.value) || 0) : 0
            };
        },

        executeSmartAction: function (isClearOnly) {
            HS.Bridge.ensureLoaded(function () {
                if (isClearOnly) {
                    HS.setStatus("Removing highlight...");
                    HS.Bridge.eval("$._smartHighlighter.removeHighlight()", function (res) {
                        if (res && res.indexOf("SUCCESS") !== -1) {
                            HS.showReport(res);
                        } else {
                            HS.setStatus(res ? res.replace("ERROR:", "") : "Unknown error", true);
                        }
                    });
                } else {
                    HS.setStatus("Generating highlight...");
                    var payloadStr = JSON.stringify(HS.Actions.getPayload());
                    HS.Bridge.eval("$._smartHighlighter.smartHighlight('" + payloadStr + "')", function (res) {
                        if (res && res.indexOf("SUCCESS") !== -1) {
                            HS.showReport(res);
                        } else {
                            HS.setStatus(res ? res.replace("ERROR:", "") : "Unknown error", true);
                        }
                    });
                }
            });
        },

        applyPhraseHighlight: function () {
            var phrases = HS.PhraseManager.getSelectedPhrases();
            if (phrases.length === 0) {
                HS.setStatus("Please select words in the board first", true);
                return;
            }

            var hexCol = HS.DOM.phraseColorInput ? HS.DOM.phraseColorInput.value : "#2ECC71";
            var col = HS.Bridge.hexToRgba(hexCol);
            var style = HS.DOM.phraseStyleSelect ? HS.DOM.phraseStyleSelect.value : "box";
            var padX = HS.DOM.phrasePadX ? (parseFloat(HS.DOM.phrasePadX.value) || 10) : 10;
            var padY = HS.DOM.phrasePadY ? (parseFloat(HS.DOM.phrasePadY.value) || 4) : 4;
            var motion = HS.DOM.phraseMotionSelect ? HS.DOM.phraseMotionSelect.value : "typewriter";
            var isOutro = HS.DOM.phraseOutroCheck ? HS.DOM.phraseOutroCheck.checked : false;
            var holdTime = HS.DOM.phraseHoldTime ? (parseFloat(HS.DOM.phraseHoldTime.value) || 1.2) : 1.2;
            var isSeq = HS.DOM.phraseSeqCheck ? HS.DOM.phraseSeqCheck.checked : false;

            var payload = {
                phrases: phrases,
                color: col,
                colorHex: hexCol,
                style: style,
                paddingX: padX,
                paddingY: padY,
                motion: motion,
                outro: isOutro,
                holdTime: holdTime,
                sequential: isSeq
            };

            HS.setStatus("Applying phrase highlight...");
            HS.Bridge.ensureLoaded(function () {
                var jsonStr = JSON.stringify(payload);
                HS.Bridge.eval("$._smartHighlighter.buildPhraseHighlights(" + JSON.stringify(jsonStr) + ")", function (res) {
                    if (res && res.indexOf("SUCCESS") !== -1) {
                        HS.showReport(res);
                        HS.State.selectedTokenIndices = [];
                        HS.State.lastClickedTokenIndex = -1;
                        HS.PhraseManager.syncTokenStyles();
                        HS.PhraseManager.updateBadge();
                        HS.PhraseManager.syncAppliedPhrases();
                    } else {
                        HS.setStatus(res ? res.replace("ERROR:", "").trim() : "Failed to apply phrase highlight", true);
                    }
                });
            });
        },

        clearPhraseHighlight: function () {
            HS.setStatus("Clearing phrase highlight...");
            HS.Bridge.ensureLoaded(function () {
                HS.Bridge.eval("$._smartHighlighter.clearPhraseHighlights()", function (res) {
                    if (res && res.indexOf("SUCCESS") !== -1) {
                        HS.showReport(res);
                        HS.PhraseManager.syncAppliedPhrases();
                    } else {
                        HS.setStatus(res ? res.replace("ERROR:", "").trim() : "Failed to clear phrase highlight", true);
                    }
                });
            });
        },

        applyDefaultSettings: function (custom) {
            var cfg = Object.assign({}, HS.Config.defaults, custom || {});
            if (HS.DOM.colorPicker && cfg.color) {
                HS.DOM.colorPicker.value = cfg.color;
                if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = cfg.color.toUpperCase();
            }
            if (HS.DOM.styleSelect && cfg.style) HS.DOM.styleSelect.value = cfg.style;
            if (HS.DOM.alignSelect && cfg.direction) HS.DOM.alignSelect.value = cfg.direction;
            if (HS.DOM.padXInput && typeof cfg.paddingX === "number") HS.DOM.padXInput.value = cfg.paddingX;
            if (HS.DOM.padYInput && typeof cfg.paddingY === "number") HS.DOM.padYInput.value = cfg.paddingY;
            if (HS.DOM.roundInput && typeof cfg.roundness === "number") HS.DOM.roundInput.value = cfg.roundness;
            if (HS.DOM.opacityInput && typeof cfg.opacity === "number") HS.DOM.opacityInput.value = cfg.opacity;
            if (HS.DOM.animCheck && typeof cfg.animate === "boolean") {
                HS.DOM.animCheck.checked = cfg.animate;
                if (HS.DOM.animControls) HS.DOM.animControls.classList.toggle("disabled", !cfg.animate);
            }
            if (HS.DOM.motionSelect && cfg.motion) HS.DOM.motionSelect.value = cfg.motion;
            if (HS.DOM.sequentialCheck && typeof cfg.sequential === "boolean") {
                HS.DOM.sequentialCheck.checked = cfg.sequential;
            }
            if (HS.DOM.lineDurInput && typeof cfg.lineDuration === "number") HS.DOM.lineDurInput.value = cfg.lineDuration;
            if (HS.DOM.staggerInput && typeof cfg.stagger === "number") HS.DOM.staggerInput.value = cfg.stagger;
            if (HS.DOM.outroCheck && typeof cfg.outro === "boolean") {
                HS.DOM.outroCheck.checked = cfg.outro;
                if (HS.DOM.outTimeInput) HS.DOM.outTimeInput.disabled = !cfg.outro;
                if (HS.DOM.outTimeCol) HS.DOM.outTimeCol.classList.toggle("disabled", !cfg.outro);
                if (HS.DOM.btnOutroOrder) HS.DOM.btnOutroOrder.classList.toggle("disabled", !cfg.outro);
            }
            if (HS.DOM.outTimeInput && typeof cfg.outTime === "number") HS.DOM.outTimeInput.value = cfg.outTime;
            if (cfg.outroOrder) HS.Controls.setOutroOrder(cfg.outroOrder);
            if (cfg.scope) HS.setScope(cfg.scope, true);
            if (HS.DOM.markerSyncCheck && typeof cfg.syncMarkers === "boolean") HS.DOM.markerSyncCheck.checked = cfg.syncMarkers;
            HS.Controls.syncChipClasses();
        }
    };

    // ============================================================
    // 11. EVENT LISTENERS INITIALIZATION
    // ============================================================
    function initEvents() {
        // Reload button & Keyboard shortcuts (F5 / Ctrl+R)
        if (HS.DOM.btnReload) {
            HS.DOM.btnReload.addEventListener("click", function () {
                HS.Bridge.ensureLoaded(function () { location.reload(true); });
            });
        }
        window.addEventListener("keydown", function (e) {
            if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R"))) {
                e.preventDefault();
                HS.Bridge.ensureLoaded(function () { location.reload(true); });
            }
        });

        // Tabs
        if (HS.DOM.tabBtnParagraph) {
            HS.DOM.tabBtnParagraph.addEventListener("click", function () { HS.switchMainTab("paragraph"); });
        }
        if (HS.DOM.tabBtnPhrases) {
            HS.DOM.tabBtnPhrases.addEventListener("click", function () { HS.switchMainTab("phrases"); });
        }

        // Scope Switch
        if (HS.DOM.btnScopeAll) {
            HS.DOM.btnScopeAll.addEventListener("click", function () { HS.setScope("all", false); });
        }
        if (HS.DOM.btnScopeLine) {
            HS.DOM.btnScopeLine.addEventListener("click", function () { HS.setScope("line", false); });
        }

        // Presets Dropdown Change & Delete
        if (HS.DOM.presetSelect) {
            HS.DOM.presetSelect.addEventListener("change", function () {
                HS.markInteraction();
                var pid = this.value;
                if (pid) HS.Presets.apply(pid);
            });
        }

        if (HS.DOM.btnDeletePreset) {
            HS.DOM.btnDeletePreset.addEventListener("click", function () {
                HS.markInteraction();
                var activeId = HS.Presets.activePresetId;
                if (activeId && HS.Presets.custom && HS.Presets.custom[activeId]) {
                    var pName = HS.Presets.custom[activeId].name;
                    if (confirm("Delete preset \"" + pName + "\"?")) {
                        HS.Presets.remove(activeId);
                    }
                }
            });
        }

        // Save Preset Modal Triggers & Actions
        if (HS.DOM.btnSavePreset) {
            HS.DOM.btnSavePreset.addEventListener("click", HS.Presets.openSaveModal);
        }
        if (HS.DOM.btnClosePresetModal) {
            HS.DOM.btnClosePresetModal.addEventListener("click", HS.Presets.closeSaveModal);
        }
        if (HS.DOM.btnCancelPreset) {
            HS.DOM.btnCancelPreset.addEventListener("click", HS.Presets.closeSaveModal);
        }
        if (HS.DOM.btnConfirmSavePreset) {
            HS.DOM.btnConfirmSavePreset.addEventListener("click", HS.Presets.saveCustomPreset);
        }
        if (HS.DOM.presetNameInput) {
            HS.DOM.presetNameInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    HS.Presets.saveCustomPreset();
                } else if (e.key === "Escape") {
                    HS.Presets.closeSaveModal();
                }
            });
        }

        // Color Picker & Swatches in Tab 1
        if (HS.DOM.colorPicker) {
            HS.DOM.colorPicker.addEventListener("input", function () {
                HS.markInteraction();
                if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = HS.DOM.colorPicker.value.toUpperCase();
                document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn").forEach(function (b) {
                    b.classList.toggle("active", b.dataset.color.toLowerCase() === HS.DOM.colorPicker.value.toLowerCase());
                });
                HS.Controls.applyLiveColor(HS.DOM.colorPicker.value);
            });
            HS.DOM.colorPicker.addEventListener("change", function () {
                HS.markInteraction();
                HS.Controls.applyLiveColor(HS.DOM.colorPicker.value);
            });
        }

        document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                HS.markInteraction();
                var col = this.dataset.color;
                if (HS.DOM.colorPicker) HS.DOM.colorPicker.value = col;
                if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = col.toUpperCase();
                document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn").forEach(function (b) { b.classList.remove("active"); });
                this.classList.add("active");
                HS.Controls.applyLiveColor(col);
            });
        });

        // Live Parameter Inputs (padX, padY, roundness, opacity)
        if (HS.DOM.roundInput) {
            HS.DOM.roundInput.addEventListener("input", function () { HS.Controls.applyLiveParam("roundness", parseFloat(this.value) || 0); });
            HS.DOM.roundInput.addEventListener("change", function () { HS.Controls.applyLiveParam("roundness", parseFloat(this.value) || 0); });
        }
        if (HS.DOM.padXInput) {
            HS.DOM.padXInput.addEventListener("input", function () { HS.Controls.applyLiveParam("padX", parseFloat(this.value) || 0); });
            HS.DOM.padXInput.addEventListener("change", function () { HS.Controls.applyLiveParam("padX", parseFloat(this.value) || 0); });
        }
        if (HS.DOM.padYInput) {
            HS.DOM.padYInput.addEventListener("input", function () { HS.Controls.applyLiveParam("padY", parseFloat(this.value) || 0); });
            HS.DOM.padYInput.addEventListener("change", function () { HS.Controls.applyLiveParam("padY", parseFloat(this.value) || 0); });
        }
        if (HS.DOM.opacityInput) {
            HS.DOM.opacityInput.addEventListener("input", function () { HS.Controls.applyLiveParam("opacity", parseFloat(this.value) || 100); });
            HS.DOM.opacityInput.addEventListener("change", function () { HS.Controls.applyLiveParam("opacity", parseFloat(this.value) || 100); });
        }

        // Animation check & Motion Select
        if (HS.DOM.animCheck) {
            HS.DOM.animCheck.addEventListener("change", function () {
                if (HS.DOM.animControls) HS.DOM.animControls.classList.toggle("disabled", !this.checked);
            });
        }
        if (HS.DOM.motionSelect) {
            HS.DOM.motionSelect.addEventListener("change", function () {
                HS.markInteraction();
                if (this.value === "typewriter") {
                    HS.setStatus("Motion: Typewriter Sync (Character-Proportional)");
                    if (HS.DOM.sequentialCheck && !HS.DOM.sequentialCheck.checked) {
                        HS.DOM.sequentialCheck.checked = true;
                        HS.Controls.syncChipClasses();
                    }
                } else if (this.value === "pop") {
                    HS.setStatus("Motion: Scale Pop (Snappy Elastic)");
                } else if (this.value === "snap") {
                    HS.setStatus("Motion: Snap Cut (Instant 0-frame)");
                } else {
                    HS.setStatus("Motion: Smooth Wipe");
                }
            });
        }

        // Outro Toggle & Order
        if (HS.DOM.outroCheck) {
            HS.DOM.outroCheck.addEventListener("change", function () {
                if (HS.DOM.outTimeInput) HS.DOM.outTimeInput.disabled = !this.checked;
                if (HS.DOM.outTimeCol) HS.DOM.outTimeCol.classList.toggle("disabled", !this.checked);
                if (HS.DOM.btnOutroOrder) HS.DOM.btnOutroOrder.classList.toggle("disabled", !this.checked);
                HS.Controls.syncChipClasses();
            });
        }
        if (HS.DOM.btnOutroOrder) {
            HS.DOM.btnOutroOrder.addEventListener("click", function () {
                HS.Controls.setOutroOrder(HS.State.outroOrder === "first" ? "last" : "first");
            });
        }

        // Chips sync
        [
            { id: "chip-seq", chk: HS.DOM.sequentialCheck },
            { id: "chip-outro", chk: HS.DOM.outroCheck },
            { id: "chip-markers", chk: HS.DOM.markerSyncCheck }
        ].forEach(function (item) {
            if (item.chk) {
                item.chk.addEventListener("change", function () {
                    HS.markInteraction();
                    HS.Controls.syncChipClasses();
                });
            }
            var chipEl = document.getElementById(item.id);
            if (chipEl) {
                chipEl.addEventListener("click", function () {
                    setTimeout(HS.Controls.syncChipClasses, 10);
                });
            }
        });

        // Precision Steppers Click (▲ ▼)
        document.addEventListener("click", function (e) {
            var upBtn = e.target.closest(".step-up");
            var downBtn = e.target.closest(".step-down");
            if (upBtn) {
                var box = upBtn.closest(".precision-input-box");
                if (box) {
                    var mult = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
                    HS.Controls.adjustStepper(box.querySelector("input[type='number']"), true, mult);
                }
            } else if (downBtn) {
                var box = downBtn.closest(".precision-input-box");
                if (box) {
                    var mult = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
                    HS.Controls.adjustStepper(box.querySelector("input[type='number']"), false, mult);
                }
            }
        });

        // Mouse Wheel Scrubbing with Shift / Alt modifiers
        document.querySelectorAll(".precision-input-box input[type='number']").forEach(function (inp) {
            inp.addEventListener("wheel", function (e) {
                e.preventDefault();
                var mult = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
                HS.Controls.adjustStepper(inp, e.deltaY < 0, mult);
            }, { passive: false });
        });

        // Interactive Horizontal Drag Scrubbing (Native AE Feel)
        document.querySelectorAll(".scrub-label").forEach(function (lbl) {
            lbl.addEventListener("mousedown", function (e) {
                if (e.button !== 0) return;
                var targetId = this.dataset.target;
                var input = document.getElementById(targetId);
                if (!input || input.disabled) return;

                e.preventDefault();
                var startX = e.clientX;
                var startVal = parseFloat(input.value) || 0;
                var step = parseFloat(input.step) || 1;
                var min = input.min !== "" ? parseFloat(input.min) : -Infinity;
                var max = input.max !== "" ? parseFloat(input.max) : Infinity;

                document.body.classList.add("is-scrubbing");

                function onMouseMove(ev) {
                    HS.markInteraction();
                    var deltaX = ev.clientX - startX;
                    var mult = ev.shiftKey ? 10 : (ev.altKey ? 0.1 : 1);
                    var change = (deltaX / 4) * step * mult;
                    var newVal = Math.max(min, Math.min(max, startVal + change));

                    var stepStr = input.step || "1";
                    if (stepStr.indexOf(".") !== -1) {
                        input.value = newVal.toFixed(stepStr.split(".")[1].length);
                    } else {
                        input.value = Math.round(newVal);
                    }
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                }

                function onMouseUp() {
                    document.body.classList.remove("is-scrubbing");
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                }

                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            });
        });

        // Phrase Highlight Tab Controls
        if (HS.DOM.btnPhraseClearSel) {
            HS.DOM.btnPhraseClearSel.addEventListener("click", function () {
                HS.State.selectedTokenIndices = [];
                HS.State.lastClickedTokenIndex = -1;
                HS.PhraseManager.syncTokenStyles();
                HS.PhraseManager.updateBadge();
            });
        }

        if (HS.DOM.phraseColorInput) {
            HS.DOM.phraseColorInput.addEventListener("input", function () {
                if (HS.DOM.phraseColorHex) HS.DOM.phraseColorHex.textContent = this.value.toUpperCase();
                document.querySelectorAll("#phrase-swatches .swatch-btn").forEach(function (b) {
                    b.classList.toggle("active", b.dataset.color.toLowerCase() === HS.DOM.phraseColorInput.value.toLowerCase());
                });
            });
        }

        document.querySelectorAll("#phrase-swatches .swatch-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var col = this.dataset.color;
                if (HS.DOM.phraseColorInput) HS.DOM.phraseColorInput.value = col;
                if (HS.DOM.phraseColorHex) HS.DOM.phraseColorHex.textContent = col.toUpperCase();
                document.querySelectorAll("#phrase-swatches .swatch-btn").forEach(function (b) { b.classList.remove("active"); });
                this.classList.add("active");
            });
        });

        // Phrase Motion & Outro Listeners
        if (HS.DOM.phraseOutroCheck) {
            HS.DOM.phraseOutroCheck.addEventListener("change", function () {
                var enabled = this.checked;
                if (HS.DOM.phraseHoldTime) HS.DOM.phraseHoldTime.disabled = !enabled;
                if (HS.DOM.phraseHoldCol) HS.DOM.phraseHoldCol.classList.toggle("disabled", !enabled);
                HS.Controls.syncChipClasses();
            });
        }
        if (HS.DOM.phraseSeqCheck) {
            HS.DOM.phraseSeqCheck.addEventListener("change", function () {
                HS.Controls.syncChipClasses();
            });
        }

        // Action Buttons
        if (HS.DOM.btnSmartApply) {
            HS.DOM.btnSmartApply.addEventListener("click", function (e) {
                var isClear = e.altKey || e.shiftKey;
                HS.Actions.executeSmartAction(isClear);
            });
            HS.DOM.btnSmartApply.addEventListener("contextmenu", function (e) {
                e.preventDefault();
                HS.Actions.executeSmartAction(true);
            });
        }

        if (HS.DOM.btnClear) {
            HS.DOM.btnClear.addEventListener("click", function () {
                HS.Actions.executeSmartAction(true);
            });
        }

        if (HS.DOM.btnApplyPhrase) {
            HS.DOM.btnApplyPhrase.addEventListener("click", HS.Actions.applyPhraseHighlight);
        }

        if (HS.DOM.btnClearPhrase) {
            HS.DOM.btnClearPhrase.addEventListener("click", HS.Actions.clearPhraseHighlight);
        }

        // Debug Console
        if (HS.DOM.btnDebug && HS.DOM.debugPanel) {
            HS.DOM.btnDebug.addEventListener("click", function () {
                var isHidden = HS.DOM.debugPanel.style.display === "none";
                HS.DOM.debugPanel.style.display = isHidden ? "block" : "none";
                if (isHidden && HS.DOM.btnRefreshLog) HS.DOM.btnRefreshLog.click();
            });
        }

        if (HS.DOM.btnRefreshLog) {
            HS.DOM.btnRefreshLog.addEventListener("click", function () {
                if (!HS.DOM.debugLog) return;
                HS.Bridge.eval("$._smartHighlighter.getDebugLog()", function (res) {
                    HS.DOM.debugLog.textContent = (res && res !== "EvalScript error." && res.length > 0) ? res : "No logs yet.";
                    HS.DOM.debugLog.scrollTop = HS.DOM.debugLog.scrollHeight;
                });
            });
        }

        if (HS.DOM.btnClearLog) {
            HS.DOM.btnClearLog.addEventListener("click", function () {
                HS.Bridge.eval("$._smartHighlighter.clearDebugLog()", function () {
                    if (HS.DOM.debugLog) HS.DOM.debugLog.textContent = "Log cleared.";
                });
            });
        }
    }

    // Initialize application
    initEvents();
    HS.Presets.init();
    HS.Actions.applyDefaultSettings();
    HS.Controls.syncChipClasses();

    // Export HS to window for debugging and external automation
    window.HIGHLIGHT_STUDIO_DEFAULTS = HS.Config.defaults;
    window.applyDefaultSettings = HS.Actions.applyDefaultSettings;
    window.syncChipClasses = HS.Controls.syncChipClasses;

})(window, document);