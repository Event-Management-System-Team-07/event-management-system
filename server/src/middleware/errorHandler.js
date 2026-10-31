const { logError } = require("../utils/safeLogger");

// SEC-03 (SR-004): last line of defence. Clients only ever see short, generic JSON.
// No stack trace, file path, database message or secret is sent in any response.

function notFound(req, res) {
  res.status(404).json({ message: "Resource not found" });
}

// Express needs all 4 arguments to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err && (err.status || err.statusCode);

  // Client mistakes raised by express.json() (bad JSON, body too large, ...)
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    let message = "Bad request";
    if (err.type === "entity.parse.failed") message = "Invalid JSON in request body";
    else if (err.type === "entity.too.large") message = "Request body is too large";
    return res.status(status).json({ message });
  }

  logError("request.unhandled_error", err);
  return res.status(500).json({ message: "Something went wrong. Please try again." });
}

module.exports = { notFound, errorHandler };
