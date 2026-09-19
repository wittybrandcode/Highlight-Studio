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

        var minStart = null;
        var maxEnd = null;
        var foundProp = null;

        for (var i = 1; i <= animators.numProperties; i++) {
            var anim = animators.property(i);
            var selectors = anim.property("ADBE Text Selectors");
            if (!selectors || selectors.numProperties === 0) continue;

            for (var s = 1; s <= selectors.numProperties; s++) {
                var sel = selectors.property(s);
                var checkProps = ["ADBE Text Percent Start", "ADBE Text Percent End", "ADBE Text Percent Offset", "Start", "End", "Offset"];
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

// إنشاء أو تحديث تأثير Typewriter أصلي على طبقة النص لضمان تطابق النص والهايلايت
$._smartHighlighter.ensureTextTypewriter = function (textLayer, tStart, tEnd, styleType) {
    try {
        var textProp = textLayer.property("ADBE Text Properties");
        if (!textProp) return false;
        var animators = textProp.property("ADBE Text Animators");
        if (!animators) return false;

        var animName = $._smartHighlighter.TYPEWRITER_ANIM_NAME || "Typewriter Sync";

        // التحقق مما إذا كان هناك Animator سابق باسم Typewriter Sync لتحديث مفاتيحه بدقة
        for (var i = 1; i <= animators.numProperties; i++) {
            var aName = animators.property(i).name;
            if (aName === animName) {
                try {
                    var exSel = animators.property(i).property("ADBE Text Selectors").property(1);
                    var exStart = null;
                    try { exStart = exSel.property("ADBE Text Percent Start"); } catch(e0) {}
                    if (!exStart) { try { exStart = exSel.property("Start"); } catch(e01) {} }
                    if (exStart) {
                        while (exStart.numKeys > 0) {
                            exStart.removeKey(1);
                        }
                        exStart.setValueAtTime(tStart, 0);
                        exStart.setValueAtTime(tEnd, 100);
                        try {
                            exStart.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                            exStart.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
                        } catch(eK) {}
                    }
                    return true;
                } catch(eUp) {}
            } else if (aName === "Typewriter") {
                return true;
            }
        }

        var anim = animators.addProperty("ADBE Text Animator");
        anim.name = animName;

        var props = anim.property("ADBE Text Animator Properties");
        var op = props.addProperty("ADBE Text Opacity");
        op.setValue(0);

        // إذا كان النمط المطلوب هو الـ Scale Pop، نضيف خاصية Scale للأنيميتور
        if (styleType === "scale" || styleType === "pop") {
            try {
                var sc = props.addProperty("ADBE Text Scale 3D");
                if (!sc) sc = props.addProperty("ADBE Text Scale");
                if (sc) sc.setValue([0, 0, 0]);
            } catch (eSc) {}
        }

        var selectors = anim.property("ADBE Text Selectors");
        var sel = selectors.addProperty("ADBE Text Selector");
        sel.name = "Range Selector";

        // ضبط النعومة على صفر (Smoothness = 0) لقفزات حرفية مطابقة لإيقاع الآلة الكاتبة الحقيقية
        try {
            var adv = sel.property("ADBE Text Range Advanced");
            if (!adv) adv = sel.property("Advanced");
            if (adv) {
                var sm = adv.property("ADBE Text Range Smoothness");
                if (!sm) sm = adv.property("Smoothness");
                if (sm) sm.setValue(0);
            }
        } catch(eSm) {}

        var startP = null;
        try { startP = sel.property("ADBE Text Percent Start"); } catch(e1) {}
        if (!startP) {
            try { startP = sel.property("Start"); } catch(e2) {}
        }
        if (!startP && sel.numProperties >= 1) {
            startP = sel.property(1);
        }

        if (startP) {
            startP.setValueAtTime(tStart, 0);
            startP.setValueAtTime(tEnd, 100);
            try {
                startP.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR);
                startP.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
            } catch(eKey) {}
            return true;
        }
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
            if (animators.property(ai).name === animName) {
                animators.property(ai).remove();
            }
        }
    } catch (eAnimDel) {}
};

var SMART_HL_TYPEWRITER_LOADED = true;
