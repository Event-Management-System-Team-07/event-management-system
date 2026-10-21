const bcrypt = require("bcryptjs");

// SEC-01: the one place where passwords are hashed and checked.
//
// - bcrypt is a one-way hash: a hash cannot be turned back into the password.
// - bcrypt creates a new random salt for every hash and stores it inside the hash string,
//   so two users with the same password get different hashes (no separate salt field needed).
// - The plain password is never stored or logged. Only the hash goes to the database.
const BCRYPT_ROUNDS = 10;

// Used when no stored hash exists (e.g. unknown email) so that case takes about as long
// as a wrong password. Otherwise response time would reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

async function hashPassword(plainPassword) {
  if (typeof plainPassword !== "string" || plainPassword.length === 0) {
    throw new TypeError("Password must be a non-empty string");
  }
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

// Returns true only if plainPassword matches storedHash. Never throws for bad input.
async function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== "string" || plainPassword.length === 0) return false;
  const hasHash = typeof storedHash === "string" && storedHash.length > 0;
  try {
    const matches = await bcrypt.compare(plainPassword, hasHash ? storedHash : DUMMY_HASH);
    return hasHash && matches;
  } catch (err) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, BCRYPT_ROUNDS };
