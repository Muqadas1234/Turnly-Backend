// Tiny in-memory rate limiter (per IP + route). Good enough for a single server; use Redis for multiple instances.
const hits = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
}, 60 * 1000).unref();

module.exports = ({ windowMs = 15 * 60 * 1000, max = 20 } = {}) => (req, res, next) => {
    const key = `${req.ip}|${req.baseUrl}${req.path}`;
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < now) e = { count: 0, reset: now + windowMs };
    e.count += 1;
    hits.set(key, e);
    if (e.count > max) {
        res.set('Retry-After', String(Math.ceil((e.reset - now) / 1000)));
        return res.status(429).json({ success: false, message: 'Too many attempts. Please try again in a few minutes.' });
    }
    next();
};
