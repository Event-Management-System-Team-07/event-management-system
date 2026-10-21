const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { registerForEvent } = require("../controllers/registrationController");

const router = express.Router();

// POST /api/events/:eventId/register
router.post(
  "/:eventId/register",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  registerForEvent
);

module.exports = router;