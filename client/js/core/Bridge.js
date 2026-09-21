/**
 * HIGHLIGHT STUDIO — Bridge Module
 * CSInterface wrapper, ExtendScript communication, color utilities, and global status/tabs.
 */
(function (window, document) {
    "use strict";

    var HS = window.HS || {};
    window.HS = HS;

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
        },

        // Hex to CSS rgba(r, g, b, a) string
        hexToRgbaCss: function (hex, alpha) {
            var c = (hex || "#2ECC71").replace("#", "");
            if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            var r = parseInt(c.substring(0, 2), 16) || 46;
            var g = parseInt(c.substring(2, 4), 16) || 204;
            var b = parseInt(c.substring(4, 6), 16) || 113;
            var a = (alpha !== undefined) ? alpha : 0.25;
            return "rgba(" + r + "," + g + "," + b + "," + a + ")";
        }
    };

    // Initialize host script on launch
    HS.Bridge.ensureLoaded();

    // Global Status & Messaging
    HS.setStatus = function (msg, isError) {
        if (!HS.DOM || !HS.DOM.statusText || !HS.DOM.statusBar) return;
        HS.DOM.statusText.textContent = msg;
        HS.DOM.statusText.title = msg;
        HS.DOM.statusBar.classList.toggle("error", !!isError);
    };

    HS.showReport = function (res) {
        var msg = (res || "").replace("SUCCESS:", "").replace("SUCCESS", "").trim();
        HS.setStatus(msg || "Done.");
    };

    // Main Tabs Switching (Paragraph vs Phrases)
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
            if (HS.Sync && HS.Sync.fromAE) HS.Sync.fromAE(true);
            HS.setStatus("Phrase Highlight: Click words or select text to highlight");
        } else {
            HS.setStatus("Paragraph & Lines: Full text highlight");
        }
    };

    // Global Bridge, Tab, and Debug Event Listeners
    HS.Bridge.initEvents = function () {
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

        // Tabs Switching
        if (HS.DOM.tabBtnParagraph) {
            HS.DOM.tabBtnParagraph.addEventListener("click", function () { HS.switchMainTab("paragraph"); });
        }
        if (HS.DOM.tabBtnPhrases) {
            HS.DOM.tabBtnPhrases.addEventListener("click", function () { HS.switchMainTab("phrases"); });
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
    };
})(window, document);
