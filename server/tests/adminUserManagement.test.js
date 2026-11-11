const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../src/models/User");
const ROLES = require("../src/constants/roles");
const adminUserRoutes = require("../src/routes/adminUserRoutes");

process.env.JWT_SECRET = "test-secret";

const app = express();
app.use(express.json());
app.use("/api/admin/users", adminUserRoutes);

const adminId = new mongoose.Types.ObjectId();
const targetId = new mongoose.Types.ObjectId();
const missingId = new mongoose.Types.ObjectId();

const makeUser = (overrides = {}) => ({
  _id: targetId,
  name: "Test User",
  email: "test@example.com",
  role: ROLES.PARTICIPANT,
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const adminUser = () =>
  makeUser({
    _id: adminId,
    name: "Admin User",
    email: "admin@example.com",
    role: ROLES.ADMIN,
  });

const tokenFor = (id = adminId) =>
  jwt.sign({ sub: id.toString() }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

const auth = (id = adminId) => ({
  Authorization: `Bearer ${tokenFor(id)}`,
});

const publicUserQuery = (user) => ({
  select: jest.fn().mockResolvedValue(user),
});

const mockAdminAuthentication = () => {
  jest.spyOn(User, "findById").mockResolvedValue(adminUser());
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Admin User Management", () => {
  describe("GET /api/admin/users", () => {
    test("returns users with only public fields", async () => {
      const users = [makeUser()];
      mockAdminAuthentication();

      const sort = jest.fn().mockResolvedValue(users);
      const select = jest.fn().mockReturnValue({ sort });
      const find = jest.spyOn(User, "find").mockReturnValue({ select });

      const res = await request(app)
        .get("/api/admin/users")
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].email).toBe("test@example.com");
      expect(res.body.users[0].passwordHash).toBeUndefined();
      expect(find).toHaveBeenCalledWith({});
      expect(select).toHaveBeenCalledWith(
        "name email role createdAt updatedAt"
      );
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    test("returns 500 when listing users fails", async () => {
      mockAdminAuthentication();
      jest.spyOn(User, "find").mockImplementation(() => {
        throw new Error("Database error");
      });
      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get("/api/admin/users")
        .set(auth());

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(
        "Something went wrong. Please try again."
      );
    });
  });

  describe("GET /api/admin/users/:id", () => {
    test("returns a user by valid ID", async () => {
      const user = makeUser();
      const select = jest.fn().mockResolvedValue(user);

      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockReturnValueOnce({ select });

      const res = await request(app)
        .get(`/api/admin/users/${targetId}`)
        .set(auth());

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("test@example.com");
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(select).toHaveBeenCalledWith(
        "name email role createdAt updatedAt"
      );
    });

    test("returns 400 for an invalid user ID", async () => {
      mockAdminAuthentication();

      const res = await request(app)
        .get("/api/admin/users/invalid-id")
        .set(auth());

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid user id");
      expect(User.findById).toHaveBeenCalledTimes(1);
    });

    test("returns 404 when the user does not exist", async () => {
      const select = jest.fn().mockResolvedValue(null);

      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockReturnValueOnce({ select });

      const res = await request(app)
        .get(`/api/admin/users/${missingId}`)
        .set(auth());

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    test("returns 500 when fetching a user fails", async () => {
      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockImplementationOnce(() => {
          throw new Error("Database error");
        });

      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .get(`/api/admin/users/${targetId}`)
        .set(auth());

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(
        "Something went wrong. Please try again."
      );
    });
  });

  describe("PATCH /api/admin/users/:id/role", () => {
    test("returns 400 for an invalid user ID", async () => {
      mockAdminAuthentication();

      const res = await request(app)
        .patch("/api/admin/users/invalid-id/role")
        .set(auth())
        .send({ role: ROLES.ORGANIZER });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid user id");
      expect(User.findById).toHaveBeenCalledTimes(1);
    });

    test.each(["Admin", "InvalidRole", "", null])(
      "rejects an invalid assignable role: %s",
      async (role) => {
        mockAdminAuthentication();

        const res = await request(app)
          .patch(`/api/admin/users/${targetId}/role`)
          .set(auth())
          .send({ role });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Validation failed");
        expect(res.body.errors.role).toBe(
          "Role must be Participant or Organizer"
        );
        expect(User.findById).toHaveBeenCalledTimes(1);
      }
    );

    test("returns 404 when the target user does not exist", async () => {
      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .patch(`/api/admin/users/${missingId}/role`)
        .set(auth())
        .send({ role: ROLES.ORGANIZER });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    test("prevents an administrator from changing their own role", async () => {
      const admin = adminUser();

      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(admin);

      const res = await request(app)
        .patch(`/api/admin/users/${adminId}/role`)
        .set(auth())
        .send({ role: ROLES.PARTICIPANT });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        "Administrators cannot change their own role"
      );
      expect(admin.save).not.toHaveBeenCalled();
    });

    test("prevents changing another administrator's role", async () => {
      const anotherAdmin = makeUser({
        role: ROLES.ADMIN,
        _id: targetId,
      });

      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockResolvedValueOnce(anotherAdmin);

      const res = await request(app)
        .patch(`/api/admin/users/${targetId}/role`)
        .set(auth())
        .send({ role: ROLES.PARTICIPANT });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "Administrator roles cannot be changed here"
      );
      expect(anotherAdmin.save).not.toHaveBeenCalled();
    });

    test.each([ROLES.PARTICIPANT, ROLES.ORGANIZER])(
      "updates a user's role to %s",
      async (role) => {
        const user = makeUser();

        jest
          .spyOn(User, "findById")
          .mockResolvedValueOnce(adminUser())
          .mockResolvedValueOnce(user);

        const res = await request(app)
          .patch(`/api/admin/users/${targetId}/role`)
          .set(auth())
          .send({ role });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("User role updated");
        expect(res.body.user.role).toBe(role);
        expect(user.role).toBe(role);
        expect(user.save).toHaveBeenCalledTimes(1);
      }
    );

    test("returns 500 when saving the role update fails", async () => {
      const user = makeUser({
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
      });

      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockResolvedValueOnce(user);

      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch(`/api/admin/users/${targetId}/role`)
        .set(auth())
        .send({ role: ROLES.ORGANIZER });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(
        "Something went wrong. Please try again."
      );
    });

    test("returns 500 when finding the target user fails", async () => {
      jest
        .spyOn(User, "findById")
        .mockResolvedValueOnce(adminUser())
        .mockRejectedValueOnce(new Error("Database error"));

      jest.spyOn(console, "error").mockImplementation(() => {});

      const res = await request(app)
        .patch(`/api/admin/users/${targetId}/role`)
        .set(auth())
        .send({ role: ROLES.ORGANIZER });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe(
        "Something went wrong. Please try again."
      );
    });
  });

  describe("Admin route authorization", () => {
    test("rejects requests without an authentication token", async () => {
      const res = await request(app).get("/api/admin/users");

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Authentication required");
    });

    test("rejects authenticated non-admin users", async () => {
      jest
        .spyOn(User, "findById")
        .mockResolvedValue(makeUser({ role: ROLES.PARTICIPANT }));

      const res = await request(app)
        .get("/api/admin/users")
        .set(auth(targetId));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        "You do not have permission to perform this action"
      );
    });
  });
});
