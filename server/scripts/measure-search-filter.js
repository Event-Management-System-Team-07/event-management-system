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
const TARGET_MS = 2000;

const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

let participant;
let organizer;
let eventIds = [];

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
}

async function timedRequest(url, headers) {
  const start = performance.now();

  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => null);

  const elapsed = performance.now() - start;

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${data?.message || "Request failed"}`
    );
  }

  return { elapsed, data };
}

async function benchmark(label, url, headers) {
  console.log(`\nRunning ${label}...`);

  for (let i = 0; i < WARMUP; i++) {
    const result = await timedRequest(url, headers);
    validateResponse(result.data);
  }

  const timings = [];

  for (let i = 0; i < SAMPLES; i++) {
    const result = await timedRequest(url, headers);
    validateResponse(result.data);
    timings.push(result.elapsed);
  }

  const passed = timings.filter((time) => time <= TARGET_MS).length;
  const percentage = (passed / SAMPLES) * 100;

  const result = {
    operation: label,
    samples: SAMPLES,
    warmupRequests: WARMUP,
    averageMs: Number(
      (timings.reduce((sum, value) => sum + value, 0) / SAMPLES).toFixed(2)
    ),
    p50Ms: Number(percentile(timings, 0.50).toFixed(2)),
    p95Ms: Number(percentile(timings, 0.95).toFixed(2)),
    maxMs: Number(Math.max(...timings).toFixed(2)),
    within2Seconds: passed,
    within2SecondsPercent: Number(percentage.toFixed(2)),
    targetMet: percentage >= 95,
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function validateResponse(data) {
  if (!Array.isArray(data?.events)) {
    throw new Error("Unexpected event-list response.");
  }

  if (data.total < 1) {
    throw new Error("The search/filter request returned no matching events.");
  }
}

async function main() {
  if (process.env.PERF_CONFIRM_LOCAL !== "YES") {
    throw new Error("Set PERF_CONFIRM_LOCAL=YES to confirm the local benchmark.");
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

  participant = await User.create({
    name: `PERF02 Participant ${runId}`,
    email: `perf02-participant-${runId}@example.test`,
    passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
    role: "Participant",
  });

  organizer = await User.create({
    name: `PERF02 Organizer ${runId}`,
    email: `perf02-organizer-${runId}@example.test`,
    passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
    role: "Organizer",
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

  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);

  const fromDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const toDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  const totalEvents = 110;
  const searchTerm = `PERF02-${runId}`;

  const events = Array.from({ length: totalEvents }, (_, index) => ({
    title: `${searchTerm} Event ${index + 1}`,
    description: "Temporary search and filter performance benchmark event.",
    category: "Performance",
    venue: "Local Benchmark Venue",
    startDate,
    endDate,
    capacity: 50,
    activeRegistrations: 0,
    status: "published",
    organizer: organizer._id,
  }));

  const createdEvents = await Event.insertMany(events);
  eventIds = createdEvents.map((event) => event._id);

  console.log(`Seeded ${totalEvents} temporary published events.`);

  const dateParams =
    `from=${encodeURIComponent(fromDate.toISOString())}` +
    `&to=${encodeURIComponent(toDate.toISOString())}`;

  const cases = [
    {
      label: "Text search",
      query: `search=${encodeURIComponent(searchTerm)}`,
    },
    {
      label: "Category filter",
      query: "category=Performance",
    },
    {
      label: "Date-range filter",
      query: dateParams,
    },
    {
      label: "Combined search and filters",
      query:
        `search=${encodeURIComponent(searchTerm)}` +
        `&category=Performance&${dateParams}`,
    },
  ];

  const results = [];

  for (const testCase of cases) {
    const url =
      `${API_URL}/api/events?page=1&limit=50&${testCase.query}`;

    results.push(
      await benchmark(testCase.label, url, headers)
    );
  }

  const overallTargetMet = results.every((result) => result.targetMet);

  console.log("\n========== PERF-02 SUMMARY ==========");
  console.log(
    JSON.stringify(
      {
        target: "At least 95% of requests within 2000 ms",
        results,
        overallTargetMet,
      },
      null,
      2
    )
  );

  if (!overallTargetMet) {
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

      const userIds = [
        participant?._id,
        organizer?._id,
      ].filter(Boolean);

      if (userIds.length) {
        await User.deleteMany({ _id: { $in: userIds } });
      }

      console.log("\nTemporary benchmark data cleaned up.");
      await mongoose.disconnect();
    }
  });
