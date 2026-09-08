/**
 * SMART HIGHLIGHTER CEP HOST ENGINE
 * Namespace: $._smartHighlighter
 */

if (typeof $._smartHighlighter === "undefined") {
    $._smartHighlighter = {};
}

// ===== DEBUG SYSTEM =====
$._smartHighlighter._debugLog = [];
$._smartHighlighter.log = function (msg) {
    var ts = new Date().toTimeString().split(" ")[0];
    $._smartHighlighter._debugLog.push("[" + ts + "] " + msg);
    // Keep max 200 entries
    if ($._smartHighlighter._debugLog.length > 200) {
        $._smartHighlighter._debugLog.shift();
    }
};

$._smartHighlighter.getDebugLog = function () {
    return $._smartHighlighter._debugLog.join("\n");
};

$._smartHighlighter.clearDebugLog = function () {
    $._smartHighlighter._debugLog = [];
    return "Log cleared.";
};

// محاكي JSON مصغر للتوافقية الكاملة مع محركات ExtendScript القديمة
$._smartHighlighter.parseJSON = function (str) {
    try {
        return eval("(" + str + ")");
    } catch (e) {
        $._smartHighlighter.log("parseJSON ERROR: " + e.toString());
        return null;
    }
};

// فحص وجود الحروف العربية لتحديد اتجاه النص أوتوماتيكياً
$._smartHighlighter.hasArabic = function (text) {
    var arabicPattern = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
};

// قراءة وتفسير محاذاة الباراجراف في After Effects
$._smartHighlighter.detectJustification = function (justification) {
    if (justification === null || justification === undefined) return null;
    try {
        if (typeof ParagraphJustification !== "undefined") {
            if (justification === ParagraphJustification.CENTER_JUSTIFY || 
                justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_CENTER) {
                return "center";
            }
            if (justification === ParagraphJustification.RIGHT_JUSTIFY || 
                justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_RIGHT) {
                return "rtl";
            }
            if (justification === ParagraphJustification.LEFT_JUSTIFY || 
                justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_LEFT ||
                justification === ParagraphJustification.FULL_JUSTIFY_LASTLINE_FULL) {
                return "ltr";
            }
        }
        var jStr = String(justification).toUpperCase();
        if (jStr.indexOf("CENTER") !== -1 || justification === 7415 || justification === 7418) return "center";
        if (jStr.indexOf("RIGHT") !== -1 || justification === 7414 || justification === 7417) return "rtl";
        if (jStr.indexOf("LEFT") !== -1 || justification === 7413 || justification === 7416) return "ltr";
    } catch (e) {}
    return null;
};

