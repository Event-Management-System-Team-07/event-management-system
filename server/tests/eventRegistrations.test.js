const mongoose = require("mongoose");
const Event = require("../src/models/Event");
const Registration = require("../src/models/Registration");
const ROLES = require("../src/constants/roles");
const { getEventRegistrations } = require("../src/controllers/registrationController");

const eventId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();
const otherId = new mongoose.Types.ObjectId();
const event = { _id: eventId, organizer: ownerId };

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

afterEach(() => jest.restoreAllMocks());

describe("getEventRegistrations", () => {
  test("event owner receives active participant rows and a registration count", async () => {
    const rows = [{ user: { name: "Participant", email: "participant@example.com" } }];
    const sort = jest.fn().mockResolvedValue(rows);
    const populate = jest.fn().mockReturnValue({ sort });
    const select = jest.fn().mockReturnValue({ populate });
    jest.spyOn(Event, "findById").mockResolvedValue(event);
    jest.spyOn(Registration, "find").mockReturnValue({ select });
    const res = response();

    await getEventRegistrations(
      { params: { eventId: eventId.toString() }, user: { _id: ownerId, role: ROLES.ORGANIZER } },
      res
    );

    expect(Registration.find).toHaveBeenCalledWith({ event: eventId, status: "active" });
    expect(select).toHaveBeenCalledWith("user createdAt");
    expect(populate).toHaveBeenCalledWith("user", "name email");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ eventId, registrationCount: 1, registrations: rows });
  });

  test("organizer cannot view another organizer's participants", async () => {
    jest.spyOn(Event, "findById").mockResolvedValue(event);
    const find = jest.spyOn(Registration, "find");
    const res = response();

    await getEventRegistrations(
      { params: { eventId: eventId.toString() }, user: { _id: otherId, role: ROLES.ORGANIZER } },
      res
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(find).not.toHaveBeenCalled();
  });
});
