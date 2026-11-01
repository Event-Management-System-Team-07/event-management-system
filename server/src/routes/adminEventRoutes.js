const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const ROLES = require("../constants/roles");
const { listEvents, getEvent } = require("../controllers/adminEventController");

const router = express.Router();
router.use(authenticate, authorize(ROLES.ADMIN));
router.get("/", listEvents);
router.get("/:id", getEvent);

module.exports = router;