// فحص أسطر الفقرة بدقة تامة مع حماية من الأخطاء
$._smartHighlighter.scanParagraph = function (textLayer, comp) {
    var temp = null;
    try {
        var srcProp = textLayer.property("Source Text");
        var textDoc = srcProp.value;
        var fullText = textDoc.text;
        var fontSize = textDoc.fontSize;

        // التقاط محاذاة النص من لوحة Paragraph
        var justification = null;
        try {
            justification = textDoc.justification;
        } catch (eJ) {}

        // إذا كانت طبقة المستخدم تحمل اسم المحرك المؤقت نتيجة خطأ سابق، نعيد تسميتها فوراً لحمايتها
        if (textLayer.name === "_scan_temp_engine") {
            textLayer.name = "Highlight Text";
        }

        // تنظيف أي طبقات فحص مؤقتة قديمة عالقة مع استثناء طبقة النص الأصلية قطعاً
        for (var ci = comp.numLayers; ci >= 1; ci--) {
            try {
                var chkL = comp.layer(ci);
                if (chkL && chkL !== textLayer && chkL.name === "_scan_temp_engine") {
                    chkL.remove();
                }
            } catch (eC) {}
        }

        temp = textLayer.duplicate();
        temp.name = "_scan_temp_engine";
        temp.enabled = true; // يجب أن تكون مفعلة ليتمكن After Effects من حساب أبعاد sourceRectAtTime
        temp.guideLayer = true; // طبقة إرشادية لا تؤثر على المشهد أو الريندر

        // قياس الارتفاع المرجعي للسطر بعينة قياسية شاملة (أحرف علوية وسفلية وعربية وأرقام)
        temp.property("Source Text").setValue("AgÉيـ1");
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
            temp.property("Source Text").setValue(words[0]);
            var prevH = temp.sourceRectAtTime(comp.time, false).height;

            for (var w = 0; w < words.length; w++) {
                var token = words[w];
                var testStr = curLine + token;
                temp.property("Source Text").setValue(testStr);
                var r = temp.sourceRectAtTime(comp.time, false);

                if (r.height > prevH + wrapThreshold && curLine.replace(/\s/g, "").length > 0) {
                    visualLines.push({
                        text: curLine.replace(/\s+$/, ""),
                        isLastOfPara: false
                    });
                    curLine = token.replace(/^\s+/, "");
                    temp.property("Source Text").setValue(curLine);
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

        temp.property("Source Text").setValue(visualLines[0].text);
        var rFirst = temp.sourceRectAtTime(comp.time, false);

        temp.property("Source Text").setValue(fullText);
        var rFull = temp.sourceRectAtTime(comp.time, false);

        var linesData = [];
        for (var i = 0; i < numLines; i++) {
            var lineObj = visualLines[i];
            temp.property("Source Text").setValue(lineObj.text);
            var rLine = temp.sourceRectAtTime(comp.time, false);

            var finalW = rLine.width;
            if (isJustified) {
                // في النص المضبوط: السطور الممتدة (غير الأخيرة) تأخذ عرض الفقرة الكامل rFull.width
                if (isJustifyFullAll || !lineObj.isLastOfPara) {
                    finalW = rFull.width;
                }
            }

            linesData.push({
                lineIndex: i,
                text: lineObj.text,
                width: finalW,
                height: rLine.height,
                isLastOfPara: lineObj.isLastOfPara,
                isJustified: isJustified,
                justifyType: justifyType,
                top: 0
            });
        }

        // قياس قمم الأسطر عبر التراكم
        var cursor = 0;
        var topsOK = true;
        for (var t = 0; t < numLines; t++) {
            var needle = visualLines[t].text;
            var found = fullText.indexOf(needle, cursor);
            if (found === -1) { topsOK = false; break; }
            var endOff = found + needle.length;
            temp.property("Source Text").setValue(fullText.substring(0, endOff));
            var rPre = temp.sourceRectAtTime(comp.time, false);
            linesData[t].top = rPre.height - linesData[t].height;
            cursor = endOff;
        }
        if (!topsOK) {
            for (var f = 0; f < numLines; f++) {
                linesData[f].top = (numLines > 1) ? (rFull.height - linesData[f].height) * (f / (numLines - 1)) : 0;
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
            justification: justification
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
                if (dL && dL !== textLayer && dL.name === "_scan_temp_engine") {
                    dL.remove();
                }
            } catch (eDel) {}
        }
        try {
            textLayer.selected = true;
        } catch (eSel) {}
    }
};

// ---------- Smart Sync helpers (Phase B/C) ----------
$._smartHighlighter.META_OPEN = "[HL-META v1]";
$._smartHighlighter.META_CLOSE = "[/HL-META]";

$._smartHighlighter.escMeta = function (s) {
    return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

$._smartHighlighter.writeMeta = function (textLayer, scan) {
    var items = [];
    for (var i = 0; i < scan.linesData.length; i++) {
        items.push('{"t":"' + $._smartHighlighter.escMeta(scan.linesData[i].text) +
            '","w":' + scan.linesData[i].width.toFixed(2) + '}');
    }
    var json = '{"v":1,"n":' + scan.numLines +
        ',"full":"' + $._smartHighlighter.escMeta(scan.fullText) + '"' +
        ',"lines":[' + items.join(",") + ']}';
    var block = $._smartHighlighter.META_OPEN + json + $._smartHighlighter.META_CLOSE;
    var c = "";
    try { c = textLayer.comment || ""; } catch (e) { c = ""; }
    var a = c.indexOf($._smartHighlighter.META_OPEN);
    var b = c.indexOf($._smartHighlighter.META_CLOSE);
    if (a !== -1 && b !== -1 && b > a) {
        c = c.substring(0, a) + c.substring(b + $._smartHighlighter.META_CLOSE.length);
    }
    c = c.replace(/\s+$/, "");
    textLayer.comment = c + (c.length > 0 ? "\n" : "") + block;
};

$._smartHighlighter.readMeta = function (textLayer) {
    try {
        var c = textLayer.comment || "";
        var a = c.indexOf($._smartHighlighter.META_OPEN);
        var b = c.indexOf($._smartHighlighter.META_CLOSE);
        if (a === -1 || b === -1 || b <= a) return null;
        var m = $._smartHighlighter.parseJSON(c.substring(a + $._smartHighlighter.META_OPEN.length, b));
        if (!m || m.v !== 1 || !m.lines || m.n !== m.lines.length) return null;
        return m;
    } catch (e) {
        return null;
    }
};

// Snapshot of existing box layers (top-first order = Line 1..N). ES3-safe.
$._smartHighlighter.snapshotBoxes = function (comp, textLayer) {
    var out = [];
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (l.parent === textLayer && l.comment === "SMART_HL_PRO_LAYER") {
            var snap = { layer: l, color: null, padX: null, padY: null, offY: null, round: null, useMaster: 1, progT: [], progV: [], progStatic: null };
            try {
                var e1 = l.effect("Local Color");
                if (e1) snap.color = e1.property("Color").value;
                var e2 = l.effect("Local Padding X");
                if (e2) snap.padX = e2.property("Slider").value;
                var e3 = l.effect("Local Padding Y");
                if (e3) snap.padY = e3.property("Slider").value;
                var e4 = l.effect("Local Offset Y");
                if (e4) snap.offY = e4.property("Slider").value;
                var e5 = l.effect("Local Roundness");
                if (e5) snap.round = e5.property("Slider").value;
                var e6 = l.effect("Use Master Controls");
                if (e6) snap.useMaster = e6.property("Checkbox").value ? 1 : 0;
                var e7 = l.effect("Progress");
                if (e7) {
                    var pp = e7.property("Slider");
                    if (pp.numKeys > 0) {
                        for (var k = 1; k <= pp.numKeys; k++) {
                            snap.progT.push(pp.keyTime(k));
                            snap.progV.push(pp.keyValue(k));
                        }
                    } else {
                        snap.progStatic = pp.value;
                    }
                }
            } catch (e) {}
            out.push(snap);
        }
    }
    return out;
};

// ---------- Per-line direction (Phase D) ----------
$._smartHighlighter.countDir = function (s) {
    var rtl = 0, ltr = 0, m;
    m = s.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
    if (m) rtl = m.length;
    m = s.match(/[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g);
    if (m) ltr = m.length;
    return { rtl: rtl, ltr: ltr };
};

$._smartHighlighter.lineIsRTL = function (lineText, fallbackRTL) {
    var c = $._smartHighlighter.countDir(lineText);
    if (c.rtl === 0 && c.ltr === 0) return fallbackRTL;
    if (c.rtl === c.ltr) return fallbackRTL;
    return c.rtl > c.ltr;
};

// Helper: safely get or create master effect on text layer (ES3-safe, top-level function)
$._smartHighlighter.masterFx = function (layer, type, name, val, force, masterNotes) {
    var propName = (type === "ADBE Color Control") ? "Color" : "Slider";
    var fx = layer.effect(name);
    if (!fx) {
        fx = layer.property("ADBE Effect Parade").addProperty(type);
        fx.name = name;
        fx.property(propName).setValue(val);
        return fx;
    }
    if (val !== undefined && force) {
        var prop = fx.property(propName);
        if (prop.numKeys > 0) {
            masterNotes.push(name + " is animated - keyframes kept");
        } else {
            prop.setValue(val);
        }
    }
    return fx;
};

// Helper: RGB array [r,g,b,a] to #RRGGBB hex string (ES3 safe)
$._smartHighlighter.rgbToHex = function (rgba) {
    if (!rgba || rgba.length < 3) return "#FFE600";
    var r = Math.round(rgba[0] * 255);
    var g = Math.round(rgba[1] * 255);
    var b = Math.round(rgba[2] * 255);
    var toH = function (n) {
        var s = Math.max(0, Math.min(255, n)).toString(16).toUpperCase();
        return s.length === 1 ? "0" + s : s;
    };
    return "#" + toH(r) + toH(g) + toH(b);
};

// Helper: #RRGGBB to [r,g,b,1.0] (ES3 safe)
$._smartHighlighter.hexToRgba = function (hex) {
    if (!hex) return null;
    var c = String(hex).replace("#", "");
    if (c.length === 3) {
        c = c.charAt(0) + c.charAt(0) + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2);
    }
    if (c.length !== 6) return null;
    var r = parseInt(c.substring(0, 2), 16) / 255;
    var g = parseInt(c.substring(2, 4), 16) / 255;
    var b = parseInt(c.substring(4, 6), 16) / 255;
    return [r, g, b, 1.0];
};

// قراءة حالة الطبقة المحددة لمزامنة اللوحة مع After Effects (Two-way sync)
$._smartHighlighter.getLayerState = function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return '{"ok":false}';
    if (comp.selectedLayers.length !== 1) return '{"ok":false}';

    var lyr = comp.selectedLayers[0];
    try {
        if (lyr instanceof TextLayer) {
            var mColFx = lyr.effect("Master Highlight Color");
            var pXFx = lyr.effect("Master Padding X");
            var pYFx = lyr.effect("Master Padding Y");
            var rndFx = lyr.effect("Master Roundness");
            if (!mColFx) return '{"ok":true,"type":"text","hasHighlight":false,"layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '"}';

            var cVal = mColFx.property("Color").value;
            var hex = $._smartHighlighter.rgbToHex(cVal);
            return '{"ok":true,"type":"text","hasHighlight":true,"color":"' + hex + '",' +
                '"paddingX":' + (pXFx ? pXFx.property("Slider").value : 8) + ',' +
                '"paddingY":' + (pYFx ? pYFx.property("Slider").value : 2) + ',' +
                '"roundness":' + (rndFx ? rndFx.property("Slider").value : 2) + ',' +
                '"layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '"}';
        }

        if (lyr instanceof ShapeLayer && lyr.comment === "SMART_HL_PRO_LAYER" && lyr.parent) {
            var locColFx = lyr.effect("Local Color");
            var useMFx = lyr.effect("Use Master Controls");
            var parentMCol = lyr.parent.effect("Master Highlight Color");

            var useMVal = useMFx ? useMFx.property("Checkbox").value : 1;
            var cArray = null;

            if (useMVal === 0 && locColFx) {
                cArray = locColFx.property("Color").value;
            } else if (parentMCol) {
                cArray = parentMCol.property("Color").value;
            } else if (locColFx) {
                cArray = locColFx.property("Color").value;
            }

            var hexS = cArray ? $._smartHighlighter.rgbToHex(cArray) : "#FFE600";
            return '{"ok":true,"type":"shape","hasHighlight":true,"isLocal":' + (useMVal === 0) + ',"color":"' + hexS + '","layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '"}';
        }
    } catch (e) {
        return '{"ok":false}';
    }

    return '{"ok":false}';
};

// تطبيق اللون المباشر بنمطين: على كل الأسطر (all) أو على السطر المحدد فقط (line)
$._smartHighlighter.setQuickColor = function (hexColorStr, targetScope) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return "ERROR: لا توجد تركيبة مفتوحة.";
    if (comp.selectedLayers.length !== 1) return "ERROR: يرجى تحديد طبقة واحدة.";

    var lyr = comp.selectedLayers[0];
    var rgba = $._smartHighlighter.hexToRgba(hexColorStr);
    if (!rgba) return "ERROR: خطأ في صياغة اللون.";

    var scope = targetScope || "all";

    app.beginUndoGroup("Highlight-Studio: Quick Color (" + scope + ")");
    try {
        var textLayer = null;
        var shapeLayer = null;

        if (lyr instanceof TextLayer) {
            textLayer = lyr;
        } else if (lyr instanceof ShapeLayer && lyr.comment === "SMART_HL_PRO_LAYER") {
            shapeLayer = lyr;
            textLayer = lyr.parent;
        }

        if (!textLayer && !shapeLayer) {
            app.endUndoGroup();
            return "ERROR: يرجى تحديد طبقة النص أو إحدى طبقات الهايلايت.";
        }

        if (scope === "line") {
            // تلوين السطر المحدد فقط
            if (!shapeLayer && textLayer) {
                // إذا كان المستخدم محدد طبقة النص ولكن اختار السطر المحدد، نبحث عن أول سطر تابع
                for (var si = 1; si <= comp.numLayers; si++) {
                    var chk = comp.layer(si);
                    if (chk && chk.parent === textLayer && chk.comment === "SMART_HL_PRO_LAYER") {
                        shapeLayer = chk;
                        break;
                    }
                }
            }
            if (shapeLayer) {
                var locColFx = shapeLayer.effect("Local Color");
                var useMFx = shapeLayer.effect("Use Master Controls");
                if (locColFx) locColFx.property("Color").setValue(rgba);
                if (useMFx) useMFx.property("Checkbox").setValue(0); // فك الارتباط ليعتمد اللون المحلي فوراً
                app.endUndoGroup();
                return "SUCCESS: Color applied to " + shapeLayer.name + " only.";
            } else {
                app.endUndoGroup();
                return "ERROR: لم يتم العثور على طبقة سطر محددة.";
            }
        } else {
            // تلوين كل الأسطر معاً (All Lines / Master)
            if (textLayer) {
                var mColFx = textLayer.effect("Master Highlight Color");
                if (mColFx) {
                    mColFx.property("Color").setValue(rgba);
                }
                // إعادة ربط كل الأسطر التابعة بالماستر
                for (var j = 1; j <= comp.numLayers; j++) {
                    var lBox = comp.layer(j);
                    if (lBox && lBox.parent === textLayer && lBox.comment === "SMART_HL_PRO_LAYER") {
                        var boxUseM = lBox.effect("Use Master Controls");
                        if (boxUseM) boxUseM.property("Checkbox").setValue(1);
                    }
                }
                app.endUndoGroup();
                return "SUCCESS: Color applied to all lines (Master).";
            }
        }
        app.endUndoGroup();
        return "NO_OP";
    } catch (e) {
        app.endUndoGroup();
        return "ERROR: " + e.toString();
    }
};



