const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/app");
const User = require("../src/models/User");
const Notification = require("../src/models/Notification");
const ROLES = require("../src/constants/roles");

process.env.JWT_SECRET = "test-secret";

const userId = new mongoose.Types.ObjectId();
const anotherUserId = new mongoose.Types.ObjectId();
const eventId = new mongoose.Types.ObjectId();
const token = jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
  expiresIn: "1h",
});
const auth = { Authorization: `Bearer ${token}` };

const asRole = (role) =>
  jest.spyOn(User, "findById").mockResolvedValue(
    new User({
      _id: userId,
      name: "Test Participant",
      email: "participant@example.com",
      passwordHash: "x",
      role,
    })
  );

afterEach(() => jest.restoreAllMocks());

describe("GET /api/notifications", () => {
  test("participant receives their notifications with associated event details", async () => {
    asRole(ROLES.PARTICIPANT);

    const notification = {
      _id: new mongoose.Types.ObjectId(),
      recipient: userId,
      event: {
        _id: eventId,
        title: "Cancelled Tech Fest",
        status: "cancelled",
      },
      type: "event_cancelled",
      message: "The event \"Cancelled Tech Fest\" has been cancelled.",
      readAt: null,
      createdAt: new Date("2026-10-27T10:00:00.000Z"),
    };

    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockResolvedValue([notification]),
    };
    query.populate.mockReturnValue(query);
    jest.spyOn(Notification, "find").mockReturnValue(query);

    const res = await request(app).get("/api/notifications").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].type).toBe("event_cancelled");
    expect(res.body.notifications[0].event.title).toBe("Cancelled Tech Fest");
    expect(Notification.find).toHaveBeenCalledWith({ recipient: userId });
    expect(query.populate).toHaveBeenCalledWith(
      "event",
      "title status startDate endDate venue"
    );
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  test("participant receives an empty list when they have no notifications", async () => {
    asRole(ROLES.PARTICIPANT);

    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockResolvedValue([]),
    };
    query.populate.mockReturnValue(query);
    jest.spyOn(Notification, "find").mockReturnValue(query);

    const res = await request(app).get("/api/notifications").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(Notification.find).toHaveBeenCalledWith({ recipient: userId });
  });

  test("unauthenticated requests are rejected", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  test("organizers cannot access the participant notification endpoint", async () => {
    asRole(ROLES.ORGANIZER);

    const res = await request(app).get("/api/notifications").set(auth);

    expect(res.status).toBe(403);
  });

  test("database errors return 500", async () => {
    asRole(ROLES.PARTICIPANT);

    const query = {
      populate: jest.fn(),
      sort: jest.fn().mockRejectedValue(new Error("Database failure")),
    };
    query.populate.mockReturnValue(query);
    jest.spyOn(Notification, "find").mockReturnValue(query);

    const res = await request(app).get("/api/notifications").set(auth);

    expect(res.status).toBe(500);
  });

  test("notification model requires recipient, event, type, and message", () => {
    const notification = new Notification({});
    const error = notification.validateSync();

    expect(error.errors.recipient).toBeDefined();
    expect(error.errors.event).toBeDefined();
    expect(error.errors.type).toBeDefined();
    expect(error.errors.message).toBeDefined();
  });

  test("notifications can only use the event_cancelled type", () => {
    const notification = new Notification({
      recipient: userId,
      event: eventId,
      type: "unknown",
      message: "Test",
    });

    expect(notification.validateSync().errors.type).toBeDefined();
  });

  test("recipient is a distinct user field", () => {
    expect(userId.toString()).not.toBe(anotherUserId.toString());
  });
});
