// EVENT-03 tests: publish and cancel event.
// The database is stubbed with jest.spyOn, so these run anywhere without MongoDB.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
jest.mock("../src/services/auditLogger", () => ({ recordEventAction: jest.fn().mockResolvedValue(null) }));
const app = require("../src/app");
const User = require("../src/models/User");
const Event = require("../src/models/Event");
const Registration = require("../src/models/Registration");
const Notification = require("../src/models/Notification");
const ROLES = require("../src/constants/roles");
const { recordEventAction } = require("../src/services/auditLogger");

process.env.JWT_SECRET = "test-secret";

const userId = new mongoose.Types.ObjectId().toString();
const otherId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
const auth = { Authorization: `Bearer ${token}` };

const asRole = (role) =>
  jest.spyOn(User, "findById").mockResolvedValue(
    new User({ _id: userId, name: "Test User", email: "t@example.com", passwordHash: "x", role })
  );

const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
const goodBody = {
  title: "Tech Fest",
  description: "Annual college tech fest",
  venue: "Main Auditorium",
  startDate: future(7),
  endDate: future(8),
  capacity: 100,
};

const makeEvent = (overrides = {}) => {
  const ev = new Event({
    _id: new mongoose.Types.ObjectId(),
    ...goodBody,
    organizer: userId,
    status: "draft",
    ...overrides,
  });
  jest.spyOn(ev, "save").mockResolvedValue(ev);
  return ev;
};

let transactionSession;

beforeEach(() => {
  recordEventAction.mockClear();
  const registrationQuery = {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockResolvedValue([]),
  };
  jest.spyOn(Registration, "find").mockReturnValue(registrationQuery);
  jest.spyOn(Notification, "insertMany").mockResolvedValue([]);
  jest.spyOn(Event, "updateOne").mockResolvedValue({ matchedCount: 1 });
  transactionSession = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  jest.spyOn(mongoose, "startSession").mockResolvedValue(transactionSession);
});

afterEach(() => jest.restoreAllMocks());

