const mongoose = require("mongoose");
const Event = require("../models/Event");
const ROLES = require("../constants/roles");
const { validateEventInput } = require("../validators/eventValidator");
const logger = require("../utils/logger");
const { recordEventAction } = require("../services/auditLogger");

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
    await recordEventAction({ actorId: req.user._id, action: "event.created", eventId: event._id });
    return res.status(201).json({ message: "Event created", event });
  } catch (err) {
    logger.error("events.create_failed", err);
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
    await recordEventAction({ actorId: req.user._id, action: "event.updated", eventId: event._id });
    return res.json({ message: "Event updated", event });
  } catch (err) {
    logger.error("events.update_failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// Loads an event and checks the caller may change it. Returns the event, or null after sending the error response.
async function loadManageableEvent(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid event id" });
    return null;
  }
  const event = await Event.findById(id);
  if (!event) {
    res.status(404).json({ message: "Event not found" });
    return null;
  }
  const isOwner = event.organizer.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== ROLES.ADMIN) {
    res.status(403).json({ message: "You can only manage your own events" });
    return null;
  }
  return event;
}

// PATCH /api/events/:id/publish  (owner Organizer, or Admin)
exports.publishEvent = async (req, res) => {
  try {
    const event = await loadManageableEvent(req, res);
    if (!event) return;

    if (event.status === "published")
      return res.status(409).json({ message: "Event is already published" });
    if (event.status === "cancelled")
      return res.status(409).json({ message: "Cancelled events cannot be published" });
    if (event.endDate < new Date())
      return res.status(409).json({ message: "An event that has already ended cannot be published" });

    event.status = "published";
    await event.save();
    await recordEventAction({ actorId: req.user._id, action: "event.published", eventId: event._id });
    return res.json({ message: "Event published", event });
  } catch (err) {
    logger.error("events.publish_failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

// PATCH /api/events/:id/cancel  (owner Organizer, or Admin)
exports.cancelEvent = async (req, res) => {
  try {
    const event = await loadManageableEvent(req, res);
    if (!event) return;

    if (event.status === "cancelled")
      return res.status(409).json({ message: "Event is already cancelled" });

    event.status = "cancelled";
    await event.save();
    await recordEventAction({ actorId: req.user._id, action: "event.cancelled", eventId: event._id });
    return res.json({ message: "Event cancelled", event });
  } catch (err) {
    logger.error("events.cancel_failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
