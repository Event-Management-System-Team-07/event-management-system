const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const {
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
} = require("../controllers/eventController");

const router = express.Router();

router.post("/", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), createEvent);
router.put("/:id", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), updateEvent);
router.patch("/:id/publish", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), publishEvent);
router.patch("/:id/cancel", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), cancelEvent);

module.exports = router;
