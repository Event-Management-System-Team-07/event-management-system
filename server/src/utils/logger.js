const LEVELS = Object.freeze({ info: "info", warn: "warn", error: "error" });
const EVENT_NAME = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_]*)+$/;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_REASON = new Set(["invalid_credentials"]);
const SAFE_ERROR_TYPE = /^(?:Error|[A-Z][A-Za-z0-9]*Error)$/;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,39}$/;

function safeDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};

  const safe = {};
  if (typeof details.actorId === "string" && SAFE_ID.test(details.actorId)) {
    safe.actorId = details.actorId;
  }
  if (typeof details.reason === "string" && SAFE_REASON.has(details.reason)) {
    safe.reason = details.reason;
  }
  if (Number.isInteger(details.port) && details.port >= 0 && details.port <= 65535) {
    safe.port = details.port;
  }
  if (typeof details.errorType === "string" && SAFE_ERROR_TYPE.test(details.errorType)) {
    safe.errorType = details.errorType;
  }
  if (
    (typeof details.errorCode === "string" && SAFE_ERROR_CODE.test(details.errorCode)) ||
    (Number.isInteger(details.errorCode) && details.errorCode >= 0)
  ) {
    safe.errorCode = details.errorCode;
  }
  return safe;
}

function write(level, event, details = {}) {
  if (!Object.hasOwn(LEVELS, level)) throw new TypeError("Unsupported log severity");
  if (typeof event !== "string" || !EVENT_NAME.test(event)) {
    throw new TypeError("Log event names must be stable dotted identifiers");
  }

  const record = {
    ...safeDetails(details),
    timestamp: new Date().toISOString(),
    level: LEVELS[level],
    event,
  };
  const output = JSON.stringify(record);
  if (level === "error") return console.error(output);
  if (level === "warn") return console.warn(output);
  return console.log(output);
}

function error(event, err) {
  return write("error", event, {
    errorType:
      err && typeof err.name === "string" && SAFE_ERROR_TYPE.test(err.name)
        ? err.name
        : "Error",
    ...(err &&
    ((typeof err.code === "string" && SAFE_ERROR_CODE.test(err.code)) ||
      (Number.isInteger(err.code) && err.code >= 0))
      ? { errorCode: err.code }
      : {}),
  });
}

module.exports = {
  info: (event, details) => write("info", event, details),
  warn: (event, details) => write("warn", event, details),
  error,
};
