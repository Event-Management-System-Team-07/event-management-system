const mongoose = require("mongoose");
const User = require("../models/User");
const ROLES = require("../constants/roles");

const PUBLIC_FIELDS = "name email role createdAt updatedAt";
const ASSIGNABLE_ROLES = [ROLES.PARTICIPANT, ROLES.ORGANIZER];

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({}).select(PUBLIC_FIELDS).sort({ createdAt: -1 });
    return res.status(200).json({ users });
  } catch (err) {
    console.error("admin list users failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

exports.getUser = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(req.params.id).select(PUBLIC_FIELDS);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user });
  } catch (err) {
    console.error("admin get user failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    if (!ASSIGNABLE_ROLES.includes(req.body?.role)) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { role: "Role must be Participant or Organizer" },
      });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(409).json({ message: "Administrators cannot change their own role" });
    }
    if (user.role === ROLES.ADMIN) {
      return res.status(403).json({ message: "Administrator roles cannot be changed here" });
    }
    user.role = req.body.role;
    await user.save();
    return res.status(200).json({ message: "User role updated", user });
  } catch (err) {
    console.error("admin update user role failed:", err.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};
