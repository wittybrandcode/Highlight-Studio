var csInterface = new CSInterface();

// UI Elements
var colorPicker = document.getElementById("color-picker");
var colorHex = document.getElementById("color-hex");
var alignSelect = document.getElementById("align-select");
var padXInput = document.getElementById("pad-x");
var padYInput = document.getElementById("pad-y");
var roundInput = document.getElementById("roundness");
var animCheck = document.getElementById("anim-check");
var lineDurInput = document.getElementById("line-dur");
var staggerInput = document.getElementById("stagger");
var statusBar = document.getElementById("status-bar");
var statusText = document.getElementById("status-text");
var animControls = document.getElementById("anim-controls");
var sequentialCheck = document.getElementById("sequential-check");
var staggerLabel = document.getElementById("stagger-label");
var outroCheck = document.getElementById("outro-check");
var outTimeInput = document.getElementById("out-time");
var outTimeCol = document.getElementById("out-time-col");

function syncAnimState() {
    animControls.classList.toggle("disabled", !animCheck.checked);
}
animCheck.addEventListener("change", syncAnimState);
syncAnimState();

function syncOutroState() {
    if (!outroCheck || !outTimeInput) return;
    outTimeInput.disabled = !outroCheck.checked;
    if (outTimeCol) {
        outTimeCol.classList.toggle("disabled", !outroCheck.checked);
    }
    if (btnOutroOrder) {
        btnOutroOrder.classList.toggle("disabled", !outroCheck.checked);
    }
}

// Outro Order (first: 1->N, last: N->1)
var currentOutroOrder = "first";
var btnOutroOrder = document.getElementById("btn-outro-order");
var orderIconFirst = document.getElementById("order-icon-first");
var orderIconLast = document.getElementById("order-icon-last");
var orderLabel = document.getElementById("order-label");

function setOutroOrder(order) {
    currentOutroOrder = order;
    if (btnOutroOrder) btnOutroOrder.dataset.order = order;
    if (order === "last") {
        if (orderIconFirst) orderIconFirst.style.display = "none";
        if (orderIconLast) orderIconLast.style.display = "inline-flex";
        if (orderLabel) orderLabel.textContent = "N➔1";
        if (btnOutroOrder) btnOutroOrder.title = "Exit Order: Last Line First (N➔1). Click to toggle: First Line First (1➔N)";
        setStatus("Outro: Last Line First (N➔1)");
    } else {
        if (orderIconFirst) orderIconFirst.style.display = "inline-flex";
        if (orderIconLast) orderIconLast.style.display = "none";
        if (orderLabel) orderLabel.textContent = "1➔N";
        if (btnOutroOrder) btnOutroOrder.title = "Exit Order: First Line First (1➔N). Click to toggle: Last Line First (N➔1)";
        setStatus("Outro: First Line First (1➔N)");
    }
}

if (btnOutroOrder) {
    btnOutroOrder.addEventListener("click", function () {
        setOutroOrder(currentOutroOrder === "first" ? "last" : "first");
    });
}

if (outroCheck) {
    outroCheck.addEventListener("change", syncOutroState);
    syncOutroState();
}

function syncSequentialState() {
    if (!sequentialCheck) return;
    if (sequentialCheck.checked) {
        if (staggerLabel) {
            staggerLabel.textContent = "Gap (s)";
            staggerLabel.title = "Delay after previous line finishes (0 = immediate at last frame)";
        }
        if (parseFloat(staggerInput.value) > 0.08) {
            staggerInput.value = "0.00";
        }
    } else {
        if (staggerLabel) {
            staggerLabel.textContent = "Stagger (s)";
            staggerLabel.title = "Overlap delay between lines";
        }
        if (parseFloat(staggerInput.value) === 0) {
            staggerInput.value = "0.12";
        }
    }
}
if (sequentialCheck) {
    sequentialCheck.addEventListener("change", syncSequentialState);
    syncSequentialState();
}

