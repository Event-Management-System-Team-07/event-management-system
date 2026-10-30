const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { listUsers, getUser, updateUserRole } = require("../controllers/adminUserController");

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN));
router.get("/", listUsers);
router.get("/:id", getUser);
router.patch("/:id/role", updateUserRole);

module.exports = router;