// الدالة الرئيسية لإنشاء الهايلايت
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

        var scan = $._smartHighlighter.scanParagraph(textLayer, comp);
        if (!scan) {
            app.endUndoGroup();
            return "ERROR: طبقة النص فارغة أو تعذر قراءتها.";
        }

        var linesData = scan.linesData;
        var totalLines = scan.numLines;
        var baseTotalH = scan.fullH;
        var baseFS = scan.fontSize;

        var isCenter = false;
        var fallbackRTL = false;

        if (data.direction === "center") {
            isCenter = true;
        } else if (data.direction === "rtl") {
            fallbackRTL = true;
        } else if (data.direction === "ltr") {
            fallbackRTL = false;
        } else {
            // نمط Auto: فحص محاذاة الباراجراف في After Effects أولاً
            if (scan.isJustified) {
                if (scan.justifyType === "right") {
                    fallbackRTL = true;
                } else if (scan.justifyType === "center") {
                    isCenter = true;
                } else {
                    fallbackRTL = false;
                }
                $._smartHighlighter.log("Auto-direction: Justified Paragraph (" + scan.justifyType + ")");
            } else {
                var pj = $._smartHighlighter.detectJustification(scan.justification);
                if (pj === "center") {
                    isCenter = true;
                    $._smartHighlighter.log("Auto-direction: detected Paragraph Justification = Center");
                } else if (pj === "rtl") {
                    fallbackRTL = true;
                    $._smartHighlighter.log("Auto-direction: detected Paragraph Justification = Right (RTL)");
                } else if (pj === "ltr") {
                    fallbackRTL = false;
                    $._smartHighlighter.log("Auto-direction: detected Paragraph Justification = Left (LTR)");
                } else {
                    var fc = $._smartHighlighter.countDir(scan.fullText);
                    fallbackRTL = (fc.rtl > fc.ltr);
                    $._smartHighlighter.log("Auto-direction: script analysis fallback (RTL=" + fallbackRTL + ")");
                }
            }
        }

        // 1. Master controls on the text layer.
        var masterNotes = [];
        $._smartHighlighter.masterFx(textLayer, "ADBE Color Control", "Master Highlight Color", data.color, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Padding X", data.paddingX, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Padding Y", data.paddingY, true, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Offset Y", 0, false, masterNotes);
        $._smartHighlighter.masterFx(textLayer, "ADBE Slider Control", "Master Roundness", data.roundness, true, masterNotes);

        // 1. أخذ لقطة من الصناديق القديمة قبل حذفها لحفظ التعديلات المحلية (Snapshot & Reconcile)
        var prevBoxes = $._smartHighlighter.snapshotBoxes(comp, textLayer);

        // 2. فحص وحذف أي ربط سابق (Previous Highlight Layers)
        var oldBoxesRemoved = 0;
        for (var si = comp.numLayers; si >= 1; si--) {
            var lyr = comp.layer(si);
            if (lyr && lyr !== textLayer && lyr.parent === textLayer && lyr.comment === "SMART_HL_PRO_LAYER") {
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

        // 2. Create independent shape layers
        var lastLayer = textLayer;
        var startTime = comp.time;

        for (var k = 0; k < totalLines; k++) {
            var ld = linesData[k];
            var rtl_k = isCenter ? false : ((data.direction === "auto") ? (scan.isJustified ? (scan.justifyType === "right") : $._smartHighlighter.lineIsRTL(ld.text, fallbackRTL)) : (data.direction === "rtl"));
            var lineH = ld.height;

            var shapeLayer = comp.layers.addShape();
            shapeLayer.name = textLayer.name + " - [Line " + (k + 1) + "]";
            shapeLayer.comment = "SMART_HL_PRO_LAYER";

            shapeLayer.moveAfter(lastLayer);
            lastLayer = shapeLayer;

            shapeLayer.parent = textLayer;

            var xform = shapeLayer.property("ADBE Transform Group");
            xform.property("ADBE Position").setValue([0, 0]);
            xform.property("ADBE Anchor Point").expression = "parent.transform.anchorPoint;";
            xform.property("ADBE Scale").setValue([100, 100]);
            xform.property("ADBE Rotate Z").setValue(0);
            shapeLayer.blendingMode = BlendingMode.NORMAL;

            // استرجاع أي تخصيص محلي سابق لهذا السطر (إن وجد) لحفظ التعديلات الخاصة بكل سطر
            var prevSnap = (prevBoxes && k < prevBoxes.length) ? prevBoxes[k] : null;
            var isLocalCustom = (prevSnap && prevSnap.useMaster === 0);

            // Per-line effect controls
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
            rndFx.property("Slider").setValue((isLocalCustom && prevSnap.round !== null) ? prevSnap.round : data.roundness);

            var progFx = fx.addProperty("ADBE Slider Control"); progFx.name = "Progress";

            if (data.animate) {
                var lineDur = (data.lineDuration && data.lineDuration > 0) ? data.lineDuration : 0.35;
                var gapOrStagger = (typeof data.stagger === "number" && !isNaN(data.stagger)) ? data.stagger : 0;
                var hasOutro = !!data.outro;
                var holdTime = (typeof data.outTime === "number" && data.outTime > 0) ? data.outTime : 1.5;
                var t1, t2;

                if (data.sequential) {
                    // الحركة التتابعية: السطر k يبدأ مباشرة عند نهاية السطر k-1 (أو مع فاصل زمني Gap اختياري)
                    t1 = startTime + (k * (lineDur + gapOrStagger));
                    t2 = t1 + lineDur;
                } else {
                    // الحركة المتداخلة الكلاسيكية: كل سطر يبدأ بعد إزاحة زمنية ثابتة
                    t1 = startTime + (k * gapOrStagger);
                    t2 = t1 + lineDur;
                }

                // حركة الدخول: من 0 إلى 100
                progFx.property("Slider").setValueAtTime(t1, 0);
                progFx.property("Slider").setValueAtTime(t2, 100);

                var easeIn = new KeyframeEase(0, 65);
                var easeOut = new KeyframeEase(0, 65);
                progFx.property("Slider").setTemporalEaseAtKey(1, [easeIn], [easeOut]);
                progFx.property("Slider").setTemporalEaseAtKey(2, [easeIn], [easeOut]);

                // حركة الخروج (اختيارية): من 100 إلى 0 بعد انقضاء زمن البقاء holdTime
                if (hasOutro) {
                    var outroOrder = data.outroOrder || "first"; // "first" (1->N) or "last" (N->1)

                    // حساب توقيت اكتمال دخول كافة الأسطر لتبدأ فترة الثبات بعد اكتمال النص بالكامل
                    var totalEntryFinish;
                    if (data.sequential) {
                        totalEntryFinish = startTime + (totalLines * lineDur) + ((totalLines - 1) * gapOrStagger);
                    } else {
                        totalEntryFinish = startTime + ((totalLines - 1) * gapOrStagger) + lineDur;
                    }

                    var exitBaseTime = totalEntryFinish + holdTime;

                    // ترتيب الخروج: السطر الأول أولاً (k) أو السطر الأخير أولاً (totalLines - 1 - k)
                    var exitIndex = (outroOrder === "last") ? (totalLines - 1 - k) : k;

                    var t3, t4;
                    if (data.sequential) {
                        t3 = exitBaseTime + (exitIndex * (lineDur + gapOrStagger));
                        t4 = t3 + lineDur;
                    } else {
                        t3 = exitBaseTime + (exitIndex * gapOrStagger);
                        t4 = t3 + lineDur;
                    }

                    progFx.property("Slider").setValueAtTime(t3, 100);
                    progFx.property("Slider").setValueAtTime(t4, 0);

                    progFx.property("Slider").setTemporalEaseAtKey(3, [easeIn], [easeOut]);
                    progFx.property("Slider").setTemporalEaseAtKey(4, [easeIn], [easeOut]);
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

            // Size expression
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
                'var fullW, fullH;\n' +
                'if (' + totalLines + ' === 1) {\n' +
                '    var rLive = pLayer.sourceRectAtTime(time, false);\n' +
                '    fullW = rLive.width + pX * 2;\n' +
                '    fullH = Math.max(rLive.height, curFS * 1.2) + pY * 2;\n' +
                '} else {\n' +
                '    fullW = (' + ld.width.toFixed(2) + ' * fontRatio) + pX * 2;\n' +
                '    fullH = (Math.max(' + lineH.toFixed(2) + ' * fontRatio, curFS * 1.2)) + pY * 2;\n' +
                '}\n' +
                '[fullW * p, fullH];';
            rect.property("ADBE Vector Rect Size").expression = sizeExpr;

            // Position expression with leading-aware spacing
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
                'var curX, curY, curW;\n' +
                'if (' + totalLines + ' === 1) {\n' +
                '    curW = (r.width + pX * 2) * p;\n' +
                '    curY = r.top + (r.height / 2);\n' +
                '} else {\n' +
                '    var dynH = ' + lineH.toFixed(2) + ' * fontRatio;\n' +
                '    var scaledBaseH = ' + baseTotalH.toFixed(2) + ' * fontRatio;\n' +
                '    var addedH = r.height - scaledBaseH;\n' +
                '    var gapRatio = addedH / (' + (totalLines - 1) + ');\n' +
                '    var dynamicTop = (' + ld.top.toFixed(2) + ' * fontRatio) + (' + k + ' * gapRatio);\n' +
                '    curY = r.top + dynamicTop + (dynH / 2);\n' +
                '    curW = ((' + ld.width.toFixed(2) + ' * fontRatio) + pX * 2) * p;\n' +
                '}\n\n';

            if (rtl_k) {
                posExpr += 
                    'curX = (r.left + r.width) + pX - curW / 2;\n' +
                    '[curX, curY + offY];';
            } else if (isCenter) {
                posExpr += 
                    'curX = r.left + (r.width / 2);\n' +
                    '[curX, curY + offY];';
            } else {
                posExpr += 
                    'curX = r.left - pX + curW / 2;\n' +
                    '[curX, curY + offY];';
            }

            rect.property("ADBE Vector Rect Position").expression = posExpr;

            // Roundness
            rect.property("ADBE Vector Rect Roundness").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                '(useM == 1) ? pLayer.effect("Master Roundness")("Slider") : effect("Local Roundness")("Slider");';

            // Fill Color
            var fill = gContents.addProperty("ADBE Vector Graphic - Fill");
            fill.name = "Fill Color";
            fill.property("ADBE Vector Fill Color").expression = 
                'var pLayer = parent;\n' +
                'var useM = effect("Use Master Controls")("Checkbox");\n' +
                'var mCol = pLayer.effect("Master Highlight Color")("Color");\n' +
                'var lColProp = effect("Local Color")("Color");\n' +
                '(useM == 0 || lColProp.numKeys > 0) ? lColProp.value : mCol;';

            $._smartHighlighter.log("  Line " + (k+1) + " created: w=" + ld.width.toFixed(1) + " h=" + ld.height.toFixed(1) + " top=" + ld.top.toFixed(1));
        }

        $._smartHighlighter.writeMeta(textLayer, scan);
        app.endUndoGroup();

        var report = hadPreviousLink
            ? "SUCCESS: Updated highlight (" + totalLines + " line(s), refreshed previous link)."
            : "SUCCESS: Created highlight (" + totalLines + " line(s)).";
        if (masterNotes.length > 0) report += " Note: " + masterNotes.join("; ") + ".";
        $._smartHighlighter.log("createHighlight DONE: " + report);
        return report;

    } catch (err) {
        app.endUndoGroup();
        $._smartHighlighter.log("createHighlight ERROR: " + err.toString() + " line:" + err.line);
        return "ERROR: " + err.toString();
    }
};

// الدالة الذكية الموحدة (Smart Apply / Update / Clear)
$._smartHighlighter.smartHighlight = function (jsonPayloadStr, isClearOnly) {
    if (isClearOnly === true || isClearOnly === "true") {
        return $._smartHighlighter.removeHighlight();
    }
    return $._smartHighlighter.createHighlight(jsonPayloadStr);
};

// دالة المزامنة التلقائية (توافقية كاملة)
$._smartHighlighter.syncHighlight = function (jsonPayloadStr) {
    return $._smartHighlighter.createHighlight(jsonPayloadStr);
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
        var removed = 0;
        for (var i = comp.numLayers; i >= 1; i--) {
            var l = comp.layer(i);
            if (l && l !== textLayer && l.parent === textLayer && l.comment === "SMART_HL_PRO_LAYER") {
                l.remove();
                removed++;
            }
        }

        // مسح الميتا داتا من تعليق النص
        try {
            var c = textLayer.comment || "";
            var a = c.indexOf($._smartHighlighter.META_OPEN);
            var b = c.indexOf($._smartHighlighter.META_CLOSE);
            if (a !== -1 && b !== -1 && b > a) {
                textLayer.comment = (c.substring(0, a) + c.substring(b + $._smartHighlighter.META_CLOSE.length)).replace(/^\s+|\s+$/g, "");
            }
        } catch (eC) {}

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