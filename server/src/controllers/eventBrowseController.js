const mongoose = require("mongoose");
const Event = require("../models/Event");
const ROLES = require("../constants/roles");
const { logError } = require("../utils/safeLogger");

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

const toPositiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

// Makes user text safe to use inside a regular expression.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Returns a clean string, or "" when the value is missing or not a plain string.
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

// GET /api/events  (any logged-in user)
// Published events only, soonest first.
// Optional: ?search= ?category= ?from= ?to= ?page= ?limit=
exports.listEvents = async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const filter = { status: "published" };

    const search = cleanText(req.query.search).slice(0, MAX_SEARCH_LENGTH);
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ title: pattern }, { description: pattern }, { venue: pattern }];
    }

    const category = cleanText(req.query.category);
    if (category) {
      filter.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
    }

    const from = cleanText(req.query.from);
    const to = cleanText(req.query.to);
    const range = {};
    if (from) {
      const d = new Date(from);
      if (isNaN(d)) return res.status(400).json({ message: "from must be a valid date" });
      range.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d)) return res.status(400).json({ message: "to must be a valid date" });
      range.$lte = d;
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte)
      return res.status(400).json({ message: "from cannot be after to" });
    if (range.$gte || range.$lte) filter.startDate = range;

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ startDate: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return res.json({ events, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    logError("listEvents.failed", err);
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
    logError("getEventById.failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
