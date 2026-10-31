const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { logError } = require("../utils/safeLogger");

// AUTH-02: authentication middleware.
// Expects the header:  Authorization: Bearer <token>   (token comes from POST /api/auth/login)
// On success it sets req.user to the logged-in user (a Mongoose document without passwordHash),
// so any later handler can read req.user._id, req.user.email and req.user.role.

const unauthorized = (res, message) => res.status(401).json({ message });

// Returns the token string, or null if the header is missing or not in "Bearer <token>" form.
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) return null;
  return parts[1];
}

async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return unauthorized(res, "Authentication required");
    }

    // A server misconfiguration, not the caller's fault -> handled as a 500 below
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not set");
    }

    let payload;
    try {
      // algorithms is pinned so a token cannot pick its own (weaker) algorithm
      payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return unauthorized(res, "Session expired. Please log in again.");
      }
      if (err.name === "JsonWebTokenError" || err.name === "NotBeforeError") {
        // bad signature, malformed token, wrong algorithm, etc.
        return unauthorized(res, "Invalid token");
      }
      throw err;
    }

    // login() puts the user's _id in "sub". It must be a plain string that is a valid ObjectId.
    const userId = payload && payload.sub;
    if (typeof userId !== "string" || !mongoose.Types.ObjectId.isValid(userId)) {
      return unauthorized(res, "Invalid token");
    }

    // The role is read from the database on every request (not from the token),
    // so a role change or a deleted account takes effect immediately.
    const user = await User.findById(userId);
    if (!user) {
      return unauthorized(res, "Invalid token");
    }

    req.user = user;
    return next();
  } catch (err) {
    logError("authenticate.failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

module.exports = authenticate;
