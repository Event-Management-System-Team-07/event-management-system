// AUTH-02 tests: authentication middleware.
// The database is stubbed with jest.spyOn, so these run anywhere (including CI) without MongoDB.
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const authenticate = require("../src/middleware/authenticate");
const User = require("../src/models/User");

process.env.JWT_SECRET = "test-secret";

// A tiny app with one protected route, used only by these tests.
const app = express();
app.get("/protected", authenticate, (req, res) => {
  res.json({ id: req.user._id.toString(), email: req.user.email, role: req.user.role });
});

const userId = new mongoose.Types.ObjectId().toString();
const makeUser = (overrides = {}) =>
  new User({ _id: userId, name: "Sindhu", email: "sindhu@example.com", passwordHash: "x", ...overrides });
const sign = (payload = { sub: userId }, options = { expiresIn: "1h" }) =>
  jwt.sign(payload, process.env.JWT_SECRET, options);

afterEach(() => jest.restoreAllMocks());

describe("authenticate middleware", () => {
  test("valid token -> 200 and downstream handler can read req.user", async () => {
    const find = jest.spyOn(User, "findById").mockResolvedValue(makeUser({ role: "Organizer" }));
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${sign()}`);
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith(userId);
    expect(res.body).toEqual({ id: userId, email: "sindhu@example.com", role: "Organizer" });
  });

  test("scheme word is case-insensitive", async () => {
    jest.spyOn(User, "findById").mockResolvedValue(makeUser());
    const res = await request(app).get("/protected").set("Authorization", `bearer ${sign()}`);
    expect(res.status).toBe(200);
  });

  test("missing Authorization header -> 401, DB never queried", async () => {
    const find = jest.spyOn(User, "findById");
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentication required");
    expect(find).not.toHaveBeenCalled();
  });

  test.each([
    ["no scheme", "justatoken"],
    ["wrong scheme", "Basic abc123"],
    ["empty bearer", "Bearer "],
    ["extra parts", "Bearer a b"],
  ])("malformed header (%s) -> 401", async (_name, header) => {
    const find = jest.spyOn(User, "findById");
    const res = await request(app).get("/protected").set("Authorization", header);
    expect(res.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });

  test("garbage token -> 401 Invalid token", async () => {
    const find = jest.spyOn(User, "findById");
    const res = await request(app).get("/protected").set("Authorization", "Bearer not.a.jwt");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token");
    expect(find).not.toHaveBeenCalled();
  });

  test("token signed with the wrong secret -> 401", async () => {
    const forged = jwt.sign({ sub: userId }, "some-other-secret", { expiresIn: "1h" });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token");
  });

  test("expired token -> 401 with a session-expired message", async () => {
    const find = jest.spyOn(User, "findById");
    const expired = sign({ sub: userId }, { expiresIn: -10 });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
    expect(find).not.toHaveBeenCalled();
  });

  test('unsigned "alg: none" token -> 401', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: userId })}.`;
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${none}`);
    expect(res.status).toBe(401);
  });

  test.each([
    ["sub missing", {}],
    ["sub is an object", { sub: { $ne: null } }],
    ["sub is not an ObjectId", { sub: "123" }],
  ])("valid signature but bad payload (%s) -> 401, DB never queried", async (_name, payload) => {
    const find = jest.spyOn(User, "findById");
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${sign(payload)}`);
    expect(res.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });

  test("user deleted after token was issued -> 401", async () => {
    jest.spyOn(User, "findById").mockResolvedValue(null);
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${sign()}`);
    expect(res.status).toBe(401);
  });

  test("req.user never exposes passwordHash", async () => {
    jest.spyOn(User, "findById").mockResolvedValue(makeUser());
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${sign()}`);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  test("DB failure -> 500, generic message, no leak", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "findById").mockRejectedValue(new Error("mongo secret details"));
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${sign()}`);
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Something went wrong/);
    expect(JSON.stringify(res.body)).not.toMatch(/mongo secret|stack/);
  });

  test("missing JWT_SECRET -> 500 generic, never treated as authenticated", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const token = sign();
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    process.env.JWT_SECRET = saved;
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Something went wrong/);
  });

  test("works with a real token produced by the login flow shape (sub = _id)", async () => {
    // login() signs { sub: user._id.toString() } with JWT_SECRET and JWT_EXPIRES_IN
    jest.spyOn(User, "findById").mockResolvedValue(makeUser());
    const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
