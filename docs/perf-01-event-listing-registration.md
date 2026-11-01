# PERF-01: Event Listing and Registration Performance

**Date:** 1 November 2026
**Requirement:** At least 95% of measured requests must complete within 3 seconds.

## Test Environment

- Platform: Local Ubuntu development environment
- Node.js: v22.22.1
- Docker: 29.1.3
- Database: MongoDB 7, running locally in Docker
- MongoDB topology: Replica set (rs0)
- Backend: Node.js / Express
- API: http://localhost:5000

## Workload

- 110 temporary published events were created.
- One temporary Organizer account and one Participant account were created.
- 10 warm-up requests and 100 measured requests were used for each operation.
- Requests were executed sequentially.
- Registration requests used distinct events.
- Only benchmark-created records were removed after testing.

## Results

### Event Listing

Endpoint: GET /api/events

| Metric | Result |
|---|---:|
| Measured requests | 100 |
| Average response time | 13.43 ms |
| p50 | 12.40 ms |
| p95 | 17.36 ms |
| Requests within 3 seconds | 100% |
| Result | PASS |

### Event Registration

Endpoint: POST /api/events/:eventId/register

| Metric | Result |
|---|---:|
| Measured requests | 100 |
| Average response time | 21.84 ms |
| p50 | 21.23 ms |
| p95 | 27.55 ms |
| Requests within 3 seconds | 100% |
| Result | PASS |

## Conclusion

Both event listing and normal participant registration met the
3-second response-time target in this local benchmark run.

The measured results exceeded the required 95% threshold.

## Limitations

This was a sequential, single-client test on a local development
environment. It does not establish performance under concurrent
users or production infrastructure.

The exact CPU and RAM configuration was not recorded.
