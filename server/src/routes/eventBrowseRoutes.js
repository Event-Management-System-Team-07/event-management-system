const express = require("express");
const authenticate = require("../middleware/authenticate");
const { listEvents, getEventById } = require("../controllers/eventBrowseController");

const router = express.Router();

router.get("/", authenticate, listEvents);
router.get("/:id", authenticate, getEventById);

module.exports = router;
