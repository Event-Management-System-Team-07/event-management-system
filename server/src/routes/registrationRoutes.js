
const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const {
  registerForEvent,
  cancelRegistration,
} = require("../controllers/registrationController");

const router = express.Router();

router.post(
  "/:eventId/register",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  registerForEvent
);

router.delete(
  "/:eventId/register",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  cancelRegistration
);

module.exports = router;
