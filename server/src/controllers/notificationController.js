const Notification = require("../models/Notification");

// GET /api/notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
    })
      .populate("event", "title status startDate endDate venue")
      .sort({ createdAt: -1 });

    return res.status(200).json({ notifications });
  } catch (err) {
    console.error("getMyNotifications failed:", err.message);
    return res.status(500).json({
      message: "Something went wrong. Please try again.",
    });
  }
};
