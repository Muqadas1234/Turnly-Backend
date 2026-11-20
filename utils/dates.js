// All booking dates are plain 'YYYY-MM-DD' strings in the hospital timezone (APP_TIMEZONE)
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TZ = () => process.env.APP_TIMEZONE || 'Asia/Karachi';

function todayStr(tz = TZ()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function nowMinutes(tz = TZ()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === 'hour').value) * 60 + Number(parts.find((p) => p.type === 'minute').value);
}

const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
const isHM = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const parseHM = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const weekday = (d) => DAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
const diffDays = (a, b) => Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);

module.exports = { DAYS, todayStr, nowMinutes, isDateStr, isHM, parseHM, weekday, diffDays };
