const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { getMyNotifications } = require("../controllers/notificationController");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  getMyNotifications
);

module.exports = router;
