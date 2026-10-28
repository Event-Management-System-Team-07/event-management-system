const { findUnsafeFields, containsUnsafeKey } = require("../utils/validators");

// SEC-02: server-side input validation. The browser/client is never trusted: these checks run on the server.

const badRequest = (res, errors) => res.status(400).json({ message: "Validation failed", errors });

// Gathers the unsafe fields of one part of the request (body or query) into `errors`.
// Returns true if anything unsafe was found.
function collect(source, label, errors) {
  const fields = findUnsafeFields(source);
  fields.forEach((field) => {
    errors[field] = "Invalid input";
  });
  // e.g. the whole body is an array that contains an operator object
  if (fields.length === 0 && containsUnsafeKey(source)) {
    errors[label] = "Invalid input";
    return true;
  }
  return fields.length > 0;
}

// Runs for EVERY request (mounted in app.js right after express.json()).
// Rejects bodies and query strings that contain MongoDB operators such as { "$gt": "" } or "a.b" keys,
// so injection-style input never reaches a controller or the database.
function rejectUnsafeInput(req, res, next) {
  // null prototype: a field literally named "__proto__" is then stored like any other key
  const errors = Object.create(null);
  const badBody = collect(req.body, "body", errors);
  const badQuery = collect(req.query, "query", errors);
  if (badBody || badQuery) {
    return badRequest(res, errors);
  }
  return next();
}

// For a single route: validateBody(fn). fn receives the body and returns an object of
// { fieldName: "message" } errors, or an empty object when the input is valid.
//
//   router.post("/events", authenticate, validateBody(validateEvent), createEvent);
function validateBody(validateFn) {
  if (typeof validateFn !== "function") {
    throw new TypeError("validateBody() needs a function that returns an errors object");
  }
  return (req, res, next) => {
    let errors;
    try {
      errors = validateFn(req.body && typeof req.body === "object" ? req.body : {}) || {};
    } catch (err) {
      return next(err);
    }
    if (Object.keys(errors).length > 0) {
      return badRequest(res, errors);
    }
    return next();
  };
}

// Error handler: must be added AFTER the routes. Turns body-parser failures into clean JSON
// responses instead of the default HTML error page. Anything else is passed on untouched.
function handleBodyParseErrors(err, req, res, next) {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  return next(err);
}

module.exports = { rejectUnsafeInput, validateBody, handleBodyParseErrors };
