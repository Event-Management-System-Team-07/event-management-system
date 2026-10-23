const mongoose = require("mongoose");
const Event = require("../models/Event");
const ROLES = require("../constants/roles");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const toPositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// GET /api/events  (any logged-in user) - published events only, soonest first
exports.listEvents = async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const filter = { status: "published" };

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ startDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return res.json({ events, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("listEvents failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// GET /api/events/:id  (any logged-in user; drafts only for the owner or an Admin)
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid event id" });

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.status === "draft") {
      const isOwner = event.organizer.toString() === req.user._id.toString();
      if (!isOwner && req.user.role !== ROLES.ADMIN)
        return res.status(404).json({ message: "Event not found" });
    }

    return res.json({ event });
  } catch (err) {
    console.error("getEventById failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
