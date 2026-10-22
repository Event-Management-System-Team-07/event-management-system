const mongoose = require("mongoose");
const Event = require("../models/Event");
const ROLES = require("../constants/roles");
const { validateEventInput } = require("../validators/eventValidator");

// Only these fields can be set by the client (organizer and status are controlled by the server).
const EDITABLE = ["title", "description", "category", "venue", "startDate", "endDate", "capacity"];

const pick = (obj, keys) =>
  keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

// POST /api/events  (Organizer or Admin)
exports.createEvent = async (req, res) => {
  try {
    const errors = validateEventInput(req.body);
    if (errors.length) return res.status(400).json({ message: "Validation failed", errors });

    const event = await Event.create({
      ...pick(req.body, EDITABLE),
      organizer: req.user._id,
      status: "draft",
    });
    return res.status(201).json({ message: "Event created", event });
  } catch (err) {
    console.error("createEvent failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// PUT /api/events/:id  (owner Organizer, or Admin)
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid event id" });

    const event = await Event.findById(id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isOwner = event.organizer.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== ROLES.ADMIN)
      return res.status(403).json({ message: "You can only edit your own events" });

    if (event.status === "cancelled")
      return res.status(409).json({ message: "Cancelled events cannot be edited" });

    const errors = validateEventInput(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ message: "Validation failed", errors });

    Object.assign(event, pick(req.body, EDITABLE));
    if (event.endDate < event.startDate)
      return res.status(400).json({ message: "endDate cannot be before startDate" });

    await event.save();
    return res.json({ message: "Event updated", event });
  } catch (err) {
    console.error("updateEvent failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
