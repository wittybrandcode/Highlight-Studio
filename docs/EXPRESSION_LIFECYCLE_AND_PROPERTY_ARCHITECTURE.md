# دليل المعمارية: إدارة الخصائص ودورة حياة الإكسبريشن لمنع تجمد After Effects
## Architectural Analysis: Property Navigation & Clean Expression Lifecycle

---

## 1. فلسفة التنقل بين الخصائص (Property Transition Architecture)

في الإضافات الاحترافية لـ After Effects (مثل Highlight Studio)، تنقسم الخصائص إلى **مستويين معماريين** يختلفان جذرياً في طريقة المعالجة والأثر على أداء البرنامج:

```
                          ┌─────────────────────────────┐
                          │   واجهة المستخدم (CEP UI)    │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
   [المستوى 1: التعديل الرقمي المباشر]             [المستوى 2: التعديل الهيكلي والاستراتيجي]
      (Live Parameter Updates)                     (Structural Topology Changes)
                 │                                               │
   • اللون (Color)                                • الشكل (Box / Pill / Marker / Underline)
   • التدوير (Roundness)                          • الحركة (Typewriter / Wipe / Pop / Snap)
   • الحواف (Padding X/Y)                         • وحدة التقسيم (Chars / Words / Lines)
   • الشفافية (Opacity)                            • اتجاه الخروج (1➔N / N➔1)
                 │                                               │
                 ▼                                               ▼
   [تعديل مباشر على متحكم الماستر]                [إعادة بناء الطبقات والأنيميتور]
      setValue() دون مسح أو بناء                     Clean Wipe & Replant Cycle
                 │                                               │
                 ▼                                               ▼
   (استجابة لحظية في أجزاء من الثانية)              (معاملة ذرية مقفلة بـ Undo Group)
```

