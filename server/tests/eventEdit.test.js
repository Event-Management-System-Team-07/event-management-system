// EVENT-02 tests: edit event.
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

afterEach(() => jest.restoreAllMocks());

describe("PUT /api/events/:id", () => {
  test("owner edits own event -> 200", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app)
      .put(`/api/events/${ev._id}`)
      .set(auth)
      .send({ title: "New Title", capacity: 50 });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("New Title");
    expect(res.body.event.capacity).toBe(50);
    expect(ev.save).toHaveBeenCalled();
  });

  test("no token -> 401", async () => {
    const res = await request(app)
      .put(`/api/events/${new mongoose.Types.ObjectId()}`)
      .send({ title: "Anything" });
    expect(res.status).toBe(401);
  });

  test("Participant -> 403", async () => {
    asRole(ROLES.PARTICIPANT);
    const find = jest.spyOn(Event, "findById");
    const res = await request(app)
      .put(`/api/events/${new mongoose.Types.ObjectId()}`)
      .set(auth)
      .send({ title: "Anything" });
    expect(res.status).toBe(403);
    expect(find).not.toHaveBeenCalled();
  });

  test("organizer cannot edit someone else's event -> 403", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ title: "Hacked" });
    expect(res.status).toBe(403);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("Admin can edit any event -> 200", async () => {
    asRole(ROLES.ADMIN);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ venue: "Hall B" });
    expect(res.status).toBe(200);
    expect(res.body.event.venue).toBe("Hall B");
  });

  test("cancelled event cannot be edited -> 409", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "cancelled" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ title: "Nope!!" });
    expect(res.status).toBe(409);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("client cannot change status or organizer through edit", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app)
      .put(`/api/events/${ev._id}`)
      .set(auth)
      .send({ title: "Still Mine", status: "published", organizer: otherId });
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("draft");
    expect(res.body.event.organizer).toBe(userId);
  });

  test("invalid edit data -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ capacity: -5 });
    expect(res.status).toBe(400);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("end date moved before start date -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app)
      .put(`/api/events/${ev._id}`)
      .set(auth)
      .send({ endDate: future(1) });
    expect(res.status).toBe(400);
    expect(ev.save).not.toHaveBeenCalled();
  });

  test("event not found -> 404", async () => {
    asRole(ROLES.ORGANIZER);
    jest.spyOn(Event, "findById").mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/events/${new mongoose.Types.ObjectId()}`)
      .set(auth)
      .send({ title: "Anything" });
    expect(res.status).toBe(404);
  });

  test("malformed id -> 400", async () => {
    asRole(ROLES.ORGANIZER);
    const res = await request(app).put("/api/events/not-an-id").set(auth).send({ title: "Anything" });
    expect(res.status).toBe(400);
  });
});
describe("PUT /api/events/:id partial updates", () => {
  test("title-only update keeps every other field unchanged", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ title: "Only Title" });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("Only Title");
    expect(res.body.event.description).toBe(goodBody.description);
    expect(res.body.event.venue).toBe(goodBody.venue);
    expect(res.body.event.capacity).toBe(goodBody.capacity);
    expect(res.body.event.startDate).toBe(goodBody.startDate);
    expect(res.body.event.endDate).toBe(goodBody.endDate);
    expect(res.body.event.status).toBe("draft");
    expect(ev.save).toHaveBeenCalled();
  });

  test("valid end-date-only update changes only the end date", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const newEnd = future(10);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ endDate: newEnd });
    expect(res.status).toBe(200);
    expect(res.body.event.endDate).toBe(newEnd);
    expect(res.body.event.startDate).toBe(goodBody.startDate);
    expect(res.body.event.title).toBe(goodBody.title);
  });

  test("valid start-date-only update changes only the start date", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent();
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const newStart = future(6);
    const res = await request(app).put(`/api/events/${ev._id}`).set(auth).send({ startDate: newStart });
    expect(res.status).toBe(200);
    expect(res.body.event.startDate).toBe(newStart);
    expect(res.body.event.endDate).toBe(goodBody.endDate);
    expect(res.body.event.venue).toBe(goodBody.venue);
  });
});