describe("PATCH /api/events/:id/publish", () => {
  test("owner publishes a draft event -> 200, status published", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("published");
    expect(ev.save).toHaveBeenCalled();
  });

  test("Admin can publish someone else's event -> 200", async () => {
    asRole(ROLES.ADMIN);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("published");
  });

  test("organizer cannot publish someone else's event -> 403", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(403);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("already published -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "published" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(409);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("cancelled event cannot be published -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "cancelled" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(409);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("event that already ended cannot be published -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({
      startDate: new Date("2020-01-01T10:00:00Z"),
      endDate: new Date("2020-01-02T10:00:00Z"),
    });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/publish`).set(auth);
    expect(res.status).toBe(409);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("Participant -> 403, event not even loaded", async () => {
    asRole(ROLES.PARTICIPANT);
    const find = jest.spyOn(Event, "findById");
    const res = await request(app)
      .patch(`/api/events/${new mongoose.Types.ObjectId()}/publish`)
      .set(auth);
    expect(res.status).toBe(403);
    expect(find).not.toHaveBeenCalled();
  });

  test("no token -> 401", async () => {
    const res = await request(app).patch(`/api/events/${new mongoose.Types.ObjectId()}/publish`);
    expect(res.status).toBe(401);
  });

  test("event not found -> 404", async () => {
    asRole(ROLES.ORGANIZER);
    jest.spyOn(Event, "findById").mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/events/${new mongoose.Types.ObjectId()}/publish`)
      .set(auth);
    expect(res.status).toBe(404);
  });

  test("malformed id -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app).patch("/api/events/not-an-id/publish").set(auth);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/events/:id/cancel", () => {
  test("owner cancels a draft event -> 200, status cancelled", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("cancelled");
    expect(res.body.notificationsCreated).toBe(0);
    expect(Notification.insertMany).not.toHaveBeenCalled();
    expect(Event.updateOne).toHaveBeenCalledWith(
      { _id: ev._id, status: { $ne: "cancelled" } },
      { $set: { status: "cancelled" } },
      { session: transactionSession }
    );
  });

  test("cancelling an event notifies multiple active registrants", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "published" });
    const participantIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    Registration.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockResolvedValue(participantIds.map((user) => ({ user }))),
    });

    const res = await request(app)
      .patch(`/api/events/${ev._id}/cancel`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.notificationsCreated).toBe(2);
    expect(Registration.find).toHaveBeenCalledWith({ event: ev._id, status: "active" });
    const [notifications, options] = Notification.insertMany.mock.calls[0];
    expect(notifications).toHaveLength(2);
    expect(notifications.map(({ recipient }) => recipient)).toEqual(participantIds);
    expect(notifications).toEqual(
      participantIds.map((recipient) =>
        expect.objectContaining({
          recipient,
          event: ev._id,
          type: "event_cancelled",
          message: `The event "${ev.title}" has been cancelled.`,
        }),
      ),
    );
    expect(options).toEqual({ session: transactionSession });
  });

  test("does not notify cancelled registrations", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "published" });
    const activeParticipantId = new mongoose.Types.ObjectId();

    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    Registration.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockResolvedValue([{ user: activeParticipantId }]),
    });

    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);

    expect(res.status).toBe(200);
    expect(Registration.find).toHaveBeenCalledWith({ event: ev._id, status: "active" });
    expect(Notification.insertMany.mock.calls[0][0].map(({ recipient }) => recipient)).toEqual([
      activeParticipantId,
    ]);
  });

  test("notification insertion failure leaves the event unchanged", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "published" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    Registration.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockResolvedValue([{ user: new mongoose.Types.ObjectId() }]),
    });
    Notification.insertMany.mockRejectedValue(new Error("database details must stay private"));

    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Something went wrong. Please try again.");
    expect(ev.status).toBe("published");
    expect(Event.updateOne).not.toHaveBeenCalled();
    expect(recordEventAction).not.toHaveBeenCalled();
    expect(transactionSession.endSession).toHaveBeenCalledTimes(1);
  });

  test("owner cancels a published event -> 200", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "published" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("cancelled");
    expect(res.body.notificationsCreated).toBe(0);
  });

  test("Admin can cancel someone else's event -> 200", async () => {
    asRole(ROLES.ADMIN);
    const ev = makeEvent({ organizer: otherId, status: "published" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("cancelled");
    expect(res.body.notificationsCreated).toBe(0);
  });

  test("organizer cannot cancel someone else's event -> 403", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);
    expect(res.status).toBe(403);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("already cancelled -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "cancelled" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).patch(`/api/events/${ev._id}/cancel`).set(auth);
    expect(res.status).toBe(409);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("Participant -> 403", async () => {
    asRole(ROLES.PARTICIPANT);
    const res = await request(app)
      .patch(`/api/events/${new mongoose.Types.ObjectId()}/cancel`)
      .set(auth);
    expect(res.status).toBe(403);
  });

  test("no token -> 401", async () => {
    const res = await request(app).patch(`/api/events/${new mongoose.Types.ObjectId()}/cancel`);
    expect(res.status).toBe(401);
  });

  test("event not found -> 404", async () => {
    asRole(ROLES.ORGANIZER);
    jest.spyOn(Event, "findById").mockResolvedValue(null);
    const res = await request(app)
      .patch(`/api/events/${new mongoose.Types.ObjectId()}/cancel`)
      .set(auth);
    expect(res.status).toBe(404);
  });

  test("malformed id -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app).patch("/api/events/not-an-id/cancel").set(auth);
    expect(res.status).toBe(400);
  });
});

describe("a cancelled event stays locked for edits", () => {
  test("edit after cancel -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "cancelled" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ title: "Too late" });
    expect(res.status).toBe(409);
  });
});