### المستوى الأول: الخصائص الحية المباشرة (Live Master Parameters)
- **الخصائص**: اللون، تدوير الزوايا، الحواف الأفقية والعمودية، الشفافية.
- **التقنية المستخدمة**: `setQuickParam` عبر [`ControllerBridge.jsx`](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/ControllerBridge.jsx#L472).
- **الآلية**: كل طبقة تظليل تحتوي على إكسبريشن مربوط بمؤثرات الماستر في طبقة النص:
  ```javascript
  var pX = (useM == 1) ? pLayer.effect("Master Padding X")("Slider") : effect("Local Padding X")("Slider");
  ```
  عندما يغير المستخدم هذه القيم من الواجهة، يتم استدعاء `setValue()` على الـ Slider أو الـ Color Control فقط. **لا يتم مسح أي طبقة ولا إعادة كتابة أي إكسبريشن**. هذا يحافظ على كاش After Effects تماماً ويمنع أي وميض أو تأخير.

### المستوى الثاني: التعديلات الهيكلية (Structural Topology Changes)
- **الخصائص**: نوع الشكل (`box`, `pill`, `underline`, `outline`, `marker`)، نوع الحركة (`typewriter`, `wipe`, `pop`, `snap`)، وحدة التقسيم (`chars`, `words`, `lines`)، واتجاه الخروج (`first`, `last`).
- **التقنية المستخدمة**: `createHighlight` عبر نمط الاستراتيجية المتغير [`Recipes.jsx`](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/host/modules/Recipes.jsx).
- **الآلية**: هذه التعديلات تتطلب معادلات رياضية مختلفة كلياً (مثلاً معادلة `curX` للمسح تختلف عن قفزات الحروف وعن التسطير السفلي). هنا يتم تفعيل تقنية **"المسح وإعادة الزرع النظيف"** المنضبطة.

---

## 2. لماذا يتجمد After Effects؟ (Root Causes of AE Freezes)

تحدث حالات التجمد (Freezing / Crashing / Beachball) أو ظهور النوافذ التحذيرية الصفراء للأخطاء البرمجية للأسباب التالية:

### 1. عاصفة إعادة تقييم التبعيات (DAG Dependency Storm)
- محرك تعبيرات After Effects الحديث (JavaScript Expression Engine) يعمل عبر شجرة تبعيات غير دورية (Directed Acyclic Graph).
- عندما يحذف السكريبت طبقة ما بينما توجد إكسبريشنات في طبقات أخرى ترتبط بها، يحاول المحرك تقييم المعادلة لكل فريم مرئي في الـ Timeline على كائن ميت (`Dead Object / Null Reference`).
- إذا استمر هذا عبر مئات الفريمات أثناء تحريك الـ CTI، يغرق الـ UI Thread في After Effects ويتجمد البرنامج تماماً.

### 2. التردد السريع وتراكم أوامر ExtendScript (Bridge Flooding)
- عند النقر المتكرر أو تحريك الـ Steppers بسرعة، إذا أرسلت الواجهة 10 استدعاءات `CSInterface.evalScript` في ثانية واحدة، تتراكم الأوامر في طابور محرك ExtendScript، حيث أن محرك ExtendScript أحادي المسار (Single-Threaded). تراكم الأوامر يؤدي إلى `Not Responding` وتجميد نافذة البرنامج.

### 3. فخ بقايا أنيميتور النص المخفي (The Opacity=0 Ghost Trap)
- عند تفعيل حركة الآلة الكاتبة، يزرع السكريبت أنيميتور نص `ADBE Text Animator` يحدد الشفافية بـ `0%`.
- إذا قرر المستخدم فجأة الانتقال إلى حركة المسح `wipe` أو مسح الهايلايت، وإذا لم يُستأصل أنيميتور الآلة الكاتبة بحذر وبشكل فوري، يظل النص الأساسي في التركيبة مخفياً بشفافية 0% حتى لو كان الهايلايت يعمل بشكل صحيح.

### 4. تشتت مجموعات التراجع (Undo Stack Choking)
- إذا لم تكن كل عمليات الحذف، والمسح، وإنشاء المؤثرات، وحقن الإكسبريشنات محصورة بين `app.beginUndoGroup()` و `app.endUndoGroup()` في خطوة واحدة، فإن كل عملية فرعية تسجل نقطة تراجع في ذاكرة الوصول العشوائي وتجبر AE على إعادة حساب كل شيء خطوة بخطوة.

---

## 3. تقنية مسح وإعادة زرع الإكسبريشن باحترافية (The Clean Wipe & Replant Paradigm)

لضمان تبديل الخصائص بدون أي فوضى أو تداخلات أو تجميد، تم تطبيق معمارية سداسية الحماية في **Highlight Studio**:

### 1. كبسولة القفل الذري (Atomic Transaction Locking)
جميع عمليات المسح والزرع محصورة بدقة داخل مجموعة تراجع واحدة:
```javascript
app.beginUndoGroup("Highlight-Studio: Apply");
try {
    // 1. Snapshot
    // 2. Wipe
    // 3. Rebuild & Replant
    app.endUndoGroup();
} catch (err) {
    app.endUndoGroup();
}
```
**الفائدة**: يمنع After Effects من تقييم أي إكسبريشن أثناء مرحلة الحذف والزرع. يتم تقييم التركيبة **مرة واحدة فقط** عند بلوغ `app.endUndoGroup()`.

### 2. لقطة المطابقة قبل الحذف (Snapshot & Reconcile)
قبل حذف أي طبقة هايلايت سابقة، تأخذ دالة `snapshotBoxes` لقطة دقيقة من التخصيصات المحلية التي قد يكون المستخدم عدلها يدوياً في التركيبة (مثل تغيير لون سطر معين أو إيقاف ربطه بالماستر `useMaster=0`):
```javascript
var prevBoxes = $._smartHighlighter.snapshotBoxes(comp, textLayer);
```
ثم تحذف الطبقات القديمة فقط التي تحمل علامة الوسم `SMART_HL_PRO_LAYER`، ثم تعيد تطبيق التخصيصات المحلية على الطبقات الجديدة فور بنائها.

### 3. التعقيم الكامل لأنيميتور النص (Text Animator Hygiene)
قبل بناء أي شكل أو حركة جديدة:
```javascript
if (motionRecipe && motionRecipe.isTypewriter) {
    // تحديث نظيف ومباشر
    $._smartHighlighter.ensureTextTypewriter(...);
} else {
    // استئصال فوري لأنيميتور الآلة الكاتبة لمنع حجب النص
    $._smartHighlighter.removeTextTypewriter(textLayer);
}
```
دالة `removeTextTypewriter` تفحص خصائص `ADBE Text Animators` وتحذف خصيصاً الأنيميتور التابع للإضافة دون المساس بأي أنيميتورات أخرى أنشأها المستخدم يدوياً على النص.

### 4. الساندبوكسينغ الدفاعي داخل نص الإكسبريشن (Defensive Expression Sandboxing)
كل إكسبريشن يتم حقنه في After Effects مكتوب بصيغة دفاعية محكمة تبدأ وتنتهي بقيمة أمان:
```javascript
var res = value; // قيمة الأمان الافتراضية
var p = null;
try { p = thisLayer.parent; } catch(e) {}
if (p && p.marker && p.marker.numKeys > 0) {
    // حساب التوقيت...
    res = calculatedValue;
}
res; // إرجاع آمن حتى لو انقطعت الصلة مؤقتاً
```
لو افترضنا أن After Effects قام بتقييم الإكسبريشن في لحظة تجزئة، فإن `try/catch` يعيد `value` دون إيقاف التشغيل أو ظهور المثلث الأصفر للخطأ.

### 5. خنق الطلبات المتتالية في واجهة العميل (Client-Side Throttling)
في ملف [`Controls.js`](file:///c:/Program%20Files%20%28x86%29/Common%20Files/Adobe/CEP/extensions/Highlight-Studio/client/js/modules/Controls.js#L23-L32):
```javascript
applyLiveParamThrottled: function (paramName, val) {
    if (HS.Controls.liveParamTimers[paramName]) {
        cancelAnimationFrame(HS.Controls.liveParamTimers[paramName]);
    }
    HS.Controls.liveParamTimers[paramName] = requestAnimationFrame(function () {
        HS.Controls.applyLiveParam(paramName, val);
        delete HS.Controls.liveParamTimers[paramName];
    });
}
```
هذا يضمن أنه أثناء سحب المقابض أو النقر السريع، لا يتم إرسال طلب جديد إلا بعد انتهاء الإطار المرئي للشاشة (60fps)، مما يستحيل معه إغراق محرك After Effects.

---

## 4. جدول المقارنة: قبل وبعد تطبيق المعمارية المنضبطة

| المظهر | الطريقة التقليدية (العشوائية) | معمارية Highlight Studio المنضبطة |
|---|---|---|
| **تغيير المقاسات** | حذف الطبقات وإعادة بنائها مع كل بكسل | تعديل مباشر على Sliders الماستر في أجزاء من الثانية |
| **تقييم الإكسبريشن** | حساب متكرر مع كل خاصية يدوياً | معالجة ذرية دفعة واحدة داخل `beginUndoGroup` |
| **تبديل الحركة** | ترك إكسبريشنات قديمة تتعارض مع الجديدة | مسح شامل محدد (`removeTextTypewriter`) ثم زراعة الاستراتيجية الجديدة |
| **حركة الخروج** | اتجاه خروج واحد ثابت يؤدي لتصادم بصري | اتجاه خروج ثنائي (`1➔N` و `N➔1`) متزامن هندسياً مع الحروف |
| **استقرار البرنامج** | بطء ملحوظ وتجمد عند السرعة في النقر | استقرار تام واستهلاك متزن للذاكرة والمعالج |
