// AUTH-01 tests: registration and login.
// The database is stubbed with jest.spyOn, so these run anywhere (including CI) without MongoDB.
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const User = require("../src/models/User");

process.env.JWT_SECRET = "test-secret";

const good = { name: "Sindhu G", email: "Sindhu@Example.com ", password: "Password123" };

afterEach(() => jest.restoreAllMocks());

describe("register", () => {
  test("201, normalises email, default role, no passwordHash in response", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    const create = jest.spyOn(User, "create").mockImplementation(async (d) => new User(d));
    const res = await request(app).post("/api/auth/register").send(good);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("sindhu@example.com");
    expect(res.body.user.role).toBe("Participant");
    expect(res.body.user._id).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Password123|\$2[aby]\$/);
    const saved = create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe("Password123");
    expect(await bcrypt.compare("Password123", saved.passwordHash)).toBe(true);
  });
  test("Organizer allowed", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User, "create").mockImplementation(async (d) => new User(d));
    const res = await request(app).post("/api/auth/register").send({ ...good, role: "Organizer" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("Organizer");
  });
  test("Admin self-register -> 403, nothing saved", async () => {
    const create = jest.spyOn(User, "create");
    const res = await request(app).post("/api/auth/register").send({ ...good, role: "Admin" });
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
  test.each([["hacker"], [{ $ne: 1 }], [42]])("bad role %p -> 400", async (role) => {
    const res = await request(app).post("/api/auth/register").send({ ...good, role });
    expect(res.status).toBe(400);
  });
  test("duplicate email -> 409", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue({ _id: "x" });
    const res = await request(app).post("/api/auth/register").send(good);
    expect(res.status).toBe(409);
  });
  test("race-condition duplicate key (11000) -> 409", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    jest.spyOn(User, "create").mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
    const res = await request(app).post("/api/auth/register").send(good);
    expect(res.status).toBe(409);
  });
  test.each([
    [{ ...good, name: "A" }, "name"],
    [{ ...good, email: "not-an-email" }, "email"],
    [{ ...good, email: { $gt: "" } }, "email"],
    [{ ...good, password: "short" }, "password"],
    [{ ...good, password: "x".repeat(73) }, "password"],
    [{ ...good, password: { $ne: null } }, "password"],
  ])("invalid input %# -> 400 with field error", async (body, field) => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.errors[field]).toBeDefined();
  });
  test("empty body -> 400 (no crash)", async () => {
    const res = await request(app).post("/api/auth/register");
    expect(res.status).toBe(400);
  });
  test("DB failure -> 500, generic message, no stack", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "findOne").mockRejectedValue(new Error("mongo secret details"));
    const res = await request(app).post("/api/auth/register").send(good);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/mongo secret|stack|at /);
  });
});

describe("login", () => {
  let user;
  beforeAll(async () => {
    user = new User({ name: "Sindhu", email: "sindhu@example.com", passwordHash: await bcrypt.hash("Password123", 4) });
  });
  const stubFind = (u) => jest.spyOn(User, "findOne").mockReturnValue({ select: jest.fn().mockResolvedValue(u) });

  test("200 with verifiable token (sub = _id) and no passwordHash", async () => {
    const find = stubFind(user);
    const res = await request(app).post("/api/auth/login").send({ email: " SINDHU@example.com", password: "Password123" });
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({ email: "sindhu@example.com" });
    const payload = jwt.verify(res.body.token, "test-secret");
    expect(payload.sub).toBe(user._id.toString());
    expect(res.body.user.role).toBe("Participant");
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
  test("wrong password and unknown email give the SAME 401 message", async () => {
    stubFind(user);
    const a = await request(app).post("/api/auth/login").send({ email: "sindhu@example.com", password: "WrongPass1" });
    stubFind(null);
    const b = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "Password123" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });
  test.each([
    [{ email: { $gt: "" }, password: { $gt: "" } }],
    [{ email: "a@b.com" }],
    [{ password: "x" }],
    [{}],
  ])("bad/injection-style input %# -> 400 and DB never queried", async (body) => {
    const find = jest.spyOn(User, "findOne");
    const res = await request(app).post("/api/auth/login").send(body);
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
  test("missing JWT_SECRET -> 500 generic, no leak", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    stubFind(user);
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const res = await request(app).post("/api/auth/login").send({ email: "sindhu@example.com", password: "Password123" });
    process.env.JWT_SECRET = saved;
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Something went wrong/);
    expect(res.body.token).toBeUndefined();
  });
});

test("model: toJSON strips passwordHash; invalid role rejected by schema", () => {
  const u = new User({ name: "Test", email: "t@t.com", passwordHash: "h" });
  expect(u.toJSON().passwordHash).toBeUndefined();
  expect(u.role).toBe("Participant");
  const bad = new User({ name: "Test", email: "t@t.com", passwordHash: "h", role: "Superuser" });
  expect(bad.validateSync().errors.role).toBeDefined();
});

test("health route still works", async () => {
  const res = await request(app).get("/api/health");
  expect(res.body).toEqual({ status: "OK" });
});