// Color application scope (All Lines or Selected Line)
var currentScope = "all";
var btnScopeAll = document.getElementById("btn-scope-all");
var btnScopeLine = document.getElementById("btn-scope-line");

function setScope(scope) {
    currentScope = scope;
    if (btnScopeAll) btnScopeAll.classList.toggle("active", scope === "all");
    if (btnScopeLine) btnScopeLine.classList.toggle("active", scope === "line");
    if (scope === "all") {
        setStatus("Mode: All Lines");
    } else {
        setStatus("Mode: Selected Line");
    }
}

if (btnScopeAll) {
    btnScopeAll.addEventListener("click", function () { setScope("all"); });
}
if (btnScopeLine) {
    btnScopeLine.addEventListener("click", function () { setScope("line"); });
}

// Apply live color to the selected layer based on the chosen scope (all or line)
function applyLiveColor(hex) {
    csInterface.evalScript("$._smartHighlighter.setQuickColor('" + hex + "', '" + currentScope + "')", function (res) {
        if (res && res.indexOf("SUCCESS") !== -1) {
            var msg = res.replace("SUCCESS:", "").trim();
            setStatus(msg);
        } else if (res && res.indexOf("ERROR") !== -1) {
            setStatus(res.replace("ERROR:", "").trim(), true);
        }
    });
}

// User interaction tracker to prevent background sync from overwriting active user edits
var lastUserInteraction = 0;
function markUserInteraction() {
    lastUserInteraction = Date.now();
}

// Update color display and apply live
colorPicker.addEventListener("input", function () {
    markUserInteraction();
    colorHex.textContent = colorPicker.value.toUpperCase();
    applyLiveColor(colorPicker.value);
});
colorPicker.addEventListener("change", function () {
    markUserInteraction();
    applyLiveColor(colorPicker.value);
});

// Apply live parameter updates (roundness, padX, padY) directly to After Effects in real-time
function applyLiveParam(paramName, val) {
    markUserInteraction();
    csInterface.evalScript("$._smartHighlighter.setQuickParam('" + paramName + "', " + val + ", '" + currentScope + "')", function (res) {
        if (res && res.indexOf("SUCCESS") !== -1) {
            var msg = res.replace("SUCCESS:", "").trim();
            setStatus(msg);
        }
    });
}

// Live update listeners for Roundness, Pad X, and Pad Y
roundInput.addEventListener("input", function () {
    applyLiveParam("roundness", parseFloat(this.value) || 0);
});
roundInput.addEventListener("change", function () {
    applyLiveParam("roundness", parseFloat(this.value) || 0);
});

padXInput.addEventListener("input", function () {
    applyLiveParam("padX", parseFloat(this.value) || 0);
});
padXInput.addEventListener("change", function () {
    applyLiveParam("padX", parseFloat(this.value) || 0);
});

padYInput.addEventListener("input", function () {
    applyLiveParam("padY", parseFloat(this.value) || 0);
});
padYInput.addEventListener("change", function () {
    applyLiveParam("padY", parseFloat(this.value) || 0);
});

// Presets
var presets = {
    marker: { color: "#FFE600", padX: 8, padY: 2, round: 2, dur: 0.35, stagger: 0.00, sequential: true },
    clean: { color: "#0D99FF", padX: 4, padY: 0, round: 0, dur: 0.20, stagger: 0.00, sequential: true },
    caption: { color: "#FF4081", padX: 10, padY: 4, round: 4, dur: 0.15, stagger: 0.00, sequential: true }
};

document.querySelectorAll(".preset-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        markUserInteraction();
        document.querySelectorAll(".preset-btn").forEach(function(b) { b.classList.remove("active"); });
        this.classList.add("active");
        var p = presets[this.dataset.preset];
        if (p) {
            colorPicker.value = p.color;
            colorHex.textContent = p.color;
            padXInput.value = p.padX;
            padYInput.value = p.padY;
            roundInput.value = p.round;
            lineDurInput.value = p.dur;
            staggerInput.value = p.stagger;
            if (sequentialCheck && typeof p.sequential === "boolean") {
                sequentialCheck.checked = p.sequential;
                syncSequentialState();
            }
            applyLiveColor(p.color);
            applyLiveParam("roundness", p.round);
            applyLiveParam("padX", p.padX);
            applyLiveParam("padY", p.padY);
        }
    });
});

