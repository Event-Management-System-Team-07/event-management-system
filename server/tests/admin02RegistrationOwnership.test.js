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

test("administrator can view registrations for an event owned by another organizer", async () => {
  const eventId = new mongoose.Types.ObjectId();
  const organizerId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const rows = [{ user: { name: "Participant", email: "participant@example.com" } }];
  const sort = jest.fn().mockResolvedValue(rows);
  const populate = jest.fn().mockReturnValue({ sort });
  const select = jest.fn().mockReturnValue({ populate });
  jest.spyOn(Event, "findById").mockResolvedValue({ _id: eventId, organizer: organizerId });
  jest.spyOn(Registration, "find").mockReturnValue({ select });
  const res = response();

  await getEventRegistrations(
    { params: { eventId: eventId.toString() }, user: { _id: adminId, role: ROLES.ADMIN } },
    res
  );

  expect(Registration.find).toHaveBeenCalledWith({ event: eventId, status: "active" });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ eventId, registrationCount: 1, registrations: rows });
});
