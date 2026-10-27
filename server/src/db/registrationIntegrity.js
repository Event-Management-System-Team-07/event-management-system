const mongoose = require("mongoose");
const Event = require("../models/Event");
const Registration = require("../models/Registration");

const BACKFILL_LOCK_ID = "registration-counter-backfill";
const getBackfillLocks = () =>
  mongoose.connection.db.collection("registration_counter_locks");

class TransactionSupportError extends Error {
  constructor(message) {
    super(message);
    this.code = "TRANSACTIONS_UNSUPPORTED";
  }
}

function isMockTest() {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.RUN_MONGO_INTEGRATION !== "1"
  );
}

async function assertTransactionSupport() {
  if (isMockTest()) return;

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new TransactionSupportError("MongoDB is not connected");
  }

  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName || !hello.logicalSessionTimeoutMinutes) {
    throw new TransactionSupportError(
      "MongoDB must be connected through a replica-set topology"
    );
  }
}

async function backfillRegistrationCounters() {
  if (mongoose.connection.readyState !== 1) {
    throw new TransactionSupportError("MongoDB is not connected");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await getBackfillLocks().updateOne(
        { _id: BACKFILL_LOCK_ID },
        {
          $setOnInsert: {
            counterBackfillInProgress: false,
          },
        },
        { upsert: true, session }
      );

      const lock = await getBackfillLocks().updateOne(
        {
          _id: BACKFILL_LOCK_ID,
          $or: [
            { counterBackfillInProgress: false },
            { counterBackfillInProgress: { $exists: false } },
          ],
        },
        { $set: { counterBackfillInProgress: true } },
        { session }
      );
      if (lock.matchedCount !== 1) {
        throw new TransactionSupportError("Could not acquire backfill lock");
      }

      const counts = await Registration.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$event", count: { $sum: 1 } } },
      ]).session(session);
      const countByEvent = new Map(
        counts.map(({ _id, count }) => [_id.toString(), count])
      );
      const events = await Event.find({}, { _id: 1 }).session(session).lean();

      if (events.length) {
        await Event.bulkWrite(
          events.map(({ _id }) => ({
            updateOne: {
              filter: { _id },
              update: {
                $set: { activeRegistrations: countByEvent.get(_id.toString()) || 0 },
              },
            },
          })),
          { session }
        );
      }

      await getBackfillLocks().updateOne(
        { _id: BACKFILL_LOCK_ID },
        { $set: { counterBackfillInProgress: false } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

async function touchBackfillLock(session) {
  const result = await getBackfillLocks().updateOne(
    { _id: BACKFILL_LOCK_ID, counterBackfillInProgress: { $ne: true } },
    { $set: { counterBackfillLastUsedAt: new Date() } },
    { session }
  );
  if (result.matchedCount !== 1) {
    throw new TransactionSupportError(
      "Registration writes are temporarily paused for counter backfill"
    );
  }
}

module.exports = {
  BACKFILL_LOCK_ID,
  TransactionSupportError,
  assertTransactionSupport,
  backfillRegistrationCounters,
  isMockTest,
  touchBackfillLock,
};
