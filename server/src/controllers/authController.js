const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ROLES = require("../constants/roles");

// Roles a person may pick for themselves at sign-up. Admin is never self-registered.
const SELF_REGISTER_ROLES = [ROLES.PARTICIPANT, ROLES.ORGANIZER];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

const isString = (value) => typeof value === "string";

function validateRegistration({ name, email, password }) {
  const errors = {};
  if (!isString(name) || name.trim().length < 2 || name.trim().length > 100) {
    errors.name = "Name must be 2 to 100 characters";
  }
  if (!isString(email) || email.length > 254 || !EMAIL_REGEX.test(email.trim())) {
    errors.email = "A valid email address is required";
  }
  // bcrypt only uses the first 72 bytes, so we cap the length
  if (!isString(password) || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    errors.password = "Password must be 8 to 72 characters";
  }
  return errors;
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { name, email, password, role } = req.body || {};

    const errors = validateRegistration({ name, email, password });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    let userRole = ROLES.PARTICIPANT;
    if (role !== undefined) {
      if (role === ROLES.ADMIN) {
        return res.status(403).json({ message: "Admin accounts cannot be self-registered" });
      }
      if (!SELF_REGISTER_ROLES.includes(role)) {
        return res.status(400).json({
          message: "Validation failed",
          errors: { role: "Role must be Participant or Organizer" },
        });
      }
      userRole = role;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
    });

    return res.status(201).json({ message: "Registration successful", user });
  } catch (err) {
    // 11000 = duplicate key (two people registering the same email at the same moment)
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    console.error("register failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    // Must be plain strings: stops objects like { "$gt": "" } reaching the database query
    if (!isString(email) || !isString(password) || !email.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));

    // Same message whether the email or the password was wrong
    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // The token only carries the user's MongoDB _id. The middleware (AUTH-02) looks up the role.
    const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    return res.status(200).json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("login failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
}

module.exports = { register, login };
