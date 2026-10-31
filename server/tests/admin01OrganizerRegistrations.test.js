const mongoose = require("mongoose");
const Event = require("../src/models/Event");
const Registration = require("../src/models/Registration");
const ROLES = require("../src/constants/roles");
const { getEventRegistrations } = require("../src/controllers/registrationController");

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

afterEach(() => jest.restoreAllMocks());

test("event owner receives an empty participant list and a zero count", async () => {
  const eventId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const sort = jest.fn().mockResolvedValue([]);
  const populate = jest.fn().mockReturnValue({ sort });
  const select = jest.fn().mockReturnValue({ populate });
  jest.spyOn(Event, "findById").mockResolvedValue({ _id: eventId, organizer: ownerId });
  jest.spyOn(Registration, "find").mockReturnValue({ select });
  const res = response();

  await getEventRegistrations(
    { params: { eventId: eventId.toString() }, user: { _id: ownerId, role: ROLES.ORGANIZER } },
    res
  );

  expect(Registration.find).toHaveBeenCalledWith({ event: eventId, status: "active" });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ eventId, registrationCount: 0, registrations: [] });
});
