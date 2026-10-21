const Event = require("../models/Event");
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
