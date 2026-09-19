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
        var initRoundness = (data.style === "pill" && (!data.roundness || data.roundness === 0)) ? 50 : (data.roundness || 0);
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
        var style = data.style || "box"; // "box", "pill", "marker", "underline", "outline"
        var motion = data.motion || "wipe"; // "wipe", "pop", "snap", "typewriter"

        // حساب التوقيت التناسبي للحروف في نمط Typewriter باستخدام الفهارس الطبيعية النظيفة
        var totalTextChars = (scan && scan.fullText) ? scan.fullText.length : 1;
        if (motion === "typewriter") {
            for (var bi = 0; bi < totalBoxes; bi++) {
                boxesData[bi].anchorStart = (typeof boxesData[bi].charStart === "number") ? boxesData[bi].charStart : 0;
                boxesData[bi].anchorEnd = (typeof boxesData[bi].charEnd === "number") ? boxesData[bi].charEnd : (boxesData[bi].anchorStart + Math.max(1, (boxesData[bi].text || "").length));
            }
        }
        if (totalTextChars <= 0) totalTextChars = 1;

        var detectedAnim = (motion === "typewriter") ? $._smartHighlighter.detectTextAnimator(textLayer) : null;
        var typeStartTime = (detectedAnim && detectedAnim.hasKeys) ? detectedAnim.startTime : startTime;
        var typeTotalDur;

        if (detectedAnim && detectedAnim.hasKeys && detectedAnim.endTime > detectedAnim.startTime) {
            typeTotalDur = detectedAnim.endTime - detectedAnim.startTime;
            $._smartHighlighter.log("Typewriter: synced with existing Text Animator (" + typeTotalDur.toFixed(2) + "s)");
        } else {
            var baseUnitDur = (data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35;
            typeTotalDur = Math.max(0.4, baseUnitDur * totalBoxes);
            if (motion === "typewriter") {
                var animStyle = (data.typewriterStyle === "pop" || data.typewriterPop === true || motion === "pop") ? "scale" : "opacity";
                $._smartHighlighter.ensureTextTypewriter(textLayer, typeStartTime, typeStartTime + typeTotalDur, animStyle);
                $._smartHighlighter.log("Typewriter: created Typewriter Sync Text Animator (" + typeTotalDur.toFixed(2) + "s)");
            }
        }

        var typeBoxTimings = [];
        for (var tb = 0; tb < totalBoxes; tb++) {
            var bData = boxesData[tb];
            var cStart = (motion === "typewriter" && typeof bData.anchorStart === "number") ? bData.anchorStart : ((typeof bData.charStart === "number") ? bData.charStart : 0);
            var cEnd = (motion === "typewriter" && typeof bData.anchorEnd === "number") ? bData.anchorEnd : ((typeof bData.charEnd === "number") ? bData.charEnd : (cStart + Math.max(1, (bData.text || "").length)));
            
            var cStartPct = (cStart / totalTextChars) * 100;
            var cEndPct = (cEnd / totalTextChars) * 100;

            var bStart = typeStartTime + (cStartPct / 100) * typeTotalDur;
            var bEnd = typeStartTime + (cEndPct / 100) * typeTotalDur;
            if (bEnd <= bStart) bEnd = bStart + 0.04;

            typeBoxTimings.push({
                start: bStart,
                end: bEnd,
                dur: (bEnd - bStart),
                cStartPct: cStartPct,
                cEndPct: cEndPct,
                anchorStart: cStart,
                anchorEnd: cEnd
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

            var xform = shapeLayer.property("ADBE Transform Group");
            xform.property("ADBE Position").setValue([0, 0]);
            xform.property("ADBE Anchor Point").expression = "parent.transform.anchorPoint;";
            xform.property("ADBE Scale").setValue([100, 100]);
            xform.property("ADBE Opacity").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var mOp = pLayer.effect("Master Highlight Opacity")("Slider");\n' +
                'var lOp = effect("Local Opacity")("Slider");\n' +
                'var baseOp = (useM == 1) ? mOp : lOp;\n' +
                'var prog = effect("Progress")("Slider");\n' +
                '(prog <= 0) ? 0 : baseOp;';

            // Real Marker: زاوية ميل عفوية طفيفة ونمط مزج Multiply
            if (style === "marker") {
                var tilts = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.7];
                xform.property("ADBE Rotate Z").setValue(tilts[k % tilts.length]);
                shapeLayer.blendingMode = BlendingMode.MULTIPLY;
            } else {
                xform.property("ADBE Rotate Z").setValue(0);
                shapeLayer.blendingMode = BlendingMode.NORMAL;
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

            // حركة الـ Scale Pop (الارتداد المرن Hormozi Elastic Overshoot)
            if (motion === "pop") {
                var scaleExpr = 
                    'var p = effect("Progress")("Slider");\n' +
                    'if (p.numKeys >= 2) {\n' +
                    '    var k1 = p.key(1);\n' +
                    '    var k2 = p.key(2);\n' +
                    '    if (time < k1.time) {\n' +
                    '        [0, 0];\n' +
                    '    } else if (time <= k2.time) {\n' +
                    '        var tNorm = (time - k1.time) / Math.max(0.001, (k2.time - k1.time));\n' +
                    '        var s = easeOut(tNorm, 0, 1, 0, 118);\n' +
                    '        [s, s];\n' +
                    '    } else {\n' +
                    '        var hasExit = (p.numKeys >= 4);\n' +
                    '        var k3 = hasExit ? p.key(3) : null;\n' +
                    '        var k4 = hasExit ? p.key(4) : null;\n' +
                    '        if (hasExit && time >= k4.time) {\n' +
                    '            [0, 0];\n' +
                    '        } else if (hasExit && time >= k3.time) {\n' +
                    '            var tOutNorm = (time - k3.time) / Math.max(0.001, (k4.time - k3.time));\n' +
                    '            var sOut = easeIn(tOutNorm, 0, 1, 100, 0);\n' +
                    '            [sOut, sOut];\n' +
                    '        } else {\n' +
                    '            var t = time - k2.time;\n' +
                    '            if (t < 0.55) {\n' +
                    '                var freq = 4.2;\n' +
                    '                var decay = 7.5;\n' +
                    '                var amp = 18.0;\n' +
                    '                var w = amp * Math.cos(freq * t * 2 * Math.PI) / Math.exp(decay * t);\n' +
                    '                [100 + w, 100 + w];\n' +
                    '            } else {\n' +
                    '                [100, 100];\n' +
                    '            }\n' +
                    '        }\n' +
                    '    }\n' +
                    '} else {\n' +
                    '    var prog = p.value;\n' +
                    '    (prog <= 0) ? [0, 0] : [100, 100];\n' +
                    '}';
                xform.property("ADBE Scale").expression = scaleExpr;
            }

            if (data.animate) {
                var lineDur = (motion === "snap") ? 0.04 : ((data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35);
                var gapOrStagger = (typeof data.stagger === "number" && !isNaN(data.stagger)) ? data.stagger : 0;
                var hasOutro = !!data.outro;
                var holdTime = (typeof data.outTime === "number" && data.outTime > 0) ? data.outTime : 1.5;
                var t1, t2;

                if (motion === "typewriter") {
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

                if (motion === "typewriter") {
                    try {
                        progFx.property("Slider").setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                        progFx.property("Slider").setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                    } catch(eLin) {}

                    // ربط ديناميكي ذكي بمحدد النطاق Range Selector لطبقة النص
                    var progExpr = 
                        'var pLayer = parent;\n' +
                        'var anim = null;\n' +
                        'try { anim = pLayer.text.animator("Typewriter Sync"); } catch(e) {}\n' +
                        'if (!anim) { try { anim = pLayer.text.animator("Typewriter"); } catch(e2) {} }\n' +
                        'if (anim && anim.numProperties >= 1) {\n' +
                        '    try {\n' +
                        '        var sel = anim.property("ADBE Text Selectors").property(1);\n' +
                        '        var pVal = 0;\n' +
                        '        var pStart = null; try { pStart = sel.property("ADBE Text Percent Start"); } catch(e1) { try { pStart = sel.property("Start"); } catch(e11) {} }\n' +
                        '        var pEnd = null; try { pEnd = sel.property("ADBE Text Percent End"); } catch(e2) { try { pEnd = sel.property("End"); } catch(e22) {} }\n' +
                        '        if (pStart && pStart.numKeys > 0) { pVal = pStart.value; }\n' +
                        '        else if (pEnd && pEnd.numKeys > 0) { pVal = pEnd.value; }\n' +
                        '        else if (pStart) { pVal = pStart.value; }\n' +
                        '        else if (pEnd) { pVal = pEnd.value; }\n' +
                        '        var c1 = ' + typeBoxTimings[k].cStartPct.toFixed(4) + ';\n' +
                        '        var c2 = ' + typeBoxTimings[k].cEndPct.toFixed(4) + ';\n' +
                        '        if (pVal <= c1) { 0; } else if (pVal >= c2) { 100; } else { linear(pVal, c1, c2, 0, 100); }\n' +
                        '    } catch(err) { value; }\n' +
                        '} else {\n' +
                        '    value;\n' +
                        '}';
                    progFx.property("Slider").expression = progExpr;

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
                    if (motion === "typewriter") {
                        totalEntryFinish = (typeBoxTimings.length > 0) ? typeBoxTimings[typeBoxTimings.length - 1].end : (startTime + typeTotalDur);
                    } else if (data.sequential) {
                        totalEntryFinish = startTime + (totalBoxes * lineDur) + ((totalBoxes - 1) * gapOrStagger);
                    } else {
                        totalEntryFinish = startTime + ((totalBoxes - 1) * gapOrStagger) + lineDur;
                    }

                    var exitBaseTime = totalEntryFinish + holdTime;
                    var exitIndex = (outroOrder === "last") ? (totalBoxes - 1 - k) : k;

                    var t3, t4;
                    if (motion === "typewriter") {
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

                    if (motion === "typewriter") {
                        try {
                            progFx.property("Slider").setInterpolationTypeAtKey(3, KeyframeInterpolationType.LINEAR);
                            progFx.property("Slider").setInterpolationTypeAtKey(4, KeyframeInterpolationType.LINEAR);
                        } catch(eLinOut) {}
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

            // معادلة حساب العرض الدقيق للحروف في نمط Typewriter مقابل النمط الخطي العادي
            var widthCalculationSnippet = "";
            if (motion === "typewriter" && box.cOffsets && box.cOffsets.length > 0) {
                var cOffsetsStr = "[" + box.cOffsets.join(",") + "]";
                widthCalculationSnippet = 
                    'var cOffsets = ' + cOffsetsStr + ';\n' +
                    'var numChars = cOffsets.length;\n' +
                    'var curTextW = 0;\n' +
                    'if (p > 0 && numChars > 0) {\n' +
                    '    var smVal = 0;\n' +
                    '    try {\n' +
                    '        var anim = null;\n' +
                    '        try { anim = pLayer.text.animator("Typewriter Sync"); } catch(e01) {}\n' +
                    '        if (!anim) { try { anim = pLayer.text.animator("Typewriter"); } catch(e02) {} }\n' +
                    '        if (anim) {\n' +
                    '            var sel = anim.property("ADBE Text Selectors").property(1);\n' +
                    '            var adv = sel.property("ADBE Text Range Advanced");\n' +
                    '            if (!adv) adv = sel.property("Advanced");\n' +
                    '            if (adv) {\n' +
                    '                var sm = adv.property("ADBE Text Range Smoothness");\n' +
                    '                if (!sm) sm = adv.property("Smoothness");\n' +
                    '                if (sm) smVal = sm.value;\n' +
                    '            }\n' +
                    '        }\n' +
                    '    } catch(eSm) {}\n' +
                    '    if (smVal > 0) {\n' +
                    '        var cFloat = p * numChars;\n' +
                    '        var cIdx = Math.min(numChars - 1, Math.floor(cFloat));\n' +
                    '        var prevW = (cIdx > 0) ? cOffsets[cIdx - 1] : 0;\n' +
                    '        var nextW = cOffsets[cIdx];\n' +
                    '        var frac = cFloat - cIdx;\n' +
                    '        curTextW = prevW + frac * (nextW - prevW);\n' +
                    '    } else {\n' +
                    '        var visChars = Math.min(numChars, Math.max(0, Math.ceil(p * numChars - 0.0001)));\n' +
                    '        curTextW = (visChars > 0) ? cOffsets[visChars - 1] : 0;\n' +
                    '    }\n' +
                    '}\n' +
                    'var curW = (p <= 0 || curTextW <= 0) ? 0 : (curTextW * fontRatio + pX * 2);\n';
            } else {
                widthCalculationSnippet = 
                    'var baseW = ' + box.width.toFixed(2) + ' * fontRatio;\n' +
                    'var curW = (p <= 0) ? 0 : (baseW * p + pX * 2);\n';
            }

            // Size expression (يحافظ على كامل الهامش pX أمام الحرف المكتوب دائماً)
            var sizeExpr = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var pX = (useM == 1) ? pLayer.effect("Master Padding X")("Slider") : effect("Local Padding X")("Slider");\n' +
                'var pY = (useM == 1) ? pLayer.effect("Master Padding Y")("Slider") : effect("Local Padding Y")("Slider");\n\n' +
                'var baseFS = ' + baseFS.toFixed(2) + ';\n' +
                'var curFS = baseFS;\n' +
                'try {\n' +
                '    curFS = pLayer.text.sourceText.style.fontSize;\n' +
                '} catch(err) {\n' +
                '    var curR = pLayer.sourceRectAtTime();\n' +
                '    curFS = baseFS * (curR.height / ' + baseTotalH.toFixed(2) + ');\n' +
                '}\n' +
                'var fontRatio = curFS / baseFS;\n\n' +
                'var p = clamp(effect("Progress")("Slider") / 100, 0, 1);\n' +
                'var fullH;\n';

            if (style === "underline") {
                sizeExpr += 
                    'fullH = Math.max(curFS * 0.12, 5) + pY;\n';
            } else {
                sizeExpr += 
                    'fullH = (' + box.height.toFixed(2) + ' * fontRatio) + pY * 2;\n';
            }

            sizeExpr += 
                widthCalculationSnippet +
                '[curW, fullH];';
            rect.property("ADBE Vector Rect Size").expression = sizeExpr;

            // Position expression (ارتكاز دقيق يضمن بقاء الحواف والهوامش ثابتة أثناء التوسع)
            var posExpr = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var pX = (useM == 1) ? pLayer.effect("Master Padding X")("Slider") : effect("Local Padding X")("Slider");\n' +
                'var offY = (useM == 1) ? pLayer.effect("Master Offset Y")("Slider") : effect("Local Offset Y")("Slider");\n\n' +
                'var r = pLayer.sourceRectAtTime();\n' +
                'var baseFS = ' + baseFS.toFixed(2) + ';\n' +
                'var curFS = baseFS;\n' +
                'try {\n' +
                '    curFS = pLayer.text.sourceText.style.fontSize;\n' +
                '} catch(err) {\n' +
                '    curFS = baseFS * (r.height / ' + baseTotalH.toFixed(2) + ');\n' +
                '}\n' +
                'var fontRatio = curFS / baseFS;\n' +
                'var p = clamp(effect("Progress")("Slider") / 100, 0, 1);\n' +
                'var curX, curY;\n' +
                'var dynH = ' + box.height.toFixed(2) + ' * fontRatio;\n' +
                'var linePitch = (' + totalLines + ' > 1) ? ((r.height - dynH) / (' + (totalLines - 1) + ')) : 0;\n';

            if (style === "underline") {
                posExpr += 'curY = r.top + dynH + (' + box.lineIndex + ' * linePitch) - (Math.max(curFS * 0.12, 5) / 2) + 2;\n';
            } else {
                posExpr += 'curY = r.top + (dynH / 2) + (' + box.lineIndex + ' * linePitch);\n';
            }

            posExpr += 
                widthCalculationSnippet + '\n';

            if (box.isWord) {
                if (box.rtl_k) {
                    posExpr += 
                        'var rightEdge = (r.left + r.width) - (' + box.wordOffset.toFixed(2) + ' * fontRatio);\n' +
                        'curX = rightEdge + pX - (curW / 2);\n' +
                        '[curX, curY + offY];';
                } else if (isCenter) {
                    posExpr += 
                        'var lineLeft = r.left + (r.width / 2) - (' + (box.lineWidth / 2).toFixed(2) + ' * fontRatio);\n' +
                        'curX = lineLeft + (' + box.wordOffset.toFixed(2) + ' * fontRatio) - pX + (curW / 2);\n' +
                        '[curX, curY + offY];';
                } else {
                    posExpr += 
                        'curX = r.left + (' + box.wordOffset.toFixed(2) + ' * fontRatio) - pX + (curW / 2);\n' +
                        '[curX, curY + offY];';
                }
            } else {
                if (box.rtl_k) {
                    posExpr += 
                        'curX = (r.left + r.width) + pX - (curW / 2);\n' +
                        '[curX, curY + offY];';
                } else if (isCenter) {
                    posExpr += 
                        'curX = r.left + (r.width / 2);\n' +
                        '[curX, curY + offY];';
                } else {
                    posExpr += 
                        'curX = r.left - pX + (curW / 2);\n' +
                        '[curX, curY + offY];';
                }
            }

            rect.property("ADBE Vector Rect Position").expression = posExpr;

            // Roundness (Safely clamped so it never exceeds half-height, fully controllable by Master & Local)
            rect.property("ADBE Vector Rect Roundness").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var r = (useM == 1) ? pLayer.effect("Master Roundness")("Slider") : effect("Local Roundness")("Slider");\n' +
                'var sz = thisProperty.propertyGroup(1).size;\n' +
                'Math.min(Math.max(0, r), Math.min(sz[0], sz[1]) / 2);';

            // Graphic: Fill vs Outline
            if (style === "outline") {
                var stroke = gContents.addProperty("ADBE Vector Graphic - Stroke");
                stroke.name = "Outline Stroke";
                stroke.property("ADBE Vector Stroke Width").setValue(3);
                stroke.property("ADBE Vector Stroke Color").expression = 
                    'var pLayer = parent;\n' +
                    'var useM = effect("Use Master Controls")("Checkbox");\n' +
                    'var mCol = pLayer.effect("Master Highlight Color")("Color");\n' +
                    'var lColProp = effect("Local Color")("Color");\n' +
                    '(useM == 0 || lColProp.numKeys > 0) ? lColProp.value : mCol;';
            } else {
                var fill = gContents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Fill Color";
                fill.property("ADBE Vector Fill Color").expression = 
                    'var pLayer = parent;\n' +
                    'var useM = effect("Use Master Controls")("Checkbox");\n' +
                    'var mCol = pLayer.effect("Master Highlight Color")("Color");\n' +
                    'var lColProp = effect("Local Color")("Color");\n' +
                    '(useM == 0 || lColProp.numKeys > 0) ? lColProp.value : mCol;';
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
