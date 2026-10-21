const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { createEvent } = require("../controllers/eventController");

const router = express.Router();

router.post("/", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), createEvent);

module.exports = router;
