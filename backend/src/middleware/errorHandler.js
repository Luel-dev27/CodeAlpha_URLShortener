function notFound(_req, res) {
  return res.status(404).json({ success: false, error: 'Route not found' });
}

function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ success: false, error: status >= 500 ? 'Internal server error' : error.message });
}

module.exports = { notFound, errorHandler };
