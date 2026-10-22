const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { createEvent, updateEvent } = require("../controllers/eventController");

const router = express.Router();

router.post("/", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), createEvent);
router.put("/:id", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), updateEvent);

module.exports = router;
