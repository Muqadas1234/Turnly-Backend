const test = require('node:test');
const assert = require('node:assert');
const { isDateStr, isHM, parseHM, weekday, diffDays, todayStr } = require('../utils/dates');

test('date and time validators', () => {
    assert.ok(isDateStr('2026-11-15'));
    assert.ok(!isDateStr('2026-13-40'));
    assert.ok(!isDateStr('15-11-2026'));
    assert.ok(isHM('09:30') && isHM('23:59'));
    assert.ok(!isHM('9:30') && !isHM('24:00'));
    assert.strictEqual(parseHM('10:30'), 630);
});

test('weekday and day difference', () => {
    assert.strictEqual(weekday('2026-11-15'), 'Sun');
    assert.strictEqual(weekday('2026-11-16'), 'Mon');
    assert.strictEqual(diffDays('2026-11-22', '2026-11-15'), 7);
});

test('todayStr returns YYYY-MM-DD', () => {
    assert.match(todayStr('Asia/Karachi'), /^\d{4}-\d{2}-\d{2}$/);
});
