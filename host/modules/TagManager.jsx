/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: TagManager.jsx
 * Version: 2.0.0 (Modular Architecture)
 * 
 * Manages tagged word parsing ([word], *word*, {word}), word stripping,
 * and multi-mode target box resolution (lines, tagged keywords, karaoke words).
 */

// استخراج الكلمات والعبارات المحاطة بالأقواس أو الوسوم [عبارة] أو *عبارة* أو {عبارة}
// يدعم امتداد العبارات عبر الأسطر المتعددة (Multi-line Tagged Phrases)
$._smartHighlighter.extractTags = function (text) {
    if (!text) return [];
    var tagPattern = /\[([^\]]+)\]|\*([^\*]+)\*|\{([^\}]+)\}/g;
    var tags = [];
    var match;
    var strippedCharsBefore = 0;
    while ((match = tagPattern.exec(text)) !== null) {
        var tagged = match[1] || match[2] || match[3];
        if (tagged && tagged.replace(/\s/g, "").length > 0) {
            var rawLen = match[0].length;
            var cleanStart = match.index - strippedCharsBefore;
            var cleanEnd = cleanStart + tagged.length;
            tags.push({
                raw: match[0],
                content: tagged,
                rawIndex: match.index,
                cleanStart: cleanStart,
                cleanEnd: cleanEnd
            });
            strippedCharsBefore += (rawLen - tagged.length);
        }
    }
    return tags;
};

// تنظيف النص من أقواس الوسوم لعرضه بشكل طبيعي
$._smartHighlighter.stripTags = function (text) {
    if (!text) return "";
    return text.replace(/\[([^\]]+)\]/g, "$1")
               .replace(/\*([^\*]+)\*/g, "$1")
               .replace(/\{([^\}]+)\}/g, "$1");
};

