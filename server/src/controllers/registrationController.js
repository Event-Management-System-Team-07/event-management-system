const mongoose = require("mongoose");
const Event = require("../models/Event");
const Registration = require("../models/Registration");
const ROLES = require("../constants/roles");
const {
  TransactionSupportError,
  assertTransactionSupport,
  isMockTest,
  touchBackfillLock,
} = require("../db/registrationIntegrity");
const logger = require("../utils/logger");

const duplicateRegistrationResponse = (res) =>
  res.status(409).json({
    message: "You are already registered for this event",
  });

async function registerWithTransaction(event, userId) {
  await assertTransactionSupport();
  const session = await mongoose.startSession();
  let registration;

  try {
    await session.withTransaction(async () => {
      await touchBackfillLock(session);
      const reservedEvent = await Event.findOneAndUpdate(
        {
          _id: event._id,
          status: "published",
          $expr: {
            $lt: [
              { $ifNull: ["$activeRegistrations", 0] },
              "$capacity",
            ],
          },
        },
        { $inc: { activeRegistrations: 1 } },
        { new: true, session }
      );

      if (!reservedEvent) {
        const error = new Error("Event is full");
        error.code = "EVENT_FULL";
        throw error;
      }

      [registration] = await Registration.create(
        [{ user: userId, event: event._id, status: "active" }],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  return registration;
}

async function registerWithMocks(event, userId) {
  const activeCount = await Registration.countDocuments({
    event: event._id,
    status: "active",
  });
  if (activeCount >= event.capacity) {
    const error = new Error("Event is full");
    error.code = "EVENT_FULL";
    throw error;
  }

  return Registration.create({
    user: userId,
    event: event._id,
    status: "active",
  });
}

// POST /api/events/:eventId/register
exports.registerForEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

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
    if (existing) return duplicateRegistrationResponse(res);

    const registration = isMockTest()
      ? await registerWithMocks(event, req.user._id)
      : await registerWithTransaction(event, req.user._id);

    return res.status(201).json({
      message: "Registration successful",
      registration,
    });
  } catch (err) {
    if (err && err.code === 11000) return duplicateRegistrationResponse(res);
    if (err && err.code === "EVENT_FULL") {
      return res.status(409).json({ message: "Event is full" });
    }
    if (err instanceof TransactionSupportError) {
      logger.error("registrations.register_database_unavailable", err);
      return res.status(503).json({
        message: "Registration service is temporarily unavailable.",
      });
    }

    logger.error("registrations.register_failed", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};

async function cancelWithTransaction(eventId, userId) {
  await assertTransactionSupport();
  const session = await mongoose.startSession();
  let registration;

  try {
    await session.withTransaction(async () => {
      await touchBackfillLock(session);
      registration = await Registration.findOneAndUpdate(
        { user: userId, event: eventId, status: "active" },
        { $set: { status: "cancelled" } },
        { new: true, session }
      );

      if (!registration) return;

      const counterUpdate = await Event.updateOne(
        { _id: eventId, activeRegistrations: { $gt: 0 } },
        { $inc: { activeRegistrations: -1 } },
        { session }
      );
      if (counterUpdate.matchedCount !== 1) {
        const error = new Error(
          "Registration counter is inconsistent with the active registration"
        );
        error.code = "COUNTER_INCONSISTENT";
        throw error;
      }
    });
  } finally {
    await session.endSession();
  }

  return registration;
}

// DELETE /api/events/:eventId/register
exports.cancelRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    let registration;
    if (isMockTest()) {
      registration = await Registration.findOne({
        user: req.user._id,
        event: event._id,
        status: "active",
      });
      if (registration) {
        registration.status = "cancelled";
        await registration.save();
      }
    } else {
      registration = await cancelWithTransaction(event._id, req.user._id);
    }

    if (!registration) {
      return res.status(404).json({
        message: "No active registration found for this event",
      });
    }

    return res.status(200).json({
      message: "Registration cancelled successfully",
      registration,
    });
  } catch (err) {
    if (err instanceof TransactionSupportError) {
      logger.error("registrations.cancel_database_unavailable", err);
      return res.status(503).json({
        message: "Registration service is temporarily unavailable.",
      });
    }
    if (err && err.code === "COUNTER_INCONSISTENT") {
      logger.error("registrations.cancel_failed", err);
      return res.status(500).json({
        message: "Something went wrong. Please try again.",
      });
    }

    logger.error("registrations.cancel_failed", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};

// GET /api/events/registrations/history
exports.getRegistrationHistory = async (req, res) => {
  try {
    const registrations = await Registration.find({
      user: req.user._id,
    })
      .populate("event")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      registrations,
    });
  } catch (err) {
    logger.error("registrations.history_failed", err);

    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};

// GET /api/events/:eventId/registrations (event organizer or admin)
exports.getEventRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isOwner = event.organizer.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ message: "You can only view registrations for your own events" });
    }

    const registrations = await Registration.find({ event: event._id, status: "active" })
      .select("user createdAt")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      eventId: event._id,
      registrationCount: registrations.length,
      registrations,
    });
  } catch (err) {
    logger.error("registrations.event_list_failed", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
