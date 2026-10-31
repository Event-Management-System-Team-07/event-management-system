// SEC-02 tests: server-side input validation (TC-SEC-02).
// The database is stubbed with jest.spyOn, so these run anywhere (including CI) without MongoDB.
const express = require("express");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const { validateBody } = require("../src/middleware/inputValidation");
const {
  isNonEmptyString,
  isEmail,
  isObjectId,
  isIntegerInRange,
  isUnsafeKey,
  containsUnsafeKey,
  findUnsafeFields,
} = require("../src/utils/validators");

process.env.JWT_SECRET = "test-secret";

const good = { name: "Sindhu G", email: "sindhu@example.com", password: "Password123" };

afterEach(() => jest.restoreAllMocks());

describe("global guard: injection-style input is rejected before any controller runs", () => {
  test.each([
    ["operator object as email", { ...good, email: { $gt: "" } }, "email"],
    ["operator object as password", { ...good, password: { $ne: null } }, "password"],
    ["operator nested deeper", { ...good, name: { a: { $where: "1" } } }, "name"],
    ["operator inside an array", { ...good, name: [{ $gt: "" }] }, "name"],
    ["dotted key", { ...good, "profile.role": "Admin" }, "profile.role"],
  ])("%s -> 400 with a field error, database never queried", async (_label, body, field) => {
    const find = jest.spyOn(User, "findOne");
    const create = jest.spyOn(User, "create");
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors[field]).toBe("Invalid input");
    expect(find).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("prototype-pollution key (__proto__) -> 400", async () => {
    const find = jest.spyOn(User, "findOne");
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send('{"name":"Sindhu G","email":"sindhu@example.com","password":"Password123","__proto__":{"isAdmin":true}}');
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  test("login with operator objects -> 400, database never queried", async () => {
    const find = jest.spyOn(User, "findOne");
    const res = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBe("Invalid input");
    expect(res.body.errors.password).toBe("Invalid input");
    expect(find).not.toHaveBeenCalled();
  });

  test("operator in the query string -> 400", async () => {
    const res = await request(app).get("/api/health?email%5B%24ne%5D=x");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation failed");
  });

  test("normal requests are not blocked", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User, "create").mockImplementation(async (d) => new User(d));
    const reg = await request(app).post("/api/auth/register").send(good);
    expect(reg.status).toBe(201);
    const health = await request(app).get("/api/health?verbose=true");
    expect(health.status).toBe(200);
  });

  test("an empty body is still handled by the controller (400), no crash", async () => {
    const res = await request(app).post("/api/auth/register");
    expect(res.status).toBe(400);
  });
});

describe("bad request bodies get clean JSON errors, not an HTML error page", () => {
  test("malformed JSON -> 400, no stack trace", async () => {
    const res = await request(app).post("/api/auth/register").set("Content-Type", "application/json").send("{ this is not json");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid JSON in request body" });
    expect(res.text).not.toMatch(/SyntaxError|node_modules|\.js:\d+/);
  });

  test("body over the size limit -> 413", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...good, name: "x".repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request body is too large" });
  });
});

describe("validateBody (reusable route-level validation)", () => {
  const small = express();
  small.use(express.json());
  small.post("/thing", validateBody((b) => (isNonEmptyString(b.title, { max: 10 }) ? {} : { title: "Title must be 1 to 10 characters" })), (req, res) =>
    res.json({ ok: true })
  );
  small.post("/boom", validateBody(() => { throw new Error("bug in validator"); }), (req, res) => res.json({ ok: true }));

  test("valid input reaches the handler", async () => {
    const res = await request(small).post("/thing").send({ title: "Hello" });
    expect(res.status).toBe(200);
  });

  test("invalid input -> 400 with the field errors from the validator", async () => {
    const res = await request(small).post("/thing").send({ title: "x".repeat(50) });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Validation failed", errors: { title: "Title must be 1 to 10 characters" } });
  });

  test("a missing body is treated as empty input -> 400, no crash", async () => {
    const res = await request(small).post("/thing");
    expect(res.status).toBe(400);
  });

  test("a validator that crashes does not let the request through", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(small).post("/boom").send({});
    expect(res.status).toBe(500);
  });

  test("validateBody needs a function", () => {
    expect(() => validateBody("nope")).toThrow(TypeError);
  });
});

describe("validators", () => {
  test("isNonEmptyString", () => {
    expect(isNonEmptyString("a")).toBe(true);
    expect(isNonEmptyString("  ")).toBe(false);
    expect(isNonEmptyString("abc", { min: 5 })).toBe(false);
    expect(isNonEmptyString("a".repeat(11), { max: 10 })).toBe(false);
    expect([undefined, null, 5, {}, []].some((v) => isNonEmptyString(v))).toBe(false);
  });

  test("isEmail", () => {
    expect(isEmail("a@b.com")).toBe(true);
    expect(isEmail(" a@b.com ")).toBe(true);
    expect(["not-an-email", "a@b", "", undefined, { $gt: "" }, `${"a".repeat(250)}@b.com`].some((v) => isEmail(v))).toBe(false);
  });

  test("isObjectId accepts only a 24-character hex string", () => {
    expect(isObjectId("507f1f77bcf86cd799439011")).toBe(true);
    expect(["123", "zzzzzzzzzzzzzzzzzzzzzzzz", { $ne: null }, null, undefined, 123].some((v) => isObjectId(v))).toBe(false);
  });

  test("isIntegerInRange", () => {
    expect(isIntegerInRange(5, 1, 10)).toBe(true);
    expect(isIntegerInRange(0, 1, 10)).toBe(false);
    expect(isIntegerInRange(1.5, 1, 10)).toBe(false);
    expect(isIntegerInRange("5", 1, 10)).toBe(false);
  });

  test("isUnsafeKey", () => {
    ["$gt", "$where", "a.b", "a[$ne]", "__proto__"].forEach((k) => expect(isUnsafeKey(k)).toBe(true));
    ["name", "email", "createdAt"].forEach((k) => expect(isUnsafeKey(k)).toBe(false));
  });

  test("containsUnsafeKey walks nested objects and arrays, and rejects absurd depth", () => {
    expect(containsUnsafeKey({ a: { b: [{ $gt: 1 }] } })).toBe(true);
    expect(containsUnsafeKey({ a: { b: [{ c: 1 }] }, d: "x" })).toBe(false);
    expect(containsUnsafeKey("text")).toBe(false);
    expect(containsUnsafeKey(null)).toBe(false);
    let deep = { v: 1 };
    for (let i = 0; i < 30; i++) deep = { n: deep };
    expect(containsUnsafeKey(deep)).toBe(true);
  });

  test("findUnsafeFields lists only the offending top-level fields", () => {
    expect(findUnsafeFields({ ok: "x", bad: { $gt: 1 }, "a.b": 1 })).toEqual(["bad", "a.b"]);
    expect(findUnsafeFields(undefined)).toEqual([]);
    expect(findUnsafeFields([1, 2])).toEqual([]);
  });
});
