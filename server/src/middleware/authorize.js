const ROLES = require("../constants/roles");

// AUTH-03: role-based authorization.
// Always put authenticate BEFORE authorize, because authorize reads req.user:
//
//   router.get("/admin/users", authenticate, authorize(ROLES.ADMIN), listUsers);
//   router.post("/events",     authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), createEvent);
//
// 401 = not logged in (no req.user)   |   403 = logged in, but the role is not allowed.

const VALID_ROLES = Object.values(ROLES);

function authorize(...allowedRoles) {
  // Fail loudly at start-up if a route is wired with a typo like authorize("admin")
  if (allowedRoles.length === 0 || !allowedRoles.every((r) => VALID_ROLES.includes(r))) {
    throw new Error(`authorize() needs one or more valid roles: ${VALID_ROLES.join(", ")}`);
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    return next();
  };
}

module.exports = authorize;
