<p align="center">
  <img src="docs/hero_banner.jpg" alt="Highlight Studio — Professional Text Highlighting for After Effects" width="100%" />
</p>

<h1 align="center">⚡ Highlight Studio 2.0</h1>

<p align="center">
  <strong>The Ultimate Text Highlighting & Caption Motion Suite for Adobe After Effects</strong><br/>
  <sub>Interactive word-by-word selection, multi-color cumulative highlights, Hormozi elastic bounces, Vox speed-ramp wipes, and custom presets.</sub>
</p>

<p align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-▶-FFE600?style=for-the-badge&logoColor=black" alt="Quick Start"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0D99FF?style=for-the-badge" alt="License: MIT"/></a>
  <a href="#-compatibility"><img src="https://img.shields.io/badge/After_Effects-CC_2017+-9999FF?style=for-the-badge&logo=adobeaftereffects&logoColor=white" alt="AE Compatibility"/></a>
  <a href="#"><img src="https://img.shields.io/badge/CEP-Panel-2ECC71?style=for-the-badge" alt="CEP Panel"/></a>
</p>

---

## ✨ What is Highlight Studio?

**Highlight Studio** is a modular CEP panel for Adobe After Effects that generates animated, perfectly-aligned highlight containers behind your text — **per-line, per-sentence, or per-word**. 

It eliminates tedious manual shape alignment and expression setup, supporting **Arabic, Hebrew, Latin**, mixed BiDi paragraphs, and dynamic text resizing without ever altering or distorting the original `Source Text`.

---

## 🎬 Key Features

### 🔤 1. Interactive Word Tokens Board & Phrase Highlighting
- **Click & Drag Multi-Selection** — Select individual words, click & drag across tokens, or `Shift+Click` for ranges.
- **Cumulative Multi-Color Highlights (Additive Mode)** — Highlight word A in green, word B in yellow, and word C in cyan on the same text layer without clearing previous phrases.
- **Active Phrases Tray** — Displays all applied phrase highlights in AE with color dots and **1-click deletion (`✕`)** for individual phrases.
- **Visual Word Indicators** — Applied words are marked with colored underlines directly on the token board.

### 🎢 2. Advanced Motion Dynamics (Physics-Based)
- **Hormozi Elastic Overshoot (`pop`)** — Mathematically continuous ($C^0/C^1$) harmonic damped spring bounce ($decay = 7.5, freq = 4.2, amp = 18.0$) settling cleanly to 100% with zero frame jumping.
- **Smooth Vox Speed-Ramp (`wipe`)** — Punchy 25% attack followed by silky 80% cinematic deceleration.
- **Typewriter Sync (`typewriter`)** — Character-proportional progression linked to the text Range Selector.
- **Instant Snap Cut (`snap`)** — 0-frame jump cut for high-energy social edits.

### ⏱️ 3. Phrase Outro & Hold Timing
- **Dedicated Outro Toggle** — Enable auto-exit animations for phrases.
- **Hold Duration Stepper** — Customize how long each phrase remains highlighted before smoothly fading or retracting.
- **Sequential (`SEQ`) Highlighting** — Highlight words in cascading order for lyric videos and reels.

### 💾 4. Custom Presets System & Persistence
- **One-Click Preset Creation (`+ Preset`)** — Save favorite color, padding, roundness, and motion settings as reusable presets.
- **LocalStorage Persistence** — Custom presets survive panel reloads and After Effects restarts.
- **Live Preview & Deletion** — Custom presets show their unique color badge with quick deletion (`✕`).

### 🎯 5. Intelligent Text Analysis & BiDi Engine
- **Zero Text Distortion** — Non-destructive subpixel measurement without injecting brackets `[...]` or modifying text.
- **Full BiDi & Justification Awareness** — Handles RTL (Arabic, Hebrew), LTR, Center, and Full Justified text with subpixel character tracking.
- **Two-Way Live Sync** — Panel controls reflect AE layers instantly; scrubbing parameters updates AE in real-time.

---

## 🚀 Quick Start

