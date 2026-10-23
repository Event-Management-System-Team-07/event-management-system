// AUTH-04 tests: authentication and role-based authorization, end to end.
//
// The other test files check one piece at a time and sign their own tokens. These tests go through
// the REAL register and login routes, and use the token that login actually returns on protected
// routes. Only the database is replaced (by an in-memory store), so they run anywhere, including
// CI, without MongoDB.
//
// Acceptance criteria of issue #43  ->  where they are tested:
//   Valid authentication is tested        -> describe "valid authentication"
//   Invalid authentication is tested      -> describe "invalid authentication"
//   Protected endpoint access is tested   -> describe "protected endpoint access"
//   Role-based access boundaries          -> describe "role-based access boundaries"
//   Unauthorized requests are rejected    -> describe "unauthorized requests are rejected"
const express = require("express");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authRoutes = require("../src/routes/authRoutes");
const authenticate = require("../src/middleware/authenticate");
const authorize = require("../src/middleware/authorize");
const ROLES = require("../src/constants/roles");
const User = require("../src/models/User");

process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1d";

// The real auth routes plus a few protected routes that stand in for future features.
const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
const whoAmI = (req, res) => res.json({ id: req.user._id.toString(), email: req.user.email, role: req.user.role });
app.get("/api/me", authenticate, whoAmI);
app.get("/api/participant-area", authenticate, authorize(ROLES.PARTICIPANT), whoAmI);
app.get("/api/organizer-area", authenticate, authorize(ROLES.ORGANIZER, ROLES.ADMIN), whoAmI);
app.get("/api/admin-area", authenticate, authorize(ROLES.ADMIN), whoAmI);
const PROTECTED_PATHS = ["/api/me", "/api/participant-area", "/api/organizer-area", "/api/admin-area"];

// In-memory replacement for the users collection (a Map of _id -> User document).
let users;
beforeEach(() => {
  users = new Map();
  // register awaits findOne directly, login calls findOne(...).select(...): support both
  const asQuery = (doc) => ({
    select: () => Promise.resolve(doc),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  });
  jest.spyOn(User, "findOne").mockImplementation((filter) => {
    const found = [...users.values()].find((u) => u.email === filter.email) || null;
    return asQuery(found);
  });
  jest.spyOn(User, "findById").mockImplementation(async (id) => users.get(String(id)) || null);
  jest.spyOn(User, "create").mockImplementation(async (data) => {
    const user = new User(data);
    users.set(user._id.toString(), user);
    return user;
  });
});
afterEach(() => jest.restoreAllMocks());

const credentials = { name: "Sindhu G", email: "sindhu@example.com", password: "Password123" };
const register = (overrides = {}) => request(app).post("/api/auth/register").send({ ...credentials, ...overrides });
const login = (email = credentials.email, password = credentials.password) =>
  request(app).post("/api/auth/login").send({ email, password });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const get = (path, token) => (token ? request(app).get(path).set(bearer(token)) : request(app).get(path));

// Registers through the real route, logs in through the real route, returns the real token.
async function registerAndLogin(overrides = {}) {
  const reg = await register(overrides);
  expect(reg.status).toBe(201);
  const res = await login(overrides.email || credentials.email);
  expect(res.status).toBe(200);
  return res.body.token;
}

// Admins can not self-register, so one is placed straight into the store, then logs in normally.
async function seedAdminAndLogin() {
  const admin = new User({
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: await bcrypt.hash("AdminPass123", 4),
    role: ROLES.ADMIN,
  });
  users.set(admin._id.toString(), admin);
  const res = await login("admin@example.com", "AdminPass123");
  expect(res.status).toBe(200);
  return { token: res.body.token, id: admin._id.toString() };
}

const tokenFor = async (role) => (role === ROLES.ADMIN ? (await seedAdminAndLogin()).token : registerAndLogin({ role }));

describe("valid authentication", () => {
  test("register, log in, and the real token identifies the same user on a protected route", async () => {
    const reg = await register();
    expect(reg.status).toBe(201);
    const res = await login();
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");

    const me = await get("/api/me", res.body.token);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: reg.body.user._id, email: "sindhu@example.com", role: ROLES.PARTICIPANT });
  });

  test("email is matched ignoring letter case and surrounding spaces", async () => {
    expect((await register({ email: "  Sindhu@Example.com " })).status).toBe(201);
    const res = await login("SINDHU@EXAMPLE.COM");
    expect(res.status).toBe(200);
    expect((await get("/api/me", res.body.token)).status).toBe(200);
  });

  test("the same token keeps working on later requests", async () => {
    const token = await registerAndLogin();
    expect((await get("/api/me", token)).status).toBe(200);
    expect((await get("/api/me", token)).status).toBe(200);
  });

  test("the password hash is never returned by register, login or the protected route", async () => {
    const reg = await register();
    const res = await login();
    const me = await get("/api/me", res.body.token);
    [reg.text, res.text, me.text].forEach((text) => expect(text).not.toMatch(/passwordHash|\$2[aby]\$/));
  });
});

