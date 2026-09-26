/**
 * HIGHLIGHT STUDIO — Unit Test Suite
 * Test: Typography & Line Start Alignment Invariant
 * 
 * Invariants Verified:
 * 1. In LTR Lines Mode, all box starting edges (Left) MUST form a 100% straight vertical line (leftOffset = 0).
 * 2. In RTL Lines Mode, all box starting edges (Right) MUST form a 100% straight vertical line (rightOffset = 0).
 * 3. Line end edges must remain dynamic and proportional to line text length + padding (pX).
 * 4. Justified lines must fill the full paragraph width without horizontal drift.
 * 5. Typewriter cumulative offsets (cOffsets / wOffsets) must adjust to start from the alignment baseline.
 */

const assert = require('assert');

function runTest() {
    console.log('\n[TEST SUITE] Typography & Flush Alignment Invariants');

    // Simulate TagManager lines mode logic
    function computeLineBoxes(scan, data) {
        var boxesData = [];
        var isCenter = (data.direction === 'center');
        var fallbackRTL = (data.direction === 'rtl');
        var mode = data.mode || 'lines';

        if (mode === "lines") {
            for (var k = 0; k < scan.numLines; k++) {
                var ld = scan.linesData[k];
                var rtl_k = isCenter ? false : ((data.direction === "auto") ? (scan.isJustified ? (scan.justifyType === "right") : false) : (data.direction === "rtl"));
                var cStart = (typeof ld.charStart === "number") ? ld.charStart : 0;
                var cEnd = (typeof ld.charEnd === "number") ? ld.charEnd : (cStart + ld.text.length);

                var boxWidth = ld.width;
                var lOff = (typeof ld.leftOffset === "number") ? ld.leftOffset : 0;
                var rOff = (typeof ld.rightOffset === "number") ? ld.rightOffset : 0;
                var cOff = (typeof ld.centerOffset === "number") ? ld.centerOffset : 0;
                var lineCOffsets = (ld.cOffsets && ld.cOffsets.length > 0) ? ld.cOffsets.slice(0) : [];
                var lineWOffsets = (ld.wOffsets && ld.wOffsets.length > 0) ? ld.wOffsets.slice(0) : [];

                if (!isCenter) {
                    if (scan.isJustified) {
                        if (scan.isJustifyFullAll || !ld.isLastOfPara) {
                            lOff = 0;
                            rOff = 0;
                            boxWidth = scan.fullW;
                        } else if (scan.justifyType === "right" || rtl_k) {
                            if (rOff > 0) {
                                boxWidth = Math.round((boxWidth + rOff) * 10) / 10;
                                if (lineCOffsets.length > 0) {
                                    for (var coR = 0; coR < lineCOffsets.length; coR++) {
                                        lineCOffsets[coR] = Math.round((lineCOffsets[coR] + rOff) * 10) / 10;
                                    }
                                }
                                if (lineWOffsets.length > 0) {
                                    for (var woR = 0; woR < lineWOffsets.length; woR++) {
                                        lineWOffsets[woR] = Math.round((lineWOffsets[woR] + rOff) * 10) / 10;
                                    }
                                }
                                rOff = 0;
                            }
                        } else if (scan.justifyType === "center") {
                            // center
                        } else {
                            if (lOff > 0) {
                                boxWidth = Math.round((boxWidth + lOff) * 10) / 10;
                                if (lineCOffsets.length > 0) {
                                    for (var coL = 0; coL < lineCOffsets.length; coL++) {
                                        lineCOffsets[coL] = Math.round((lineCOffsets[coL] + lOff) * 10) / 10;
                                    }
                                }
                                if (lineWOffsets.length > 0) {
                                    for (var woL = 0; woL < lineWOffsets.length; woL++) {
                                        lineWOffsets[woL] = Math.round((lineWOffsets[woL] + lOff) * 10) / 10;
                                    }
                                }
                                lOff = 0;
                            }
                        }
                    } else if (rtl_k) {
                        if (rOff > 0) {
                            boxWidth = Math.round((boxWidth + rOff) * 10) / 10;
                            if (lineCOffsets.length > 0) {
                                for (var coR2 = 0; coR2 < lineCOffsets.length; coR2++) {
                                    lineCOffsets[coR2] = Math.round((lineCOffsets[coR2] + rOff) * 10) / 10;
                                }
                            }
                            if (lineWOffsets.length > 0) {
                                for (var woR2 = 0; woR2 < lineWOffsets.length; woR2++) {
                                    lineWOffsets[woR2] = Math.round((lineWOffsets[woR2] + rOff) * 10) / 10;
                                }
                            }
                            rOff = 0;
                        }
                    } else {
                        if (lOff > 0) {
                            boxWidth = Math.round((boxWidth + lOff) * 10) / 10;
                            if (lineCOffsets.length > 0) {
                                for (var coL2 = 0; coL2 < lineCOffsets.length; coL2++) {
                                    lineCOffsets[coL2] = Math.round((lineCOffsets[coL2] + lOff) * 10) / 10;
                                }
                            }
                            if (lineWOffsets.length > 0) {
                                for (var woL2 = 0; woL2 < lineWOffsets.length; woL2++) {
                                    lineWOffsets[woL2] = Math.round((lineWOffsets[woL2] + lOff) * 10) / 10;
                                }
                            }
                            lOff = 0;
                        }
                    }
                }

                boxesData.push({
                    boxIndex: k,
                    text: ld.text,
                    width: boxWidth,
                    leftOffset: lOff,
                    rightOffset: rOff,
                    centerOffset: cOff,
                    rtl_k: rtl_k,
                    cOffsets: lineCOffsets,
                    wOffsets: lineWOffsets
                });
            }
        }
        return boxesData;
    }

    // 1. LTR Flush Left Verification
    var pX = 12;
    var rFullLTR = { left: 100.0, width: 350.0 };
    var scanLTR = {
        numLines: 5,
        fullW: 350.0,
        isJustified: false,
        linesData: [
            { text: 'This starts with T', width: 180.0, leftOffset: 0.0, cOffsets: [15, 30, 60, 120, 180], wOffsets: [60, 120, 180] },
            { text: 'license starts with lowercase', width: 220.0, leftOffset: 2.8, cOffsets: [12, 35, 80, 150, 220], wOffsets: [80, 150, 220] },
            { text: 'and conditions apply here', width: 200.0, leftOffset: 2.5, cOffsets: [10, 40, 90, 140, 200], wOffsets: [90, 140, 200] },
            { text: 'The second T line here', width: 190.0, leftOffset: 0.0, cOffsets: [15, 32, 70, 130, 190], wOffsets: [70, 130, 190] },
            { text: 'Software distribution model', width: 240.0, leftOffset: 1.9, cOffsets: [20, 60, 110, 180, 240], wOffsets: [110, 180, 240] }
        ]
    };

    var boxesLTR = computeLineBoxes(scanLTR, { direction: 'ltr', mode: 'lines' });
    var targetLeftEdge = (rFullLTR.left - pX);

    boxesLTR.forEach(function (b, i) {
        var curW = b.width + 2 * pX;
        var curX = (rFullLTR.left + b.leftOffset - pX) + curW / 2;
        var leftEdge = curX - curW / 2;
        var rightEdge = curX + curW / 2;

        // Invariant 1: Left edge must be 100% flush
        assert.strictEqual(leftEdge.toFixed(2), targetLeftEdge.toFixed(2), `LTR Line ${i + 1} left edge must be flush`);
        assert.strictEqual(b.leftOffset, 0, `LTR Line ${i + 1} leftOffset must be 0`);

        // Invariant 2: Right edge must end exactly after line text + pX
        var orig = scanLTR.linesData[i];
        var expectedRight = (rFullLTR.left + orig.leftOffset + orig.width) + pX;
        assert.strictEqual(rightEdge.toFixed(1), expectedRight.toFixed(1), `LTR Line ${i + 1} right edge mismatch`);

        // Invariant 3: Typewriter cOffsets last element must equal box width
        var lastCharW = b.cOffsets[b.cOffsets.length - 1];
        assert.strictEqual(lastCharW.toFixed(1), b.width.toFixed(1), `LTR Line ${i + 1} last cOffset must match box width`);
    });
    console.log('  ✓ LTR: All lines 100% flush vertically on the left; endings are dynamic');

    // 2. RTL Flush Right Verification
    var rFullRTL = { left: 40.0, width: 400.0 }; // right edge = 440.0
    var scanRTL = {
        numLines: 3,
        fullW: 400.0,
        isJustified: false,
        linesData: [
            { text: 'سطر أول طويل هنا', width: 250.0, rightOffset: 0.0, cOffsets: [30, 80, 150, 250], wOffsets: [80, 150, 250] },
            { text: 'هذا سطر ثاني قصير', width: 160.0, rightOffset: 2.7, cOffsets: [20, 60, 110, 160], wOffsets: [60, 110, 160] },
            { text: 'خاتمة النص العربي', width: 190.0, rightOffset: 1.2, cOffsets: [25, 75, 130, 190], wOffsets: [75, 130, 190] }
        ]
    };

    var boxesRTL = computeLineBoxes(scanRTL, { direction: 'rtl', mode: 'lines' });
    var targetRightEdge = (rFullRTL.left + rFullRTL.width + pX);

    boxesRTL.forEach(function (b, i) {
        var curW = b.width + 2 * pX;
        var rFullRight = rFullRTL.left + rFullRTL.width;
        var curX = (rFullRight - b.rightOffset + pX) - curW / 2;
        var leftEdge = curX - curW / 2;
        var rightEdge = curX + curW / 2;

        // Invariant 1: Right edge must be 100% flush
        assert.strictEqual(rightEdge.toFixed(2), targetRightEdge.toFixed(2), `RTL Line ${i + 1} right edge must be flush`);
        assert.strictEqual(b.rightOffset, 0, `RTL Line ${i + 1} rightOffset must be 0`);

        // Invariant 2: Left edge must end exactly after line text start - pX
        var orig = scanRTL.linesData[i];
        var expectedLeft = (rFullRight - orig.rightOffset - orig.width) - pX;
        assert.strictEqual(leftEdge.toFixed(1), expectedLeft.toFixed(1), `RTL Line ${i + 1} left edge mismatch`);

        // Invariant 3: Typewriter cOffsets last element must equal box width
        var lastCharW = b.cOffsets[b.cOffsets.length - 1];
        assert.strictEqual(lastCharW.toFixed(1), b.width.toFixed(1), `RTL Line ${i + 1} last cOffset must match box width`);
    });
    console.log('  ✓ RTL: All lines 100% flush vertically on the right; endings are dynamic');

    // 3. Justified Full Paragraph Verification
    var scanJustified = {
        numLines: 3,
        fullW: 380.0,
        isJustified: true,
        isJustifyFullAll: true,
        justifyType: 'full',
        linesData: [
            { text: 'Line 1 justified', width: 380.0, leftOffset: 0.0, isLastOfPara: false, cOffsets: [50, 150, 380] },
            { text: 'Line 2 justified', width: 380.0, leftOffset: 1.5, isLastOfPara: false, cOffsets: [40, 180, 380] },
            { text: 'Line 3 justified', width: 380.0, leftOffset: 2.0, isLastOfPara: true, cOffsets: [60, 200, 380] }
        ]
    };

    var boxesJustified = computeLineBoxes(scanJustified, { direction: 'ltr', mode: 'lines' });
    boxesJustified.forEach(function (b, i) {
        assert.strictEqual(b.width, 380.0, `Justified line ${i + 1} width must equal full paragraph width`);
        assert.strictEqual(b.leftOffset, 0, `Justified line ${i + 1} left offset must be 0`);
        assert.strictEqual(b.rightOffset, 0, `Justified line ${i + 1} right offset must be 0`);
    });
    console.log('  ✓ Justified: All lines span 100% full paragraph width flush on both sides');

    console.log('✓ All Typography & Alignment Invariants Passed Successfully!\n');
    return true;
}

if (require.main === module) {
    runTest();
}

module.exports = runTest;