### Installation

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/wittybrandcode/Highlight-Studio.git
   ```

2. **Copy the folder** to your CEP extensions directory:

   | OS | Path |
   |---|---|
   | **Windows** | `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\` |
   | **macOS** | `/Library/Application Support/Adobe/CEP/extensions/` |

3. **Enable unsigned extensions**:
   - **Windows**: In `regedit`, navigate to `HKEY_CURRENT_USER\SOFTWARE\Adobe\CSXS.11` (or your version) and set `PlayerDebugMode` to `1` (String).
   - **macOS**: In Terminal:
     ```bash
     defaults write com.adobe.CSXS.11 PlayerDebugMode 1
     ```

4. **Restart After Effects** → Go to `Window` → `Extensions` → **Highlight-Studio**.

---

## 🎮 Workflow & Shortcuts

### Highlighting Full Paragraphs & Lines
1. Select a Text Layer in your AE composition.
2. Under the **Paragraph & Lines** tab, choose a Preset or customize Shape, Color, Padding, and Motion.
3. Click **Apply Highlight** (or `Click`).

### Highlighting Specific Phrases / Words
1. Switch to the **Phrase Highlight** tab.
2. Click or drag to select target words in the interactive tokens board.
3. Choose a color and animation style, then click **Apply Phrase Highlight**.
4. Repeat with different colors to create colorful multi-word highlights on the same layer!

### Keyboard & Mouse Shortcuts

| Action | Shortcut |
|---|---|
| **Reload Panel** | `F5` or `Ctrl+R` |
| **Clear Highlights** | `Alt+Click` or `Right-Click` on Apply button |
| **Token Range Selection** | `Shift+Click` on tokens in Words Board |
| **Drag Multi-Select** | `Click & Drag` across word tokens |
| **Precision Stepper Adjust** | `Shift` (×10) or `Alt` (×0.1) while clicking arrows or mouse-wheel scrubbing |
| **Interactive Scrubbing** | `Click & Drag` horizontally on input labels (Pad X, Radius, etc.) |

---

## 🏗️ Modular Architecture

```
Highlight-Studio/
├── CSXS/
│   └── manifest.xml          # CEP Extension manifest
├── client/
│   ├── index.html            # Dark industrial UI (zero radius, high-contrast)
│   ├── css/
│   │   └── style.css         # Industrial design tokens & animations
│   └── js/
│       ├── CSInterface.js    # Adobe CEP bridge
│       └── app.js            # Modular client namespaces (HS.State, HS.Presets, HS.PhraseManager)
├── host/
│   ├── hostscript.jsx        # Modular host aggregator
│   └── modules/
│       ├── Config.jsx        # Shared constants & tags
│       ├── Utils.jsx         # Math, color conversions & JSON helpers
│       ├── TextScanner.jsx   # Line wrapping, justification & subpixel character offsets
│       ├── InvisibleAnchors.jsx # Non-destructive text anchor system
│       ├── HighlightBuilder.jsx # Full-line shape generation & expressions
│       ├── TagManager.jsx    # Word-level phrase highlights & applied tray engine
│       ├── TypewriterEngine.jsx # Dynamic typewriter synchronization
│       └── ControllerBridge.jsx # Fast two-way parameter sync
├── docs/
│   ├── ROADMAP_AND_EXECUTION_PLAN.md
│   └── hero_banner.jpg
└── README.md
```

---

## 🌍 Language & BiDi Support

| Feature | Status |
|---|---|
| Arabic | ✅ Full RTL support with Kashida & subpixel kerning |
| Hebrew | ✅ Full RTL support |
| Latin (English, French, etc.) | ✅ Full LTR support |
| Mixed BiDi (Arabic + English) | ✅ Per-line auto-direction detection |
| Center alignment | ✅ Centered box positioning |
| Justified text | ✅ Full-width line detection |

---

## 🔌 Compatibility

| Requirement | Minimum Version |
|---|---|
| Adobe After Effects | CC 2017 (v14.0) up to 2026+ |
| CEP Runtime | CSXS 7.0+ |
| OS | Windows 10/11 / macOS 10.14+ |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

