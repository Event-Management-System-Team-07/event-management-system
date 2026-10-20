// AUTH-03 tests: role-based authorization (authenticate + authorize together).
// The database is stubbed with jest.spyOn, so these run anywhere (including CI) without MongoDB.
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const authenticate = require("../src/middleware/authenticate");
const authorize = require("../src/middleware/authorize");
const ROLES = require("../src/constants/roles");
const User = require("../src/models/User");

process.env.JWT_SECRET = "test-secret";

// A tiny app with routes that need different roles, used only by these tests.
const app = express();
const ok = (req, res) => res.json({ ok: true, role: req.user.role });
app.get("/any-logged-in", authenticate, ok);
app.get("/participant-area", authenticate, authorize(ROLES.PARTICIPANT), ok);
app.get("/organizer-area", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), ok);
app.get("/admin-area", authenticate, authorize(ROLES.ADMIN), ok);
// Wired WITHOUT authenticate on purpose: authorize must still refuse (401), never let it through.
app.get("/forgot-authenticate", authorize(ROLES.ADMIN), ok);

const userId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
const asRole = (role) =>
  jest.spyOn(User, "findById").mockResolvedValue(
    new User({ _id: userId, name: "Test User", email: "t@example.com", passwordHash: "x", role })
  );
const get = (path) => request(app).get(path).set("Authorization", `Bearer ${token}`);

afterEach(() => jest.restoreAllMocks());

describe("authorize: permission matrix", () => {
  // [role, path, expected status]
  test.each([
    [ROLES.PARTICIPANT, "/any-logged-in", 200],
    [ROLES.PARTICIPANT, "/participant-area", 200],
    [ROLES.PARTICIPANT, "/organizer-area", 403],
    [ROLES.PARTICIPANT, "/admin-area", 403],

    [ROLES.ORGANIZER, "/any-logged-in", 200],
    [ROLES.ORGANIZER, "/participant-area", 403],
    [ROLES.ORGANIZER, "/organizer-area", 200],
    [ROLES.ORGANIZER, "/admin-area", 403],

    [ROLES.ADMIN, "/any-logged-in", 200],
    [ROLES.ADMIN, "/participant-area", 403],
    [ROLES.ADMIN, "/organizer-area", 200],
    [ROLES.ADMIN, "/admin-area", 200],
  ])("%s on %s -> %i", async (role, path, status) => {
    asRole(role);
    const res = await get(path);
    expect(res.status).toBe(status);
  });
});

describe("authorize: error responses", () => {
  test("403 has a clear message and does not reveal other info", async () => {
    asRole(ROLES.PARTICIPANT);
    const res = await get("/admin-area");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "You do not have permission to perform this action" });
  });

  test("no token on a role-protected route -> 401 (not 403)", async () => {
    const res = await request(app).get("/admin-area");
    expect(res.status).toBe(401);
  });

  test("expired token on an admin route -> 401, handler never reached", async () => {
    const expired = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get("/admin-area").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test("authorize without authenticate in front -> 401, never lets the request through", async () => {
    const res = await request(app).get("/forgot-authenticate");
    expect(res.status).toBe(401);
  });
});

describe("authorize: role comes from the database, not the token", () => {
  test("a token that CLAIMS role Admin does not give admin access", async () => {
    const sneaky = jwt.sign({ sub: userId, role: "Admin" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    asRole(ROLES.PARTICIPANT);
    const res = await request(app).get("/admin-area").set("Authorization", `Bearer ${sneaky}`);
    expect(res.status).toBe(403);
  });

  test("a role change in the database takes effect on the very next request", async () => {
    const find = asRole(ROLES.PARTICIPANT);
    expect((await get("/admin-area")).status).toBe(403);
    find.mockResolvedValue(
      new User({ _id: userId, name: "Test User", email: "t@example.com", passwordHash: "x", role: ROLES.ADMIN })
    );
    expect((await get("/admin-area")).status).toBe(200);
  });
});

describe("authorize: setup mistakes are caught immediately", () => {
  test("no roles given -> throws when the route is defined", () => {
    expect(() => authorize()).toThrow(/valid roles/);
  });
  test('typo like "admin" (wrong case) -> throws when the route is defined', () => {
    expect(() => authorize("admin")).toThrow(/valid roles/);
  });
  test("unknown role -> throws when the route is defined", () => {
    expect(() => authorize(ROLES.ADMIN, "Superuser")).toThrow(/valid roles/);
  });
});
