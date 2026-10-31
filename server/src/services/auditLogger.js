const AuditLog = require("../models/AuditLog");

const EVENT_ACTIONS = new Set([
  "event.created",
  "event.updated",
  "event.published",
  "event.cancelled",
]);

async function recordEventAction({ actorId, action, eventId }) {
  if (!EVENT_ACTIONS.has(action)) throw new Error("Unsupported audit action");
  if (!actorId || !eventId) throw new Error("Audit actor and event are required");

  try {
    return await AuditLog.create({
      actor: actorId,
      action,
      resourceType: "Event",
      resourceId: eventId,
    });
  } catch (err) {
    // Do not report a failed event mutation after it has already been saved.
    // The failure itself is logged without including database error details.
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "audit.write_failed",
      errorType: err && typeof err.name === "string" ? err.name : "Error",
    }));
    return null;
  }
}

module.exports = { recordEventAction };
