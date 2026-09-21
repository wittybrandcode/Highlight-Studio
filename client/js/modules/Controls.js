/**
 * HIGHLIGHT STUDIO — Controls Module
 * Handles UI input controls: live color, steppers, scrubbing, chips, and outro direction.
 */
(function (window, document) {
    "use strict";

    var HS = window.HS || {};
    window.HS = HS;

    HS.Controls = {
        applyLiveColor: function (hex) {
            HS.Bridge.eval("$._smartHighlighter.setQuickColor('" + hex + "', 'all')", function (res) {
                if (res && res.indexOf("SUCCESS") !== -1) {
                    HS.setStatus(res.replace("SUCCESS:", "").trim());
                } else if (res && res.indexOf("ERROR") !== -1) {
                    HS.setStatus(res.replace("ERROR:", "").trim(), true);
                }
            });
        },

        applyLiveParam: function (paramName, val) {
            HS.markInteraction();
            HS.Bridge.eval("$._smartHighlighter.setQuickParam('" + paramName + "', " + val + ", 'all')", function (res) {
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
            if (!HS.DOM) return;
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
            if (HS.DOM && HS.DOM.btnOutroOrder) HS.DOM.btnOutroOrder.dataset.order = order;
            if (HS.DOM && HS.DOM.orderLabel) HS.DOM.orderLabel.textContent = (order === "last") ? "N➔1" : "1➔N";
            if (HS.DOM && HS.DOM.btnOutroOrder) {
                HS.DOM.btnOutroOrder.title = (order === "last")
                    ? "Exit Order: Last Line First (N➔1). Click to toggle: 1➔N"
                    : "Exit Order: First Line First (1➔N). Click to toggle: N➔1";
            }
            HS.setStatus("Outro Order: " + (order === "last" ? "Last Line First (N➔1)" : "First Line First (1➔N)"));
        },

        setShape: function (shape) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.styleSelect) {
                HS.DOM.styleSelect.value = shape;
            }
            HS.Controls.syncShapeButtons();
            var shapeLabels = {
                box: "Box (مستطيل)",
                pill: "Pill (كبسولة)",
                marker: "Marker (ماركر)",
                underline: "Underline (تسطير)",
                outline: "Outline (إطار)"
            };
            HS.setStatus("Shape: " + (shapeLabels[shape] || shape));
            if (HS.State.mainTab === "paragraph") {
                HS.Actions.executeSmartAction(false);
            }
        },

        syncShapeButtons: function () {
            var cur = (HS.DOM && HS.DOM.styleSelect) ? HS.DOM.styleSelect.value : "box";
            document.querySelectorAll(".shape-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.shape === cur);
            });
        },

        setDirection: function (dir) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.alignSelect) {
                HS.DOM.alignSelect.value = dir;
            }
            HS.Controls.syncDirectionButtons();
            var dirLabels = {
                auto: "Auto (تلقائي)",
                ltr: "LTR (يسار ليمين)",
                rtl: "RTL (يمين ليسار)",
                center: "Center (منتصف)"
            };
            HS.setStatus("Direction: " + (dirLabels[dir] || dir));
            if (HS.State.mainTab === "paragraph") {
                HS.Actions.executeSmartAction(false);
            }
        },

        syncDirectionButtons: function () {
            var cur = (HS.DOM && HS.DOM.alignSelect) ? HS.DOM.alignSelect.value : "auto";
            document.querySelectorAll(".dir-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.dir === cur);
            });
        },

        setMotion: function (motion) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.motionSelect) {
                HS.DOM.motionSelect.value = motion;
                HS.DOM.motionSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
            HS.Controls.syncMotionButtons();
            if (HS.State.mainTab === "paragraph") {
                HS.Actions.executeSmartAction(false);
            }
        },

        syncMotionButtons: function () {
            var cur = (HS.DOM && HS.DOM.motionSelect) ? HS.DOM.motionSelect.value : "typewriter";
            document.querySelectorAll(".motion-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.motion === cur);
            });
            var isTypewriter = (cur === "typewriter");
            var fieldRev = document.getElementById("field-reveal-unit");
            if (fieldRev) {
                fieldRev.style.opacity = isTypewriter ? "1" : "0.4";
                fieldRev.style.pointerEvents = isTypewriter ? "auto" : "none";
            }
        },

        setRevealUnit: function (unit) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.revealUnitSelect) {
                HS.DOM.revealUnitSelect.value = unit;
                HS.DOM.revealUnitSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
            HS.Controls.syncRevealButtons();
        },

        syncRevealButtons: function () {
            var cur = (HS.DOM && HS.DOM.revealUnitSelect) ? HS.DOM.revealUnitSelect.value : "chars";
            document.querySelectorAll(".reveal-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.unit === cur);
            });
        },

        updateColorIndicator: function (hex) {
            if (!hex) return;
            var dot = document.getElementById("color-indicator-dot");
            if (dot) dot.style.backgroundColor = hex;

            var recent = HS.DOM && HS.DOM.recentColorSwatch ? HS.DOM.recentColorSwatch : document.getElementById("recent-color-swatch");
            if (recent) {
                recent.style.backgroundColor = hex;
                recent.dataset.color = hex;
                recent.title = "Last Chosen Color: " + hex.toUpperCase() + " (آخر لون تم اختياره)";
                try { localStorage.setItem("hs_recent_color", hex); } catch (e) {}
            }

            var normHex = hex.toLowerCase();
            var foundPreset = false;
            document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn:not(.swatch-recent)").forEach(function (b) {
                var isMatch = b.dataset.color && b.dataset.color.toLowerCase() === normHex;
                b.classList.toggle("active", isMatch);
                if (isMatch) foundPreset = true;
            });
            if (recent) {
                recent.classList.toggle("active", !foundPreset);
            }
        },

        setPhraseShape: function (shape) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.phraseStyleSelect) {
                HS.DOM.phraseStyleSelect.value = shape;
            }
            HS.Controls.syncPhraseShapeButtons();
            var shapeLabels = {
                box: "Box (مستطيل)",
                pill: "Pill (كبسولة)",
                marker: "Marker (ماركر)",
                underline: "Underline (تسطير)",
                outline: "Outline (إطار)"
            };
            HS.setStatus("Phrase Shape: " + (shapeLabels[shape] || shape));
        },

        syncPhraseShapeButtons: function () {
            var cur = (HS.DOM && HS.DOM.phraseStyleSelect) ? HS.DOM.phraseStyleSelect.value : "box";
            document.querySelectorAll(".phrase-shape-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.shape === cur);
            });
        },

        setPhraseMotion: function (motion) {
            HS.markInteraction();
            if (HS.DOM && HS.DOM.phraseMotionSelect) {
                HS.DOM.phraseMotionSelect.value = motion;
                HS.DOM.phraseMotionSelect.dispatchEvent(new Event("change", { bubbles: true }));
            }
            HS.Controls.syncPhraseMotionButtons();
            var motionLabels = {
                typewriter: "Typewriter Sync (كتابة متزامنة)",
                wipe: "Smooth Wipe (مسح تدريجي)",
                pop: "Scale Pop (ظهور بتكبير)",
                snap: "Snap Jump (قفز فوري)"
            };
            HS.setStatus("Phrase Motion: " + (motionLabels[motion] || motion));
        },

        syncPhraseMotionButtons: function () {
            var cur = (HS.DOM && HS.DOM.phraseMotionSelect) ? HS.DOM.phraseMotionSelect.value : "typewriter";
            document.querySelectorAll(".phrase-motion-btn").forEach(function (b) {
                b.classList.toggle("active", b.dataset.motion === cur);
            });
        },

        updatePhraseColorIndicator: function (hex) {
            if (!hex) return;
            var dot = document.getElementById("phrase-color-indicator-dot");
            if (dot) dot.style.backgroundColor = hex;

            var recent = HS.DOM && HS.DOM.phraseRecentColorSwatch ? HS.DOM.phraseRecentColorSwatch : document.getElementById("phrase-recent-color-swatch");
            if (recent) {
                recent.style.backgroundColor = hex;
                recent.dataset.color = hex;
                recent.title = "Last Chosen Color: " + hex.toUpperCase() + " (آخر لون تم اختياره)";
                try { localStorage.setItem("hs_phrase_recent_color", hex); } catch (e) {}
            }

            var normHex = hex.toLowerCase();
            var foundPreset = false;
            document.querySelectorAll("#phrase-swatches .swatch-btn:not(.swatch-recent)").forEach(function (b) {
                var isMatch = b.dataset.color && b.dataset.color.toLowerCase() === normHex;
                b.classList.toggle("active", isMatch);
                if (isMatch) foundPreset = true;
            });
            if (recent) {
                recent.classList.toggle("active", !foundPreset);
            }
        },

        initEvents: function () {
            if (!HS.DOM) return;

            // Shape Buttons Click Listeners (Tab 1)
            document.querySelectorAll(".shape-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var shape = this.dataset.shape;
                    if (shape) HS.Controls.setShape(shape);
                });
            });

            // Direction Buttons Click Listeners (Tab 1)
            document.querySelectorAll(".dir-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var dir = this.dataset.dir;
                    if (dir) HS.Controls.setDirection(dir);
                });
            });

            // Motion Buttons Click Listeners (Tab 1)
            document.querySelectorAll(".motion-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var motion = this.dataset.motion;
                    if (motion) HS.Controls.setMotion(motion);
                });
            });

            // Reveal Unit Buttons Click Listeners (Tab 1)
            document.querySelectorAll(".reveal-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var unit = this.dataset.unit;
                    if (unit) HS.Controls.setRevealUnit(unit);
                });
            });

            // Phrase Shape Buttons Click Listeners (Tab 2)
            document.querySelectorAll(".phrase-shape-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var shape = this.dataset.shape;
                    if (shape) HS.Controls.setPhraseShape(shape);
                });
            });

            // Phrase Motion Buttons Click Listeners (Tab 2)
            document.querySelectorAll(".phrase-motion-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var motion = this.dataset.motion;
                    if (motion) HS.Controls.setPhraseMotion(motion);
                });
            });

            // Phrase Color Trigger Button Click Listener
            var btnPhraseColorTrigger = document.getElementById("btn-phrase-color-trigger");
            if (btnPhraseColorTrigger && HS.DOM.phraseColorInput) {
                btnPhraseColorTrigger.addEventListener("click", function () {
                    HS.DOM.phraseColorInput.click();
                });
            }

            // Sync initial state of Shape, Direction, Motion, & Reveal buttons
            HS.Controls.syncShapeButtons();
            HS.Controls.syncDirectionButtons();
            HS.Controls.syncMotionButtons();
            HS.Controls.syncRevealButtons();
            HS.Controls.syncPhraseShapeButtons();
            HS.Controls.syncPhraseMotionButtons();
            if (HS.DOM.phraseColorInput) {
                HS.Controls.updatePhraseColorIndicator(HS.DOM.phraseColorInput.value);
            }

            // Restore saved recent color if exists
            try {
                var savedRecent = localStorage.getItem("hs_recent_color");
                if (savedRecent) {
                    var recentEl = document.getElementById("recent-color-swatch");
                    if (recentEl) {
                        recentEl.style.backgroundColor = savedRecent;
                        recentEl.dataset.color = savedRecent;
                        recentEl.title = "Last Chosen Color: " + savedRecent.toUpperCase() + " (آخر لون تم اختياره)";
                    }
                }
            } catch (e) {}

            // Color Picker & Swatches in Tab 1
            if (HS.DOM.colorPicker) {
                HS.Controls.updateColorIndicator(HS.DOM.colorPicker.value);
                HS.DOM.colorPicker.addEventListener("input", function () {
                    HS.markInteraction();
                    HS.Controls.updateColorIndicator(this.value);
                    if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = this.value.toUpperCase();
                    HS.Controls.applyLiveColor(this.value);
                });
                HS.DOM.colorPicker.addEventListener("change", function () {
                    HS.markInteraction();
                    HS.Controls.updateColorIndicator(this.value);
                    HS.Controls.applyLiveColor(this.value);
                });
            }

            // Click on color square button triggers color picker
            var btnColorTrigger = document.getElementById("btn-color-trigger");
            if (btnColorTrigger && HS.DOM.colorPicker) {
                btnColorTrigger.addEventListener("click", function () {
                    HS.DOM.colorPicker.click();
                });
            }

            document.querySelectorAll("#view-paragraph .swatches-bar .swatch-btn").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    HS.markInteraction();
                    var col = this.dataset.color;
                    if (HS.DOM.colorPicker) HS.DOM.colorPicker.value = col;
                    HS.Controls.updateColorIndicator(col);
                    if (HS.DOM.colorHex) HS.DOM.colorHex.textContent = col.toUpperCase();
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
                    var isTypewriter = (this.value === "typewriter");
                    var fieldRev = document.getElementById("field-reveal-unit");
                    if (fieldRev) {
                        fieldRev.style.opacity = isTypewriter ? "1" : "0.4";
                        fieldRev.style.pointerEvents = isTypewriter ? "auto" : "none";
                    }
                    if (this.value === "typewriter") {
                        HS.setStatus("Motion: Typewriter Sync");
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

            if (HS.DOM.revealUnitSelect) {
                HS.DOM.revealUnitSelect.addEventListener("change", function () {
                    HS.markInteraction();
                    var uVal = this.value || "chars";
                    var uLabel = (uVal === "words") ? "Words (كلمة بكلمة)" : ((uVal === "lines") ? "Lines (سطر بسطر)" : "Characters (حرف بحرف)");
                    HS.setStatus("Reveal Unit: " + uLabel);
                    if (HS.State.mainTab === "paragraph") {
                        HS.Actions.executeSmartAction(false);
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
        }
    };
})(window, document);
