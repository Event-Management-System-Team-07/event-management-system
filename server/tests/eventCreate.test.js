// EVENT-01 tests: create event.
// The database is stubbed with jest.spyOn, so these run anywhere without MongoDB.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
jest.mock("../src/services/auditLogger", () => ({ recordEventAction: jest.fn().mockResolvedValue(null) }));
const app = require("../src/app");
const User = require("../src/models/User");
const Event = require("../src/models/Event");
const ROLES = require("../src/constants/roles");

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

afterEach(() => jest.restoreAllMocks());

describe("POST /api/events", () => {
  test("Organizer creates event -> 201, organizer set by server, status draft", async () => {
    asRole(ROLES.ORGANIZER);
    const create = jest.spyOn(Event, "create").mockImplementation(async (d) => new Event(d));
    const res = await request(app)
      .post("/api/events")
      .set(auth)
      .send({ ...goodBody, status: "published", organizer: otherId });
    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe("draft");
    expect(res.body.event.organizer).toBe(userId);
    const saved = create.mock.calls[0][0];
    expect(saved.status).toBe("draft");
    expect(String(saved.organizer)).toBe(userId);
  });

  test("no token -> 401", async () => {
    const res = await request(app).post("/api/events").send(goodBody);
    expect(res.status).toBe(401);
  });

  test("Participant -> 403, nothing saved", async () => {
    asRole(ROLES.PARTICIPANT);
    const create = jest.spyOn(Event, "create");
    const res = await request(app).post("/api/events").set(auth).send(goodBody);
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  test("missing fields -> 400, nothing saved", async () => {
    asRole(ROLES.ORGANIZER);
    const create = jest.spyOn(Event, "create");
    const res = await request(app).post("/api/events").set(auth).send({ title: "Hi" });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(create).not.toHaveBeenCalled();
  });

  test("start date in the past -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app)
      .post("/api/events")
      .set(auth)
      .send({ ...goodBody, startDate: "2020-01-01T10:00:00Z", endDate: "2020-01-02T10:00:00Z" });
    expect(res.status).toBe(400);
  });

  test("end before start -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app)
      .post("/api/events")
      .set(auth)
      .send({ ...goodBody, startDate: future(8), endDate: future(7) });
    expect(res.status).toBe(400);
  });

  test("capacity 0 -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app).post("/api/events").set(auth).send({ ...goodBody, capacity: 0 });
    expect(res.status).toBe(400);
  });
});