// Two-way sync: read current state from After Effects and update the panel
var lastSyncedLayer = "";

function syncFromAE(force) {
    // If user edited inputs recently (< 3s), do not overwrite user edits!
    var isRecentUserEdit = (Date.now() - lastUserInteraction < 3000);

    csInterface.evalScript("$._smartHighlighter.getLayerState()", function (resStr) {
        if (!resStr || resStr === "EvalScript error.") return;
        try {
            var state = JSON.parse(resStr);
            if (state && state.ok) {
                var layerChanged = (state.layerName && state.layerName !== lastSyncedLayer);
                if (state.layerName) lastSyncedLayer = state.layerName;

                if (state.hasHighlight && state.color) {
                    if (document.activeElement !== colorPicker && (!isRecentUserEdit || layerChanged || force)) {
                        colorPicker.value = state.color;
                        colorHex.textContent = state.color.toUpperCase();
                    }
                    if (state.type === "text") {
                        if (layerChanged || (!isRecentUserEdit && !force)) {
                            if (typeof state.paddingX === "number" && document.activeElement !== padXInput) padXInput.value = state.paddingX;
                            if (typeof state.paddingY === "number" && document.activeElement !== padYInput) padYInput.value = state.paddingY;
                            if (typeof state.roundness === "number" && document.activeElement !== roundInput) roundInput.value = state.roundness;
                        }
                        if (statusText.textContent.indexOf("Target:") !== -1 || statusText.textContent === "Ready") {
                            setStatus("Target: " + (state.layerName || "Master Text") + " (Master Controls)");
                        }
                    } else if (state.type === "shape") {
                        setStatus("Target: " + (state.layerName || "Line") + " (Local Color)");
                    }
                }
            }
        } catch (e) {}
    });
}

window.addEventListener("focus", function () { syncFromAE(true); });
setInterval(function () {
    if (!document.hidden && Date.now() - lastUserInteraction > 3000) syncFromAE();
}, 2500);
syncFromAE();

// Convert Hex color to RGBA array for After Effects
function hexToRgbaArray(hex) {
    var c = hex.replace("#", "");
    var r = parseInt(c.substring(0, 2), 16) / 255;
    var g = parseInt(c.substring(2, 4), 16) / 255;
    var b = parseInt(c.substring(4, 6), 16) / 255;
    return [r, g, b, 1.0];
}

// Build the unified settings payload
function getPayload() {
    var isSequential = sequentialCheck ? sequentialCheck.checked : true;
    var isOutro = outroCheck ? outroCheck.checked : false;
    return {
        direction: alignSelect.value,
        color: hexToRgbaArray(colorPicker.value),
        paddingX: parseFloat(padXInput.value) || 8,
        paddingY: parseFloat(padYInput.value) || 2,
        roundness: parseFloat(roundInput.value) || 0,
        animate: animCheck.checked,
        sequential: isSequential,
        outro: isOutro,
        outroOrder: currentOutroOrder,
        lineDuration: parseFloat(lineDurInput.value) || 0.35,
        outTime: outTimeInput ? (parseFloat(outTimeInput.value) || 1.5) : 1.5,
        stagger: parseFloat(staggerInput.value) || 0
    };
}

function setStatus(msg, isError) {
    statusText.textContent = msg;
    statusBar.classList.toggle("error", !!isError);
}

function showReport(res) {
    var msg = res.replace("SUCCESS:", "").replace("SUCCESS", "").replace(/^\s+/, "");
    setStatus(msg || "Done.");
}

// Smart unified button: Apply / Update / Clear
var btnSmartApply = document.getElementById("btn-smart-apply");

