const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const app = require("../src/app");

const User = require("../src/models/User");
const Event = require("../src/models/Event");
const Registration = require("../src/models/Registration");
const ROLES = require("../src/constants/roles");

process.env.JWT_SECRET = "test-secret";

const userId = new mongoose.Types.ObjectId();
const eventId = new mongoose.Types.ObjectId();

const token = jwt.sign(
  { sub: userId.toString() },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

const auth = { Authorization: `Bearer ${token}` };
const path = `/api/events/${eventId}/register`;

const asRole = (role) =>
  jest.spyOn(User, "findById").mockResolvedValue(
    new User({
      _id: userId,
      name: "Test User",
      email: "test@example.com",
      passwordHash: "x",
      role,
    })
  );

const publishedEvent = (overrides = {}) => ({
  _id: eventId,
  status: "published",
  startDate: new Date(Date.now() + 86400000),
  capacity: 2,
  ...overrides,
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("POST /api/events/:eventId/register", () => {
  test("participant registers successfully -> 201", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Registration, "create").mockImplementation(async (data) => ({
      ...data,
      _id: new mongoose.Types.ObjectId(),
    }));

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Registration successful");
    expect(res.body.registration.status).toBe("active");
    expect(String(res.body.registration.user)).toBe(userId.toString());
  });

  test("no token -> 401", async () => {
    const res = await request(app).post(path);
    expect(res.status).toBe(401);
  });

  test("organizer cannot register as a participant -> 403", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app).post(path).set(auth);
    expect(res.status).toBe(403);
  });

  test("invalid event ID -> 400", async () => {
    asRole(ROLES.PARTICIPANT);

    const res = await request(app)
      .post("/api/events/not-an-id/register")
      .set(auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid event ID");
  });

  test("event does not exist -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(null);

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Event not found");
  });

  test("unpublished event -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ status: "draft" })
    );

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Registration is only available for published events"
    );
  });

  test("event has started -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ startDate: new Date(Date.now() - 1000) })
    );

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Registration deadline has passed");
  });

  test("event start-time cutoff is enforced -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ startDate: new Date(Date.now() - 1) })
    );

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Registration deadline has passed");
  });

  test("event starts exactly at the registration cutoff -> 400", async () => {
    jest.useFakeTimers();

    const now = new Date("2030-01-01T12:00:00.000Z");
    jest.setSystemTime(now);

    try {
      asRole(ROLES.PARTICIPANT);

      const boundaryToken = jwt.sign(
        { sub: userId.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const boundaryAuth = {
        Authorization: `Bearer ${boundaryToken}`,
      };

      jest.spyOn(Event, "findById").mockResolvedValue(
        publishedEvent({ startDate: now })
      );

      const createSpy = jest.spyOn(Registration, "create");

      const res = await request(app)
        .post(path)
        .set(boundaryAuth);

      expect(res.status).toBe(400);
      expect(createSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test("already actively registered -> 409", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue({
      status: "active",
    });

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "You are already registered for this event"
    );
  });

  test("event is full -> 409", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ capacity: 2 })
    );
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(2);

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Event is full");
  });

  test("one slot remaining -> registration succeeds", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(1);
    jest.spyOn(Registration, "create").mockImplementation(async (data) => ({
      ...data,
      _id: new mongoose.Types.ObjectId(),
    }));

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(201);
    expect(Registration.create).toHaveBeenCalledTimes(1);
  });

  test("active registration count filters out cancelled registrations", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());

    jest.spyOn(Registration, "findOne").mockResolvedValue(null);

    const countSpy = jest
      .spyOn(Registration, "countDocuments")
      .mockResolvedValue(1);

    jest.spyOn(Registration, "create").mockImplementation(async (data) => ({
      ...data,
      _id: new mongoose.Types.ObjectId(),
    }));

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(201);
    expect(countSpy).toHaveBeenCalledWith({
      event: eventId,
      status: "active",
    });
  });

  test("registration after cancellation is allowed when capacity remains", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ capacity: 2 })
    );
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(1);
    jest.spyOn(Registration, "create").mockImplementation(async (data) => ({
      ...data,
      _id: new mongoose.Types.ObjectId(),
    }));

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(201);
    expect(Registration.countDocuments).toHaveBeenCalledWith({
      event: eventId,
      status: "active",
    });
  });

  test("registration is rejected when active registrations equal capacity", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ capacity: 2 })
    );
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);

    const countSpy = jest
      .spyOn(Registration, "countDocuments")
      .mockResolvedValue(2);

    const createSpy = jest.spyOn(Registration, "create");

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Event is full");
    expect(countSpy).toHaveBeenCalledWith({
      event: eventId,
      status: "active",
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  test("database duplicate-key error -> 409", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Registration, "create").mockRejectedValue({
      code: 11000,
    });

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "You are already registered for this event"
    );
  });
});

describe("DELETE /api/events/:eventId/register", () => {
  test("participant cancels active registration -> 200", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());

    const registration = {
      user: userId,
      event: eventId,
      status: "active",
      save: jest.fn().mockImplementation(async function () {
        return this;
      }),
    };

    jest.spyOn(Registration, "findOne").mockResolvedValue(registration);

    const res = await request(app).delete(path).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Registration cancelled successfully");
    expect(registration.status).toBe("cancelled");
    expect(registration.save).toHaveBeenCalledTimes(1);
  });

  test("no token when cancelling -> 401", async () => {
    const res = await request(app).delete(path);
    expect(res.status).toBe(401);
  });

  test("invalid event ID when cancelling -> 400", async () => {
    asRole(ROLES.PARTICIPANT);

    const res = await request(app)
      .delete("/api/events/not-an-id/register")
      .set(auth);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid event ID");
  });

  test("event does not exist when cancelling -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(null);

    const res = await request(app).delete(path).set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Event not found");
  });

  test("no active registration to cancel -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);

    const res = await request(app).delete(path).set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(
      "No active registration found for this event"
    );
  });

  test("duplicate-key database error -> 409", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue(null);
    jest.spyOn(Registration, "countDocuments").mockResolvedValue(0);
    jest.spyOn(Registration, "create").mockRejectedValue({ code: 11000 });

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(
      "You are already registered for this event"
    );
  });
});