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
$._smartHighlighter.ensureTextTypewriter = function (textLayer, tStart, tEnd, styleType, revealUnit) {
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

        // دالة موحدة لضبط إعدادات Range Selector المتقدمة بدقة وتوافق تام
        var configureRangeAdvanced = function (advGroup) {
            if (!advGroup) return;

            // 1. التأكد من بقاء Units على نسبة مئوية (1 = Percentage, 2 = Index)
            try {
                var uProp = advGroup.property("ADBE Text Range Units") || advGroup.property("Units");
                if (!uProp && advGroup.numProperties >= 1) uProp = advGroup.property(1);
                if (uProp) uProp.setValue(1);
            } catch(eU) {}

            // 2. ضبط خاصية Based On الحقيقية (ADBE Text Range Type2: 1=Chars, 3=Words, 4=Lines)
            try {
                var bProp = null;
                try { bProp = advGroup.property("ADBE Text Range Type2"); } catch(eB1) {}
                if (!bProp) { try { bProp = advGroup.property("Based On"); } catch(eB2) {} }
                if (!bProp) { try { bProp = advGroup.property("ADBE Text Range Type"); } catch(eB3) {} }
                if (!bProp && advGroup.numProperties >= 2) {
                    try { bProp = advGroup.property(2); } catch(eB4) {}
                }
                if (bProp) {
                    bProp.setValue(unitVal);
                    $._smartHighlighter.log("ensureTextTypewriter: Based On set to " + unitVal + " (" + (revealUnit || "chars") + ")");
                }
            } catch(eB) {
                $._smartHighlighter.log("ensureTextTypewriter Based On error: " + eB.toString());
            }

            // 3. ضبط النعومة على صفر (Smoothness = 0) لقفزات حاسمة ومطابقة
            try {
                var smProp = null;
                try { smProp = advGroup.property("ADBE Text Range Smoothness"); } catch(eS1) {}
                if (!smProp) { try { smProp = advGroup.property("ADBE Text Selector Smoothness"); } catch(eS2) {} }
                if (!smProp) { try { smProp = advGroup.property("Smoothness"); } catch(eS3) {} }
                if (!smProp && advGroup.numProperties >= 5) {
                    try { smProp = advGroup.property(5); } catch(eS4) {}
                }
                if (smProp) smProp.setValue(0);
            } catch(eSm) {}
        };

        // التحقق مما إذا كان هناك Animator سابق باسم Typewriter Sync لتحديث مفاتيحه بدقة
        for (var i = 1; i <= animators.numProperties; i++) {
            var aName = animators.property(i).name;
            if (aName === animName || aName === "Typewriter" || aName === "Typewriter Sync") {
                try {
                    var exAnim = animators.property(i);
                    var exSelectors = exAnim.property("ADBE Text Selectors");
                    if (exSelectors && exSelectors.numProperties >= 1) {
                        var exSel = exSelectors.property(1);
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
                        var exAdv = null;
                        try { exAdv = exSel.property("ADBE Text Range Advanced"); } catch(eA1) {}
                        if (!exAdv) { try { exAdv = exSel.property("Advanced"); } catch(eA2) {} }
                        if (exAdv) {
                            configureRangeAdvanced(exAdv);
                        }
                        return true;
                    }
                } catch(eUp) {}
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

        // ضبط خصائص Range Selector المتقدمة (Units, Based On, Smoothness)
        var adv = null;
        try { adv = sel.property("ADBE Text Range Advanced"); } catch(eA3) {}
        if (!adv) { try { adv = sel.property("Advanced"); } catch(eA4) {} }
        if (adv) {
            configureRangeAdvanced(adv);
        }

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
