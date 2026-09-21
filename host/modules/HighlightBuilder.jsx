/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: HighlightBuilder.jsx
 * Version: 2.0.0 (Modular Architecture)
 * 
 * Core Shape Layer Generator:
 * Builds shape layers, links dual-control (Master/Local) expressions,
 * injects subpixel character-tracking width calculations, and handles removal.
 */

// الدالة الرئيسية لإنشاء وتحديث الهايلايت
$._smartHighlighter.createHighlight = function (jsonPayloadStr, _isSync, _preBoxes, _preMeta) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        return "ERROR: يرجى فتح تركيبة (Composition) أولاً.";
    }
    if (comp.selectedLayers.length !== 1 || !(comp.selectedLayers[0] instanceof TextLayer)) {
        return "ERROR: يرجى تحديد طبقة نص واحدة (Text Layer).";
    }

    var textLayer = comp.selectedLayers[0];
    var data = $._smartHighlighter.parseJSON(jsonPayloadStr);
    if (!data) return "ERROR: خطأ في صياغة البيانات.";

    // إنهاء أي تحرير نصي نشط بسلاسة والعودة لأداة التحديد لمنع تعارض التركيز (76::59)
    try {
        if (app.toolType === ToolType.Tool_TextH || app.toolType === ToolType.Tool_TextV) {
            app.toolType = ToolType.Tool_Arrow;
        }
    } catch (eToolSwitch) {}

    app.beginUndoGroup("Highlight-Studio: Apply");

    try {
        $._smartHighlighter.log("createHighlight START, isSync=" + !!_isSync);

        // تنظيف أي علامات خفية قديمة من النص لضمان دقة الفحص الهندسي مع الحفاظ التام على التنسيق والمحاذاة
        try {
            var srcP0 = textLayer.property("Source Text");
            var tDoc0 = srcP0.value;
            var strippedT0 = $._smartHighlighter.stripAnchors(tDoc0.text);
            if (strippedT0 !== tDoc0.text) {
                tDoc0.text = strippedT0;
                srcP0.setValue(tDoc0);
            }
        } catch (eCleanRaw0) {}

        var targetScan = $._smartHighlighter.scanTargetBoxes(textLayer, comp, data);
        if (!targetScan) {
            app.endUndoGroup();
            return "ERROR: طبقة النص فارغة أو تعذر قراءتها.";
        }

        var scan = targetScan.scan;
        var boxesData = targetScan.boxesData;
        var totalBoxes = boxesData.length;
        var totalLines = scan.numLines;
        var baseTotalH = scan.fullH;
        var baseFS = scan.fontSize;
        var isCenter = targetScan.isCenter;
        var fallbackRTL = targetScan.fallbackRTL;

        // تنظيف أقواس الوسوم من طبقة النص إذا كانت موجودة وكان الخيار مفعلاً
        if (targetScan.hasTags && data.stripTags !== false) {
            try {
                var curT = textLayer.property("Source Text").value.text;
                if (curT !== targetScan.cleanText) {
                    textLayer.property("Source Text").setValue(targetScan.cleanText);
                }
            } catch (eClean) {}
        }

        // 1. Master controls on the text layer.
        var masterNotes = [];
        var initOpacity = (typeof data.opacity === "number" && !isNaN(data.opacity)) ? data.opacity : 100;

        var styleName = data.style || "box"; // "box", "pill", "marker", "underline", "outline"
        var motionName = data.motion || "wipe"; // "wipe", "pop", "snap", "typewriter"
        var revealUnit = data.revealUnit || "chars"; // "chars", "words", "lines"

        var styleRecipe = ($._smartHighlighter.recipes && $._smartHighlighter.recipes.getStyle) 
            ? $._smartHighlighter.recipes.getStyle(styleName) 
            : null;
        var motionRecipe = ($._smartHighlighter.recipes && $._smartHighlighter.recipes.getMotion) 
            ? $._smartHighlighter.recipes.getMotion(motionName) 
            : null;

        var defaultRnd = (styleRecipe && typeof styleRecipe.defaultRoundness === "number") ? styleRecipe.defaultRoundness : (styleName === "pill" ? 50 : 0);
        var initRoundness = (data.roundness !== undefined && data.roundness !== null && data.roundness !== "") ? Number(data.roundness) : defaultRnd;

        $._smartHighlighter.masterFx(textLayer, "ADBE Color Control", "Master Highlight Color", data.color, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Highlight Opacity", initOpacity, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Padding X", data.paddingX, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Padding Y", data.paddingY, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Offset Y", 0, false, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Roundness", initRoundness, true, masterNotes);

        // أخذ لقطة من الصناديق القديمة قبل حذفها لحفظ التعديلات المحلية (Snapshot & Reconcile)
        var prevBoxes = $._smartHighlighter.snapshotBoxes(comp, textLayer);

        // فحص وحذف أي ربط سابق (Previous Highlight Layers)
        var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
        var oldBoxesRemoved = 0;
        for (var si = comp.numLayers; si >= 1; si--) {
            var lyr = comp.layer(si);
            if (lyr && lyr !== textLayer && lyr.parent === textLayer && lyr.comment === tag) {
                try {
                    lyr.remove();
                    oldBoxesRemoved++;
                } catch(eDel) {}
            }
        }
        var hadPreviousLink = (oldBoxesRemoved > 0);
        if (hadPreviousLink) {
            $._smartHighlighter.log("Previous link detected: deleted " + oldBoxesRemoved + " old shape layer(s). Preserving custom local tweaks.");
        } else {
            $._smartHighlighter.log("No previous link: creating fresh highlight.");
        }

        // قراءة الماركرز للمزامنة الصوتية إذا كان الخيار مفعلاً
        var markerTimes = (data.syncMarkers) ? $._smartHighlighter.readMarkers(textLayer, comp) : [];
        var hasMarkers = (markerTimes.length > 0);

        // إعدادات النمط والحركة
        var lastLayer = textLayer;
        var startTime = comp.time;
        var style = styleName;
        var motion = motionName;

        // حساب التوقيت التناسبي للحروف في نمط Typewriter باستخدام الفهارس الطبيعية النظيفة
        var totalTextChars = (scan && scan.fullText) ? scan.fullText.length : 1;
        var totalWords = (scan && scan.numWords) ? scan.numWords : 1;
        var totalLines = (scan && scan.numLines) ? scan.numLines : totalBoxes;

        if (motionRecipe && motionRecipe.isTypewriter) {
            for (var bi = 0; bi < totalBoxes; bi++) {
                boxesData[bi].anchorStart = (typeof boxesData[bi].charStart === "number") ? boxesData[bi].charStart : 0;
                boxesData[bi].anchorEnd = (typeof boxesData[bi].charEnd === "number") ? boxesData[bi].charEnd : (boxesData[bi].anchorStart + Math.max(1, (boxesData[bi].text || "").length));
            }
        }
        if (totalTextChars <= 0) totalTextChars = 1;
        if (totalWords <= 0) totalWords = 1;
        if (totalLines <= 0) totalLines = 1;

        var detectedAnim = (motionRecipe && motionRecipe.isTypewriter) ? $._smartHighlighter.detectTextAnimator(textLayer) : null;
        var typeStartTime = (detectedAnim && detectedAnim.hasKeys) ? detectedAnim.startTime : startTime;
        var typeTotalDur;

        if (detectedAnim && detectedAnim.hasKeys && detectedAnim.endTime > detectedAnim.startTime) {
            typeTotalDur = detectedAnim.endTime - detectedAnim.startTime;
            if (motionRecipe && motionRecipe.setupTextAnimator) {
                motionRecipe.setupTextAnimator(textLayer, typeStartTime, typeTotalDur, data.typewriterStyle, revealUnit);
            } else {
                var animStyle = (data.typewriterStyle === "pop" || data.typewriterPop === true) ? "scale" : "opacity";
                $._smartHighlighter.ensureTextTypewriter(textLayer, typeStartTime, typeStartTime + typeTotalDur, animStyle, revealUnit);
            }
            $._smartHighlighter.log("Typewriter: synced with existing Text Animator (" + typeTotalDur.toFixed(2) + "s, unit=" + revealUnit + ")");
        } else {
            var baseUnitDur = (data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35;
            typeTotalDur = Math.max(0.4, baseUnitDur * totalBoxes);
            if (motionRecipe && motionRecipe.isTypewriter) {
                if (motionRecipe.setupTextAnimator) {
                    motionRecipe.setupTextAnimator(textLayer, typeStartTime, typeTotalDur, data.typewriterStyle, revealUnit);
                } else {
                    var animStyle = (data.typewriterStyle === "pop" || data.typewriterPop === true || motion === "pop") ? "scale" : "opacity";
                    $._smartHighlighter.ensureTextTypewriter(textLayer, typeStartTime, typeStartTime + typeTotalDur, animStyle, revealUnit);
                }
                $._smartHighlighter.log("Typewriter: created Typewriter Sync Text Animator (" + typeTotalDur.toFixed(2) + "s, unit=" + revealUnit + ")");
            }
        }

        var typeBoxTimings = [];
        for (var tb = 0; tb < totalBoxes; tb++) {
            var bData = boxesData[tb];
            var cStartPct = 0;
            var cEndPct = 100;

            if (revealUnit === "words" && typeof bData.wordStart === "number") {
                cStartPct = (bData.wordStart / totalWords) * 100;
                cEndPct = (bData.wordEnd / totalWords) * 100;
            } else if (revealUnit === "lines") {
                var lIdx = (typeof bData.lineIndex === "number") ? bData.lineIndex : tb;
                cStartPct = (lIdx / totalLines) * 100;
                cEndPct = ((lIdx + 1) / totalLines) * 100;
            } else {
                var cStart = (motionRecipe && motionRecipe.isTypewriter && typeof bData.anchorStart === "number") ? bData.anchorStart : ((typeof bData.charStart === "number") ? bData.charStart : 0);
                var cEnd = (motionRecipe && motionRecipe.isTypewriter && typeof bData.anchorEnd === "number") ? bData.anchorEnd : ((typeof bData.charEnd === "number") ? bData.charEnd : (cStart + Math.max(1, (bData.text || "").length)));
                cStartPct = (cStart / totalTextChars) * 100;
                cEndPct = (cEnd / totalTextChars) * 100;
            }

            var bStart = typeStartTime + (cStartPct / 100) * typeTotalDur;
            var bEnd = typeStartTime + (cEndPct / 100) * typeTotalDur;
            if (bEnd <= bStart) bEnd = bStart + 0.04;

            typeBoxTimings.push({
                start: bStart,
                end: bEnd,
                dur: (bEnd - bStart),
                cStartPct: cStartPct,
                cEndPct: cEndPct,
                revealUnit: revealUnit,
                anchorStart: (typeof bData.anchorStart === "number") ? bData.anchorStart : 0,
                anchorEnd: (typeof bData.anchorEnd === "number") ? bData.anchorEnd : 0
            });
        }

        for (var k = 0; k < totalBoxes; k++) {
            var box = boxesData[k];
            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = box.name;
            shapeLayer.comment = tag;

            shapeLayer.moveAfter(lastLayer);
            lastLayer = shapeLayer;
            shapeLayer.parent = textLayer;

            // Context for strategy recipes
            var ctx = {
                index: k,
                totalBoxes: totalBoxes,
                box: box,
                textLayer: textLayer,
                shapeLayer: shapeLayer,
                comp: comp,
                data: data,
                style: styleRecipe,
                motion: motionRecipe,
                totalLines: totalLines,
                totalWords: totalWords,
                totalChars: totalTextChars,
                baseFS: baseFS,
                baseTotalH: baseTotalH,
                isCenter: isCenter,
                timing: typeBoxTimings[k]
            };

            var xform = shapeLayer.property("ADBE Transform Group");
            xform.property("ADBE Position").setValue([0, 0]);
            xform.property("ADBE Anchor Point").expression = "parent.transform.anchorPoint;";
            xform.property("ADBE Scale").setValue([100, 100]);

            var opacityCond = (motionRecipe && motionRecipe.getOpacityCondition)
                ? motionRecipe.getOpacityCondition(ctx)
                : ((motion === "typewriter" && revealUnit === "lines") ? '(prog < 50) ? 0 : baseOp;' : '(prog <= 0) ? 0 : baseOp;');

            xform.property("ADBE Opacity").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var mOp = pLayer.effect("Master Highlight Opacity")("Slider");\n' +
                'var lOp = effect("Local Opacity")("Slider");\n' +
                'var baseOp = (useM == 1) ? mOp : lOp;\n' +
                'var prog = effect("Progress")("Slider");\n' +
                opacityCond;

            // Visual setup: blending mode & rotation (delegated to style recipe)
            if (styleRecipe && styleRecipe.setupLayer) {
                styleRecipe.setupLayer(shapeLayer, ctx);
            } else {
                if (style === "marker") {
                    var tilts = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.7];
                    xform.property("ADBE Rotate Z").setValue(tilts[k % tilts.length]);
                    shapeLayer.blendingMode = BlendingMode.MULTIPLY;
                } else {
                    xform.property("ADBE Rotate Z").setValue(0);
                    shapeLayer.blendingMode = BlendingMode.NORMAL;
                }
            }

            // استرجاع أي تخصيص محلي سابق لهذا السطر/الصندوق (إن وجد)
            var prevSnap = (prevBoxes && k < prevBoxes.length) ? prevBoxes[k] : null;
            var isLocalCustom = (prevSnap && prevSnap.useMaster === 0);

            // Per-line / Per-box effect controls
            var fx = shapeLayer.property("ADBE Effect Parade");
            var chk = fx.addProperty("ADBE Checkbox Control"); chk.name = "Use Master Controls";
            chk.property("Checkbox").setValue(isLocalCustom ? 0 : 1);

            var colFx = fx.addProperty("ADBE Color Control"); colFx.name = "Local Color";
            colFx.property("Color").setValue((isLocalCustom && prevSnap.color) ? prevSnap.color : data.color);

            var pXFx = fx.addProperty("ADBE Slider Control"); pXFx.name = "Local Padding X";
            pXFx.property("Slider").setValue((isLocalCustom && prevSnap.padX !== null) ? prevSnap.padX : data.paddingX);

            var pYFx = fx.addProperty("ADBE Slider Control"); pYFx.name = "Local Padding Y";
            pYFx.property("Slider").setValue((isLocalCustom && prevSnap.padY !== null) ? prevSnap.padY : data.paddingY);

            var offFx = fx.addProperty("ADBE Slider Control"); offFx.name = "Local Offset Y";
            offFx.property("Slider").setValue((isLocalCustom && prevSnap.offY !== null) ? prevSnap.offY : 0);

            var rndFx = fx.addProperty("ADBE Slider Control"); rndFx.name = "Local Roundness";
            rndFx.property("Slider").setValue((isLocalCustom && prevSnap.round !== null) ? prevSnap.round : initRoundness);

            var opacFx = fx.addProperty("ADBE Slider Control"); opacFx.name = "Local Opacity";
            opacFx.property("Slider").setValue((isLocalCustom && prevSnap.opacity !== null && prevSnap.opacity !== undefined) ? prevSnap.opacity : initOpacity);

            var progFx = fx.addProperty("ADBE Slider Control"); progFx.name = "Progress";

            // Scale transform expression (delegated to motion recipe)
            if (motionRecipe && motionRecipe.applyTransformScale) {
                motionRecipe.applyTransformScale(xform.property("ADBE Scale"), ctx);
            }

            if (data.animate) {
                var lineDur = (motionRecipe && typeof motionRecipe.lineDur === "number")
                    ? motionRecipe.lineDur
                    : ((motion === "snap") ? 0.04 : ((data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35));
                var gapOrStagger = (typeof data.stagger === "number" && !isNaN(data.stagger)) ? data.stagger : 0;
                var hasOutro = !!data.outro;
                var holdTime = (typeof data.outTime === "number" && data.outTime > 0) ? data.outTime : 1.5;
                var t1, t2;

                if (motionRecipe && motionRecipe.isTypewriter) {
                    // التوقيت التناسبي الدقيق للحروف (Character-Proportional Distribution)
                    t1 = typeBoxTimings[k].start;
                    t2 = typeBoxTimings[k].end;
                } else if (hasMarkers && k < markerTimes.length) {
                    // مزامنة الماركرز: الصندوق يبدأ بدقة عند توقيت الماركر المطابق
                    t1 = markerTimes[k];
                    t2 = t1 + lineDur;
                } else if (hasMarkers && markerTimes.length > 0) {
                    var lastMTime = markerTimes[markerTimes.length - 1];
                    var extraIdx = k - markerTimes.length + 1;
                    t1 = lastMTime + (extraIdx * (lineDur + gapOrStagger));
                    t2 = t1 + lineDur;
                } else if (data.sequential) {
                    t1 = startTime + (k * (lineDur + gapOrStagger));
                    t2 = t1 + lineDur;
                } else {
                    t1 = startTime + (k * gapOrStagger);
                    t2 = t1 + lineDur;
                }

                progFx.property("Slider").setValueAtTime(t1, 0);
                progFx.property("Slider").setValueAtTime(t2, 100);

                if (motionRecipe && motionRecipe.isTypewriter) {
                    try {
                        progFx.property("Slider").setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                        progFx.property("Slider").setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                    } catch(eLin) {}

                    if (motionRecipe.getProgressExpression) {
                        progFx.property("Slider").expression = motionRecipe.getProgressExpression(ctx);
                    }
                } else if (motionRecipe && motionRecipe.applyKeyframeEasing) {
                    motionRecipe.applyKeyframeEasing(progFx.property("Slider"), 1, 2);
                } else if (motion !== "snap") {
                    var easePunch = new KeyframeEase(0, 25);
                    var easeDecel = new KeyframeEase(0, 80);
                    progFx.property("Slider").setTemporalEaseAtKey(1, [easePunch], [easePunch]);
                    progFx.property("Slider").setTemporalEaseAtKey(2, [easeDecel], [easeDecel]);
                }

                // حركة الخروج (اختيارية)
                if (hasOutro) {
                    var outroOrder = data.outroOrder || "first";
                    var totalEntryFinish;
                    if (motionRecipe && motionRecipe.isTypewriter) {
                        totalEntryFinish = (typeBoxTimings.length > 0) ? typeBoxTimings[typeBoxTimings.length - 1].end : (startTime + typeTotalDur);
                    } else if (data.sequential) {
                        totalEntryFinish = startTime + (totalBoxes * lineDur) + ((totalBoxes - 1) * gapOrStagger);
                    } else {
                        totalEntryFinish = startTime + ((totalBoxes - 1) * gapOrStagger) + lineDur;
                    }

                    var exitBaseTime = totalEntryFinish + holdTime;
                    var exitIndex = (outroOrder === "last") ? (totalBoxes - 1 - k) : k;

                    var t3, t4;
                    if (motionRecipe && motionRecipe.isTypewriter) {
                        var outDur = typeBoxTimings[k].dur;
                        t3 = exitBaseTime + (exitIndex * (outDur + gapOrStagger));
                        t4 = t3 + outDur;
                    } else if (data.sequential) {
                        t3 = exitBaseTime + (exitIndex * (lineDur + gapOrStagger));
                        t4 = t3 + lineDur;
                    } else {
                        t3 = exitBaseTime + (exitIndex * gapOrStagger);
                        t4 = t3 + lineDur;
                    }

                    progFx.property("Slider").setValueAtTime(t3, 100);
                    progFx.property("Slider").setValueAtTime(t4, 0);

                    if (motionRecipe && motionRecipe.isTypewriter) {
                        try {
                            progFx.property("Slider").setInterpolationTypeAtKey(3, KeyframeInterpolationType.LINEAR);
                            progFx.property("Slider").setInterpolationTypeAtKey(4, KeyframeInterpolationType.LINEAR);
                        } catch(eLinOut) {}
                    } else if (motionRecipe && motionRecipe.applyOutroKeyframeEasing) {
                        motionRecipe.applyOutroKeyframeEasing(progFx.property("Slider"), 3, 4);
                    } else if (motion !== "snap") {
                        var easeOutIn = new KeyframeEase(0, 30);
                        var easeOutEnd = new KeyframeEase(0, 75);
                        progFx.property("Slider").setTemporalEaseAtKey(3, [easeOutIn], [easeOutIn]);
                        progFx.property("Slider").setTemporalEaseAtKey(4, [easeOutEnd], [easeOutEnd]);
                    }
                }
            } else {
                progFx.property("Slider").setValue(100);
            }

            var contents = shapeLayer.property("ADBE Root Vectors Group");
            var group = contents.addProperty("ADBE Vector Group");
            group.name = "Box Group";
            var gContents = group.property("ADBE Vectors Group");

            var rect = gContents.addProperty("ADBE Vector Shape - Rect");
            rect.name = "Box";

            // Size expression (delegated to style recipe)
            if (styleRecipe && styleRecipe.getSizeExpression) {
                rect.property("ADBE Vector Rect Size").expression = styleRecipe.getSizeExpression(ctx);
            }

            // Position expression (delegated to style recipe)
            if (styleRecipe && styleRecipe.getPositionExpression) {
                rect.property("ADBE Vector Rect Position").expression = styleRecipe.getPositionExpression(ctx);
            }

            // Roundness (Safely clamped so it never exceeds half-height, fully controllable by Master & Local)
            rect.property("ADBE Vector Rect Roundness").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var r = (useM == 1) ? pLayer.effect("Master Roundness")("Slider") : effect("Local Roundness")("Slider");\n' +
                'var sz = thisProperty.propertyGroup(1).size;\n' +
                'Math.min(Math.max(0, r), Math.min(sz[0], sz[1]) / 2);';

            // Graphic: Fill vs Outline (delegated to style recipe)
            if (styleRecipe && styleRecipe.buildGraphics) {
                styleRecipe.buildGraphics(gContents, ctx);
            }

            $._smartHighlighter.log("  Box " + (k + 1) + " created: [" + box.text + "] w=" + box.width.toFixed(1) + " h=" + box.height.toFixed(1));
        }

        $._smartHighlighter.writeMeta(textLayer, scan);
        app.endUndoGroup();

        var unitName = (targetScan.mode === "lines") ? "line(s)" : (targetScan.mode === "tagged" ? "tagged keyword(s)" : "word(s)");
        var report = hadPreviousLink
            ? "SUCCESS: Updated highlight (" + totalBoxes + " " + unitName + ", refreshed link)."
            : "SUCCESS: Created highlight (" + totalBoxes + " " + unitName + ").";
        if (masterNotes.length > 0) report += " Note: " + masterNotes.join("; ") + ".";
        $._smartHighlighter.log("createHighlight DONE: " + report);
        return report;

    } catch (err) {
        app.endUndoGroup();
        $._smartHighlighter.log("createHighlight ERROR: " + err.toString() + " line:" + err.line);
        return "ERROR: " + err.toString();
    }
};

// دالة الإزالة والتنظيف الشامل
$._smartHighlighter.removeHighlight = function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return "ERROR: لا توجد تركيبة مفتوحة.";
    if (comp.selectedLayers.length !== 1 || !(comp.selectedLayers[0] instanceof TextLayer)) {
        return "ERROR: يرجى تحديد طبقة النص المراد مسح الهايلايت منها.";
    }

    var textLayer = comp.selectedLayers[0];
    app.beginUndoGroup("Highlight-Studio: Remove");

    try {
        var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
        var removed = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l !== textLayer && l.parent === textLayer && l.comment === tag) {
                l.remove();
                removed++;
            }
        }

        // تنظيف أي Text Animator من نوع Typewriter Sync أنشأته الإضافة
        $._smartHighlighter.removeTextTypewriter(textLayer);

        // مسح الميتا داتا من تعليق النص
        try {
            var c = textLayer.comment || "";
            var a = c.indexOf($._smartHighlighter.META_OPEN);
            var b = c.indexOf($._smartHighlighter.META_CLOSE);
            if (a !== -1 && b !== -1 && b > a) {
                textLayer.comment = (c.substring(0, a) + c.substring(b + $._smartHighlighter.META_CLOSE.length)).replace(/^\s+|\s+$/g, "");
            }
        } catch (eC) {}

        // تنظيف العلامات المخفية الذكية من النص في حال كانت موجودة
        try {
            var sProp = textLayer.property("Source Text");
            if (sProp && sProp.value) {
                var cleaned = $._smartHighlighter.stripAnchors(sProp.value.text);
                if (cleaned !== sProp.value.text) {
                    sProp.setValue(cleaned);
                }
            }
        } catch (eAnc) {}

        app.endUndoGroup();
        $._smartHighlighter.log("removeHighlight: " + removed + " removed");
        if (removed === 0) {
            return "SUCCESS: No highlight shapes linked to selected text.";
        }
        return "SUCCESS: Highlight cleared (" + removed + " box(es) removed).";
    } catch (e) {
        app.endUndoGroup();
        $._smartHighlighter.log("removeHighlight ERROR: " + e.toString());
        return "ERROR: " + e.toString();
    }
};

var SMART_HL_BUILDER_LOADED = true;
