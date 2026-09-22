/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: TypewriterEngine.jsx
 * Version: 2.0.0 (Custom Typewriter Engine)
 * 
 * Creates, detects, and synchronizes the dedicated Highlight Studio Typewriter
 * animator on the text layer with discrete character jumps (Smoothness = 0)
 * and subpixel keyframe precision.
 */

// فحص وجود Text Animator مسبق على طبقة النص بمفاتيح Range Selector (Start/End)
$._smartHighlighter.detectTextAnimator = function (textLayer) {
    try {
        var textProp = textLayer.property("ADBE Text Properties");
        if (!textProp) return null;
        var animators = textProp.property("ADBE Text Animators");
        if (!animators || animators.numProperties === 0) return null;

        var animName = $._smartHighlighter.TYPEWRITER_ANIM_NAME || "Typewriter Sync";
        var minStart = null;
        var maxEnd = null;
        var foundProp = null;

        for (var i = 1; i <= animators.numProperties; i++) {
            var anim = animators.property(i);
            var aName = anim.name || "";
            // تجاهل أنيميتور الآلة الكاتبة التابع للإضافة لمنع تراكم المدة بشكل أسي
            if (aName === animName || aName === "Typewriter Sync" || aName === "Typewriter") {
                continue;
            }

            var selectors = anim.property("ADBE Text Selectors");
            if (!selectors || selectors.numProperties === 0) continue;

            // نفحص فقط المحدد الأول (Intro selector) لتجنب قراءة مفاتيح الخروج كمدة حركة الدخول
            var sel = selectors.property(1);
            if (!sel) continue;

            var checkProps = ["ADBE Text Percent Start", "ADBE Text Percent End", "Start", "End"];
            for (var p = 0; p < checkProps.length; p++) {
                try {
                    var targetProp = sel.property(checkProps[p]);
                    if (targetProp && targetProp.numKeys >= 2) {
                        var k1 = targetProp.keyTime(1);
                        var k2 = targetProp.keyTime(targetProp.numKeys);
                        if (minStart === null || k1 < minStart) minStart = k1;
                        if (maxEnd === null || k2 > maxEnd) maxEnd = k2;
                        foundProp = targetProp;
                    }
                } catch (eProp) {}
            }
        }

        if (minStart !== null && maxEnd !== null && maxEnd > minStart) {
            return {
                hasKeys: true,
                startTime: minStart,
                endTime: maxEnd,
                prop: foundProp
            };
        }
    } catch (e) {
        $._smartHighlighter.log("detectTextAnimator error: " + e.toString());
    }
    return null;
};

