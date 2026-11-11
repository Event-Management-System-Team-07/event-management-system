const mongoose = require("mongoose");
const Event = require("../src/models/Event");
const {
  listEvents,
  getEvent,
} = require("../src/controllers/adminEventController");

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Admin Event Management", () => {
  describe("listEvents", () => {
    test("returns events with default pagination", async () => {
      const events = [{ title: "Tech Fest" }];
      const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(events),
      };

      jest.spyOn(Event, "find").mockReturnValue(query);
      jest.spyOn(Event, "countDocuments").mockResolvedValue(1);

      const res = response();

      await listEvents({ query: {} }, res);

      expect(Event.find).toHaveBeenCalledWith({});
      expect(query.populate).toHaveBeenCalledWith("organizer", "name email");
      expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(50);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        events,
        pagination: {
          page: 1,
          pageSize: 50,
          total: 1,
          totalPages: 1,
        },
      });
    });

    test("filters events by status and applies pagination", async () => {
      const events = [{ title: "Published Event" }];
      const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(events),
      };

      jest.spyOn(Event, "find").mockReturnValue(query);
      jest.spyOn(Event, "countDocuments").mockResolvedValue(75);

      const res = response();

      await listEvents({ query: { page: "2", status: "published" } }, res);

      expect(Event.find).toHaveBeenCalledWith({ status: "published" });
      expect(Event.countDocuments).toHaveBeenCalledWith({
        status: "published",
      });
      expect(query.skip).toHaveBeenCalledWith(50);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        events,
        pagination: {
          page: 2,
          pageSize: 50,
          total: 75,
          totalPages: 2,
        },
      });
    });

    test.each(["0", "-1", "1.5", "abc"])(
      "rejects invalid page value: %s",
      async (page) => {
        const findSpy = jest.spyOn(Event, "find");
        const res = response();

        await listEvents({ query: { page } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "page must be a positive integer",
        });
        expect(findSpy).not.toHaveBeenCalled();
      },
    );

    test.each(["invalid", "archived", ["published", "draft"]])(
      "rejects invalid status value",
      async (status) => {
        const findSpy = jest.spyOn(Event, "find");
        const res = response();

        await listEvents({ query: { status } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Invalid event status",
        });
        expect(findSpy).not.toHaveBeenCalled();
      },
    );

    test("returns a server error when event retrieval fails", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(Event, "find").mockImplementation(() => {
        throw new Error("Database failure");
      });

      const res = response();

      await listEvents({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Something went wrong. Please try again.",
      });
    });
  });

  describe("getEvent", () => {
    test("returns an event when a valid ID exists", async () => {
      const eventId = new mongoose.Types.ObjectId();
      const event = { _id: eventId, title: "Tech Fest" };

      const populate = jest.fn().mockResolvedValue(event);
      jest.spyOn(Event, "findById").mockReturnValue({ populate });

      const res = response();

      await getEvent({ params: { id: eventId.toString() } }, res);

      expect(Event.findById).toHaveBeenCalledWith(eventId.toString());
      expect(populate).toHaveBeenCalledWith("organizer", "name email");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ event });
    });

    test("rejects an invalid event ID", async () => {
      const findByIdSpy = jest.spyOn(Event, "findById");
      const res = response();

      await getEvent({ params: { id: "invalid-id" } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Invalid event id",
      });
      expect(findByIdSpy).not.toHaveBeenCalled();
    });

    test("returns 404 when the event does not exist", async () => {
      const eventId = new mongoose.Types.ObjectId();

      const populate = jest.fn().mockResolvedValue(null);
      jest.spyOn(Event, "findById").mockReturnValue({ populate });

      const res = response();

      await getEvent({ params: { id: eventId.toString() } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Event not found",
      });
    });

    test("returns a server error when event retrieval fails", async () => {
      const eventId = new mongoose.Types.ObjectId();

      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(Event, "findById").mockImplementation(() => {
        throw new Error("Database failure");
      });

      const res = response();

      await getEvent({ params: { id: eventId.toString() } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Something went wrong. Please try again.",
      });
    });
  });
});
