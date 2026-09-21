/**
 * HIGHLIGHT STUDIO — State Module
 * Central reactive runtime state repository.
 */
(function (window) {
    "use strict";

    var HS = window.HS || {};
    window.HS = HS;

    HS.State = {
        scope: "all",               // "all" | "line"
        mainTab: "paragraph",       // "paragraph" | "phrases"
        outroOrder: "first",        // "first" (1->N) | "last" (N->1)
        lastUserInteraction: 0,
        lastSyncedLayer: "",
        lastTokensRawText: null,
        phraseTokens: [],
        selectedTokenIndices: [],
        lastClickedTokenIndex: -1,
        isDraggingTokenSelect: false,
        dragSelectActive: true,
        appliedPhrases: []
    };

    // Mark user interaction timestamp to prevent background polling overwrites
    HS.markInteraction = function () {
        HS.State.lastUserInteraction = Date.now();
    };
})(window);