function executeSmartAction(isClearOnly) {
    if (isClearOnly) {
        setStatus("Clearing highlight...");
        csInterface.evalScript("$._smartHighlighter.removeHighlight()", function (res) {
            if (res && res.indexOf("SUCCESS") !== -1) {
                showReport(res);
            } else {
                setStatus(res ? res.replace("ERROR:", "") : "Unknown error", true);
            }
        });
    } else {
        setStatus("Applying highlight...");
        var payloadStr = JSON.stringify(getPayload());
        csInterface.evalScript("$._smartHighlighter.smartHighlight('" + payloadStr + "')", function (res) {
            if (res && res.indexOf("SUCCESS") !== -1) {
                showReport(res);
            } else {
                setStatus(res ? res.replace("ERROR:", "") : "Unknown error", true);
            }
        });
    }
}

// Normal click: Apply or auto-update (removes old link and creates new)
// Alt+Click or Shift+Click: Clear highlight
if (btnSmartApply) {
    btnSmartApply.addEventListener("click", function (e) {
        var isClear = e.altKey || e.shiftKey;
        executeSmartAction(isClear);
    });

    // Right-click: also clears for convenience
    btnSmartApply.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        executeSmartAction(true);
    });
}

// ===== DEBUG CONSOLE =====
var debugPanel = document.getElementById("debug-panel");
var debugLog = document.getElementById("debug-log");

document.getElementById("btn-debug").addEventListener("click", function () {
    var isHidden = debugPanel.style.display === "none";
    debugPanel.style.display = isHidden ? "block" : "none";
    if (isHidden) refreshDebugLog();
});

function refreshDebugLog() {
    csInterface.evalScript("$._smartHighlighter.getDebugLog()", function (res) {
        debugLog.textContent = (res && res !== "EvalScript error." && res.length > 0) ? res : "No logs yet.";
        debugLog.scrollTop = debugLog.scrollHeight;
    });
}

document.getElementById("btn-refresh-log").addEventListener("click", refreshDebugLog);

document.getElementById("btn-clear-log").addEventListener("click", function () {
    csInterface.evalScript("$._smartHighlighter.clearDebugLog()", function () {
        debugLog.textContent = "Log cleared.";
    });
});

// ===== STEPPER CONTROLS & WHEEL SCRUBBING =====
function adjustStepper(input, isUp) {
    markUserInteraction();
    if (!input || input.disabled) return;
    try {
        if (isUp) {
            input.stepUp();
        } else {
            input.stepDown();
        }
    } catch (e) {
        var step = parseFloat(input.step) || 1;
        var val = parseFloat(input.value) || 0;
        val = isUp ? val + step : val - step;
        var min = input.min !== "" ? parseFloat(input.min) : -Infinity;
        var max = input.max !== "" ? parseFloat(input.max) : Infinity;
        val = Math.max(min, Math.min(max, val));
        input.value = Math.round(val * 100) / 100;
    }
    // Clean up floating point precision
    var num = parseFloat(input.value);
    if (!isNaN(num)) {
        var stepStr = input.step || "1";
        if (stepStr.indexOf(".") !== -1) {
            var decimals = stepStr.split(".")[1].length;
            input.value = num.toFixed(decimals);
        }
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

document.addEventListener("click", function (e) {
    var upBtn = e.target.closest(".step-up");
    var downBtn = e.target.closest(".step-down");
    if (upBtn) {
        var box = upBtn.closest(".stepper-box");
        if (box) adjustStepper(box.querySelector("input[type='number']"), true);
    } else if (downBtn) {
        var box = downBtn.closest(".stepper-box");
        if (box) adjustStepper(box.querySelector("input[type='number']"), false);
    }
});

document.querySelectorAll(".stepper-box input[type='number']").forEach(function (inp) {
    inp.addEventListener("wheel", function (e) {
        e.preventDefault();
        adjustStepper(inp, e.deltaY < 0);
    }, { passive: false });
});