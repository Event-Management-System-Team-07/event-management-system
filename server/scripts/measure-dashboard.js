const { performance } = require("node:perf_hooks");

const url = process.env.DASHBOARD_URL;
const samples = Number.parseInt(process.env.SAMPLES || "100", 10);
const warmup = Number.parseInt(process.env.WARMUP || "10", 10);
const targetMs = Number.parseFloat(process.env.TARGET_P95_MS || "5000");

if (!url) {
  console.error("Set DASHBOARD_URL to the dashboard GET endpoint under measurement.");
  process.exit(2);
}
if (![samples, warmup].every(Number.isInteger) || samples < 1 || warmup < 0) {
  console.error("SAMPLES must be a positive integer and WARMUP a non-negative integer.");
  process.exit(2);
}

const headers = { Accept: "application/json" };
if (process.env.AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.AUTH_TOKEN}`;

async function measure() {
  const timings = [];
  let statusFailures = 0;
  for (let i = 0; i < warmup + samples; i += 1) {
    const start = performance.now();
    const response = await fetch(url, { headers });
    await response.arrayBuffer();
    const elapsed = performance.now() - start;
    if (!response.ok) statusFailures += 1;
    if (i >= warmup) timings.push(elapsed);
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const percentile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
  const result = {
    url: new URL(url).pathname,
    samples,
    warmup,
    non2xxResponses: statusFailures,
    meanMs: Number((timings.reduce((sum, value) => sum + value, 0) / samples).toFixed(2)),
    p50Ms: Number(percentile(0.5).toFixed(2)),
    p95Ms: Number(percentile(0.95).toFixed(2)),
    targetP95Ms: targetMs,
  };
  console.log(JSON.stringify(result, null, 2));
  if (statusFailures > 0 || result.p95Ms > targetMs) process.exitCode = 1;
}

measure().catch((error) => {
  console.error(`Measurement failed: ${error.name || "Error"}`);
  process.exitCode = 1;
});
