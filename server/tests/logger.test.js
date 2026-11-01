const logger = require("../src/utils/logger");

afterEach(() => jest.restoreAllMocks());

const loggedRecord = (spy) => JSON.parse(spy.mock.calls[0][0]);

describe("structured logger", () => {
  test("writes timestamped JSON records with stable event names and info severity", () => {
    const output = jest.spyOn(console, "log").mockImplementation(() => {});

    logger.info("auth.login_succeeded", { actorId: "user-123" });

    const record = loggedRecord(output);
    expect(record).toMatchObject({
      level: "info",
      event: "auth.login_succeeded",
      actorId: "user-123",
    });
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  test("writes warning and error records at their matching severity", () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});

    logger.warn("auth.login_rejected", { reason: "invalid_credentials" });
    logger.error("server.startup_failed", new TypeError("private error details"));

    expect(loggedRecord(warning)).toMatchObject({
      level: "warn",
      event: "auth.login_rejected",
      reason: "invalid_credentials",
    });
    expect(loggedRecord(error)).toMatchObject({
      level: "error",
      event: "server.startup_failed",
      errorType: "TypeError",
    });
  });

  test("excludes passwords, tokens, secrets, raw errors, and attempts to override record fields", () => {
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    const rawError = "password=hunter2 token=secret-token signing_secret=private";

    logger.info("server.listening", {
      port: 5000,
      password: "hunter2",
      token: "secret-token",
      secret: "private",
      message: rawError,
      timestamp: "forged-timestamp",
      level: "error",
      event: "forged.event",
    });

    const serialized = output.mock.calls[0][0];
    const record = JSON.parse(serialized);
    expect(record).toMatchObject({ level: "info", event: "server.listening", port: 5000 });
    expect(record.timestamp).not.toBe("forged-timestamp");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("signing_secret");
    expect(serialized).not.toContain("private");
  });

  test("does not include raw error messages in error records", () => {
    const output = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("database password=private token=secret");
    err.code = "E_DATABASE";

    logger.error("events.create_failed", err);

    const serialized = output.mock.calls[0][0];
    const record = JSON.parse(serialized);
    expect(record).toMatchObject({
      level: "error",
      event: "events.create_failed",
      errorType: "Error",
      errorCode: "E_DATABASE",
    });
    expect(serialized).not.toContain(err.message);
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("secret");
  });

  test("filters unsafe error names and codes", () => {
    const output = jest.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("private-token");
    err.name = "private-token";
    err.code = "token123";

    logger.error("events.create_failed", err);

    const serialized = output.mock.calls[0][0];
    expect(JSON.parse(serialized).errorType).toBe("Error");
    expect(serialized).not.toContain("private-token");
    expect(serialized).not.toContain("token123");
  });

  test("rejects unstable event names", () => {
    expect(() => logger.info("login failed", {})).toThrow(
      "Log event names must be stable dotted identifiers"
    );
  });
});
