// SEC-01 tests: secure password storage (TC-SEC-01).
// The database is stubbed with jest.spyOn, so these run anywhere (including CI) without MongoDB.
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../src/app");
const User = require("../src/models/User");
const { hashPassword, verifyPassword } = require("../src/utils/password");

process.env.JWT_SECRET = "test-secret";

// bcrypt format: $2b$ + 2-digit cost + $ + 22-char salt + 31-char hash = 60 characters in total
const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

afterEach(() => jest.restoreAllMocks());

describe("hashPassword", () => {
  test("returns a bcrypt hash and never the plaintext", async () => {
    const hash = await hashPassword("Password123");
    expect(hash).toMatch(BCRYPT_FORMAT);
    expect(hash).not.toBe("Password123");
    expect(hash).not.toContain("Password123");
  });

  test("is salted: the same password gives a different hash every time", async () => {
    const a = await hashPassword("Password123");
    const b = await hashPassword("Password123");
    expect(a).not.toBe(b);
    expect(await bcrypt.compare("Password123", a)).toBe(true);
    expect(await bcrypt.compare("Password123", b)).toBe(true);
  });

  test.each([[""], [null], [undefined], [12345], [{}]])("rejects a non-string or empty password (%p)", async (bad) => {
    await expect(hashPassword(bad)).rejects.toThrow(TypeError);
  });
});

describe("verifyPassword", () => {
  let hash;
  beforeAll(async () => {
    hash = await hashPassword("Password123");
  });

  test("true for the right password", async () => {
    expect(await verifyPassword("Password123", hash)).toBe(true);
  });

  test("false for a wrong password, including a different letter case", async () => {
    expect(await verifyPassword("WrongPass1", hash)).toBe(false);
    expect(await verifyPassword("password123", hash)).toBe(false);
  });

  test.each([[""], [null], [undefined], [12345], [{ $ne: null }]])("false (no crash) for a bad password input (%p)", async (bad) => {
    expect(await verifyPassword(bad, hash)).toBe(false);
  });

  test.each([[undefined], [null], [""], ["not-a-hash"], [12345]])("false (no crash) when the stored hash is missing or invalid (%p)", async (badHash) => {
    expect(await verifyPassword("Password123", badHash)).toBe(false);
  });

  test("a plaintext password stored by mistake is never accepted as a match", async () => {
    expect(await verifyPassword("Password123", "Password123")).toBe(false);
  });
});

describe("user model", () => {
  test("has no plaintext password field, and the hash is hidden from queries by default", () => {
    expect(User.schema.path("password")).toBeUndefined();
    expect(User.schema.path("passwordHash")).toBeDefined();
    expect(User.schema.path("passwordHash").options.select).toBe(false);
  });
});

describe("register stores only a hash", () => {
  test("the value saved to the database is a salted hash that verifies, and nothing leaks back", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    const create = jest.spyOn(User, "create").mockImplementation(async (d) => new User(d));
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sindhu G", email: "sindhu@example.com", password: "Password123" });

    expect(res.status).toBe(201);
    const saved = create.mock.calls[0][0];
    expect(saved.password).toBeUndefined();
    expect(saved.passwordHash).toMatch(BCRYPT_FORMAT);
    expect(saved.passwordHash).not.toContain("Password123");
    expect(await verifyPassword("Password123", saved.passwordHash)).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Password123|\$2[aby]\$/);
  });
});

describe("login checks the password against the stored hash", () => {
  let user;
  beforeAll(async () => {
    user = new User({ name: "Sindhu", email: "sindhu@example.com", passwordHash: await hashPassword("Password123") });
  });
  const stubFind = (u) => jest.spyOn(User, "findOne").mockReturnValue({ select: jest.fn().mockResolvedValue(u) });

  test("right password -> 200", async () => {
    stubFind(user);
    const res = await request(app).post("/api/auth/login").send({ email: "sindhu@example.com", password: "Password123" });
    expect(res.status).toBe(200);
  });

  test("wrong password -> 401", async () => {
    stubFind(user);
    const res = await request(app).post("/api/auth/login").send({ email: "sindhu@example.com", password: "WrongPass1" });
    expect(res.status).toBe(401);
  });

  test("unknown email -> the same 401 as a wrong password", async () => {
    stubFind(user);
    const wrong = await request(app).post("/api/auth/login").send({ email: "sindhu@example.com", password: "WrongPass1" });
    stubFind(null);
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "Password123" });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });
});
