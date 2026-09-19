# 🏗️ مخطط هندسة محرك Typewriter الأصيل ونظام الرموز الخفية (Highlight Studio v2.0)
> **وثيقة معمارية وتنفيذية مطورة**  
> **الحالة**: 🟢 تم إنجاز وتقسيم المعمارية الموديلار بنجاح (8 وحدات برمجية مستقلة)  
> **الهدف الحالي**: تفعيل وتطوير الربط الكامل بين محرك الرموز الخفية (`InvisibleAnchors.jsx`) ومحرك الآلة الكاتبة (`TypewriterEngine.jsx`) وتعبيرات بناء الصناديق (`HighlightBuilder.jsx`) لتحقيق تزامن إعجازي 100% في الفقرات بدون أدنى لاغ (Zero-Lag Character Lockstep).

---

## 📑 فهرس الوثيقة المطورة
1. [الواقع المعماري المنجز (Current Architecture State)](#1-الواقع-المعماري-المنجز-current-architecture-state)
2. [تطوير منهجية العمل بما يتناسب مع بنية الملفات الجديدة](#2-تطوير-منهجية-العمل-بما-يتناسب-مع-بنية-الملفات-الجديدة)
3. [الهندسة التشغيلية لمحرك الرموز الخفية الذكية (Invisible Anchors Integration)](#3-الهندسة-التشغيلية-لمحرك-الرموز-الخفية-الذكية-invisible-anchors-integration)
4. [محرك الآلة الكاتبة الأصيل وثنائية الحركة (Opacity Pop vs Scale Pop)](#4-محرك-الآلة-الكاتبة-الأصيل-وثنائية-الحركة-opacity-pop-vs-scale-pop)
5. [المعادلات التعبيرية الجديدة للصناديق (The Waypoint-Locked Expressions)](#5-المعادلات-التعبيرية-الجديدة-للصناديق-the-waypoint-locked-expressions)
6. [دورة حياة الهايلايت والتنظيف الشامل (Lifecycle & Safe Cleanup)](#6-دورة-حياة-الهايلايت-والتنظيف-الشامل-lifecycle--safe-cleanup)
7. [مراحل خطة التنفيذ المتبقية (Remaining Execution Roadmap)](#7-مراحل-خطة-التنفيذ-المتبقية-remaining-execution-roadmap)

---

## 1. الواقع المعماري المنجز (Current Architecture State)

تم تفكيك ملف `hostscript.jsx` المتضخم وتحويله إلى بنية موديلار نقية 100%، وتم التحقق منها واختبارها عبر Node.js بنجاح تام:

```text
host/
├── hostscript.jsx               # المحمل المركزي والموجه العام (Entry Point معتمد في CSXS)
└── modules/
    ├── Config.jsx               # الثوابت العامة، الإعدادات، ومعرفات الرموز الخفية ZW_START و ZW_END
    ├── Utils.jsx                # أدوات السجل، فحص اتجاه النص (RTL/LTR)، والمحاذاة، والألوان
    ├── TextScanner.jsx          # فحص أسطر الفقرة، قياس عروض المسافات fontSpaceW، وحساب cOffsets
    ├── TagManager.jsx           # استخراج وسوم الكلمات [الكلمات]، التنظيف، وحساب أبعاد الكلمات
    ├── InvisibleAnchors.jsx     # محرك حقن وفهرسة ومسح العلامات الخفية (\u200B و \u2060)
    ├── TypewriterEngine.jsx     # محرك الآلة الكاتبة الأصيل وإدارة Range Selector
    ├── ControllerBridge.jsx     # جسر المزامنة الثنائية (Master/Local) وإدارة الـ Snapshots
    └── HighlightBuilder.jsx     # بناء طبقات الأشكال، وحقن التعبيرات، ومسح الهايلايت
```

**المكسب الهندسي المتحقق:**
- أصبح كل ملف مسؤولاً عن اختصاص محدد ومغلق برمجياً.
- التعديل في معادلات الصناديق أو محرك الآلة الكاتبة يتم الآن داخل وحدته دون مساس ببقية الكود.
- توافقية كاملة مع المحرك القديم بـ 34 دالة مُحققة بالكامل.

---

## 2. تطوير منهجية العمل بما يتناسب مع بنية الملفات الجديدة

بدلاً من التعامل مع الـ Expressions كنصوص متناثرة أو متداخلة مع كود فحص النصوص، نعتمد الآن منهجية العمل الموديلار التالية:

1. **وحدة الرموز الخفية (`InvisibleAnchors.jsx`)** هي المسؤولة الوحيدة عن التعامل المباشر مع النص لحقن المحارف الذكية واستخراج فهارس البداية والنهاية لكل سطر ($S_k \rightarrow E_k$).
2. **وحدة الآلة الكاتبة (`TypewriterEngine.jsx`)** هي المسؤولة الوحيدة عن إنشاء وضبط الـ Text Animator وتوليد متحكمات الحركة (`Typewriter Progress`، ونمط `Opacity` مقابل `Scale Pop`).
3. **وحدة البناء (`HighlightBuilder.jsx`)** تقوم باستدعاء الوحدتين وربطهما بتعبيرات رياضية نقية وقوية وموجزة (Clean Expressions Generator).
4. **التوافقية العالية**: إذا لم يكن خيار الحركة هو `typewriter`، يعمل المحرك بالنمط الاعتيادي (`wipe`, `pop`, `snap`) دون حقن أي رموز، مما يحافظ على خفة النظام بنسبة 100%.

---

## 3. الهندسة التشغيلية لمحرك الرموز الخفية الذكية (Invisible Anchors Integration)

### 💡 آلية الحقن والفهرسة أثناء التطبيق (`createHighlight`):
عند تفعيل خيار `motion: "typewriter"`:
1. يقوم `TextScanner.jsx` بفحص الفقرة واكتشاف الأسطر المرئية `visualLines`.
2. يتم استدعاء `InvisibleAnchors.injectAnchors(text, visualLines)`:
   - يتم حقن محرف البداية `\u200B` (Zero-Width Space) في أول كل سطر مرئي.
   - يتم حقن محرف النهاية `\u2060` (Word Joiner) في آخر كل سطر مرئي.
   - كلاهما بعرض فيزيائي يساوي **`0.0000 Pixel`**، لا يؤثران على شكل الحروف ولا على الريندر نهائياً.
   - يتم تحديث `Source Text` لطبقة النص بالقيمة المحقونة.
3. يتم استدعاء `InvisibleAnchors.getAnchorIndices(text)`:
   - يتم استخراج مصفوفة المواقع: لكل صندوق $k$ يتم تحديد نقطة البداية $S_k$ ونقطة النهاية $E_k$.
   - يتم تمرير هذه النقاط إلى كائن الصندوق `boxesData[k].anchorStart` و `boxesData[k].anchorEnd`.

---

## 4. محرك الآلة الكاتبة الأصيل وثنائية الحركة (Opacity Pop vs Scale Pop)

يتم بناء أو تحديث الـ Text Animator المسمى `Typewriter Sync` على طبقة النص بواسطة `TypewriterEngine.jsx`:

### 🎛️ متحكمات الحركة الموحدة على طبقة النص:
* **محدد النطاق (Range Selector)**:
  * يعمل بالوحدات المئوية أو بالفهرس الحرفي الصارم.
  * النعومة: `Smoothness = 0%` للقفز الحرفي الحاد المتزامن لحظياً.
* **خيارات المظهر البصري للحرف لحظة انبثاقه**:
  1. **Classic Opacity**: انتقال شفافية الحرف من 0% إلى 100% فورياً عند بلوغ مؤشره.
  2. **Snappy Scale Pop**: انبثاق الحرف بحجم مرن يبدأ من الصفر ويتمدد مع ارتداد خاطف يشد عين المشاهد في السناك فيديو.

---

## 5. المعادلات التعبيرية الجديدة للصناديق (The Waypoint-Locked Expressions)

في المعمارية الجديدة، يتم تزويد كل صندوق بهايلايت بثلاثة تعبيرات رياضية تعتمد على الرموز الخفية ومصفوفة `cOffsets`:

### 📏 1. تعبير الحجم (Size Expression):
يعتمد على موقع مؤشر الكتابة الحالي مقارنةً بنطاق السطر $[S_k, E_k]$:

```javascript
// === HIGHLIGHT STUDIO: WAYPOINT-LOCKED SIZE EXPRESSION ===
var pLayer = parent;
var useM = effect("Use Master Controls")("Checkbox");
var pX = (useM == 1) ? pLayer.effect("Master Padding X")("Slider") : effect("Local Padding X")("Slider");
var pY = (useM == 1) ? pLayer.effect("Master Padding Y")("Slider") : effect("Local Padding Y")("Slider");

// نسبة الخط والتكبير
var baseFS = __BASE_FS__;
var curFS = baseFS;
try { curFS = pLayer.text.sourceText.style.fontSize; } catch(e) {
    var curR = pLayer.sourceRectAtTime();
    curFS = baseFS * (curR.height / __BASE_TOTAL_H__);
}
var fontRatio = curFS / baseFS;

// قراءة التقدم الحرفي من الـ Animator
var curChar = 0;
try {
    var anim = pLayer.text.animator("Typewriter Sync");
    var sel = anim.property("ADBE Text Selectors").property(1);
    var pVal = sel.property("ADBE Text Percent Start").value; // 0 to 100
    var totalChars = pLayer.text.sourceText.value.length;
    curChar = (pVal / 100) * totalChars;
} catch(err) {
    // البديل: قراءة سلايدر التقدم المحلي
    var prog = effect("Progress")("Slider");
    curChar = (prog / 100) * __TOTAL_CHARS__;
}

var S_k = __ANCHOR_START__;
var E_k = __ANCHOR_END__;
var cOffsets = __C_OFFSETS_ARRAY__;
var numChars = cOffsets.length;

var curW = 0;
if (curChar <= S_k) {
    // مؤشر الكتابة لم يصل لهذا السطر بعد
    curW = 0;
} else if (curChar >= E_k) {
    // السطر اكتمل بالكامل
    var maxW = (numChars > 0) ? cOffsets[numChars - 1] : __BOX_WIDTH__;
    curW = maxW * fontRatio + pX * 2;
} else {
    // السطر قيد الكتابة اللحظية
    var charOffsetInLine = Math.min(numChars, Math.max(1, Math.ceil(curChar - S_k)));
    var textW = cOffsets[charOffsetInLine - 1];
    curW = textW * fontRatio + pX * 2;
}

var fullH = Math.max(__BOX_HEIGHT__ * fontRatio, curFS * 1.2) + pY * 2;
[curW, fullH];
```

### 📍 2. تعبير الموضع (Position Expression):
يضمن ارتكاز الصندوق بثبات عند طرف السطر الأيمن (للعربية) أو الأيسر (للإنجليزية) بحيث يتمدد الصندوق للأمام مع زحف مؤشر الكتابة دون أي اهتزاز:

```javascript
// === HIGHLIGHT STUDIO: WAYPOINT-LOCKED POSITION EXPRESSION ===
var pLayer = parent;
var useM = effect("Use Master Controls")("Checkbox");
var pX = (useM == 1) ? pLayer.effect("Master Padding X")("Slider") : effect("Local Padding X")("Slider");
var offY = (useM == 1) ? pLayer.effect("Master Offset Y")("Slider") : effect("Local Offset Y")("Slider");

var r = pLayer.sourceRectAtTime();
var baseFS = __BASE_FS__;
var curFS = baseFS;
try { curFS = pLayer.text.sourceText.style.fontSize; } catch(e) {
    curFS = baseFS * (r.height / __BASE_TOTAL_H__);
}
var fontRatio = curFS / baseFS;

var dynamicTop = (__LINE_TOP__ * fontRatio);
var dynH = __LINE_H__ * fontRatio;
var curY = r.top + dynamicTop + (dynH / 2);

// استدعاء العرض اللحظي المحسوب في مستطيل الحجم
var curW = content("Box Group").content("Box").size[0];
var curX;

if (__IS_RTL__) {
    // محاذاة لليمين: الصندوق يرتكز عند حافة السطر اليمنى ويتوسع يساراً
    curX = (r.left + r.width) + pX - (curW / 2);
} else {
    // محاذاة لليسار: الصندوق يرتكز عند حافة السطر اليسرى ويتوسع يميناً
    curX = r.left - pX + (curW / 2);
}

[curX, curY + offY];
```

### 👁️ 3. تعبير الشفافية ومنع الأشباح (Opacity Expression):
يضمن اختفاء الصندوق 100% وبشكل صامت طالما أن مؤشر الكتابة لم يبلغ سطر هذا الصندوق:

```javascript
var pLayer = parent;
var useM = effect("Use Master Controls")("Checkbox");
var mOp = pLayer.effect("Master Highlight Opacity")("Slider");
var lOp = effect("Local Opacity")("Slider");
var baseOp = (useM == 1) ? mOp : lOp;

var curW = content("Box Group").content("Box").size[0];
(curW <= 0) ? 0 : baseOp;
```

---

## 6. دورة حياة الهايلايت والتنظيف الشامل (Lifecycle & Safe Cleanup)

عند طلب المستخدم مسح الهايلايت عبر زر `[ 🗑️ Clear ]` أو عبر الدالة `removeHighlight()`:
1. **حذف طبقات الأشكال**: حذف كل الطبقات التابعة الحاملة لوسم `SMART_HL_PRO_LAYER`.
2. **حذف أنيميتور الآلة الكاتبة**: إزالة `Typewriter Sync` بأمان من طبقة النص عبر `TypewriterEngine.removeTextTypewriter(textLayer)`.
3. **تنظيف الرموز الخفية**: استدعاء `InvisibleAnchors.stripAnchors()` لإعادة النص الأصلي كما كان بالضبط بدون أي محارف خفية.
4. **مسح الميتا داتا**: إزالة تعليق `[HL-META]` من `textLayer.comment`.
5. **تجميع العملية في Undo واحد**: `app.beginUndoGroup / endUndoGroup` تضمن التراجع بنقرة واحدة `Ctrl+Z`.

---

## 7. مراحل خطة التنفيذ المتبقية (Remaining Execution Roadmap)

| المرحلة | الوصف الإجرائي | الملفات المستهدفة | النتيجة المتوقعة |
| :---: | :--- | :--- | :--- |
| **المرحلة 5.1** | ربط حقن الرموز الخفية في `HighlightBuilder.jsx` عند تفعيل نمط Typewriter | `HighlightBuilder.jsx`<br>`InvisibleAnchors.jsx` | حقن `\u200B` و `\u2060` في النص واستخراج فهارس البداية والنهاية لكل سطر. |
| **المرحلة 5.2** | تحديث تعبيرات الحجم والموضع في `HighlightBuilder.jsx` لتعتمد معادلات النقاط الخفية | `HighlightBuilder.jsx` | تطابق عرض الصندوق حرفياً مع مؤشر كتابة كل سطر بالبيكسل. |
| **المرحلة 5.3** | ترقية نمطي الـ Typewriter في `TypewriterEngine.jsx` (Opacity Fade vs Snappy Scale Pop) | `TypewriterEngine.jsx` | خياران احترافيان لحركة انبعاث الحروف في الآلة الكاتبة. |
| **المرحلة 5.4** | تعزيز تنظيف الرموز الخفية التلقائي عند `removeHighlight` وعند إعادة التطبيق | `HighlightBuilder.jsx`<br>`InvisibleAnchors.jsx` | نص نقي دائماً وأمان تام عند التراجع. |
| **المرحلة 5.5** | التحقق البرمجي الآلي الشامل عبر Node.js ومطابقة المنظومة | كافة ملفات `host/modules/` | كود نظيف، خالٍ من الأخطاء، وجاهز للعمل الميداني في After Effects. |

---
*تم تحديث هذه الوثيقة لمطابقة المعمارية الموديلار الحالية وتوجيه الخطوة التنفيذية القادمة بدقة.*