// إنشاء أو تحديث تأثير Typewriter أصلي على طبقة النص مع دعم كامل لحركتي الدخول والخروج (Intro & Outro)
$._smartHighlighter.ensureTextTypewriter = function (textLayer, tStart, tEnd, styleType, revealUnit, hasOutro, tOutStart, tOutEnd, outroOrder, useMarkers) {
    try {
        var textProp = textLayer.property("ADBE Text Properties");
        if (!textProp) return false;
        var animators = textProp.property("ADBE Text Animators");
        if (!animators) return false;

        var animName = $._smartHighlighter.TYPEWRITER_ANIM_NAME || "Typewriter Sync";

        // تحديد وحدة التقسيم (Based On): 1 = Characters, 3 = Words, 4 = Lines
        var unitVal = 1;
        if (revealUnit === "words") {
            unitVal = 3;
        } else if (revealUnit === "lines") {
            unitVal = 4;
        }

        // 1. تنظيف أي أنيميتور سابق لضمان بناء جديد ونظيف وخالٍ من الأخطاء التراكمية
        $._smartHighlighter.removeTextTypewriter(textLayer);

        // 2. إنشاء أنيميتور جديد باسم Typewriter Sync
        var anim = animators.addProperty("ADBE Text Animator");
        anim.name = animName;

        // 3. إضافة المحدّد الأول: حركة الدخول (Range Selector Intro)
        var selectors = anim.property("ADBE Text Selectors");
        var inSel = selectors.addProperty("ADBE Text Selector");
        try { inSel.name = "Range Selector Intro"; } catch(eNameIn) {}

        // ضبط إعدادات المحدّد المتقدمة (Advanced): Based On و Smoothness = 0
        try {
            var inAdv = inSel.property("ADBE Text Range Advanced");
            if (inAdv) {
                // Based On: 1=Chars, 3=Words, 4=Lines
                try {
                    var bProp = inAdv.property("ADBE Text Range Type2");
                    if (bProp) bProp.setValue(unitVal);
                } catch(eB) {}
                // Smoothness: 0 لقفزات نصية حاسمة
                try {
                    var smProp = inAdv.property("ADBE Text Selector Smoothness");
                    if (smProp) smProp.setValue(0);
                } catch(eSm) {}
            }
        } catch(eAdvIn) {}

        // ضبط مفاتيح الدخول على المحدّد الأول (Intro)
        try {
            var inEndProp = inSel.property("ADBE Text Percent End");
            if (inEndProp) inEndProp.setValue(100);
        } catch(eE1) {}

        var inStartProp = null;
        try { inStartProp = inSel.property("ADBE Text Percent Start"); } catch(eS1) {}
        if (inStartProp) {
            inStartProp.setValueAtTime(tStart, 0);
            inStartProp.setValueAtTime(tEnd, 100);
            try {
                inStartProp.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                inStartProp.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
            } catch(eLin1) {}

            if (useMarkers === true) {
                var inExpr = 
                    "var res = value;\n" +
                    "if (thisLayer.marker && thisLayer.marker.numKeys > 0) {\n" +
                    "    var inS = null, inE = null;\n" +
                    "    for (var i = 1; i <= thisLayer.marker.numKeys; i++) {\n" +
                    "        var c = thisLayer.marker.key(i).comment;\n" +
                    "        if (c === 'HL_IN_START') inS = thisLayer.marker.key(i).time;\n" +
                    "        else if (c === 'HL_IN_END') inE = thisLayer.marker.key(i).time;\n" +
                    "    }\n" +
                    "    if (inS !== null && inE !== null) res = linear(time, inS, inE, 0, 100);\n" +
                    "}\n" +
                    "res;";
                try { inStartProp.expression = inExpr; } catch(eEx1) {}
            }
        }

        // 4. إذا كانت حركة الخروج مفعلة، ننشئ المحدد الثاني (Range Selector Outro)
        if (hasOutro === true) {
            if (typeof tOutStart !== "number") tOutStart = tEnd + 1.0;
            if (typeof tOutEnd !== "number" || tOutEnd <= tOutStart) tOutEnd = tOutStart + Math.max(0.2, tEnd - tStart);

            var outSel = selectors.addProperty("ADBE Text Selector");
            try { outSel.name = "Range Selector Outro"; } catch(eNameOut) {}

            try {
                var outAdv = outSel.property("ADBE Text Range Advanced");
                if (outAdv) {
                    try {
                        var obProp = outAdv.property("ADBE Text Range Type2");
                        if (obProp) obProp.setValue(unitVal);
                    } catch(eOb) {}
                    try {
                        var osmProp = outAdv.property("ADBE Text Selector Smoothness");
                        if (osmProp) osmProp.setValue(0);
                    } catch(eOsm) {}
                }
            } catch(eAdvOut) {}

            var isReverse = (outroOrder === "last");
            if (isReverse) {
                // خروج عكسي N➔1: الحروف الأخيرة تختفي أولاً
                try {
                    var oEndP = outSel.property("ADBE Text Percent End");
                    if (oEndP) oEndP.setValue(100);
                } catch(eOE) {}

                var oStartP = null;
                try { oStartP = outSel.property("ADBE Text Percent Start"); } catch(eOS) {}
                if (oStartP) {
                    oStartP.setValueAtTime(tOutStart, 100);
                    oStartP.setValueAtTime(tOutEnd, 0);
                    try {
                        oStartP.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                        oStartP.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                    } catch(eLin2) {}

                    if (useMarkers === true) {
                        var outRevExpr = 
                            "var res = value;\n" +
                            "if (thisLayer.marker && thisLayer.marker.numKeys > 0) {\n" +
                            "    var outS = null, outE = null;\n" +
                            "    for (var i = 1; i <= thisLayer.marker.numKeys; i++) {\n" +
                            "        var c = thisLayer.marker.key(i).comment;\n" +
                            "        if (c === 'HL_OUT_START') outS = thisLayer.marker.key(i).time;\n" +
                            "        else if (c === 'HL_OUT_END') outE = thisLayer.marker.key(i).time;\n" +
                            "    }\n" +
                            "    if (outS !== null && outE !== null) res = linear(time, outS, outE, 100, 0);\n" +
                            "}\n" +
                            "res;";
                        try { oStartP.expression = outRevExpr; } catch(eExRev) {}
                    }
                }
            } else {
                // خروج طبيعي 1➔N: الحروف الأولى تختفي أولاً
                try {
                    var oStartP2 = outSel.property("ADBE Text Percent Start");
                    if (oStartP2) oStartP2.setValue(0);
                } catch(eOS2) {}

                var oEndP2 = null;
                try { oEndP2 = outSel.property("ADBE Text Percent End"); } catch(eOE2) {}
                if (oEndP2) {
                    oEndP2.setValueAtTime(tOutStart, 0);
                    oEndP2.setValueAtTime(tOutEnd, 100);
                    try {
                        oEndP2.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                        oEndP2.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                    } catch(eLin3) {}

                    if (useMarkers === true) {
                        var outFwdExpr = 
                            "var res = value;\n" +
                            "if (thisLayer.marker && thisLayer.marker.numKeys > 0) {\n" +
                            "    var outS = null, outE = null;\n" +
                            "    for (var i = 1; i <= thisLayer.marker.numKeys; i++) {\n" +
                            "        var c = thisLayer.marker.key(i).comment;\n" +
                            "        if (c === 'HL_OUT_START') outS = thisLayer.marker.key(i).time;\n" +
                            "        else if (c === 'HL_OUT_END') outE = thisLayer.marker.key(i).time;\n" +
                            "    }\n" +
                            "    if (outS !== null && outE !== null) res = linear(time, outS, outE, 0, 100);\n" +
                            "}\n" +
                            "res;";
                        try { oEndP2.expression = outFwdExpr; } catch(eExFwd) {}
                    }
                }
            }
        }

        // 5. إضافة الخصائص البصرية (ADBE Text Opacity = 0)
        var props = anim.property("ADBE Text Animator Properties");
        var op = null;
        try { op = props.addProperty("ADBE Text Opacity"); } catch(eAddOp) {}
        if (!op) {
            try { op = props.property("ADBE Text Opacity"); } catch(eGetOp) {}
        }
        if (op) op.setValue(0);

        if (styleType === "scale" || styleType === "pop") {
            try {
                var sc = props.addProperty("ADBE Text Scale 3D");
                if (!sc) sc = props.addProperty("ADBE Text Scale");
                if (sc) sc.setValue([0, 0, 0]);
            } catch (eSc) {}
        }

        $._smartHighlighter.log("ensureTextTypewriter: successfully built Typewriter Sync with selectors and opacity.");
        return true;
    } catch (e) {
        $._smartHighlighter.log("ensureTextTypewriter error: " + e.toString());
    }
    return false;
};

// إزالة أنيميتور الآلة الكاتبة عند مسح الهايلايت
$._smartHighlighter.removeTextTypewriter = function (textLayer) {
    try {
        var textProp = textLayer.property("ADBE Text Properties");
        if (!textProp) return;
        var animators = textProp.property("ADBE Text Animators");
        if (!animators) return;

        var animName = $._smartHighlighter.TYPEWRITER_ANIM_NAME || "Typewriter Sync";
        for (var ai = animators.numProperties; ai >= 1; ai--) {
            var an = animators.property(ai).name;
            if (an === animName || an === "Typewriter Sync" || an === "Typewriter") {
                animators.property(ai).remove();
            }
        }
    } catch (eAnimDel) {}
};

var SMART_HL_TYPEWRITER_LOADED = true;