describe("invalid authentication", () => {
  test("wrong password -> 401 without a token", async () => {
    await register();
    const res = await login(credentials.email, "WrongPass999");
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test("unknown email -> the same 401 as a wrong password", async () => {
    await register();
    const wrong = await login(credentials.email, "WrongPass999");
    const unknown = await login("nobody@example.com", credentials.password);
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  test("login before registering -> 401", async () => {
    expect((await login()).status).toBe(401);
  });

  test.each([
    [{ email: { $gt: "" }, password: { $gt: "" } }],
    [{ email: credentials.email }],
    [{ password: credentials.password }],
    [{}],
  ])("missing or injection-style login input %# -> 400", async (body) => {
    const res = await request(app).post("/api/auth/login").send(body);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  test("registering the same email twice -> 409, and the first account still works", async () => {
    await register();
    expect((await register({ name: "Someone Else", password: "OtherPass456" })).status).toBe(409);
    expect((await login()).status).toBe(200);
    expect((await login(credentials.email, "OtherPass456")).status).toBe(401);
  });

  test("registration with an invalid email or a too-short password -> 400, nothing stored", async () => {
    expect((await register({ email: "not-an-email" })).status).toBe(400);
    expect((await register({ password: "short" })).status).toBe(400);
    expect(users.size).toBe(0);
  });
});

describe("protected endpoint access", () => {
  test("a valid real token is accepted on a protected route", async () => {
    const token = await registerAndLogin();
    expect((await get("/api/me", token)).status).toBe(200);
  });

  test("no token -> 401 on every protected route", async () => {
    for (const path of PROTECTED_PATHS) {
      expect((await get(path)).status).toBe(401);
    }
  });

  test("a token whose user has since been deleted -> 401", async () => {
    const token = await registerAndLogin();
    users.clear();
    expect((await get("/api/me", token)).status).toBe(401);
  });

  test("the scheme word is case-insensitive, but other schemes are refused", async () => {
    const token = await registerAndLogin();
    expect((await request(app).get("/api/me").set("Authorization", `bearer ${token}`)).status).toBe(200);
    expect((await request(app).get("/api/me").set("Authorization", `Basic ${token}`)).status).toBe(401);
  });

  test("a token in the URL is not accepted, only the Authorization header", async () => {
    const token = await registerAndLogin();
    expect((await request(app).get(`/api/me?token=${token}`)).status).toBe(401);
  });
});

describe("role-based access boundaries", () => {
  const expected = {
    [ROLES.PARTICIPANT]: { "/api/participant-area": 200, "/api/organizer-area": 403, "/api/admin-area": 403 },
    [ROLES.ORGANIZER]: { "/api/participant-area": 403, "/api/organizer-area": 200, "/api/admin-area": 403 },
    [ROLES.ADMIN]: { "/api/participant-area": 403, "/api/organizer-area": 200, "/api/admin-area": 200 },
  };

  test.each(Object.keys(expected))("%s gets the expected result on every area (real login token)", async (role) => {
    const token = await tokenFor(role);
    for (const [path, status] of Object.entries(expected[role])) {
      const res = await get(path, token);
      expect({ path, status: res.status }).toEqual({ path, status });
    }
  });

  test("a self-registered account can never become Admin", async () => {
    const res = await register({ role: ROLES.ADMIN });
    expect(res.status).toBe(403);
    expect(users.size).toBe(0);
  });

  test("sending a role when logging in does not change the account's role", async () => {
    await register();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password, role: ROLES.ADMIN });
    expect(res.status).toBe(200);
    expect((await get("/api/admin-area", res.body.token)).status).toBe(403);
    expect((await get("/api/me", res.body.token)).body.role).toBe(ROLES.PARTICIPANT);
  });

  test("a change of role in the database applies to the very next request with the same token", async () => {
    const token = await registerAndLogin();
    expect((await get("/api/admin-area", token)).status).toBe(403);

    const userId = jwt.decode(token).sub;
    users.get(userId).role = ROLES.ADMIN;
    expect((await get("/api/admin-area", token)).status).toBe(200);

    users.get(userId).role = ROLES.PARTICIPANT;
    expect((await get("/api/admin-area", token)).status).toBe(403);
  });
});

describe("unauthorized requests are rejected", () => {
  test("garbage, wrong-secret and malformed tokens -> 401 on every protected route", async () => {
    const wrongSecret = jwt.sign({ sub: "507f1f77bcf86cd799439011" }, "some-other-secret", { expiresIn: "1h" });
    for (const path of PROTECTED_PATHS) {
      expect((await get(path, "not.a.jwt")).status).toBe(401);
      expect((await get(path, wrongSecret)).status).toBe(401);
      expect((await request(app).get(path).set("Authorization", "Bearer")).status).toBe(401);
    }
  });

  test("a real token with its payload swapped for the admin's id is rejected (privilege escalation attempt)", async () => {
    const userToken = await registerAndLogin();
    const { id: adminId } = await seedAdminAndLogin();
    const [header, , signature] = userToken.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: adminId })).toString("base64url");
    const forged = [header, forgedPayload, signature].join(".");
    expect((await get("/api/admin-area", forged)).status).toBe(401);
  });

  test("a real login token stops working once it has expired", async () => {
    const token = await registerAndLogin();
    expect((await get("/api/me", token)).status).toBe(200);

    const twoDaysLater = Date.now() + 2 * 24 * 60 * 60 * 1000;
    jest.spyOn(Date, "now").mockReturnValue(twoDaysLater);
    const res = await get("/api/me", token);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  test("a logged-in user without the right role gets 403 with a plain message, not a role hint", async () => {
    const token = await registerAndLogin();
    const res = await get("/api/admin-area", token);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "You do not have permission to perform this action" });
  });

  test("401 and 403 responses contain no password hash and no token", async () => {
    const token = await registerAndLogin();
    const unauthorized = await get("/api/admin-area");
    const forbidden = await get("/api/admin-area", token);
    [unauthorized.text, forbidden.text].forEach((text) => {
      expect(text).not.toMatch(/passwordHash|\$2[aby]\$/);
      expect(text).not.toContain(token);
    });
  });
});
