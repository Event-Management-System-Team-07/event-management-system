
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

const future = new Date(Date.now() + 86400000);

const publishedEvent = (overrides = {}) => ({
  _id: eventId,
  status: "published",
  startDate: future,
  capacity: 2,
  ...overrides,
});

afterEach(() => jest.restoreAllMocks());

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
  });

  test("event does not exist -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(null);

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(404);
  });

  test("unpublished event -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ status: "draft" })
    );

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(400);
  });

  test("event has started -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(
      publishedEvent({ startDate: new Date(Date.now() - 1000) })
    );

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(400);
  });

  test("already actively registered -> 409", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(publishedEvent());
    jest.spyOn(Registration, "findOne").mockResolvedValue({
      status: "active",
    });

    const res = await request(app).post(path).set(auth);

    expect(res.status).toBe(409);
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
});
