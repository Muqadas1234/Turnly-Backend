// Small helpers shared by the new controllers

class AppError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

// Wrap async handlers so a thrown AppError / rejected promise reaches the global error handler
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Positive integer or null (ids in this project are SERIAL integers)
const toInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const needId = (v, label = 'id') => {
    const n = toInt(v);
    if (!n) throw new AppError(400, `Invalid ${label}`);
    return n;
};

module.exports = { AppError, h, toInt, needId };
