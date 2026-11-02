require('dotenv').config();
const { createApp } = require('./app');

const port = Number.parseInt(process.env.PORT || '5000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

const { app, db } = createApp();
const server = app.listen(port, () => console.log(`URL shortener listening on port ${port}`));
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);
  server.close((error) => {
    try { db.close(); } catch (closeError) { console.error(closeError); process.exitCode = 1; }
    if (error) { console.error(error); process.exitCode = 1; }
  });
  setTimeout(() => { console.error('Graceful shutdown timed out'); process.exit(1); }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
