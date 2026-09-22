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
    if (comp.selectedLayers.length !== 1) {
        return "ERROR: يرجى تحديد طبقة واحدة (Text Layer أو Shape Layer).";
    }

    var sel = comp.selectedLayers[0];
    var textLayer = (sel instanceof TextLayer) ? sel : ((sel instanceof ShapeLayer && sel.parent && sel.parent instanceof TextLayer) ? sel.parent : null);
    if (!textLayer) {
        return "ERROR: يرجى تحديد طبقة نص واحدة (Text Layer) أو طبقة تظليل مرتبطة بها.";
    }
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

        // قراءة الماركرز للمزامنة الصوتية أو ماركرز التوقيت المخصصة إذا كان الخيار مفعلاً
        var timingMarkers = (data.syncMarkers && $._smartHighlighter.readTimingMarkers) ? $._smartHighlighter.readTimingMarkers(textLayer) : null;
        var hasTimingMarkers = (timingMarkers && timingMarkers.inStart !== null && timingMarkers.inEnd !== null);
        var outroMismatch = (data.syncMarkers && hasTimingMarkers && ((data.outro && (timingMarkers.outStart === null || timingMarkers.outEnd === null)) || (!data.outro && timingMarkers.outStart !== null)));
        if (data.syncMarkers && (!hasTimingMarkers || outroMismatch) && $._smartHighlighter.addTimingMarkers) {
            $._smartHighlighter.addTimingMarkers(data.inPoint, data.outPoint, data.lineDuration, data.outTime, data.outro);
            timingMarkers = $._smartHighlighter.readTimingMarkers(textLayer);
            hasTimingMarkers = (timingMarkers && timingMarkers.inStart !== null && timingMarkers.inEnd !== null);
        }
        var markerTimes = (!hasTimingMarkers && data.syncMarkers) ? $._smartHighlighter.readMarkers(textLayer, comp) : [];
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
        var typeStartTime;
        var typeTotalDur;
        var hasTextOutro = !!data.outro;
        var textOutStart = null;
        var textOutEnd = null;

        if (hasTimingMarkers) {
            typeStartTime = timingMarkers.inStart;
            typeTotalDur = Math.max(0.04, timingMarkers.inEnd - timingMarkers.inStart);
            if (timingMarkers.outStart !== null && timingMarkers.outEnd !== null) {
                hasTextOutro = true;
                textOutStart = timingMarkers.outStart;
                textOutEnd = timingMarkers.outEnd;
            }
        } else if (detectedAnim && detectedAnim.hasKeys && detectedAnim.endTime > detectedAnim.startTime) {
            typeStartTime = detectedAnim.startTime;
            typeTotalDur = detectedAnim.endTime - detectedAnim.startTime;
            if (hasTextOutro) {
                var holdTime = (typeof data.outTime === "number" && data.outTime > 0) ? data.outTime : 1.5;
                textOutStart = (typeStartTime + typeTotalDur) + holdTime;
                textOutEnd = textOutStart + typeTotalDur;
            }
        } else {
            typeStartTime = (data.syncMarkers && typeof data.inPoint === "number" && data.inPoint >= 0) ? data.inPoint : startTime;
            var baseUnitDur = (data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35;
            typeTotalDur = Math.max(0.04, baseUnitDur * totalBoxes);
            if (hasTextOutro) {
                textOutStart = (typeof data.outPoint === "number" && data.outPoint > (typeStartTime + typeTotalDur)) ? data.outPoint : ((typeStartTime + typeTotalDur) + 1.5);
                var outroDur = (typeof data.outTime === "number" && data.outTime > 0) ? data.outTime : (baseUnitDur * totalBoxes);
                textOutEnd = textOutStart + outroDur;
            }
        }

        var textOutroOrder = data.textOutroOrder || data.outroOrder || "first";
        var boxOutroOrder = (data.syncOutro !== false) ? textOutroOrder : (data.boxOutroOrder || textOutroOrder);

        if (motionRecipe && motionRecipe.isTypewriter) {
            var animStyle = (data.typewriterStyle === "pop" || data.typewriterPop === true || motion === "pop") ? "scale" : "opacity";
            var useMarkers = !!hasTimingMarkers;
            if (motionRecipe.setupTextAnimator) {
                motionRecipe.setupTextAnimator(textLayer, typeStartTime, typeTotalDur, animStyle, revealUnit, hasTextOutro, textOutStart, textOutEnd, textOutroOrder, useMarkers);
            } else {
                $._smartHighlighter.ensureTextTypewriter(textLayer, typeStartTime, typeStartTime + typeTotalDur, animStyle, revealUnit, hasTextOutro, textOutStart, textOutEnd, textOutroOrder, useMarkers);
            }
            $._smartHighlighter.log("Typewriter: setup Text Animator with Intro & Outro (" + typeTotalDur.toFixed(2) + "s in, hasOutro=" + hasTextOutro + ", outStart=" + textOutStart + ", textOrder=" + textOutroOrder + ", boxOrder=" + boxOutroOrder + ", useMarkers=" + useMarkers + ")");
        } else {
            // إزالة أنيميتور الآلة الكاتبة إذا تم التحويل لحركة أخرى حتى لا يظل النص مخفياً بـ Opacity = 0
            $._smartHighlighter.removeTextTypewriter(textLayer);
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
                timing: typeBoxTimings[k],
                boxOutroOrder: boxOutroOrder,
                textOutroOrder: textOutroOrder,
                hasOutro: hasOutro
            };

            var xform = shapeLayer.property("ADBE Transform Group");
            xform.property("ADBE Position").setValue([0, 0]);
            xform.property("ADBE Anchor Point").expression = "hasParent ? parent.transform.anchorPoint : value;";
            xform.property("ADBE Scale").setValue([100, 100]);

            var opacityCond = (motionRecipe && motionRecipe.getOpacityCondition)
                ? motionRecipe.getOpacityCondition(ctx)
                : ((motion === "typewriter" && revealUnit === "lines") ? '(prog < 50) ? 0 : baseOp;' : '(prog <= 0) ? 0 : baseOp;');

            xform.property("ADBE Opacity").expression = 
                'var pLayer = hasParent ? parent : null;\n' +
                'var useM = effect("Use Master Controls")(1);\n' +
                'var mOp = pLayer ? pLayer.effect("Master Highlight Opacity")(1) : 100;\n' +
                'var lOp = effect("Local Opacity")(1);\n' +
                'var baseOp = (useM == 1) ? mOp : lOp;\n' +
                'var prog = effect("Progress")(1);\n' +
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

            // Per-line / Per-box effect controls (توافقية دولية عبر الفهرس 1)
            var fx = shapeLayer.property("ADBE Effect Parade");
            var chk = fx.addProperty("ADBE Checkbox Control"); chk.name = "Use Master Controls";
            chk.property(1).setValue(isLocalCustom ? 0 : 1);

            var colFx = fx.addProperty("ADBE Color Control"); colFx.name = "Local Color";
            colFx.property(1).setValue((isLocalCustom && prevSnap.color) ? prevSnap.color : data.color);

            var pXFx = fx.addProperty("ADBE Slider Control"); pXFx.name = "Local Padding X";
            pXFx.property(1).setValue((isLocalCustom && prevSnap.padX !== null) ? prevSnap.padX : data.paddingX);

            var pYFx = fx.addProperty("ADBE Slider Control"); pYFx.name = "Local Padding Y";
            pYFx.property(1).setValue((isLocalCustom && prevSnap.padY !== null) ? prevSnap.padY : data.paddingY);

            var offFx = fx.addProperty("ADBE Slider Control"); offFx.name = "Local Offset Y";
            offFx.property(1).setValue((isLocalCustom && prevSnap.offY !== null) ? prevSnap.offY : 0);

            var rndFx = fx.addProperty("ADBE Slider Control"); rndFx.name = "Local Roundness";
            rndFx.property(1).setValue((isLocalCustom && prevSnap.round !== null) ? prevSnap.round : initRoundness);

            var opacFx = fx.addProperty("ADBE Slider Control"); opacFx.name = "Local Opacity";
            opacFx.property(1).setValue((isLocalCustom && prevSnap.opacity !== null && prevSnap.opacity !== undefined) ? prevSnap.opacity : initOpacity);

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

                if (hasTimingMarkers && motionRecipe && motionRecipe.isTypewriter) {
                    // التوقيت التناسبي الدقيق للحروف عبر نافذة الماركرز
                    var typeMarkerDur = Math.max(0.04, timingMarkers.inEnd - timingMarkers.inStart);
                    t1 = timingMarkers.inStart + ((typeBoxTimings[k].cStartPct / 100) * typeMarkerDur);
                    t2 = timingMarkers.inStart + ((typeBoxTimings[k].cEndPct / 100) * typeMarkerDur);
                    if (t2 <= t1) t2 = t1 + 0.04;
                    if (timingMarkers.outStart !== null && timingMarkers.outEnd !== null) {
                        hasOutro = true;
                    }
                } else if (hasTimingMarkers) {
                    // مزامنة الماركرز الحية المخصصة
                    t1 = timingMarkers.inStart + (k * gapOrStagger);
                    t2 = timingMarkers.inEnd + (k * gapOrStagger);
                    if (timingMarkers.outStart !== null && timingMarkers.outEnd !== null) {
                        hasOutro = true;
                    }
                } else if (motionRecipe && motionRecipe.isTypewriter) {
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

                progFx.property(1).setValueAtTime(t1, 0);
                progFx.property(1).setValueAtTime(t2, 100);

                if (hasTimingMarkers) {
                    var outOrder = boxOutroOrder;
                    var exitK = (outOrder === "last") ? (totalBoxes - 1 - k) : k;
                    var rS = (typeBoxTimings && typeBoxTimings[k]) ? (typeBoxTimings[k].cStartPct / 100) : 0;
                    var rE = (typeBoxTimings && typeBoxTimings[k]) ? (typeBoxTimings[k].cEndPct / 100) : 1;
                    var isType = (motionRecipe && motionRecipe.isTypewriter);
                    var exitIndex = exitK;

                    var markerExpr = 
                        "var res = value;\n" +
                        "var p = null; try { p = thisLayer.parent; } catch(e) {}\n" +
                        "if (p && p.marker && p.marker.numKeys > 0) {\n" +
                        "    var m = p.marker;\n" +
                        "    var inS = null, inE = null, outS = null, outE = null;\n" +
                        "    for (var i = 1; i <= m.numKeys; i++) {\n" +
                        "        var comm = m.key(i).comment;\n" +
                        "        var mt = m.key(i).time;\n" +
                        "        if (comm === 'HL_IN_START') inS = mt;\n" +
                        "        else if (comm === 'HL_IN_END') inE = mt;\n" +
                        "        else if (comm === 'HL_OUT_START') outS = mt;\n" +
                        "        else if (comm === 'HL_OUT_END') outE = mt;\n" +
                        "    }\n" +
                        "    if (inS !== null && inE !== null) {\n" +
                        (isType ? (
                        "        var inDur = Math.max(0.01, inE - inS);\n" +
                        "        var startT = inS + (" + rS.toFixed(4) + " * inDur);\n" +
                        "        var endT = inS + (" + rE.toFixed(4) + " * inDur);\n"
                        ) : (
                        "        var delay = " + (k * gapOrStagger) + ";\n" +
                        "        var startT = inS + delay;\n" +
                        "        var endT = inE + delay;\n"
                        )) +
                        "        var cur = time;\n" +
                        "        if (outS !== null && outE !== null) {\n" +
                        (isType ? (
                        "            var outDur = Math.max(0.01, outE - outS);\n" +
                        (outOrder === "last" ? (
                        "            var oStartT = outS + ((1 - " + rE.toFixed(4) + ") * outDur);\n" +
                        "            var oEndT = outS + ((1 - " + rS.toFixed(4) + ") * outDur);\n"
                        ) : (
                        "            var oStartT = outS + (" + rS.toFixed(4) + " * outDur);\n" +
                        "            var oEndT = outS + (" + rE.toFixed(4) + " * outDur);\n"
                        ))
                        ) : (
                        "            var exitDelay = " + (exitK * gapOrStagger) + ";\n" +
                        "            var oStartT = outS + exitDelay;\n" +
                        "            var oEndT = outE + exitDelay;\n"
                        )) +
                        "            if (cur < startT) res = 0;\n" +
                        "            else if (cur <= endT) res = " + (isType ? "linear" : "ease") + "(cur, startT, endT, 0, 100);\n" +
                        "            else if (cur < oStartT) res = 100;\n" +
                        "            else if (cur <= oEndT) res = " + (isType ? "linear" : "ease") + "(cur, oStartT, oEndT, 100, 0);\n" +
                        "            else res = 0;\n" +
                        "        } else {\n" +
                        "            if (cur < startT) res = 0;\n" +
                        "            else if (cur <= endT) res = " + (isType ? "linear" : "ease") + "(cur, startT, endT, 0, 100);\n" +
                        "            else res = 100;\n" +
                        "        }\n" +
                        "    }\n" +
                        "}\n" +
                        "res;";
                    progFx.property(1).expression = markerExpr;
                } else if (motionRecipe && motionRecipe.isTypewriter) {
                    try {
                        progFx.property(1).setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                        progFx.property(1).setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                    } catch(eLin) {}
                } else if (motionRecipe && motionRecipe.applyKeyframeEasing) {
                    motionRecipe.applyKeyframeEasing(progFx.property(1), 1, 2);
                } else if (motion !== "snap") {
                    var easePunch = new KeyframeEase(0, 25);
                    var easeDecel = new KeyframeEase(0, 80);
                    progFx.property(1).setTemporalEaseAtKey(1, [easePunch], [easePunch]);
                    progFx.property(1).setTemporalEaseAtKey(2, [easeDecel], [easeDecel]);
                }

                // حركة الخروج (اختيارية)
                if (hasOutro) {
                    var outroOrder = boxOutroOrder;
                    var exitIndex = (outroOrder === "last") ? (totalBoxes - 1 - k) : k;
                    var t3, t4;

                    if (motionRecipe && motionRecipe.isTypewriter) {
                        var totalOutroDur = (typeof textOutEnd === "number" && typeof textOutStart === "number" && textOutEnd > textOutStart)
                            ? (textOutEnd - textOutStart)
                            : Math.max(0.04, (data.outTime && data.outTime > 0) ? data.outTime : typeTotalDur);
                        var baseOutStart = (typeof textOutStart === "number")
                            ? textOutStart
                            : ((typeBoxTimings.length > 0 ? typeBoxTimings[typeBoxTimings.length - 1].end : (startTime + typeTotalDur)) + holdTime);

                        var rS = (typeBoxTimings && typeBoxTimings[k]) ? (typeBoxTimings[k].cStartPct / 100) : 0;
                        var rE = (typeBoxTimings && typeBoxTimings[k]) ? (typeBoxTimings[k].cEndPct / 100) : 1;

                        if (outroOrder === "last") {
                            t3 = baseOutStart + ((1 - rE) * totalOutroDur);
                            t4 = baseOutStart + ((1 - rS) * totalOutroDur);
                        } else {
                            t3 = baseOutStart + (rS * totalOutroDur);
                            t4 = baseOutStart + (rE * totalOutroDur);
                        }
                    } else if (hasTimingMarkers && timingMarkers.outStart !== null && timingMarkers.outEnd !== null) {
                        t3 = timingMarkers.outStart + (exitIndex * gapOrStagger);
                        t4 = timingMarkers.outEnd + (exitIndex * gapOrStagger);
                    } else {
                        var totalEntryFinish;
                        if (data.sequential) {
                            totalEntryFinish = startTime + (totalBoxes * lineDur) + ((totalBoxes - 1) * gapOrStagger);
                        } else {
                            totalEntryFinish = startTime + ((totalBoxes - 1) * gapOrStagger) + lineDur;
                        }

                        var exitBaseTime = (typeof data.outPoint === "number" && data.outPoint > totalEntryFinish) ? data.outPoint : (totalEntryFinish + holdTime);
                        if (data.sequential) {
                            t3 = exitBaseTime + (exitIndex * (lineDur + gapOrStagger));
                            t4 = t3 + lineDur;
                        } else {
                            t3 = exitBaseTime + (exitIndex * gapOrStagger);
                            t4 = t3 + lineDur;
                        }
                    }

                    progFx.property(1).setValueAtTime(t3, 100);
                    progFx.property(1).setValueAtTime(t4, 0);

                    if (motionRecipe && motionRecipe.isTypewriter) {
                        try {
                            progFx.property(1).setInterpolationTypeAtKey(3, KeyframeInterpolationType.LINEAR);
                            progFx.property(1).setInterpolationTypeAtKey(4, KeyframeInterpolationType.LINEAR);
                        } catch(eLinOut) {}
                    } else if (motionRecipe && motionRecipe.applyOutroKeyframeEasing) {
                        motionRecipe.applyOutroKeyframeEasing(progFx.property(1), 3, 4);
                    } else if (motion !== "snap") {
                        var easeOutIn = new KeyframeEase(0, 30);
                        var easeOutEnd = new KeyframeEase(0, 75);
                        progFx.property(1).setTemporalEaseAtKey(3, [easeOutIn], [easeOutIn]);
                        progFx.property(1).setTemporalEaseAtKey(4, [easeOutEnd], [easeOutEnd]);
                    }
                }
            } else {
                progFx.property(1).setValue(100);
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
                'var pLayer = hasParent ? parent : null;\n' +
                'var useM = effect("Use Master Controls")(1);\n' +
                'var r = (useM == 1 && pLayer) ? pLayer.effect("Master Roundness")(1) : effect("Local Roundness")(1);\n' +
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
        $._smartHighlighter.safeEndUndoGroup();
        $._smartHighlighter.log("createHighlight ERROR: " + err.toString() + " line:" + err.line);
        return "ERROR: " + err.toString();
    }
};

