// EVENT-04 tests: browse events and view event details.
// The database is stubbed with jest.spyOn, so these run anywhere without MongoDB.
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
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

const makeEvent = (overrides = {}) =>
  new Event({
    _id: new mongoose.Types.ObjectId(),
    ...goodBody,
    organizer: userId,
    status: "published",
    ...overrides,
  });

// Event.find(...).sort(...).skip(...).limit(...) resolves to the events array.
const stubList = (events, total = events.length) => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(events),
  };
  const find = jest.spyOn(Event, "find").mockReturnValue(chain);
  jest.spyOn(Event, "countDocuments").mockResolvedValue(total);
  return { chain, find };
};

afterEach(() => jest.restoreAllMocks());

describe("GET /api/events", () => {
  test("no token -> 401", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(401);
  });

  test("participant gets published events only, soonest first", async () => {
    asRole(ROLES.PARTICIPANT);
    const events = [makeEvent(), makeEvent({ title: "Second" })];
    const { chain, find } = stubList(events);
    const res = await request(app).get("/api/events").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(find).toHaveBeenCalledWith({ status: "published" });
    expect(chain.sort).toHaveBeenCalledWith({ startDate: 1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  test("paging: page 2 with limit 5 skips 5", async () => {
    asRole(ROLES.PARTICIPANT);
    const { chain } = stubList([makeEvent()], 12);
    const res = await request(app).get("/api/events?page=2&limit=5").set(auth);
    expect(res.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(5);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(5);
  });

  test("limit is capped at 50", async () => {
    asRole(ROLES.PARTICIPANT);
    const { chain } = stubList([]);
    const res = await request(app).get("/api/events?limit=1000").set(auth);
    expect(res.status).toBe(200);
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  test("invalid page and limit fall back to defaults", async () => {
    asRole(ROLES.PARTICIPANT);
    const { chain } = stubList([]);
    const res = await request(app).get("/api/events?page=abc&limit=-5").set(auth);
    expect(res.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  test("returns total and totalPages", async () => {
    asRole(ROLES.PARTICIPANT);
    stubList([makeEvent()], 25);
    const res = await request(app).get("/api/events?limit=10").set(auth);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(3);
  });

  test("no published events -> 200 with an empty list", async () => {
    asRole(ROLES.PARTICIPANT);
    stubList([], 0);
    const res = await request(app).get("/api/events").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.events).toEqual([]);
    expect(res.body.totalPages).toBe(0);
  });
});

describe("GET /api/events/:id", () => {
  test("no token -> 401", async () => {
    const res = await request(app).get(`/api/events/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(401);
  });

  test("participant can view a published event -> 200", async () => {
    asRole(ROLES.PARTICIPANT);
    const ev = makeEvent({ organizer: otherId });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("Tech Fest");
  });

  test("participant can view a cancelled event -> 200", async () => {
    asRole(ROLES.PARTICIPANT);
    const ev = makeEvent({ organizer: otherId, status: "cancelled" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("cancelled");
  });

  test("owner can view their own draft -> 200", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ status: "draft" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe("draft");
  });

  test("another organizer cannot see a draft -> 404", async () => {
    asRole(ROLES.ORGANIZER);
    const ev = makeEvent({ organizer: otherId, status: "draft" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(404);
  });

  test("participant cannot see a draft -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    const ev = makeEvent({ organizer: otherId, status: "draft" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(404);
  });

  test("Admin can see any draft -> 200", async () => {
    asRole(ROLES.ADMIN);
    const ev = makeEvent({ organizer: otherId, status: "draft" });
    jest.spyOn(Event, "findById").mockResolvedValue(ev);
    const res = await request(app).get(`/api/events/${ev._id}`).set(auth);
    expect(res.status).toBe(200);
  });

  test("event not found -> 404", async () => {
    asRole(ROLES.PARTICIPANT);
    jest.spyOn(Event, "findById").mockResolvedValue(null);
    const res = await request(app).get(`/api/events/${new mongoose.Types.ObjectId()}`).set(auth);
    expect(res.status).toBe(404);
  });

  test("malformed id -> 400", async () => {
    asRole(ROLES.PARTICIPANT);
    const res = await request(app).get("/api/events/not-an-id").set(auth);
    expect(res.status).toBe(400);
  });
});