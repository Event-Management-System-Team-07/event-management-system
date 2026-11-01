# PERF-02: Search and Filter Performance

**Date:** 1 November 2026
**Requirement:** Search and filter requests should complete within approximately 2 seconds.

## Test Environment

- Platform: Local Ubuntu development environment
- Node.js: v22.22.1
- Docker: 29.1.3
- Database: MongoDB 7 in Docker
- MongoDB topology: Replica set (rs0)
- Backend: Node.js / Express
- API: http://localhost:5000

## Workload

- 110 temporary published events.
- One temporary Participant account.
- One temporary Organizer account.
- 10 warm-up requests per operation.
- 100 measured requests per operation.
- Requests executed sequentially.
- Temporary benchmark records cleaned up afterward.

## Results

| Operation | Average | p50 | p95 | Maximum | Under 2 seconds |
|---|---:|---:|---:|---:|---:|
| Text search | 13.58 ms | 12.35 ms | 22.71 ms | 34.69 ms | 100% |
| Category filter | 11.32 ms | 9.54 ms | 17.59 ms | 18.44 ms | 100% |
| Date-range filter | 11.03 ms | 9.51 ms | 17.06 ms | 24.83 ms | 100% |
| Combined search and filters | 12.82 ms | 12.05 ms | 18.77 ms | 22.51 ms | 100% |

## Conclusion

All four search and filter operations met the approximately
2-second performance target.

All 400 measured requests completed within 2 seconds.

## Limitations

This was a sequential, single-client test on a local development
environment. It does not establish performance under concurrent
users or production infrastructure.

The exact CPU and RAM configuration was not recorded.
