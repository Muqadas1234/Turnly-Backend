// Usage (PowerShell):
//   $env:TOKEN="<jwt>"; node scripts/ws-watch.js [doctorId] [YYYY-MM-DD]
const WebSocket = require('ws');

const token = process.env.TOKEN;
if (!token) { console.error('Set $env:TOKEN first'); process.exit(1); }

const host = process.env.WS_HOST || 'ws://localhost:3000';
const ws = new WebSocket(`${host}/ws?token=${token}`);

const doctorId = process.argv[2];
const date = process.argv[3] || new Date().toISOString().slice(0, 10);

ws.on('open', () => console.log('[ws] connected'));

ws.on('message', (data) => {
  const text = data.toString();
  console.log('[ws] <-', text);
  let m; try { m = JSON.parse(text); } catch (_) { return; }
  if (m.event === 'ready' && doctorId) {
    ws.send(JSON.stringify({ type: 'subscribe', doctor_id: Number(doctorId), date }));
    console.log(`[ws] subscribe sent: doctor ${doctorId}, ${date}`);
  }
});