// قياس واستخراج أبعاد صناديق التظليل سواء للأسطر الكاملة أو الكلمات المستهدفة
$._smartHighlighter.scanTargetBoxes = function (textLayer, comp, data) {
    var rawText = "";
    try {
        rawText = textLayer.property("Source Text").value.text;
    } catch (e) {
        return null;
    }

    var tags = $._smartHighlighter.extractTags(rawText);
    var mode = data.mode || "auto"; // "lines", "tagged", "words", "auto"

    if (mode === "auto") {
        mode = (tags.length > 0) ? "tagged" : "lines";
    }

    var cleanText = (mode === "tagged" && tags.length > 0) ? $._smartHighlighter.stripTags(rawText) : rawText;
    var scan = $._smartHighlighter.scanParagraph(textLayer, comp, cleanText);
    if (!scan) return null;

    var boxesData = [];
    var fallbackRTL = false;
    var isCenter = false;

    if (data.direction === "center") {
        isCenter = true;
    } else if (data.direction === "rtl") {
        fallbackRTL = true;
    } else if (data.direction === "ltr") {
        fallbackRTL = false;
    } else {
        if (scan.isJustified) {
            if (scan.justifyType === "right") fallbackRTL = true;
            else if (scan.justifyType === "center") isCenter = true;
            else fallbackRTL = false;
        } else {
            var pj = $._smartHighlighter.detectJustification(scan.justification);
            if (pj === "center") isCenter = true;
            else if (pj === "rtl") fallbackRTL = true;
            else if (pj === "ltr") fallbackRTL = false;
            else {
                var fc = $._smartHighlighter.countDir(scan.fullText);
                fallbackRTL = (fc.rtl > fc.ltr);
            }
        }
    }

    if (mode === "lines") {
        for (var k = 0; k < scan.numLines; k++) {
            var ld = scan.linesData[k];
            var rtl_k = isCenter ? false : ((data.direction === "auto") ? (scan.isJustified ? (scan.justifyType === "right") : $._smartHighlighter.lineIsRTL(ld.text, fallbackRTL)) : (data.direction === "rtl"));
            var cStart = (typeof ld.charStart === "number") ? ld.charStart : 0;
            var cEnd = (typeof ld.charEnd === "number") ? ld.charEnd : (cStart + ld.text.length);
            boxesData.push({
                boxIndex: k,
                lineIndex: k,
                text: ld.text,
                width: ld.width,
                height: ld.height,
                lineH: ld.height,
                lineTop: ld.top,
                charStart: cStart,
                charEnd: cEnd,
                totalChars: scan.fullText.length,
                isWord: false,
                wordOffset: 0,
                rightOffset: (typeof ld.rightOffset === "number") ? ld.rightOffset : 0,
                leftOffset: (typeof ld.leftOffset === "number") ? ld.leftOffset : 0,
                centerOffset: (typeof ld.centerOffset === "number") ? ld.centerOffset : 0,
                lineWidth: ld.width,
                rtl_k: rtl_k,
                name: textLayer.name + " - [Line " + (k + 1) + "]",
                cOffsets: ld.cOffsets || []
            });
        }
    } else {
        // نمط الكلمات المفتاحية (Tagged Words) أو كاريوكي كل الكلمات (Words Mode)
        var tempWord = null;
        try {
            tempWord = textLayer.duplicate();
            tempWord.name = $._smartHighlighter.SCAN_TEMP_WORDS;
            tempWord.enabled = true;
            tempWord.guideLayer = true;

            var setTempWordText = function (str) {
                try {
                    var wd = tempWord.property("Source Text").value;
                    wd.text = str;
                    tempWord.property("Source Text").setValue(wd);
                } catch (eWd) {
                    try { tempWord.property("Source Text").setValue(str); } catch (eWd2) {}
                }
            };

            for (var lIdx = 0; lIdx < scan.numLines; lIdx++) {
                var lineObj = scan.linesData[lIdx];
                var lText = lineObj.text;
                var rtl_line = isCenter ? false : ((data.direction === "auto") ? (scan.isJustified ? (scan.justifyType === "right") : $._smartHighlighter.lineIsRTL(lText, fallbackRTL)) : (data.direction === "rtl"));

                var wordsToFind = [];
                if (mode === "tagged") {
                    var lStart = (typeof lineObj.charStart === "number") ? lineObj.charStart : 0;
                    var lEnd = (typeof lineObj.charEnd === "number") ? lineObj.charEnd : (lStart + lText.length);
                    for (var tg = 0; tg < tags.length; tg++) {
                        var tagObj = tags[tg];
                        var overlapStart = Math.max(tagObj.cleanStart, lStart);
                        var overlapEnd = Math.min(tagObj.cleanEnd, lEnd);
                        if (overlapStart < overlapEnd) {
                            var localStart = overlapStart - lStart;
                            var localEnd = overlapEnd - lStart;
                            if (localStart < lText.length && localEnd <= lText.length) {
                                var subPhrase = lText.substring(localStart, localEnd);
                                var leadWs = subPhrase.match(/^\s*/)[0].length;
                                var trailWs = subPhrase.match(/\s*$/)[0].length;
                                if (leadWs + trailWs < subPhrase.length) {
                                    localStart += leadWs;
                                    localEnd -= trailWs;
                                    subPhrase = subPhrase.substring(leadWs, subPhrase.length - trailWs);
                                    wordsToFind.push({
                                        phrase: subPhrase,
                                        charIdx: localStart,
                                        tagIndex: tg
                                    });
                                }
                            }
                        }
                    }
                    wordsToFind.sort(function (a, b) { return a.charIdx - b.charIdx; });
                } else if (mode === "words") {
                    var matchedWords = lText.match(/\S+/g) || [];
                    var searchCursor = 0;
                    for (var mw = 0; mw < matchedWords.length; mw++) {
                        var wToken = matchedWords[mw];
                        var foundC = lText.indexOf(wToken, searchCursor);
                        if (foundC !== -1) {
                            wordsToFind.push({ phrase: wToken, charIdx: foundC });
                            searchCursor = foundC + wToken.length;
                        }
                    }
                }

                for (var wIdx = 0; wIdx < wordsToFind.length; wIdx++) {
                    var item = wordsToFind[wIdx];
                    var prefixUpTo = lText.substring(0, item.charIdx + item.phrase.length);

                    setTempWordText(prefixUpTo);
                    var rUpTo = tempWord.sourceRectAtTime(comp.time, false);

                    setTempWordText(item.phrase);
                    var rWord = tempWord.sourceRectAtTime(comp.time, false);

                    var wOffset = Math.max(0, rUpTo.width - rWord.width);
                    var finalWordW = rWord.width;
                    var finalWordH = Math.max(rWord.height, lineObj.height * 0.9);

                    var wordCharStart = (typeof lineObj.charStart === "number") ? (lineObj.charStart + item.charIdx) : item.charIdx;
                    var wordCharEnd = wordCharStart + item.phrase.length;

                    // قياس العروض التراكمية الدقيقة للكلمة (Exact cumulative character offsets for word)
                    var wordCOffsets = [];
                    var pText = item.phrase;
                    var prevWordOffW = 0;
                    var fontSpaceW = scan.fontSpaceW || 5;
                    for (var pwc = 1; pwc <= pText.length; pwc++) {
                        setTempWordText(pText.substring(0, pwc));
                        var rPWSub = tempWord.sourceRectAtTime(comp.time, false);
                        var curPWSubW = rPWSub.width;
                        if (/\s/.test(pText.charAt(pwc - 1)) && curPWSubW <= prevWordOffW) {
                            curPWSubW = prevWordOffW + fontSpaceW;
                        } else {
                            curPWSubW = Math.max(prevWordOffW, curPWSubW);
                        }
                        wordCOffsets.push(Math.round(curPWSubW * 10) / 10);
                        prevWordOffW = curPWSubW;
                    }

                    boxesData.push({
                        boxIndex: boxesData.length,
                        lineIndex: lIdx,
                        text: item.phrase,
                        width: finalWordW,
                        height: finalWordH,
                        lineH: lineObj.height,
                        lineTop: lineObj.top,
                        charStart: wordCharStart,
                        charEnd: wordCharEnd,
                        totalChars: scan.fullText.length,
                        isWord: true,
                        wordOffset: wOffset,
                        rightOffset: (typeof lineObj.rightOffset === "number") ? lineObj.rightOffset : 0,
                        leftOffset: (typeof lineObj.leftOffset === "number") ? lineObj.leftOffset : 0,
                        centerOffset: (typeof lineObj.centerOffset === "number") ? lineObj.centerOffset : 0,
                        lineWidth: lineObj.width,
                        rtl_k: rtl_line,
                        name: textLayer.name + " - [Word " + (boxesData.length + 1) + ": " + item.phrase + "]",
                        cOffsets: wordCOffsets
                    });
                }
            }
        } catch (eW) {
            $._smartHighlighter.log("scanTargetBoxes words error: " + eW.toString());
        } finally {
            if (tempWord) {
                try { tempWord.remove(); } catch (eR) {}
                tempWord = null;
            }
            for (var cl = comp.numLayers; cl >= 1; cl--) {
                try {
                    var chLayer = comp.layer(cl);
                    if (chLayer && chLayer !== textLayer && chLayer.name === $._smartHighlighter.SCAN_TEMP_WORDS) {
                        chLayer.remove();
                    }
                } catch (eCl) {}
            }
        }
    }

    // إذا لم يتم العثور على أي كلمات في نمط tagged، نتراجع تلقائياً لنمط الأسطر
    if (boxesData.length === 0) {
        mode = "lines";
        for (var k2 = 0; k2 < scan.numLines; k2++) {
            var ld2 = scan.linesData[k2];
            var rtl_k2 = isCenter ? false : ((data.direction === "auto") ? (scan.isJustified ? (scan.justifyType === "right") : $._smartHighlighter.lineIsRTL(ld2.text, fallbackRTL)) : (data.direction === "rtl"));
            var cStart2 = (typeof ld2.charStart === "number") ? ld2.charStart : 0;
            var cEnd2 = (typeof ld2.charEnd === "number") ? ld2.charEnd : (cStart2 + ld2.text.length);
            boxesData.push({
                boxIndex: k2,
                lineIndex: k2,
                text: ld2.text,
                width: ld2.width,
                height: ld2.height,
                lineH: ld2.height,
                lineTop: ld2.top,
                charStart: cStart2,
                charEnd: cEnd2,
                totalChars: scan.fullText.length,
                isWord: false,
                wordOffset: 0,
                lineWidth: ld2.width,
                rtl_k: rtl_k2,
                name: textLayer.name + " - [Line " + (k2 + 1) + "]",
                cOffsets: ld2.cOffsets || []
            });
        }
    }

    $._smartHighlighter.log("scanTargetBoxes: mode=" + mode + ", totalBoxes=" + boxesData.length);

    return {
        scan: scan,
        boxesData: boxesData,
        mode: mode,
        cleanText: cleanText,
        hasTags: (tags.length > 0),
        isCenter: isCenter,
        fallbackRTL: fallbackRTL
    };
};

