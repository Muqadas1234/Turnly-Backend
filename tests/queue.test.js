const test = require('node:test');
const assert = require('node:assert');
const { sortWaiting, estimateWait, nextAverage } = require('../utils/queue');

test('priority tokens jump the queue, then token number order', () => {
    const q = sortWaiting([
        { token_number: 10, priority: 0 }, { token_number: 11, priority: 0 },
        { token_number: 14, priority: 1 }, { token_number: 12, priority: 1 },
    ]);
    assert.deepStrictEqual(q.map((t) => t.token_number), [12, 14, 10, 11]);
});

test('wait estimate = average consultation time x patients ahead', () => {
    assert.strictEqual(estimateWait(3, 7), 21);
    assert.strictEqual(estimateWait(0, 7), 0);
});

test('running average is clamped and smoothed', () => {
    assert.strictEqual(nextAverage(null, 8), 8);
    assert.strictEqual(nextAverage(10, 5), 9);
    assert.strictEqual(nextAverage(10, 500), 20); // clamped to 60 -> 10*.8 + 60*.2
    assert.strictEqual(nextAverage(10, 0), 8.2);  // clamped to 1
});
