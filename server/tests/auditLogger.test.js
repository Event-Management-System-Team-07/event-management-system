const AuditLog = require("../src/models/AuditLog");
const { recordEventAction } = require("../src/services/auditLogger");

afterEach(() => jest.restoreAllMocks());

describe("recordEventAction", () => {
  test("stores the actor, action, and event reference without event payloads", async () => {
    const actorId = "507f1f77bcf86cd799439011";
    const eventId = "507f191e810c19729de860ea";
    const create = jest.spyOn(AuditLog, "create").mockResolvedValue({});

    await recordEventAction({ actorId, action: "event.published", eventId });

    expect(create).toHaveBeenCalledWith({
      actor: actorId,
      action: "event.published",
      resourceType: "Event",
      resourceId: eventId,
    });
  });

  test("does not persist actions outside the allowlist", async () => {
    const create = jest.spyOn(AuditLog, "create");

    await expect(
      recordEventAction({ actorId: "actor", action: "user.password_changed", eventId: "event" })
    ).rejects.toThrow("Unsupported audit action");
    expect(create).not.toHaveBeenCalled();
  });
});
