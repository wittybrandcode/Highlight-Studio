/**
 * HIGHLIGHT STUDIO - Host Engine
 * Module: InvisibleAnchors.jsx
 * Version: 2.0.0 (Smart Invisible Waypoints Engine)
 * 
 * Injects and manages Zero-Width Unicode Waypoints:
 * - \u200B (Zero-Width Space) at line/box starts (visual width = 0.00px)
 * - \u2060 (Word Joiner) at line/box ends (visual width = 0.00px)
 * 
 * Provides subpixel-exact character boundary tracking for the Typewriter engine
 * across multi-line paragraphs without any visual artifacts or rendering side-effects.
 */

// إزالة كل العلامات المخفية القديمة من النص لتفادي التكرار وضمان نقاء النص
$._smartHighlighter.stripAnchors = function (text) {
    if (!text) return "";
    return text.replace(/[\u200B\u2060\uFEFF\u200C\u200D\u200E\u200F\u061C]/g, "");
};

// حقن العلامات المخفية الذكية عند بداية ونهاية كل سطر أو صندوق مستهدف في النص
$._smartHighlighter.injectAnchors = function (text, items) {
    if (!text || !items || items.length === 0) return text;

    var clean = $._smartHighlighter.stripAnchors(text);
    var zwStart = $._smartHighlighter.ZW_START;
    var zwEnd = $._smartHighlighter.ZW_END;

    var result = clean;
    var searchCursor = 0;

    // نبني النص الجديد مع وضع zwStart في بداية كل عنصر و zwEnd في نهايته
    for (var i = 0; i < items.length; i++) {
        var targetText = items[i].text;
        if (!targetText) continue;
        var fIdx = result.indexOf(targetText, searchCursor);
        if (fIdx !== -1) {
            var before = result.substring(0, fIdx);
            var target = result.substring(fIdx, fIdx + targetText.length);
            var after = result.substring(fIdx + targetText.length);

            // تغليف العنصر بالعلامات المخفية
            result = before + zwStart + target + zwEnd + after;
            // تحديث مؤشر البحث متخطياً العنصر والعلامتين
            searchCursor = fIdx + zwStart.length + target.length + zwEnd.length;
        }
    }

    return result;
};

// استخراج فهارس العلامات المخفية من النص لتحديد مواقع البداية والنهاية الدقيقة لكل صندوق
$._smartHighlighter.getAnchorIndices = function (text) {
    if (!text) return [];

    var zwStart = $._smartHighlighter.ZW_START;
    var zwEnd = $._smartHighlighter.ZW_END;
    var anchors = [];
    var searchIdx = 0;
    var idx = 0;

    while (searchIdx < text.length) {
        var sPos = text.indexOf(zwStart, searchIdx);
        if (sPos === -1) break;

        var ePos = text.indexOf(zwEnd, sPos + zwStart.length);
        if (ePos === -1) break;

        anchors.push({
            index: idx,
            lineIndex: idx,
            boxIndex: idx,
            startPos: sPos,
            endPos: ePos,
            innerLength: ePos - (sPos + zwStart.length),
            text: text.substring(sPos + zwStart.length, ePos)
        });

        idx++;
        searchIdx = ePos + zwEnd.length;
    }

    return anchors;
};

var SMART_HL_ANCHORS_LOADED = true;
