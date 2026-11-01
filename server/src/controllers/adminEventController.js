const mongoose = require("mongoose");
const Event = require("../models/Event");

const PAGE_SIZE = 50;
const VALID_STATUSES = ["draft", "published", "cancelled"];

exports.listEvents = async (req, res) => {
  try {
    // Default to page 1 only when the page query is not provided.
    const rawPage = req.query.page;
    const page = rawPage === undefined ? 1 : Number(rawPage);

    // Reject zero, negative, decimal, and non-numeric page values.
    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({
        message: "page must be a positive integer",
      });
    }

    const filter = {};

    // Validate the status query parameter.
    // This also rejects repeated status parameters, which Express parses as an array.
    if (req.query.status !== undefined) {
      if (
        typeof req.query.status !== "string" ||
        !VALID_STATUSES.includes(req.query.status)
      ) {
        return res.status(400).json({
          message: "Invalid event status",
        });
      }

      filter.status = req.query.status;
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate("organizer", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE),

      Event.countDocuments(filter),
    ]);

    return res.status(200).json({
      events,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    console.error("admin list events failed:", err.message);

    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};

exports.getEvent = async (req, res) => {
  try {
    // Check whether the supplied event ID is a valid MongoDB ObjectId.
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid event id",
      });
    }

    const event = await Event.findById(req.params.id).populate(
      "organizer",
      "name email",
    );

    if (!event) {
      return res.status(404).json({
        message: "Event not found",
      });
    }

    return res.status(200).json({ event });
  } catch (err) {
    console.error("admin get event failed:", err.message);

    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};
