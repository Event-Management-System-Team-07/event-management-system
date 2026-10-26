const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

const uri = process.env.MONGO_INTEGRATION_URI;
const dbName = "event-management-data01-test";

async function main() {
  const input = JSON.parse(process.argv[2]);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);

  if (input.operation === "probe") {
    const hello = await db.admin().command({ hello: 1 });
    if (hello.setName !== "rs-data01-test") {
      throw new Error(`Unexpected replica set: ${hello.setName}`);
    }
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection("transaction_probe").insertOne(
          { createdBy: "DATA-01 integration probe" },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
    await db.collection("transaction_probe").deleteMany({
      createdBy: "DATA-01 integration probe",
    });
    return { discoveredSet: hello.setName, transaction: "committed" };
  }

  if (input.operation === "createUser") {
    const user = {
      _id: new ObjectId(),
      name: `Integration User ${input.suffix}`,
      email: `data01-${input.suffix}-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: await bcrypt.hash("not-used", 4),
      role: "Participant",
    };
    await db.collection("users").insertOne(user);
    return { id: user._id.toString() };
  }

  if (input.operation === "createEvent") {
    const event = {
      _id: new ObjectId(),
      title: "DATA-01 integration event",
      description: "Temporary integration-test event",
      venue: "Integration venue",
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      capacity: input.capacity,
      activeRegistrations: 0,
      organizer: new ObjectId(),
      status: "published",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("events").insertOne(event);
    return { id: event._id.toString() };
  }

  if (input.operation === "state") {
    const eventId = new ObjectId(input.eventId);
    return {
      activeCount: await db.collection("registrations").countDocuments({
        event: eventId,
        status: "active",
      }),
      counter: (await db.collection("events").findOne({ _id: eventId })).activeRegistrations,
    };
  }

  if (input.operation === "indexes") {
    return {
      indexes: await db.collection("registrations").listIndexes().toArray(),
    };
  }

  if (input.operation === "directDuplicateInsert") {
    const userId = new ObjectId(input.userId);
    const eventId = new ObjectId(input.eventId);
    try {
      await db.collection("registrations").insertOne({
        user: userId,
        event: eventId,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      return { code: error.code };
    }
    throw new Error("Duplicate active registration insert unexpectedly succeeded");
  }

  if (input.operation === "cleanup") {
    const eventIds = input.eventIds.map((id) => new ObjectId(id));
    const userIds = input.userIds.map((id) => new ObjectId(id));
    await db.collection("registrations").deleteMany({ event: { $in: eventIds } });
    await db.collection("events").deleteMany({ _id: { $in: eventIds } });
    await db.collection("users").deleteMany({ _id: { $in: userIds } });
    return { cleaned: true };
  }

  throw new Error(`Unknown operation: ${input.operation}`);
}

main()
  .then((result) => {
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  })
  .catch((error) => {
    process.stderr.write(error.stack || error.message);
    process.exit(1);
  });