/**
 * [DEPRECATED] tagSelection is retired in favor of non-destructive buildPhraseHighlights.
 */
$._smartHighlighter.tagSelection = function (phrase) {
    return "DEPRECATED: Use interactive Phrase Highlight tab";
};

/**
 * ============================================================
 * PHRASE HIGHLIGHT ENGINE (NON-DESTRUCTIVE & ZERO-BRACKETS)
 * ============================================================
 * Builds precise highlight containers for selected phrases directly
 * from character indices without modifying the text layer Source Text.
 * Automatically slices phrases that cross line boundaries into coordinated
 * sub-boxes, and locks in step with Typewriter animation via cOffsets.
 */
$._smartHighlighter.buildPhraseHighlights = function (jsonPayloadStr) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "ERROR: Please select an active composition";
        }
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            return "ERROR: Please select a Text Layer";
        }
        var textLayer = layers[0];
        if (!(textLayer instanceof TextLayer)) {
            if (textLayer.parent && (textLayer.parent instanceof TextLayer)) {
                textLayer = textLayer.parent;
            } else if (textLayer.comment && textLayer.comment.indexOf("PARENT:") !== -1) {
                var pName = textLayer.comment.replace("PARENT:", "").replace(/^\s+|\s+$/g, "");
                textLayer = comp.layer(pName);
            }
        }
        if (!textLayer || !(textLayer instanceof TextLayer)) {
            return "ERROR: Please select a Text Layer";
        }

        var data = $._smartHighlighter.parseJSON(jsonPayloadStr);
        if (!data) return "ERROR: Invalid JSON payload";

        // Remove any previous phrase highlight shape layers for this text layer
        var phraseTag = "SMART_HL_PHRASE";
        for (var si = comp.numLayers; si >= 1; si--) {
            var lyr = comp.layer(si);
            if (lyr && lyr !== textLayer && lyr.parent === textLayer && lyr.comment === phraseTag) {
                try { lyr.remove(); } catch (eDel) {}
            }
        }

        // If no phrases passed, treat as clean clear
        if (!data.phrases || data.phrases.length === 0) {
            return "SUCCESS: Cleared phrase highlights";
        }

        // Read source text non-destructively (Source Text is NOT touched)
        var rawText = "";
        try {
            rawText = textLayer.property("Source Text").value.text;
        } catch (eTxt) {
            return "ERROR: Cannot read text from layer";
        }

        var scan = $._smartHighlighter.scanParagraph(textLayer, comp, rawText);
        if (!scan || !scan.linesData || scan.linesData.length === 0) {
            return "ERROR: Text layer is empty or cannot be measured";
        }

        // Resolve justification & fallback reading direction
        var fallbackRTL = false;
        var isCenter = false;
        if (data.direction === "center") {
            isCenter = true;
        } else if (data.direction === "rtl") {
            fallbackRTL = true;
        } else if (data.direction === "ltr") {
            fallbackRTL = false;
        } else {
            if (scan.isJustified) {
                if (scan.justifyType === "right") fallbackRTL = true;
                else if (scan.justifyType === "center") isCenter = true;
                else fallbackRTL = false;
            } else {
                var pj = $._smartHighlighter.detectJustification(scan.justification);
                if (pj === "center") isCenter = true;
                else if (pj === "rtl") fallbackRTL = true;
                else if (pj === "ltr") fallbackRTL = false;
                else {
                    var fc = $._smartHighlighter.countDir(scan.fullText);
                    fallbackRTL = (fc.rtl > fc.ltr);
                }
            }
        }

        // Create temporary text layer for subpixel phrase measurements
        var tempWord = null;
        var boxesData = [];
        try {
            tempWord = textLayer.duplicate();
            tempWord.name = $._smartHighlighter.SCAN_TEMP_WORDS;
            tempWord.enabled = true;
            tempWord.guideLayer = true;

            var setTempWordText = function (str) {
                try {
                    var wd = tempWord.property("Source Text").value;
                    wd.text = str;
                    tempWord.property("Source Text").setValue(wd);
                } catch (eWd) {
                    try { tempWord.property("Source Text").setValue(str); } catch (eWd2) {}
                }
            };

            for (var pIdx = 0; pIdx < data.phrases.length; pIdx++) {
                var phr = data.phrases[pIdx];
                var pStart = (typeof phr.charStart === "number") ? phr.charStart : 0;
                var pEnd = (typeof phr.charEnd === "number") ? phr.charEnd : (pStart + (phr.text || "").length);
                var pId = "phr_" + (new Date().getTime()) + "_" + pIdx + "_" + Math.floor(Math.random() * 1000);
                var pColHex = phr.colorHex || data.colorHex;
                if (!pColHex) {
                    var cArr = phr.color || data.color;
                    pColHex = (cArr && $._smartHighlighter.rgbToHex) ? $._smartHighlighter.rgbToHex(cArr) : "#2ECC71";
                }

                for (var lIdx = 0; lIdx < scan.numLines; lIdx++) {
                    var lineObj = scan.linesData[lIdx];
                    var lText = lineObj.text;
                    var lStart = (typeof lineObj.charStart === "number") ? lineObj.charStart : 0;
                    var lEnd = (typeof lineObj.charEnd === "number") ? lineObj.charEnd : (lStart + lText.length);

                    var overlapStart = Math.max(pStart, lStart);
                    var overlapEnd = Math.min(pEnd, lEnd);

                    if (overlapStart < overlapEnd) {
                        var localStart = overlapStart - lStart;
                        var localEnd = overlapEnd - lStart;
                        if (localStart < lText.length && localEnd <= lText.length) {
                            var subPhrase = lText.substring(localStart, localEnd);
                            var leadMatch = subPhrase.match(/^\s*/);
                            var trailMatch = subPhrase.match(/\s*$/);
                            var leadWs = leadMatch ? leadMatch[0].length : 0;
                            var trailWs = trailMatch ? trailMatch[0].length : 0;

                            if (leadWs + trailWs < subPhrase.length) {
                                localStart += leadWs;
                                localEnd -= trailWs;
                                subPhrase = subPhrase.substring(leadWs, subPhrase.length - trailWs);

                                var prefixUpTo = lText.substring(0, localStart + subPhrase.length);
                                setTempWordText(prefixUpTo);
                                var rUpTo = tempWord.sourceRectAtTime(comp.time, false);

                                setTempWordText(subPhrase);
                                var rWord = tempWord.sourceRectAtTime(comp.time, false);

                                var wOffset = Math.max(0, rUpTo.width - rWord.width);
                                var finalW = rWord.width;
                                var finalH = Math.max(rWord.height, lineObj.height * 0.9);

                                var wordCOffsets = [];
                                var prevWordOffW = 0;
                                var fontSpaceW = scan.fontSpaceW || 5;
                                for (var pwc = 1; pwc <= subPhrase.length; pwc++) {
                                    setTempWordText(subPhrase.substring(0, pwc));
                                    var rPWSub = tempWord.sourceRectAtTime(comp.time, false);
                                    var curPWSubW = rPWSub.width;
                                    if (/\s/.test(subPhrase.charAt(pwc - 1)) && curPWSubW <= prevWordOffW) {
                                        curPWSubW = prevWordOffW + fontSpaceW;
                                    } else {
                                        curPWSubW = Math.max(prevWordOffW, curPWSubW);
                                    }
                                    wordCOffsets.push(Math.round(curPWSubW * 10) / 10);
                                    prevWordOffW = curPWSubW;
                                }

                                var rtl_line = isCenter ? false : ((data.direction === "auto" || !data.direction) ? (scan.isJustified ? (scan.justifyType === "right") : $._smartHighlighter.lineIsRTL(lText, fallbackRTL)) : (data.direction === "rtl"));

                                boxesData.push({
                                    boxIndex: boxesData.length,
                                    lineIndex: lIdx,
                                    text: subPhrase,
                                    phraseText: phr.text || subPhrase,
                                    phraseId: pId,
                                    phraseColorHex: pColHex,
                                    width: finalW,
                                    height: finalH,
                                    lineH: lineObj.height,
                                    lineTop: lineObj.top,
                                    charStart: lStart + localStart,
                                    charEnd: lStart + localEnd,
                                    totalChars: scan.fullText.length,
                                    isWord: true,
                                    wordOffset: wOffset,
                                    lineWidth: lineObj.width,
                                    rtl_k: rtl_line,
                                    name: '[HL-Phrase] "' + (subPhrase.length > 18 ? subPhrase.substring(0, 16) + '...' : subPhrase) + '"',
                                    cOffsets: wordCOffsets,
                                    color: phr.color || data.color,
                                    style: phr.style || data.style || "box",
                                    paddingX: (typeof phr.paddingX === "number") ? phr.paddingX : ((typeof data.paddingX === "number") ? data.paddingX : 10),
                                    paddingY: (typeof phr.paddingY === "number") ? phr.paddingY : ((typeof data.paddingY === "number") ? data.paddingY : 4),
                                    motion: phr.motion || data.motion || "typewriter",
                                    outro: (typeof phr.outro === "boolean") ? phr.outro : (data.outro === true),
                                    holdTime: (typeof phr.holdTime === "number") ? phr.holdTime : ((typeof data.holdTime === "number") ? data.holdTime : 1.2),
                                    sequential: (typeof phr.sequential === "boolean") ? phr.sequential : (data.sequential === true)
                                });
                            }
                        }
                    }
                }
            }
        } catch (eScanPhr) {
            $._smartHighlighter.log("buildPhraseHighlights scan error: " + eScanPhr.toString());
        } finally {
            if (tempWord) {
                try { tempWord.remove(); } catch (eR) {}
                tempWord = null;
            }
            for (var cl = comp.numLayers; cl >= 1; cl--) {
                try {
                    var chLayer = comp.layer(cl);
                    if (chLayer && chLayer !== textLayer && chLayer.name === $._smartHighlighter.SCAN_TEMP_WORDS) {
                        chLayer.remove();
                    }
                } catch (eCl) {}
            }
        }

        if (boxesData.length === 0) {
            return "ERROR: No matching words could be measured in text";
        }

        // Build Shape Layers for phrase highlight boxes
        app.beginUndoGroup("Highlight-Studio: Apply Phrase Highlight");

        var totalBoxes = boxesData.length;
        var totalTextChars = scan.fullText.length || 1;
        var baseTotalH = scan.fullH;
        var baseFS = scan.fontSize;
        var totalLines = scan.numLines;
        var globalMotion = data.motion || "typewriter";

        // Check or create Typewriter Text Animator on text layer if needed
        var detectedAnim = (globalMotion === "typewriter") ? $._smartHighlighter.detectTextAnimator(textLayer) : null;
        var typeStartTime = (detectedAnim && detectedAnim.hasKeys) ? detectedAnim.startTime : comp.time;
        var typeTotalDur;
        if (detectedAnim && detectedAnim.hasKeys && detectedAnim.endTime > detectedAnim.startTime) {
            typeTotalDur = detectedAnim.endTime - detectedAnim.startTime;
        } else {
            typeTotalDur = 1.2;
            if (globalMotion === "typewriter") {
                $._smartHighlighter.ensureTextTypewriter(textLayer, typeStartTime, typeStartTime + typeTotalDur, "opacity");
            }
        }

        var lastLayer = textLayer;

        for (var k = 0; k < totalBoxes; k++) {
            var box = boxesData[k];
            var shapeLayer = comp.layers.addShape();
            var phraseTag = "SMART_HL_PHRASE";
            shapeLayer.name = box.name;
            shapeLayer.comment = phraseTag + "|id:" + box.phraseId + "|color:" + box.phraseColorHex + "|text:" + encodeURIComponent(box.phraseText) + "|cs:" + box.charStart + "|ce:" + box.charEnd;

            shapeLayer.moveAfter(lastLayer);
            lastLayer = shapeLayer;
            shapeLayer.parent = textLayer;

            var xform = shapeLayer.property("ADBE Transform Group");
            xform.property("ADBE Position").setValue([0, 0]);
            xform.property("ADBE Anchor Point").expression = "parent.transform.anchorPoint;";
            xform.property("ADBE Scale").setValue([100, 100]);

            var hasOutro = !!box.outro;
            var holdTime = (typeof box.holdTime === "number" && box.holdTime > 0) ? box.holdTime : 1.2;
            var isSequential = !!box.sequential;
            var boxDelay = (isSequential && totalBoxes > 1) ? (k * 0.22) : 0;
            var outDur = 0.26;

            if (box.motion === "typewriter" && hasOutro) {
                var bCStartPct = (box.charStart / totalTextChars) * 100;
                var bCEndPct = (box.charEnd / totalTextChars) * 100;
                var bStartT = typeStartTime + (bCStartPct / 100) * typeTotalDur;
                var bEndT = typeStartTime + (bCEndPct / 100) * typeTotalDur;
                var tExitTime = bEndT + holdTime;
                xform.property("ADBE Opacity").expression =
                    'var prog = effect("Progress")("Slider");\n' +
                    'var baseOpac = (prog <= 0) ? 0 : effect("Local Opacity")("Slider");\n' +
                    'var tExit = ' + tExitTime.toFixed(3) + ';\n' +
                    'var dExit = ' + outDur.toFixed(3) + ';\n' +
                    'if (time > tExit) {\n' +
                    '    ease(time, tExit, tExit + dExit, baseOpac, 0);\n' +
                    '} else {\n' +
                    '    baseOpac;\n' +
                    '}';
            } else {
                xform.property("ADBE Opacity").expression =
                    'var prog = effect("Progress")("Slider");\n' +
                    '(prog <= 0) ? 0 : effect("Local Opacity")("Slider");';
            }

            if (box.style === "marker") {
                var tilts = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.7];
                xform.property("ADBE Rotate Z").setValue(tilts[k % tilts.length]);
                shapeLayer.blendingMode = BlendingMode.MULTIPLY;
            } else {
                xform.property("ADBE Rotate Z").setValue(0);
                shapeLayer.blendingMode = BlendingMode.NORMAL;
            }

            // Local Effect Controls
            var fx = shapeLayer.property("ADBE Effect Parade");

            var rawCol = box.color;
            var boxColor = [0.18, 0.8, 0.44, 1.0];
            if (rawCol instanceof Array && rawCol.length >= 3) {
                boxColor = [rawCol[0], rawCol[1], rawCol[2], (rawCol.length >= 4 ? rawCol[3] : 1.0)];
            } else if (typeof rawCol === "string" && rawCol.charAt(0) === "#") {
                boxColor = $._smartHighlighter.hexToRgba(rawCol);
            }

            var colFx = fx.addProperty("ADBE Color Control"); colFx.name = "Local Color";
            colFx.property("Color").setValue(boxColor);

            var pXFx = fx.addProperty("ADBE Slider Control"); pXFx.name = "Local Padding X";
            pXFx.property("Slider").setValue(box.paddingX);

            var pYFx = fx.addProperty("ADBE Slider Control"); pYFx.name = "Local Padding Y";
            pYFx.property("Slider").setValue(box.paddingY);

            var offFx = fx.addProperty("ADBE Slider Control"); offFx.name = "Local Offset Y";
            offFx.property("Slider").setValue(0);

            var rndFx = fx.addProperty("ADBE Slider Control"); rndFx.name = "Local Roundness";
            rndFx.property("Slider").setValue(box.style === "pill" ? 50 : 0);

            var opacFx = fx.addProperty("ADBE Slider Control"); opacFx.name = "Local Opacity";
            opacFx.property("Slider").setValue(100);

            var progFx = fx.addProperty("ADBE Slider Control"); progFx.name = "Progress";

            // Motion & Timing
            var boxMotion = box.motion || globalMotion;
            if (boxMotion === "typewriter") {
                var cStartPct = (box.charStart / totalTextChars) * 100;
                var cEndPct = (box.charEnd / totalTextChars) * 100;

                var bStart = typeStartTime + (cStartPct / 100) * typeTotalDur;
                var bEnd = typeStartTime + (cEndPct / 100) * typeTotalDur;
                if (bEnd <= bStart) bEnd = bStart + 0.04;

                progFx.property("Slider").setValueAtTime(bStart, 0);
                progFx.property("Slider").setValueAtTime(bEnd, 100);
                try {
                    progFx.property("Slider").setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                    progFx.property("Slider").setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                } catch (eLin) {}

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
                    '        var c1 = ' + cStartPct.toFixed(4) + ';\n' +
                    '        var c2 = ' + cEndPct.toFixed(4) + ';\n' +
                    '        if (pVal <= c1) { 0; } else if (pVal >= c2) { 100; } else { linear(pVal, c1, c2, 0, 100); }\n' +
                    '    } catch(err) { value; }\n' +
                    '} else {\n' +
                    '    value;\n' +
                    '}';
                progFx.property("Slider").expression = progExpr;

            } else if (boxMotion === "pop") {
                var t1 = comp.time + boxDelay;
                var t2 = t1 + 0.26;
                progFx.property("Slider").setValueAtTime(t1, 0);
                progFx.property("Slider").setValueAtTime(t2, 100);
                if (hasOutro) {
                    var t3 = t2 + holdTime;
                    var t4 = t3 + outDur;
                    progFx.property("Slider").setValueAtTime(t3, 100);
                    progFx.property("Slider").setValueAtTime(t4, 0);
                }

                var popExpr =
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
                xform.property("ADBE Scale").expression = popExpr;

            } else if (boxMotion === "snap") {
                var t1 = comp.time + boxDelay;
                var t2 = t1 + 0.04;
                progFx.property("Slider").setValueAtTime(t1, 0);
                progFx.property("Slider").setValueAtTime(t2, 100);
                if (hasOutro) {
                    var t3 = t2 + holdTime;
                    var t4 = t3 + 0.04;
                    progFx.property("Slider").setValueAtTime(t3, 100);
                    progFx.property("Slider").setValueAtTime(t4, 0);
                }

            } else {
                // Smooth Vox Wipe: punchy attack, luxurious deceleration
                var t1 = comp.time + boxDelay;
                var t2 = t1 + 0.32;
                progFx.property("Slider").setValueAtTime(t1, 0);
                progFx.property("Slider").setValueAtTime(t2, 100);
                var easePunch = new KeyframeEase(0, 25);
                var easeDecel = new KeyframeEase(0, 80);
                progFx.property("Slider").setTemporalEaseAtKey(1, [easePunch], [easePunch]);
                progFx.property("Slider").setTemporalEaseAtKey(2, [easeDecel], [easeDecel]);

                if (hasOutro) {
                    var t3 = t2 + holdTime;
                    var t4 = t3 + 0.28;
                    progFx.property("Slider").setValueAtTime(t3, 100);
                    progFx.property("Slider").setValueAtTime(t4, 0);
                    var easeOutIn = new KeyframeEase(0, 30);
                    var easeOutEnd = new KeyframeEase(0, 75);
                    progFx.property("Slider").setTemporalEaseAtKey(3, [easeOutIn], [easeOutIn]);
                    progFx.property("Slider").setTemporalEaseAtKey(4, [easeOutEnd], [easeOutEnd]);
                }
            }

            // Vectors Group
            var contents = shapeLayer.property("ADBE Root Vectors Group");
            var group = contents.addProperty("ADBE Vector Group");
            group.name = "Phrase Group";
            var gContents = group.property("ADBE Vectors Group");

            var rect = gContents.addProperty("ADBE Vector Shape - Rect");
            rect.name = "Box";

            // Subpixel character width calculation
            var widthCalculationSnippet = "";
            if (boxMotion === "typewriter" && box.cOffsets && box.cOffsets.length > 0) {
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

            // Size expression
            var sizeExpr =
                'var pLayer = parent;\n' +
                'var pX = effect("Local Padding X")("Slider");\n' +
                'var pY = effect("Local Padding Y")("Slider");\n\n' +
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

            if (box.style === "underline") {
                sizeExpr += 'fullH = Math.max(curFS * 0.12, 5) + pY;\n';
            } else {
                sizeExpr += 'fullH = (' + box.height.toFixed(2) + ' * fontRatio) + pY * 2;\n';
            }

            sizeExpr += widthCalculationSnippet + '[curW, fullH];';
            rect.property("ADBE Vector Rect Size").expression = sizeExpr;

            // Position expression
            var posExpr =
                'var pLayer = parent;\n' +
                'var pX = effect("Local Padding X")("Slider");\n' +
                'var offY = effect("Local Offset Y")("Slider");\n\n' +
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

            if (box.style === "underline") {
                posExpr += 'curY = r.top + dynH + (' + box.lineIndex + ' * linePitch) - (Math.max(curFS * 0.12, 5) / 2) + 2;\n';
            } else {
                posExpr += 'curY = r.top + (dynH / 2) + (' + box.lineIndex + ' * linePitch);\n';
            }

            posExpr += widthCalculationSnippet + '\n';

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

            rect.property("ADBE Vector Rect Position").expression = posExpr;

            // Roundness expression
            rect.property("ADBE Vector Rect Roundness").expression =
                'var r = effect("Local Roundness")("Slider");\n' +
                'var sz = thisProperty.propertyGroup(1).size;\n' +
                'Math.min(Math.max(0, r), Math.min(sz[0], sz[1]) / 2);';

            // Graphic: Fill vs Outline
            if (box.style === "outline") {
                var stroke = gContents.addProperty("ADBE Vector Graphic - Stroke");
                stroke.name = "Outline Stroke";
                stroke.property("ADBE Vector Stroke Width").setValue(3);
                stroke.property("ADBE Vector Stroke Color").expression = 'effect("Local Color")("Color");';
            } else {
                var fill = gContents.addProperty("ADBE Vector Graphic - Fill");
                fill.name = "Fill Color";
                fill.property("ADBE Vector Fill Color").expression = 'effect("Local Color")("Color");';
            }
        }

        app.endUndoGroup();
        var reportMsg = "SUCCESS: Applied " + totalBoxes + " phrase highlight box(es)";
        $._smartHighlighter.log(reportMsg);
        return reportMsg;

    } catch (e) {
        try { app.endUndoGroup(); } catch (eGrp) {}
        $._smartHighlighter.log("buildPhraseHighlights ERROR: " + e.toString());
        return "ERROR: " + e.toString();
    }
};

