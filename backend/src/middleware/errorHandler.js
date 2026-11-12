function notFound(_req, res) {
  return res.status(404).json({ success: false, error: "Route not found" });
}

function errorHandler(error, _req, res, next) {
  if (res.headersSent) return next(error);
  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
  if (status >= 500) console.error(error);

  let message = error.message;
  if (status >= 500) message = "Internal server error";
  else if (status === 413) message = "Request body exceeds the 10 KB limit";
  else if (error.type === "entity.parse.failed")
    message = "Malformed JSON request body";
  return res.status(status).json({ success: false, error: message });
}

export { notFound, errorHandler };
