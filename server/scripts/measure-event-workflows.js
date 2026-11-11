require("dotenv").config();

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");

const User = require("../src/models/User");
const Event = require("../src/models/Event");
const Registration = require("../src/models/Registration");
const { hashPassword } = require("../src/utils/password");

const API_URL = process.env.PERF_API_URL || "http://localhost:5000";
const SAMPLES = 100;
const WARMUP = 10;
const TARGET_MS = 3000;

const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

let organizer;
let participant;
let eventIds = [];

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
}

async function timedRequest(url, options) {
  const start = performance.now();

  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  const elapsed = performance.now() - start;

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${data?.message || "Request failed"}`
    );
  }

  return { elapsed, data };
}

async function benchmark(label, count, warmup, request, validate) {
  console.log(`\nRunning ${label}...`);

  for (let i = 0; i < warmup; i++) {
    const result = await request(i);
    validate(result.data);
  }

  const timings = [];

  for (let i = 0; i < count; i++) {
    const result = await request(i + warmup);
    validate(result.data);
    timings.push(result.elapsed);
  }

  const passed = timings.filter((time) => time <= TARGET_MS).length;
  const percentage = (passed / count) * 100;

  const result = {
    operation: label,
    samples: count,
    warmupRequests: warmup,
    averageMs: Number(
      (timings.reduce((sum, value) => sum + value, 0) / count).toFixed(2)
    ),
    p50Ms: Number(percentile(timings, 0.50).toFixed(2)),
    p95Ms: Number(percentile(timings, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...timings).toFixed(2)),
    within3Seconds: passed,
    within3SecondsPercent: Number(percentage.toFixed(2)),
    targetMet: percentage >= 95,
  };

  console.log(JSON.stringify(result, null, 2));

  return result;
}

async function main() {
  if (process.env.PERF_CONFIRM_LOCAL !== "YES") {
    throw new Error("Set PERF_CONFIRM_LOCAL=YES to confirm this local benchmark.");
  }

  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGO_URI and JWT_SECRET must be configured.");
  }

  const api = new URL(API_URL);
  if (!["localhost", "127.0.0.1", "::1"].includes(api.hostname)) {
    throw new Error("Benchmark API must be running locally.");
  }

  const mongoHost = new URL(process.env.MONGO_URI).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(mongoHost)) {
    throw new Error("Benchmark database must be local.");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const health = await fetch(`${API_URL}/api/health`);
  if (!health.ok) {
    throw new Error("Backend health check failed.");
  }

  console.log("Connected to local MongoDB and backend.");

  organizer = await User.create({
    name: `PERF Organizer ${runId}`,
    email: `perf-organizer-${runId}@example.test`,
    passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
    role: "Organizer",
  });

  participant = await User.create({
    name: `PERF Participant ${runId}`,
    email: `perf-participant-${runId}@example.test`,
    passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
    role: "Participant",
  });

  const token = jwt.sign(
    { sub: participant._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const totalEvents = SAMPLES + WARMUP;
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const events = Array.from({ length: totalEvents }, (_, index) => ({
    title: `PERF-01 ${runId} Event ${index + 1}`,
    description: "Temporary event for performance measurement.",
    category: "Performance",
    venue: "Local Benchmark Venue",
    startDate,
    endDate,
    capacity: 2,
    activeRegistrations: 0,
    status: "published",
    organizer: organizer._id,
  }));

  const createdEvents = await Event.insertMany(events);
  eventIds = createdEvents.map((event) => event._id);

  console.log(`Seeded ${totalEvents} temporary published events.`);

  const listingResult = await benchmark(
    "GET /api/events",
    SAMPLES,
    WARMUP,
    () =>
      timedRequest(`${API_URL}/api/events?page=1&limit=50`, {
        headers,
      }),
    (data) => {
      if (!Array.isArray(data?.events)) {
        throw new Error("Unexpected event-list response.");
      }
    }
  );

  const registrationResult = await benchmark(
    "POST /api/events/:eventId/register",
    SAMPLES,
    WARMUP,
    (index) =>
      timedRequest(
        `${API_URL}/api/events/${eventIds[index]}/register`,
        {
          method: "POST",
          headers,
        }
      ),
    (data) => {
      if (data?.message !== "Registration successful") {
        throw new Error("Unexpected registration response.");
      }
    }
  );

  console.log("\n========== PERF-01 SUMMARY ==========");
  console.log(
    JSON.stringify(
      {
        target: "At least 95% of requests within 3000 ms",
        listing: listingResult,
        registration: registrationResult,
        overallTargetMet:
          listingResult.targetMet && registrationResult.targetMet,
      },
      null,
      2
    )
  );

  if (!listingResult.targetMet || !registrationResult.targetMet) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\nBenchmark failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      if (eventIds.length) {
        await Registration.deleteMany({ event: { $in: eventIds } });
        await Event.deleteMany({ _id: { $in: eventIds } });
      }

      const userIds = [organizer?._id, participant?._id].filter(Boolean);

      if (userIds.length) {
        await User.deleteMany({ _id: { $in: userIds } });
      }

      console.log("\nTemporary benchmark data cleaned up.");
      await mongoose.disconnect();
    }
  });
