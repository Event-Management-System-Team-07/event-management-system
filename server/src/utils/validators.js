// SEC-02: small reusable input checks. Use these in controllers and routes instead of re-writing them.
// Every function returns true/false (or a list) and never throws, whatever the input is.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const MAX_DEPTH = 10;

const isNonEmptyString = (value, { min = 1, max = 1000 } = {}) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

const isEmail = (value) => typeof value === "string" && value.length <= 254 && EMAIL_REGEX.test(value.trim());

// Only a 24-character hex string (a real MongoDB _id), never an object like { $ne: null }.
const isObjectId = (value) => typeof value === "string" && OBJECT_ID_REGEX.test(value);

const isIntegerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

// A key is unsafe if MongoDB or JavaScript would treat it as something special:
//   "$gt", "$ne"  -> MongoDB query operators (NoSQL injection)
//   "a.b"         -> MongoDB dotted path
//   "a[$ne]"      -> bracket-style operator in a query string
//   "__proto__"   -> prototype pollution
const isUnsafeKey = (key) => key.startsWith("$") || key.includes(".") || key.includes("[$") || key === "__proto__";

// True if any key, at any depth, is unsafe. Absurdly deep objects are rejected instead of walked.
function containsUnsafeKey(value, depth = 0) {
  if (value === null || typeof value !== "object") return false;
  if (depth >= MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeKey(item, depth + 1));
  return Object.keys(value).some((key) => isUnsafeKey(key) || containsUnsafeKey(value[key], depth + 1));
}

// For a request body or query: the names of its top-level fields that are, or contain, an unsafe key.
function findUnsafeFields(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj).filter((key) => isUnsafeKey(key) || containsUnsafeKey(obj[key]));
}

module.exports = {
  isNonEmptyString,
  isEmail,
  isObjectId,
  isIntegerInRange,
  isUnsafeKey,
  containsUnsafeKey,
  findUnsafeFields,
};
