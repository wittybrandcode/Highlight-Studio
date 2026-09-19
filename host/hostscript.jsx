/**
 * HIGHLIGHT STUDIO CEP HOST ENGINE
 * Entry Point: hostscript.jsx
 * Version: 2.0.0 (Modular Architecture)
 * 
 * Central preprocessor loader that imports all system modules in topological order.
 */

// ═══════════════════════════════════════════════════════════════════
// MODULE PREPROCESSOR DIRECTIVES (#include)
// ═══════════════════════════════════════════════════════════════════

// 1. Config & Constants (No dependencies)
#include "modules/Config.jsx"

// 2. Core Utilities & Logging (Depends on Config)
#include "modules/Utils.jsx"

// 3. Text & Paragraph Scanner (Depends on Config, Utils)
#include "modules/TextScanner.jsx"

// 4. Tag & Multi-Mode Target Resolution (Depends on Config, Utils, TextScanner)
#include "modules/TagManager.jsx"

// 5. Smart Invisible Anchors Engine (Depends on Config, Utils)
#include "modules/InvisibleAnchors.jsx"

// 6. Custom Typewriter Engine (Depends on Config, Utils)
#include "modules/TypewriterEngine.jsx"

// 7. Controller & CEP UI Bridge (Depends on Config, Utils)
#include "modules/ControllerBridge.jsx"

// 8. Highlight Shape Layer Builder (Depends on all above modules)
#include "modules/HighlightBuilder.jsx"

// ═══════════════════════════════════════════════════════════════════
// PUBLIC API ROUTING & VERIFICATION
// ═══════════════════════════════════════════════════════════════════

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

// فحص نجاح تحميل جميع الوحدات وتوثيقها
(function () {
    var loaded = [];
    if (typeof SMART_HL_CONFIG_LOADED !== "undefined") loaded.push("Config");
    if (typeof SMART_HL_UTILS_LOADED !== "undefined") loaded.push("Utils");
    if (typeof SMART_HL_TEXTSCANNER_LOADED !== "undefined") loaded.push("TextScanner");
    if (typeof SMART_HL_TAGMANAGER_LOADED !== "undefined") loaded.push("TagManager");
    if (typeof SMART_HL_ANCHORS_LOADED !== "undefined") loaded.push("InvisibleAnchors");
    if (typeof SMART_HL_TYPEWRITER_LOADED !== "undefined") loaded.push("TypewriterEngine");
    if (typeof SMART_HL_CONTROLLER_LOADED !== "undefined") loaded.push("ControllerBridge");
    if (typeof SMART_HL_BUILDER_LOADED !== "undefined") loaded.push("HighlightBuilder");

    if ($._smartHighlighter && $._smartHighlighter.log) {
        $._smartHighlighter.log("Host Engine initialized. Modules loaded: " + loaded.join(", ") + " (" + loaded.length + "/8)");
    }
})();