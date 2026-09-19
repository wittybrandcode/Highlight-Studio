/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: ControllerBridge.jsx
 * Version: 2.0.0 (Modular Architecture)
 * 
 * Manages Master & Local controls, CEP Two-Way Sync, Layer State,
 * Snapshotting & Reconciling local adjustments, and Metadata persistence.
 */

// إنشاء أو جلب تأثير الماستر على طبقة النص بأمان
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

// حفظ بيانات الفحص والمحاذاة في تعليق طبقة النص كـ Metadata
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

// قراءة الـ Metadata من تعليق طبقة النص
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

// أخذ لقطة سريعة من الصناديق القديمة قبل حذفها لحفظ التعديلات المحلية (Snapshot & Reconcile)
$._smartHighlighter.snapshotBoxes = function (comp, textLayer) {
    var out = [];
    var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
    for (var i = 1; i <= comp.numLayers; i++) {
        var l = comp.layer(i);
        if (l.parent === textLayer && l.comment === tag) {
            var snap = { layer: l, color: null, opacity: null, padX: null, padY: null, offY: null, round: null, useMaster: 1, progT: [], progV: [], progStatic: null };
            try {
                var e1 = l.effect("Local Color");
                if (e1) snap.color = e1.property("Color").value;
                var eOp = l.effect("Local Opacity");
                if (eOp) snap.opacity = eOp.property("Slider").value;
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

// قراءة توقيت الماركرز من طبقة النص أو التركيبة للمزامنة الصوتية
$._smartHighlighter.readMarkers = function (textLayer, comp) {
    var times = [];
    try {
        if (textLayer) {
            var mProp = textLayer.property("ADBE Marker");
            if (mProp && mProp.numKeys > 0) {
                for (var i = 1; i <= mProp.numKeys; i++) {
                    times.push(mProp.keyTime(i));
                }
            }
        }
        if (times.length === 0 && comp) {
            var compM = comp.markerProperty;
            if (compM && compM.numKeys > 0) {
                for (var j = 1; j <= compM.numKeys; j++) {
                    times.push(compM.keyTime(j));
                }
            }
        }
    } catch (e) {
        $._smartHighlighter.log("readMarkers ERROR: " + e.toString());
    }
    return times;
};

// قراءة حالة الطبقة المحددة لمزامنة اللوحة مع After Effects (Two-way sync)
$._smartHighlighter.getLayerState = function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return '{"ok":false}';
    if (comp.selectedLayers.length !== 1) return '{"ok":false}';

    var lyr = comp.selectedLayers[0];
    var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";

    try {
        if (lyr instanceof TextLayer) {
            var mColFx = lyr.effect("Master Highlight Color");
            var mOpFx = lyr.effect("Master Highlight Opacity");
            var pXFx = lyr.effect("Master Padding X");
            var pYFx = lyr.effect("Master Padding Y");
            var rndFx = lyr.effect("Master Roundness");
            var txtContent = "";
            try { txtContent = lyr.property("Source Text").value.text; } catch (eTxt) {}
            var safeTxt = $._smartHighlighter.escMeta(txtContent);

            if (!mColFx) return '{"ok":true,"type":"text","hasHighlight":false,"layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '","text":"' + safeTxt + '"}';

            var cVal = mColFx.property("Color").value;
            var hex = $._smartHighlighter.rgbToHex(cVal);
            return '{"ok":true,"type":"text","hasHighlight":true,"scope":"all","color":"' + hex + '",' +
                '"opacity":' + (mOpFx ? mOpFx.property("Slider").value : 100) + ',' +
                '"paddingX":' + (pXFx ? pXFx.property("Slider").value : 8) + ',' +
                '"paddingY":' + (pYFx ? pYFx.property("Slider").value : 2) + ',' +
                '"roundness":' + (rndFx ? rndFx.property("Slider").value : 0) + ',' +
                '"layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '",' +
                '"text":"' + safeTxt + '"}';
        }

        if (lyr instanceof ShapeLayer && lyr.comment === tag && lyr.parent) {
            var locColFx = lyr.effect("Local Color");
            var locOpFx = lyr.effect("Local Opacity");
            var locPXFx = lyr.effect("Local Padding X");
            var locPYFx = lyr.effect("Local Padding Y");
            var locRndFx = lyr.effect("Local Roundness");
            var useMFx = lyr.effect("Use Master Controls");

            var parentMCol = lyr.parent.effect("Master Highlight Color");
            var parentMOp = lyr.parent.effect("Master Highlight Opacity");
            var parentMPX = lyr.parent.effect("Master Padding X");
            var parentMPY = lyr.parent.effect("Master Padding Y");
            var parentMRnd = lyr.parent.effect("Master Roundness");

            var useMVal = useMFx ? useMFx.property("Checkbox").value : 1;
            var isLocal = (useMVal === 0);

            var cArray = (isLocal && locColFx) ? locColFx.property("Color").value : (parentMCol ? parentMCol.property("Color").value : (locColFx ? locColFx.property("Color").value : [1,0.9,0,1]));
            var hexS = $._smartHighlighter.rgbToHex(cArray);

            var curPX = (isLocal && locPXFx) ? locPXFx.property("Slider").value : (parentMPX ? parentMPX.property("Slider").value : 8);
            var curPY = (isLocal && locPYFx) ? locPYFx.property("Slider").value : (parentMPY ? parentMPY.property("Slider").value : 2);
            var curRnd = (isLocal && locRndFx) ? locRndFx.property("Slider").value : (parentMRnd ? parentMRnd.property("Slider").value : 0);
            var curOp = (isLocal && locOpFx) ? locOpFx.property("Slider").value : (parentMOp ? parentMOp.property("Slider").value : 100);
            var parentTxt = "";
            try { if (lyr.parent instanceof TextLayer) parentTxt = lyr.parent.property("Source Text").value.text; } catch (ePTxt) {}
            var safePTxt = $._smartHighlighter.escMeta(parentTxt);

            return '{"ok":true,"type":"shape","hasHighlight":true,"scope":"line","isLocal":' + isLocal + ',' +
                '"color":"' + hexS + '",' +
                '"opacity":' + curOp + ',' +
                '"paddingX":' + curPX + ',' +
                '"paddingY":' + curPY + ',' +
                '"roundness":' + curRnd + ',' +
                '"layerName":"' + $._smartHighlighter.escMeta(lyr.name) + '",' +
                '"text":"' + safePTxt + '"}';
        }
    } catch (e) {
        return '{"ok":false}';
    }

    return '{"ok":false}';
};

// تبديل نمط التحكم (Master vs Local) للطبقات المحددة في After Effects
$._smartHighlighter.setScopeMode = function (targetScope) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return "ERROR: لا توجد تركيبة مفتوحة.";
    if (comp.selectedLayers.length !== 1) return "ERROR: يرجى تحديد طبقة واحدة.";

    var lyr = comp.selectedLayers[0];
    var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
    var textLayer = (lyr instanceof TextLayer) ? lyr : ((lyr instanceof ShapeLayer && lyr.parent) ? lyr.parent : null);
    if (!textLayer) return "ERROR: لم يتم العثور على طبقة نص مرتبطة.";

    app.beginUndoGroup("Highlight-Studio: Scope Mode (" + targetScope + ")");
    try {
        if (targetScope === "all") {
            // إعادة ربط كل الأسطر بالماستر
            for (var j = 1; j <= comp.numLayers; j++) {
                var lBox = comp.layer(j);
                if (lBox && lBox.parent === textLayer && lBox.comment === tag) {
                    var boxUseM = lBox.effect("Use Master Controls");
                    if (boxUseM) boxUseM.property("Checkbox").setValue(1);
                }
            }
            app.endUndoGroup();
            return "SUCCESS: Linked all lines to Master Controls.";
        } else if (targetScope === "line") {
            // فصل السطر المحدد ليعتمد التحكم المحلي
            var targetShape = (lyr instanceof ShapeLayer && lyr.comment === tag) ? lyr : null;
            if (!targetShape) {
                for (var si = 1; si <= comp.numLayers; si++) {
                    var chk = comp.layer(si);
                    if (chk && chk.parent === textLayer && chk.comment === tag) {
                        targetShape = chk;
                        break;
                    }
                }
            }
            if (targetShape) {
                var targetUseM = targetShape.effect("Use Master Controls");
                if (targetUseM) targetUseM.property("Checkbox").setValue(0);
                app.endUndoGroup();
                return "SUCCESS: Decoupled " + targetShape.name + " for Local Control.";
            }
        }
        app.endUndoGroup();
        return "NO_OP";
    } catch (e) {
        app.endUndoGroup();
        return "ERROR: " + e.toString();
    }
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
    var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";

    app.beginUndoGroup("Highlight-Studio: Quick Color (" + scope + ")");
    try {
        var textLayer = null;
        var shapeLayer = null;

        if (lyr instanceof TextLayer) {
            textLayer = lyr;
        } else if (lyr instanceof ShapeLayer && lyr.comment === tag) {
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
                for (var si = 1; si <= comp.numLayers; si++) {
                    var chk = comp.layer(si);
                    if (chk && chk.parent === textLayer && chk.comment === tag) {
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
                for (var j = 1; j <= comp.numLayers; j++) {
                    var lBox = comp.layer(j);
                    if (lBox && lBox.parent === textLayer && lBox.comment === tag) {
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

// تطبيق تعديل فوري ومباشر للمقاييس (تدوير الزوايا، الحواف، الشفافية) في After Effects
$._smartHighlighter.setQuickParam = function (paramName, numVal, targetScope) {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return "ERROR: لا توجد تركيبة مفتوحة.";
    if (comp.selectedLayers.length !== 1) return "ERROR: يرجى تحديد طبقة واحدة.";

    var lyr = comp.selectedLayers[0];
    var val = parseFloat(numVal);
    if (isNaN(val)) return "ERROR: قيمة غير صالحة.";

    var scope = targetScope || "all";
    var tag = $._smartHighlighter.LAYER_COMMENT || "SMART_HL_PRO_LAYER";
    var fxMasterName = "";
    var fxLocalName = "";

    if (paramName === "roundness") {
        fxMasterName = "Master Roundness";
        fxLocalName = "Local Roundness";
    } else if (paramName === "padX") {
        fxMasterName = "Master Padding X";
        fxLocalName = "Local Padding X";
    } else if (paramName === "padY") {
        fxMasterName = "Master Padding Y";
        fxLocalName = "Local Padding Y";
    } else if (paramName === "opacity") {
        fxMasterName = "Master Highlight Opacity";
        fxLocalName = "Local Opacity";
    } else {
        return "ERROR: معلمة غير معروفة.";
    }

    app.beginUndoGroup("Highlight-Studio: " + fxMasterName);
    try {
        var textLayer = null;
        var shapeLayer = null;

        if (lyr instanceof TextLayer) {
            textLayer = lyr;
        } else if (lyr instanceof ShapeLayer && lyr.comment === tag) {
            shapeLayer = lyr;
            textLayer = lyr.parent;
        }

        if (!textLayer && !shapeLayer) {
            app.endUndoGroup();
            return "NO_HIGHLIGHT";
        }

        if (scope === "line") {
            if (!shapeLayer && textLayer) {
                for (var si = 1; si <= comp.numLayers; si++) {
                    var chk = comp.layer(si);
                    if (chk && chk.parent === textLayer && chk.comment === tag) {
                        shapeLayer = chk;
                        break;
                    }
                }
            }
            if (shapeLayer) {
                var locFx = shapeLayer.effect(fxLocalName);
                var useMFx = shapeLayer.effect("Use Master Controls");
                if (locFx) locFx.property("Slider").setValue(val);
                if (useMFx) useMFx.property("Checkbox").setValue(0);
                app.endUndoGroup();
                return "SUCCESS: " + paramName + " -> " + val + " (" + shapeLayer.name + ")";
            } else {
                app.endUndoGroup();
                return "ERROR: لم يتم العثور على طبقة سطر.";
            }
        } else {
            // نمط All Lines: تحديث الماستر على طبقة النص
            if (textLayer) {
                var mFx = textLayer.effect(fxMasterName);
                if (mFx) {
                    mFx.property("Slider").setValue(val);
                }
                for (var j = 1; j <= comp.numLayers; j++) {
                    var lBox = comp.layer(j);
                    if (lBox && lBox.parent === textLayer && lBox.comment === tag) {
                        var boxUseM = lBox.effect("Use Master Controls");
                        if (boxUseM && boxUseM.property("Checkbox").value === 0) {
                            var locProp = lBox.effect(fxLocalName);
                            if (locProp) locProp.property("Slider").setValue(val);
                        }
                    }
                }
                app.endUndoGroup();
                return "SUCCESS: " + paramName + " -> " + val;
            }
        }
        app.endUndoGroup();
        return "NO_OP";
    } catch (e) {
        app.endUndoGroup();
        return "ERROR: " + e.toString();
    }
};

var SMART_HL_CONTROLLER_LOADED = true;