/**
 * إزالة جميع صناديق تظليل العبارات (Phrase Highlights) من طبقة النص المحددة
 */
$._smartHighlighter.clearPhraseHighlights = function () {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return "ERROR: Please select an active composition";
        }
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            return "ERROR: Please select a Text Layer";
        }
        var textLayer = layers[0];
        if (!(textLayer instanceof TextLayer)) {
            if (textLayer.parent && (textLayer.parent instanceof TextLayer)) {
                textLayer = textLayer.parent;
            } else if (textLayer.comment && textLayer.comment.indexOf("PARENT:") !== -1) {
                var pName = textLayer.comment.replace("PARENT:", "").replace(/^\s+|\s+$/g, "");
                textLayer = comp.layer(pName);
            }
        }
        if (!textLayer || !(textLayer instanceof TextLayer)) {
            return "ERROR: Please select a Text Layer";
        }

        app.beginUndoGroup("Highlight-Studio: Clear Phrase Highlights");
        var removed = 0;
        var phraseTag = "SMART_HL_PHRASE";
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l !== textLayer && l.parent === textLayer && l.comment && l.comment.indexOf(phraseTag) !== -1) {
                try {
                    l.remove();
                    removed++;
                } catch (eR) {}
            }
        }
        app.endUndoGroup();

        var msg = "SUCCESS: Removed " + removed + " phrase highlight(s)";
        $._smartHighlighter.log(msg);
        return msg;
    } catch (e) {
        try { app.endUndoGroup(); } catch (eGrp) {}
        return "ERROR: " + e.toString();
    }
};

