require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const logger = require("./utils/logger");
const Registration = require("./models/Registration");
const {
  assertTransactionSupport,
  backfillRegistrationCounters,
} = require("./db/registrationIntegrity");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  await mongoose.connect(MONGO_URI);
  await assertTransactionSupport();
  await Registration.createIndexes();
  await backfillRegistrationCounters();

  logger.info("server.database_connected");

  app.listen(PORT, () => {
    logger.info("server.listening", { port: Number(PORT) });
  });
}

startServer().catch((error) => {
  logger.error("server.startup_failed", error);
  process.exitCode = 1;
});
