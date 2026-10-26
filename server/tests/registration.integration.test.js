require("dotenv").config();

const { execFileSync, spawn } = require("child_process");
const path = require("path");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const runIntegration = process.env.RUN_MONGO_INTEGRATION === "1";
const describeIntegration = runIntegration ? describe : describe.skip;
const TEST_URI = process.env.MONGO_INTEGRATION_URI;
const TEST_PORT = 5010;
const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

process.env.JWT_SECRET = "integration-test-secret";
jest.setTimeout(30000);

if (runIntegration && !TEST_URI) throw new Error("MONGO_INTEGRATION_URI is required");
if (runIntegration && !TEST_URI.includes("event-management-data01-test")) {
  throw new Error("MONGO_INTEGRATION_URI must target the DATA-01 test database");
}

const helper = (operation) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(__dirname, "mongo-integration-helper.js"), JSON.stringify(operation)],
      {
        cwd: path.join(__dirname, ".."),
        env: { ...process.env, MONGO_INTEGRATION_URI: TEST_URI },
        encoding: "utf8",
      }
    )
  );

const waitForServer = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${TEST_BASE_URL}/api/health`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Integration server did not become ready");
};

describeIntegration("registration MongoDB integration", () => {
  let server;
  let app;
  let createdIds = { users: [], events: [] };

  beforeAll(async () => {
    expect(helper({ operation: "probe" })).toEqual({
      discoveredSet: "rs-data01-test",
      transaction: "committed",
    });

    server = spawn(process.execPath, [path.join(__dirname, "../src/server.js")], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "integration",
        PORT: String(TEST_PORT),
        MONGO_URI: TEST_URI,
        JWT_SECRET: process.env.JWT_SECRET,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    await waitForServer();
    app = request(TEST_BASE_URL);

    const indexes = helper({ operation: "indexes" }).indexes;
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { user: 1, event: 1 },
          unique: true,
          partialFilterExpression: { status: "active" },
        }),
      ])
    );
  });

  afterEach(async () => {
    if (createdIds.users.length || createdIds.events.length) {
      try {
        helper({
          operation: "cleanup",
          userIds: createdIds.users,
          eventIds: createdIds.events,
        });
      } finally {
        createdIds = { users: [], events: [] };
      }
    } else {
      createdIds = { users: [], events: [] };
    }
  });

  afterAll(async () => {
    if (!server) return;
    server.kill();
    await new Promise((resolve) => {
      if (server.exitCode !== null) return resolve();
      server.once("exit", resolve);
    });
  });

  const createUser = (suffix) => {
    const user = helper({ operation: "createUser", suffix });
    createdIds.users.push(user.id);
    return user.id;
  };

  const createEvent = (capacity) => {
    const event = helper({ operation: "createEvent", capacity });
    createdIds.events.push(event.id);
    return event.id;
  };

  const auth = (userId) => ({
    Authorization: `Bearer ${jwt.sign({ sub: userId }, process.env.JWT_SECRET)}`,
  });

  test("two users competing for one seat produce one success", async () => {
    const first = createUser("one");
    const second = createUser("two");
    const event = createEvent(1);
    const responses = await Promise.all(
      [first, second].map((user) =>
        app.post(`/api/events/${event}/register`).set(auth(user))
      )
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(helper({ operation: "state", eventId: event })).toEqual({
      activeCount: 1,
      counter: 1,
    });
  });

  test("duplicate active registration returns 409", async () => {
    const user = createUser("duplicate");
    const event = createEvent(2);
    const route = `/api/events/${event}/register`;
    const first = await app.post(route).set(auth(user));
    const second = await app.post(route).set(auth(user));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(
      helper({
        operation: "directDuplicateInsert",
        userId: user,
        eventId: event,
      }).code
    ).toBe(11000);
    expect(helper({ operation: "state", eventId: event }).counter).toBe(1);
  });

  test("cancellation permits re-registration", async () => {
    const first = createUser("cancel-first");
    const second = createUser("cancel-second");
    const event = createEvent(1);
    const route = `/api/events/${event}/register`;

    expect((await app.post(route).set(auth(first))).status).toBe(201);
    expect((await app.delete(route).set(auth(first))).status).toBe(200);
    expect((await app.post(route).set(auth(second))).status).toBe(201);
    expect(helper({ operation: "state", eventId: event }).counter).toBe(1);
  });

  test("repeated cancellation does not decrement twice", async () => {
    const user = createUser("cancel-twice");
    const event = createEvent(1);
    const route = `/api/events/${event}/register`;

    expect((await app.post(route).set(auth(user))).status).toBe(201);
    expect((await app.delete(route).set(auth(user))).status).toBe(200);
    expect((await app.delete(route).set(auth(user))).status).toBe(404);
    expect(helper({ operation: "state", eventId: event })).toEqual({
      activeCount: 0,
      counter: 0,
    });
  });

  test("failed duplicate operation leaves the counter consistent", async () => {
    const user = createUser("duplicate-race");
    const event = createEvent(2);
    const route = `/api/events/${event}/register`;

    expect((await app.post(route).set(auth(user))).status).toBe(201);
    expect((await app.post(route).set(auth(user))).status).toBe(409);
    expect(helper({ operation: "state", eventId: event })).toEqual({
      activeCount: 1,
      counter: 1,
    });
  });
});
