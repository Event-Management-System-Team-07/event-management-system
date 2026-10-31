// SEC-03 tests (SR-004): no secrets, stack traces or framework details leak
// through API responses or logs. No database is needed.
const express = require("express");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const { notFound, errorHandler } = require("../src/middleware/errorHandler");
const { logError, redact } = require("../src/utils/safeLogger");

process.env.JWT_SECRET = "test-secret-value-1234";

const STACK_HINTS = /\bat\s.+\(.*:\d+:\d+\)|node_modules|SyntaxError|\/src\/|\\src\\/;

afterEach(() => jest.restoreAllMocks());

describe("responses", () => {
  test("X-Powered-By header is not sent", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("unknown route -> generic JSON 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ message: "Resource not found" });
  });

  test("malformed JSON body -> clean 400 JSON, no stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": "a@b.com", ');
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toEqual({ message: "Invalid JSON in request body" });
    expect(res.text).not.toMatch(STACK_HINTS);
  });

  test("oversized body -> clean 413 JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.com", password: "x".repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Request body is too large" });
  });

  test("login and register responses never contain a password or hash", async () => {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash("Password123", 4);
    const doc = new User({ name: "Sindhu", email: "s@example.com", passwordHash: hash });
    jest.spyOn(User, "findOne").mockReturnValue({ select: () => Promise.resolve(doc) });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "s@example.com", password: "Password123" });
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/passwordHash|Password123|\$2[aby]\$/);
  });
});

describe("unexpected errors (500)", () => {
  const secretError = () =>
    new Error("connect failed mongodb://admin:hunter2@db.internal:27017/app password=hunter3");

  function buildApp() {
    const a = express();
    a.disable("x-powered-by");
    a.get("/boom", () => {
      throw secretError();
    });
    a.get("/boom-async", async () => {
      throw secretError();
    });
    a.use(notFound);
    a.use(errorHandler);
    return a;
  }

  test.each(["/boom", "/boom-async"])("%s -> generic body, nothing sensitive", async (path) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(buildApp()).get(path);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Something went wrong. Please try again." });
    expect(res.text).not.toMatch(/hunter|mongodb|db\.internal/);
    expect(res.text).not.toMatch(STACK_HINTS);
  });

  test("the log entry for a 500 has no stack and no secrets", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await request(buildApp()).get("/boom");
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0].join(" ");
    expect(line).not.toMatch(/hunter2|hunter3/);
    expect(line).not.toMatch(/\bat\s.+:\d+:\d+/);
    expect(JSON.parse(line).event).toBe("request.unhandled_error");
  });
});

describe("log redaction", () => {
  test("redact removes DB credentials, bearer tokens, JWTs, hashes and JWT_SECRET", () => {
    const text = redact(
      [
        "mongodb+srv://user:pa55@cluster0.example.net/db",
        "Authorization: Bearer abc.def.ghi",
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln",
        "$2b$10$" + "a".repeat(53),
        "token=abcdef",
        `value ${process.env.JWT_SECRET} end`,
      ].join(" | ")
    );
    expect(text).not.toMatch(/pa55|abc\.def|eyJ|\$2b\$|abcdef|test-secret-value-1234/);
    expect(text).toContain("[REDACTED]");
  });

  test("logError writes a single JSON line without the stack", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    logError("demo.failed", new TypeError("bad password=hunter9"));
    const entry = JSON.parse(spy.mock.calls[0][0]);
    expect(entry).toMatchObject({ level: "error", event: "demo.failed", errorType: "TypeError" });
    expect(entry.stack).toBeUndefined();
    expect(spy.mock.calls[0][0]).not.toMatch(/hunter9/);
  });
});
