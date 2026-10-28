const LEVELS = Object.freeze({ info: "info", warn: "warn", error: "error" });

function write(level, event, details = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level: LEVELS[level],
    event,
    ...details,
  };
  const output = JSON.stringify(record);
  if (level === "error") return console.error(output);
  if (level === "warn") return console.warn(output);
  return console.log(output);
}

function error(event, err) {
  return write("error", event, {
    errorType: err && typeof err.name === "string" ? err.name : "Error",
    ...(err && typeof err.code === "string" ? { errorCode: err.code } : {}),
  });
}

module.exports = {
  info: (event, details) => write("info", event, details),
  warn: (event, details) => write("warn", event, details),
  error,
};
