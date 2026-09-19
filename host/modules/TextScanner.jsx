/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: TextScanner.jsx
 * Version: 2.0.0 (Modular Architecture)
 * 
 * High-precision Paragraph & Line Geometry Scanner:
 * Dissects visual line wraps, measures subpixel font metrics, and computes
 * exact cumulative character offsets (cOffsets) for subpixel typewriter tracking.
 */

// فحص أسطر الفقرة بدقة تامة مع حماية من الأخطاء (يدعم تمرير نص نظيف اختياري)
$._smartHighlighter.scanParagraph = function (textLayer, comp, optText) {
    var temp = null;
    try {
        var srcProp = textLayer.property("Source Text");
        var textDoc = srcProp.value;
        var fullText = $._smartHighlighter.stripAnchors((typeof optText === "string") ? optText : textDoc.text);
        var fontSize = textDoc.fontSize;

        // التقاط محاذاة النص من لوحة Paragraph
        var justification = null;
        try {
            justification = textDoc.justification;
        } catch (eJ) {}

        // إذا كانت طبقة المستخدم تحمل اسم المحرك المؤقت نتيجة خطأ سابق، نعيد تسميتها فوراً لحمايتها
        if (textLayer.name === $._smartHighlighter.SCAN_TEMP_ENGINE) {
            textLayer.name = "Highlight Text";
        }

        // تنظيف أي طبقات فحص مؤقتة قديمة عالقة مع استثناء طبقة النص الأصلية قطعاً
        for (var ci = comp.numLayers; ci >= 1; ci--) {
            try {
                var chkL = comp.layer(ci);
                if (chkL && chkL !== textLayer && chkL.name === $._smartHighlighter.SCAN_TEMP_ENGINE) {
                    chkL.remove();
                }
            } catch (eC) {}
        }

        temp = textLayer.duplicate();
        temp.name = $._smartHighlighter.SCAN_TEMP_ENGINE;
        temp.enabled = true; // يجب أن تكون مفعلة ليتمكن After Effects من حساب أبعاد sourceRectAtTime
        temp.guideLayer = true; // طبقة إرشادية لا تؤثر على المشهد أو الريندر

        // دالة مساعدة لتحديث نص الطبقة المؤقتة مع الحفاظ التام 100% على تنسيق الخط والمحاذاة والتباعد
        var setTempText = function (str) {
            try {
                var d = temp.property("Source Text").value;
                d.text = str;
                temp.property("Source Text").setValue(d);
            } catch (eDoc) {
                try { temp.property("Source Text").setValue(str); } catch (eRaw) {}
            }
        };

        // قياس الارتفاع المرجعي للسطر بعينة قياسية شاملة (أحرف علوية وسفلية وعربية وأرقام)
        setTempText("AgÉيـ1");
        var sampleR = temp.sourceRectAtTime(comp.time, false);
        var refLineH = Math.max(sampleR.height, fontSize * 1.15);
        if (refLineH <= 0) refLineH = Math.max(fontSize, 24);

        var wrapThreshold = refLineH * 0.55;

        var rawParagraphs = fullText.split(/\r\n|[\r\n\u0003]/);
        var visualLines = [];

        for (var p = 0; p < rawParagraphs.length; p++) {
            var para = rawParagraphs[p];
            if (para.replace(/\s/g, "").length === 0) continue;

            var words = para.match(/\S+|\s+/g) || [];
            if (words.length === 0) continue;

            var curLine = "";
            setTempText(words[0]);
            var prevH = temp.sourceRectAtTime(comp.time, false).height;

            for (var w = 0; w < words.length; w++) {
                var token = words[w];
                var testStr = curLine + token;
                setTempText(testStr);
                var r = temp.sourceRectAtTime(comp.time, false);

                if (r.height > prevH + wrapThreshold && curLine.replace(/\s/g, "").length > 0) {
                    visualLines.push({
                        text: curLine.replace(/\s+$/, ""),
                        isLastOfPara: false
                    });
                    curLine = token.replace(/^\s+/, "");
                    setTempText(curLine);
                    prevH = temp.sourceRectAtTime(comp.time, false).height;
                } else {
                    curLine = testStr;
                    prevH = r.height;
                }
            }
            if (curLine.replace(/\s/g, "").length > 0) {
                visualLines.push({
                    text: curLine.replace(/\s+$/, ""),
                    isLastOfPara: true
                });
            }
        }

        var numLines = visualLines.length;
        if (numLines === 0) {
            return null;
        }

        // فحص ما إذا كان النص مضبوطاً (Justified)
        var isJustified = false;
        var isJustifyFullAll = false;
        var justifyType = "left"; // "left", "right", "center", "full"

        if (justification !== null && justification !== undefined) {
            try {
                if (typeof ParagraphJustification !== "undefined") {
                    if (justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT) {
                        isJustified = true; justifyType = "left";
                    } else if (justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) {
                        isJustified = true; justifyType = "right";
                    } else if (justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) {
                        isJustified = true; justifyType = "center";
                    } else if (justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL) {
                        isJustified = true; isJustifyFullAll = true; justifyType = "full";
                    }
                }
                var jStr = String(justification).toUpperCase();
                if (jStr.indexOf("FULL_JUSTIFY") !== -1 || (justification >= 7416 && justification <= 7419)) {
                    isJustified = true;
                    if (jStr.indexOf("LASTLINE_FULL") !== -1 || justification === 7419) isJustifyFullAll = true;
                    if (jStr.indexOf("LASTLINE_RIGHT") !== -1 || justification === 7417) justifyType = "right";
                    if (jStr.indexOf("LASTLINE_CENTER") !== -1 || justification === 7418) justifyType = "center";
                }
            } catch (eJ2) {}
        }

        setTempText(visualLines[0].text);
        var rFirst = temp.sourceRectAtTime(comp.time, false);

        setTempText(fullText);
        var rFull = temp.sourceRectAtTime(comp.time, false);

        // قياس عرض المسافة الفعلي للخط (Exact font space width)
        setTempText("n n");
        var rWS = temp.sourceRectAtTime(comp.time, false).width;
        setTempText("nn");
        var rNS = temp.sourceRectAtTime(comp.time, false).width;
        var fontSpaceW = Math.max(2, rWS - rNS);

        var linesData = [];
        for (var i = 0; i < numLines; i++) {
            var lineObj = visualLines[i];
            setTempText(lineObj.text);
            var rLine = temp.sourceRectAtTime(comp.time, false);

            var finalW = rLine.width;
            if (isJustified) {
                // في النص المضبوط: السطور الممتدة (غير الأخيرة) تأخذ عرض الفقرة الكامل rFull.width
                if (isJustifyFullAll || !lineObj.isLastOfPara) {
                    finalW = rFull.width;
                }
            }

            // قياس العرض التراكمي الحقيقي بالبيكسل لكل حرف (Exact Cumulative Character Offsets)
            var cOffsets = [];
            var lText = lineObj.text;
            var prevOffW = 0;
            for (var c = 1; c <= lText.length; c++) {
                setTempText(lText.substring(0, c));
                var rSub = temp.sourceRectAtTime(comp.time, false);
                var curSubW = rSub.width;
                if (/\s/.test(lText.charAt(c - 1)) && curSubW <= prevOffW) {
                    curSubW = prevOffW + fontSpaceW;
                } else {
                    curSubW = Math.max(prevOffW, curSubW);
                }
                cOffsets.push(Math.round(curSubW * 10) / 10);
                prevOffW = curSubW;
            }

            // إذا كان السطر مضبوطاً وله عرض نهائي أكبر، نضبط النسبة التراكمية للحروف لتصل لـ finalW
            if (isJustified && finalW > 0 && cOffsets.length > 0 && prevOffW > 0 && Math.abs(finalW - prevOffW) > 1) {
                var justRatio = finalW / prevOffW;
                for (var jc = 0; jc < cOffsets.length; jc++) {
                    cOffsets[jc] = Math.round(cOffsets[jc] * justRatio * 10) / 10;
                }
            }

            // قياس الإزاحات الأفقية الدقيقة للسطر نسبة إلى الحدود العامة للفقرة
            // Exact per-line horizontal offsets relative to paragraph bounding box
            var rFullRight = rFull.left + rFull.width;
            var rLineRight = rLine.left + rLine.width;
            var lineRightOffset = Math.max(0, Math.round((rFullRight - rLineRight) * 10) / 10);
            var lineLeftOffset = Math.max(0, Math.round((rLine.left - rFull.left) * 10) / 10);
            var lineCenterOffset = Math.round(((rLine.left + rLine.width / 2) - (rFull.left + rFull.width / 2)) * 10) / 10;

            linesData.push({
                lineIndex: i,
                text: lineObj.text,
                width: finalW,
                height: refLineH,
                lineH: refLineH,
                isLastOfPara: lineObj.isLastOfPara,
                isJustified: isJustified,
                justifyType: justifyType,
                top: 0,
                rightOffset: lineRightOffset,
                leftOffset: lineLeftOffset,
                centerOffset: lineCenterOffset,
                cOffsets: cOffsets
            });
        }

        // توزيع قمم الأسطر بتناسق هندسي موحد على كامل ارتفاع الفقرة
        var linePitch = (numLines > 1) ? ((rFull.height - refLineH) / (numLines - 1)) : 0;
        var cursor = 0;
        for (var t = 0; t < numLines; t++) {
            linesData[t].top = Math.round((t * linePitch) * 10) / 10;
            var needle = visualLines[t].text;
            var found = fullText.indexOf(needle, cursor);
            if (found !== -1) {
                var endOff = found + needle.length;
                linesData[t].charStart = found;
                linesData[t].charEnd = endOff;
                cursor = endOff;
            } else {
                linesData[t].charStart = cursor;
                linesData[t].charEnd = cursor + visualLines[t].text.length;
                cursor += visualLines[t].text.length;
            }
        }

        $._smartHighlighter.log("scan: " + numLines + " lines, isJustified=" + isJustified + " (" + justifyType + "), fullW=" + rFull.width.toFixed(1) + ", refH=" + refLineH.toFixed(1));

        return {
            linesData: linesData,
            numLines: numLines,
            singleH: refLineH,
            fullH: rFull.height,
            fullW: rFull.width,
            fontSize: fontSize,
            fullText: fullText,
            isJustified: isJustified,
            justifyType: justifyType,
            justification: justification,
            fontSpaceW: fontSpaceW
        };

    } catch (eScan) {
        $._smartHighlighter.log("scanParagraph EXCEPTION: " + eScan.toString());
        return null;
    } finally {
        // ضمان الحذف الفوري للطبقة المؤقتة
        if (temp) {
            try {
                temp.remove();
            } catch (eR) {}
            temp = null;
        }
        for (var di = comp.numLayers; di >= 1; di--) {
            try {
                var dL = comp.layer(di);
                if (dL && dL !== textLayer && dL.name === $._smartHighlighter.SCAN_TEMP_ENGINE) {
                    dL.remove();
                }
            } catch (eDel) {}
        }
        try {
            textLayer.selected = true;
        } catch (eSel) {}
    }
};

var SMART_HL_TEXTSCANNER_LOADED = true;
