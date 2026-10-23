
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Registration = require("../models/Registration");

// POST /api/events/:eventId/register
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.status !== "published") {
      return res.status(400).json({
        message: "Registration is only available for published events",
      });
    }

    if (new Date() >= new Date(event.startDate)) {
      return res.status(400).json({
        message: "Registration deadline has passed",
      });
    }

    const existing = await Registration.findOne({
      user: req.user._id,
      event: event._id,
      status: "active",
    });

    if (existing) {
      return res.status(409).json({
        message: "You are already registered for this event",
      });
    }

    const activeCount = await Registration.countDocuments({
      event: event._id,
      status: "active",
    });

    if (activeCount >= event.capacity) {
      return res.status(409).json({ message: "Event is full" });
    }

    const registration = await Registration.create({
      user: req.user._id,
      event: event._id,
      status: "active",
    });

    return res.status(201).json({
      message: "Registration successful",
      registration,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({
        message: "You are already registered for this event",
      });
    }

    console.error("registerForEvent failed:", err.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};

// DELETE /api/events/:eventId/register
exports.cancelRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const registration = await Registration.findOne({
      user: req.user._id,
      event: event._id,
      status: "active",
    });

    if (!registration) {
      return res.status(404).json({
        message: "No active registration found for this event",
      });
    }

    registration.status = "cancelled";
    await registration.save();

    return res.status(200).json({
      message: "Registration cancelled successfully",
      registration,
    });
  } catch (err) {
    console.error("cancelRegistration failed:", err.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};