// دالة الإزالة والتنظيف الشامل (حذف الصناديق والمتحكمات والماركرز من النص)
$._smartHighlighter.removeHighlight = function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return "ERROR: لا توجد تركيبة مفتوحة.";
    if (comp.selectedLayers.length !== 1) {
        return "ERROR: يرجى تحديد طبقة النص أو إحدى طبقات الهايلايت.";
    }

    var sel = comp.selectedLayers[0];
    var textLayer = null;
    if (sel instanceof TextLayer) {
        textLayer = sel;
    } else if (sel instanceof ShapeLayer && sel.parent && (sel.parent instanceof TextLayer)) {
        textLayer = sel.parent;
    }

    if (!textLayer) {
        return "ERROR: يرجى تحديد طبقة النص أو إحدى طبقات الهايلايت المرتبطة بها.";
    }

    app.beginUndoGroup("Highlight-Studio: Clear All");

    try {
        var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
        var removedBoxes = 0;

        // 1. حذف جميع طبقات أشكال الهايلايت المرتبطة بطبقة النص (Line-by-line و Phrase Highlights)
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l !== textLayer && l.parent === textLayer) {
                var c = l.comment || "";
                var n = l.name || "";
                if (c === tag || c.indexOf("SMART_HL") !== -1 || n.indexOf("HL_") === 0 || n.indexOf("Highlight_") === 0 || n.indexOf("Phrase_") === 0 || n.indexOf("[HL-Phrase]") !== -1) {
                    try {
                        l.remove();
                        removedBoxes++;
                    } catch(eDelBox) {}
                }
            }
        }

        // 2. حذف جميع متحكمات ومؤثرات الماستر (Master Effects) من طبقة النص
        var fxGroup = textLayer.property("ADBE Effect Parade");
        var removedEffects = 0;
        if (fxGroup) {
            var masterNames = [
                "Master Highlight Color",
                "Master Highlight Opacity",
                "Master Padding X",
                "Master Padding Y",
                "Master Offset Y",
                "Master Roundness"
            ];
            for (var mi = 0; mi < masterNames.length; mi++) {
                try {
                    var fx = fxGroup.property(masterNames[mi]);
                    if (fx) {
                        fx.remove();
                        removedEffects++;
                    }
                } catch(eFxName) {}
            }
            // فحص إضافي لأي تأثيرات متبقية تبدأ بكلمة Master Highlight أو Master Padding أو Master Offset أو Master Roundness
            for (var fi = fxGroup.numProperties; fi >= 1; fi--) {
                try {
                    var pName = fxGroup.property(fi).name || "";
                    if (pName.indexOf("Master Highlight") === 0 ||
                        pName.indexOf("Master Padding") === 0 ||
                        pName.indexOf("Master Offset") === 0 ||
                        pName.indexOf("Master Roundness") === 0) {
                        fxGroup.property(fi).remove();
                        removedEffects++;
                    }
                } catch(eFxRest) {}
            }
        }

        // 3. حذف جميع ماركرز التوقيت المخصصة للإضافة من طبقة النص (HL_IN_START, HL_IN_END, HL_OUT_START, HL_OUT_END)
        var mProp = textLayer.property("ADBE Marker");
        var removedMarkers = 0;
        if (mProp && mProp.numKeys > 0) {
            for (var ki = mProp.numKeys; ki >= 1; ki--) {
                try {
                    var mComm = mProp.keyValue(ki).comment || "";
                    if (mComm.indexOf("HL_") === 0) {
                        mProp.removeKey(ki);
                        removedMarkers++;
                    }
                } catch(eMk) {}
            }
        }

        // 4. تنظيف أي Text Animator من نوع Typewriter Sync أو Typewriter أنشأته الإضافة
        $._smartHighlighter.removeTextTypewriter(textLayer);

        // 5. مسح الميتا داتا من تعليق النص
        try {
            var cText = textLayer.comment || "";
            var a = cText.indexOf($._smartHighlighter.META_OPEN);
            var b = cText.indexOf($._smartHighlighter.META_CLOSE);
            if (a !== -1 && b !== -1 && b > a) {
                textLayer.comment = (cText.substring(0, a) + cText.substring(b + $._smartHighlighter.META_CLOSE.length)).replace(/^\s+|\s+$/g, "");
            }
        } catch (eC) {}

        // 6. تنظيف العلامات المخفية الذكية من النص في حال كانت موجودة
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
        $._smartHighlighter.log("removeHighlight: " + removedBoxes + " boxes, " + removedEffects + " master effects, " + removedMarkers + " markers removed");
        
        var summary = [];
        if (removedBoxes > 0) summary.push(removedBoxes + " box(es)");
        if (removedEffects > 0) summary.push(removedEffects + " controller(s)");
        if (removedMarkers > 0) summary.push(removedMarkers + " marker(s)");
        
        var details = (summary.length > 0) ? summary.join(", ") : "All highlights and controls";
        return "SUCCESS: Cleared everything (" + details + " removed).";
    } catch (e) {
        $._smartHighlighter.safeEndUndoGroup();
        $._smartHighlighter.log("removeHighlight ERROR: " + e.toString());
        return "ERROR: " + e.toString();
    }
};

var SMART_HL_BUILDER_LOADED = true;
