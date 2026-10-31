const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: ["event.created", "event.updated", "event.published", "event.cancelled"],
    },
    resourceType: { type: String, required: true, enum: ["Event"] },
    resourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { versionKey: false }
);

auditLogSchema.index({ occurredAt: -1, action: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