/**
 * استخراج قائمة العبارات المظللة حالياً على الطبقة النصية المحددة
 * ترجع مصفوفة JSON تحتوي على معرف كل عبارة، نصها، ولونها، وإحداثياتها
 */
$._smartHighlighter.getAppliedPhrases = function () {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "[]";
        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) return "[]";
        var textLayer = layers[0];
        if (!(textLayer instanceof TextLayer)) {
            if (textLayer.parent && (textLayer.parent instanceof TextLayer)) {
                textLayer = textLayer.parent;
            } else if (textLayer.comment && textLayer.comment.indexOf("PARENT:") !== -1) {
                var pName = textLayer.comment.replace("PARENT:", "").replace(/^\s+|\s+$/g, "");
                textLayer = comp.layer(pName);
            }
        }
        if (!textLayer || !(textLayer instanceof TextLayer)) return "[]";

        var phrasesMap = {};
        var phrasesList = [];

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (l && l.parent === textLayer && l.comment && l.comment.indexOf("SMART_HL_PHRASE") !== -1) {
                var c = l.comment;
                var idMatch = c.match(/id:([^\|]+)/);
                var colMatch = c.match(/color:([^\|]+)/);
                var textMatch = c.match(/text:([^\|]+)/);
                var csMatch = c.match(/cs:([^\|]+)/);
                var ceMatch = c.match(/ce:([^\|]+)/);

                var pId = idMatch ? idMatch[1] : ("layer_" + l.index);
                var pCol = colMatch ? colMatch[1] : "#2ECC71";
                var pText = textMatch ? decodeURIComponent(textMatch[1]) : l.name;
                var pCs = csMatch ? parseInt(csMatch[1], 10) : 0;
                var pCe = ceMatch ? parseInt(ceMatch[1], 10) : 0;

                if (!phrasesMap[pId]) {
                    var phrObj = {
                        id: pId,
                        text: pText,
                        color: pCol,
                        charStart: pCs,
                        charEnd: pCe,
                        boxCount: 1
                    };
                    phrasesMap[pId] = phrObj;
                    phrasesList.push(phrObj);
                } else {
                    phrasesMap[pId].boxCount++;
                    if (pCe > phrasesMap[pId].charEnd) phrasesMap[pId].charEnd = pCe;
                    if (pCs < phrasesMap[pId].charStart) phrasesMap[pId].charStart = pCs;
                }
            }
        }

        return JSON.stringify(phrasesList);
    } catch (e) {
        return "[]";
    }
};

/**
 * حذف عبارة مظللة محددة بحسب معرفها الفريد دون التأثير على العبارات الأخرى
 */
$._smartHighlighter.removeSinglePhrase = function (phraseId) {
    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return "ERROR: Please select an active composition";
        if (!phraseId) return "ERROR: No phrase ID provided";

        app.beginUndoGroup("Highlight-Studio: Remove Phrase Highlight");
        var removed = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l.comment && l.comment.indexOf("SMART_HL_PHRASE") !== -1) {
                if (l.comment.indexOf("id:" + phraseId) !== -1) {
                    try {
                        l.remove();
                        removed++;
                    } catch (eR) {}
                }
            }
        }
        app.endUndoGroup();

        var msg = "SUCCESS: Removed phrase (" + removed + " box(es))";
        $._smartHighlighter.log(msg);
        return msg;
    } catch (e) {
        try { app.endUndoGroup(); } catch (eGrp) {}
        return "ERROR: " + e.toString();
    }
};

var SMART_HL_TAGMANAGER_LOADED = true;
