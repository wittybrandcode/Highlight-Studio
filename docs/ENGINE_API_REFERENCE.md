# Highlight Studio — Engine API & Developer Reference
> **دليل الواجهة البرمجية للمطورين (Public API Reference & Extension Guide)**

تم تصميم معمارية **Highlight Studio** لتعمل كمحرك مستقل عالي الدقة (Standalone High-Precision Engine) يمكن استدعاؤه برمجياً من داخل After Effects، أو عبر لوحة CEP، أو حتى عبر نصوص الأتمتة المتقدمة (ExtendScript CLI / Render Automation).

---

## 1. بنية المحرك (Host Architecture)

يعيش المحرك داخل كائن عام موحد في ExtendScript:
```javascript
$._smartHighlighter
```

### الوحدات الأساسية (Core Modules):
| الوحدة | الملف | المسؤولية |
| :--- | :--- | :--- |
| **`Config`** | [Config.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/Config.jsx) | الثوابت، المعرفات، ومفاتيح الميتا داتا |
| **`Utils`** | [Utils.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/Utils.jsx) | دوال الفحص، كشف اتجاه النصوص، والـ Safe Undo |
| **`TextScanner`** | [TextScanner.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/TextScanner.jsx) | القياس التيبوغرافي الدقيق للأسطر والكلمات والأحرف |
| **`TagManager`** | [TagManager.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/TagManager.jsx) | بناء أبعاد الصناديق وضمان المحاذاة العمودية المستقيمة |
| **`Recipes`** | [Recipes.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/Recipes.jsx) | سجل الأنماط والحركات وتوليد الإكسبرشنات الرياضية |
| **`HighlightBuilder`** | [HighlightBuilder.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/HighlightBuilder.jsx) | بناء طبقات الـ Shape Layers وتطبيق المتحكمات والماركرز |
| **`ControllerBridge`** | [ControllerBridge.jsx](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/ControllerBridge.jsx) | المزامنة الثنائية وقراءة خصائص الطبقة المحددة |

---

## 2. الواجهة البرمجية الأساسية (Public Methods)

### `$._smartHighlighter.createHighlight(payloadJson)`
الدالة الرئيسية لإنشاء أو تحديث الهايلايت على طبقة النص المحددة حالياً.
* **المدخلات:** نص JSON يحتوي على خيارات التظليل:
  ```json
  {
    "mode": "lines",
    "style": "box",
    "motion": "wipe",
    "color": "#ffd200",
    "opacity": 100,
    "paddingX": 12,
    "paddingY": 6,
    "roundness": 6,
    "inPoint": 1.0,
    "inDur": 0.5,
    "outPoint": 5.0,
    "outDur": 0.6,
    "hasOutro": true,
    "boxOutroOrder": "last",
    "direction": "auto"
  }
  ```
* **المخرجات:** نص تقرير النجاح (مثال: `"SUCCESS: Created highlight (4 line(s))."`) أو رسالة خطأ تبدأ بـ `"ERROR:"`.

### `$._smartHighlighter.removeHighlight()`
إزالة شاملة ونظيفة لجميع صناديق التظليل والمتحكمات والماركرز المرتبطة بطبقة النص المحددة مع استعادة النص لأصله.
* **المخرجات:** `"SUCCESS: Cleared everything (...)"`

### `$._smartHighlighter.addTimingMarkers(inPoint, outPoint, inDur, outDur, hasOutro)`
تحديث ماركرز التوقيت الأربعة على طبقة النص بشكل فوري دون إعادة بناء الصناديق.
* `inPoint`: زمن بدء الدخول بالثواني.
* `outPoint`: زمن انتهاء الخروج بالثواني.
* `inDur`: مدة حركة الدخول بالثواني.
* `outDur`: مدة حركة الخروج بالثواني.
* `hasOutro`: تفعيل أو إلغاء الخروج (`true` أو `false`).

---

## 3. كيفية توسيع المكتبة بأنماط وحركات جديدة (Plugin Guide)

### إضافة ستايل تظليل جديد (Custom Style Recipe)
يمكنك تسجيل ستايل جديد في أي ملف إضافي يستدعى في المشروع:
```javascript
$._smartHighlighter.recipes.registerStyle("my_custom_brush", {
    id: "my_custom_brush",
    name: "Custom Brush Highlighter",
    hasFill: true,
    hasStroke: false,
    
    // بناء الأشكال الرسومية للطبقة
    buildGraphics: function (gContents, ctx) {
        var fill = gContents.addProperty("ADBE Vector Graphic - Fill");
        fill.name = "Brush Fill";
        fill.property("ADBE Vector Fill Color").expression = 'effect("Local Color")(1);';
    },

    // إكسبرشن الحجم الديناميكي
    getSizeExpression: function (ctx) {
        return $._smartHighlighter.recipes.getStandardSizeSnippet(ctx);
    },

    // إكسبرشن الموضع الديناميكي
    getPositionExpression: function (ctx) {
        return $._smartHighlighter.recipes.getStandardPosSnippet(ctx);
    }
});
```

### إضافة حركة جديدة (Custom Motion Strategy)
```javascript
$._smartHighlighter.recipes.registerMotion("custom_glitch", {
    id: "custom_glitch",
    name: "Glitch Reveal",
    isTypewriter: false,

    // حركة الحجم أو الموضع
    getWidthSnippet: function (ctx) {
        return (
            'var baseW = ' + ctx.box.width.toFixed(2) + ' * fontRatio;\n' +
            'var curW = (p <= 0) ? 0 : (baseW * p + pX * 2);\n'
        );
    }
});
```

---

## 4. مكتبة التوقيت للواجهة (Client TimeEngine API)

في بيئة العميل (JavaScript / Node.js):
```javascript
const TimeEngine = require('./client/js/core/TimeEngine.js');

// 1. تحديد معدل الإطارات
TimeEngine.setFPS(25);

// 2. التحويل من كود زمني لثوانٍ
var seconds = TimeEngine.toSeconds("00:01:13"); // 1.52

// 3. التحويل من ثوانٍ لكود زمني
var timecode = TimeEngine.fromSeconds(1.52);   // "00:01:13"

// 4. الحساب المباشر للخانة المجزأة (دقيقة : ثانية : فريم)
var totalSec = (min * 60) + sec + (frames / TimeEngine.getFPS());
```

---

## 5. تشغيل الاختبارات الآلية (Testing & Continuous Verification)

للتأكد من سلامة جميع أجزاء المكتبة في أي وقت:
```bash
# تشغيل جميع الاختبارات الآلية
npm test

# أو مباشرة عبر Node:
node tests/run_all.js
```
