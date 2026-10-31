# Dashboard performance measurement

Issue #41 defines a five-second dashboard response target. Use the server-side
measurement harness to record repeatable latency samples against the dashboard
GET endpoint in the demo environment.

```powershell
$env:DASHBOARD_URL = "http://localhost:5000/api/your-dashboard-endpoint"
$env:AUTH_TOKEN = "<organizer-or-admin-bearer-token>"
$env:SAMPLES = "100"
$env:WARMUP = "10"
$env:TARGET_P95_MS = "5000"
npm run perf:dashboard --prefix server
```

The harness warms the endpoint, records each response time, and prints mean,
median (p50), and p95 latency as JSON. It exits nonzero when any response is
non-2xx or p95 exceeds the configured target. Run it against the same seeded
dataset and machine used for the demonstration; record the JSON output with the
date, dataset size, and environment when reporting results.

The current API does not yet expose a dedicated dashboard endpoint. Set
`DASHBOARD_URL` to the endpoint being evaluated once that route is available;
the harness does not claim a performance result by itself.
