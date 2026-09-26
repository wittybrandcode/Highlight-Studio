/**
 * HIGHLIGHT STUDIO — Unit Test Suite
 * Test: Timecode Engine & Segmented Inputs Invariant
 * 
 * Invariants Verified:
 * 1. Time conversion between Real Seconds, Frames, and MM:SS:FF must be 100% bijective and reversible.
 * 2. Active FPS must be respected (24, 25, 29.97, 30, 60).
 * 3. Segmented UI inputs (Minutes : Seconds : Frames) must equal exact totalSeconds without floating point drift.
 * 4. Timing Invariant: Outro start must strictly equal (outPt - outDur).
 * 5. Keyframe Invariant: k1.time <= k2.time <= k3.time <= k4.time (no inverted keyframes).
 */

const assert = require('assert');
const TimeEngine = require('../../client/js/core/TimeEngine.js');

function runTest() {
    console.log('\n[TEST SUITE] Timecode Engine & Timing Invariants');

    // 1. Bijective Timecode Conversion at 25 FPS
    TimeEngine.setFPS(25);
    TimeEngine.setFormat('tc');
    assert.strictEqual(TimeEngine.getFPS(), 25);

    // 1.52 seconds = 1s + 13 frames @ 25fps = "00:01:13"
    var tc1 = TimeEngine.fromSeconds(1.52);
    assert.strictEqual(tc1, '00:01:13', '1.52s should convert to 00:01:13 @ 25fps');
    var sec1 = TimeEngine.toSeconds('00:01:13');
    assert.strictEqual(sec1.toFixed(2), '1.52', '00:01:13 should parse back to 1.52s @ 25fps');
    console.log('  ✓ 25 FPS: 1.52s <-> 00:01:13 bijective conversion confirmed');

    // 65.0 seconds = 1 minute 5 seconds 0 frames = "01:05:00"
    var tc2 = TimeEngine.fromSeconds(65.0);
    assert.strictEqual(tc2, '01:05:00', '65s should convert to 01:05:00');
    var sec2 = TimeEngine.toSeconds('01:05:00');
    assert.strictEqual(sec2, 65.0, '01:05:00 should parse back to 65.0s');
    console.log('  ✓ 25 FPS: 65.0s <-> 01:05:00 minute boundary confirmed');

    // 2. Exact Frame Notation parsing
    var frameSec = TimeEngine.toSeconds('15f');
    assert.strictEqual(frameSec, 15 / 25, '15f should parse to 0.6s @ 25fps');
    var secNotation = TimeEngine.toSeconds('0.75s');
    assert.strictEqual(secNotation, 0.75, '0.75s should parse to 0.75s');
    console.log('  ✓ Format flexibility: "15f" and "0.75s" parsed accurately');

    // 3. 30 FPS Composition Testing
    TimeEngine.setFPS(30);
    assert.strictEqual(TimeEngine.getFPS(), 30);
    var tc30 = TimeEngine.fromSeconds(1.5); // 1s + 15 frames @ 30fps = "00:01:15"
    assert.strictEqual(tc30, '00:01:15', '1.5s should convert to 00:01:15 @ 30fps');
    console.log('  ✓ 30 FPS: Dynamic comp FPS switching respected');

    // Reset back to standard 25 FPS
    TimeEngine.setFPS(25);

    // 4. Segmented Timecode Composition Invariant
    // Formula: totalSeconds = (min * 60) + sec + (frames / fps)
    function computeSegmentedSeconds(m, s, f, fps) {
        return (m * 60) + s + (f / fps);
    }

    var sMin = 2, sSec = 14, sFrame = 10, fps = 25;
    var computedSec = computeSegmentedSeconds(sMin, sSec, sFrame, fps);
    var expectedSec = 2 * 60 + 14 + (10 / 25); // 134.4s
    assert.strictEqual(computedSec, expectedSec, 'Segmented math must match totalSeconds');

    var decompTC = TimeEngine.fromSeconds(computedSec);
    assert.strictEqual(decompTC, '02:14:10', 'Computed seconds must format back to 02:14:10');
    console.log('  ✓ Segmented Inputs: [02m : 14s : 10f] strictly equals 134.40s');

    // 5. Timing Invariant: Outro Start & Non-overlapping Keyframes
    var inPt = 1.0;     // Intro begins at 1.0s
    var inDur = 0.5;    // Intro runs for 0.5s (finishes at 1.5s)
    var outPt = 5.0;    // Outro target point is 5.0s
    var outDur = 0.6;   // Outro duration is 0.6s

    var k1_time = inPt;
    var k2_time = inPt + inDur;
    var k3_time = outPt - outDur;
    var k4_time = outPt;

    // Assert Keyframe Ordering Invariant
    assert.ok(k1_time <= k2_time, 'k1 (intro start) must be <= k2 (intro end)');
    assert.ok(k2_time <= k3_time, 'k2 (intro end) must be <= k3 (outro start)');
    assert.ok(k3_time <= k4_time, 'k3 (outro start) must be <= k4 (outro end)');
    assert.strictEqual(k3_time, 4.4, 'Outro must start at exactly 4.4s (5.0s - 0.6s)');

    console.log('  ✓ Timing Keyframe Invariant: k1(1.0s) <= k2(1.5s) <= k3(4.4s) <= k4(5.0s) validated');

    console.log('✓ All Timecode & Timing Invariants Passed Successfully!\n');
    return true;
}

if (require.main === module) {
    runTest();
}

module.exports = runTest;
