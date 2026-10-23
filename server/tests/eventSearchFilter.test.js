// EVENT-05 tests: search and filter events.
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
const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
const auth = { Authorization: `Bearer ${token}` };

const asParticipant = () =>
  jest.spyOn(User, "findById").mockResolvedValue(
    new User({
      _id: userId,
      name: "Test User",
      email: "t@example.com",
      passwordHash: "x",
      role: ROLES.PARTICIPANT,
    })
  );

// Event.find(...).sort(...).skip(...).limit(...) resolves to the events array.
const stubList = (events = [], total = events.length) => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(events),
  };
  const find = jest.spyOn(Event, "find").mockReturnValue(chain);
  const count = jest.spyOn(Event, "countDocuments").mockResolvedValue(total);
  return { chain, find, count };
};

const filterUsed = (find) => find.mock.calls[0][0];

beforeEach(() => asParticipant());
afterEach(() => jest.restoreAllMocks());

describe("GET /api/events search", () => {
  test("search matches title, description or venue, case-insensitive", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events").query({ search: "fest" }).set(auth);
    expect(res.status).toBe(200);
    const pattern = { $regex: "fest", $options: "i" };
    expect(filterUsed(find)).toEqual({
      status: "published",
      $or: [{ title: pattern }, { description: pattern }, { venue: pattern }],
    });
  });

  test("special characters in search are escaped", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ search: "c++" }).set(auth);
    expect(filterUsed(find).$or[0].title.$regex).toBe("c\\+\\+");
  });

  test("blank search is ignored", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ search: "   " }).set(auth);
    expect(filterUsed(find)).toEqual({ status: "published" });
  });

  test("non-string search (repeated parameter) is ignored", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events?search=a&search=b").set(auth);
    expect(res.status).toBe(200);
    expect(filterUsed(find)).toEqual({ status: "published" });
  });

  test("very long search is cut to 100 characters", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ search: "a".repeat(150) }).set(auth);
    expect(filterUsed(find).$or[0].title.$regex).toHaveLength(100);
  });
});

describe("GET /api/events category filter", () => {
  test("category is an exact, case-insensitive match", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events").query({ category: "Tech" }).set(auth);
    expect(res.status).toBe(200);
    expect(filterUsed(find)).toEqual({
      status: "published",
      category: { $regex: "^Tech$", $options: "i" },
    });
  });

  test("special characters in category are escaped", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ category: "a.b" }).set(auth);
    expect(filterUsed(find).category.$regex).toBe("^a\\.b$");
  });
});

describe("GET /api/events date range filter", () => {
  test("from only -> startDate >= from", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events").query({ from: "2030-01-01" }).set(auth);
    expect(res.status).toBe(200);
    expect(filterUsed(find).startDate).toEqual({ $gte: new Date("2030-01-01") });
  });

  test("to only -> startDate <= to", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ to: "2030-12-31" }).set(auth);
    expect(filterUsed(find).startDate).toEqual({ $lte: new Date("2030-12-31") });
  });

  test("from and to together -> a range", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ from: "2030-01-01", to: "2030-12-31" }).set(auth);
    expect(filterUsed(find).startDate).toEqual({
      $gte: new Date("2030-01-01"),
      $lte: new Date("2030-12-31"),
    });
  });

  test("invalid from -> 400, database not queried", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events").query({ from: "not-a-date" }).set(auth);
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  test("invalid to -> 400, database not queried", async () => {
    const { find } = stubList();
    const res = await request(app).get("/api/events").query({ to: "nope" }).set(auth);
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  test("from after to -> 400", async () => {
    const { find } = stubList();
    const res = await request(app)
      .get("/api/events")
      .query({ from: "2030-12-31", to: "2030-01-01" })
      .set(auth);
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
});

describe("GET /api/events combined options", () => {
  test("search + category + date range work together", async () => {
    const { find } = stubList();
    const res = await request(app)
      .get("/api/events")
      .query({ search: "fest", category: "Tech", from: "2030-01-01" })
      .set(auth);
    expect(res.status).toBe(200);
    const f = filterUsed(find);
    expect(f.status).toBe("published");
    expect(f.$or).toHaveLength(3);
    expect(f.category.$regex).toBe("^Tech$");
    expect(f.startDate).toEqual({ $gte: new Date("2030-01-01") });
  });

  test("a status parameter cannot expose drafts", async () => {
    const { find } = stubList();
    await request(app).get("/api/events").query({ status: "draft" }).set(auth);
    expect(filterUsed(find)).toEqual({ status: "published" });
  });

  test("paging still works together with a filter", async () => {
    const { chain, count } = stubList([], 25);
    const res = await request(app)
      .get("/api/events")
      .query({ search: "fest", page: 2, limit: 10 })
      .set(auth);
    expect(res.status).toBe(200);
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(res.body.total).toBe(25);
    expect(res.body.totalPages).toBe(3);
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  });
});