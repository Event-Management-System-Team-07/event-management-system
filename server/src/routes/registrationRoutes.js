
const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");

const {
  registerForEvent,
  cancelRegistration,
  getRegistrationHistory,
} = require("../controllers/registrationController");

const router = express.Router();

// GET /api/events/registrations/history
router.get(
  "/registrations/history",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  getRegistrationHistory
);

// POST /api/events/:eventId/register
router.post(
  "/:eventId/register",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  registerForEvent
);

// DELETE /api/events/:eventId/register
router.delete(
  "/:eventId/register",
  authenticate,
  authorize(ROLES.PARTICIPANT),
  cancelRegistration
);

module.exports = router;
