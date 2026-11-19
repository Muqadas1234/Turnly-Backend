// Pure queue helpers (no database) so they can be unit-tested

// Priority tokens (priority = 1) are served first, then by token number
function sortWaiting(tokens) {
    return [...tokens].sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.token_number - b.token_number);
}

// Waiting-time formula from the project plan: average consultation time x patients ahead
const estimateWait = (ahead, avgMinutes) => Math.round(ahead * avgMinutes);

// Running average of consultation length (clamped to 1..60 minutes)
function nextAverage(prevAvg, durationMinutes) {
    const d = Math.min(60, Math.max(1, durationMinutes));
    if (!prevAvg) return Math.round(d * 10) / 10;
    return Math.round((prevAvg * 0.8 + d * 0.2) * 10) / 10;
}

module.exports = { sortWaiting, estimateWait, nextAverage };
