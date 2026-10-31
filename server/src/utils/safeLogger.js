// SEC-03 (SR-004): one place for logging errors without leaking secrets.
// Only the error type, code and a redacted message are written, never the stack,
// request body, headers or environment values.

const REDACTED = "[REDACTED]";

function redact(text) {
  if (typeof text !== "string") return "";
  let out = text;

  // Exact secret values from the environment (e.g. the JWT secret)
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 4) out = out.split(secret).join(REDACTED);

  return out
    // mongodb://user:password@host -> credentials removed
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, `$1${REDACTED}@`)
    // Authorization: Bearer <token>
    .replace(/(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, `$1${REDACTED}`)
    // JWT-looking strings (three base64url parts)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, REDACTED)
    // bcrypt hashes
    .replace(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/g, REDACTED)
    // password=..., token: ..., secret=... style pairs
    .replace(/((?:password|passwd|pwd|token|secret|authorization)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi, `$1${REDACTED}`);
}

function logError(event, err) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    errorType: err && typeof err.name === "string" ? err.name : "Error",
  };
  if (err && (typeof err.code === "string" || typeof err.code === "number")) {
    entry.code = err.code;
  }
  if (err && typeof err.message === "string") {
    entry.message = redact(err.message).slice(0, 300);
  }
  console.error(JSON.stringify(entry));
}

module.exports = { logError, redact };
