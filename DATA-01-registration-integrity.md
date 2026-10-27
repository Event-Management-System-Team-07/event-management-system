# DATA-01: Registration Data Integrity and Concurrency Testing

## Objective

Document registration data-integrity rules, capacity boundaries, cancellation behavior, and concurrency verification.

## 1. Duplicate Active Registrations

The Registration model defines a unique compound index on `user` and `event`, with a partial filter for `status: "active"`.

This is intended to prevent multiple active registrations for the same user and event while allowing a cancelled registration to be followed by a new active registration.

The schema test verifies that this index is defined. Actual enforcement depends on the index being created in MongoDB.

## 2. Event Capacity Boundaries

The event document maintains an `activeRegistrations` counter. In production, registration requires a connected MongoDB replica-set topology and runs inside one transaction. The transaction atomically increments the counter only when the counter is below `capacity`, then inserts the registration.

- When active registrations are below capacity, registration may proceed.
- When active registrations equal capacity, the controller returns HTTP 409 with the message `Event is full`.
- Cancelled registrations are excluded from the active registration count.

The mock-based unit tests verify response behavior. The integration tests verify the persisted counter and registration documents against MongoDB.

## 3. Cancellation and Re-registration

Cancellation atomically changes one active registration to `cancelled` and decrements the counter in the same transaction. The status predicate means a second cancellation finds no document and cannot decrement the counter again.

## 4. Concurrency Safety

The production database path does not use a disconnected count fallback. Concurrent requests compete on the same event document inside transactions, so MongoDB can commit at most `capacity` reservations. If registration creation fails, the transaction aborts and the counter increment is rolled back.

The partial unique index still protects duplicate active registrations for the same user and event. A duplicate-key response aborts the transaction and returns HTTP 409.

## 5. Counter Backfill

On server startup, before the HTTP listener starts, active registrations are aggregated and every event's counter is set to that authoritative count. This handles events created before the counter field existed and does not treat a missing field as zero. The same backfill helper is used by the integration suite.

The backfill runs in a transaction and coordinates with registration and cancellation transactions through a dedicated lock collection. Every current application writer touches that lock in its transaction, so it cannot commit while the backfill transaction is updating counters. This is safe only when all application instances use this version of the code; an older instance that writes registrations without the coordination lock must be stopped before startup backfill.

## 6. Local MongoDB Connectivity and Tests

The application requires MongoDB to be connected through a replica-set topology. `directConnection=true` is intentionally rejected for transactional registration because MongoDB does not expose replica-set transaction support in that topology. The server now fails with a clear startup error instead of silently using an unsafe fallback.

### Local Integration Tests

Run the integration tests from the `server` directory with a reachable MongoDB replica-set member. For the local setup used during testing:

```powershell
$env:RUN_MONGO_INTEGRATION = "1"
$env:MONGO_INTEGRATION_URI = "mongodb://127.0.0.1:27018/event-management-data01-test?replicaSet=rs-data01-test&retryWrites=false"
npm test -- --runTestsByPath tests/registration.integration.test.js
```

The local URI assumes that the MongoDB replica-set container is reachable on port `27018` and that its replica-set name is `rs-data01-test`.

The integration suite requires `MONGO_INTEGRATION_URI`; it never falls back to the application `.env`. It verifies replica-set discovery and a committed transaction before starting the application in a separate Node process. Startup then connects to MongoDB, verifies transaction support, creates indexes, runs the counter backfill, and only starts the HTTP listener after those steps complete.

The suite sends real HTTP requests through that server, including simultaneous duplicate requests for the same user and event, and verifies both the response statuses and persisted MongoDB state.

### Continuous Integration

Without `RUN_MONGO_INTEGRATION=1`, the integration suite is skipped; mock tests must not be reported as concurrency evidence.

CI starts a `mongo:7` container with replica set `rs-data01-test`, initializes it, runs the backend unit suite, and then runs the real MongoDB integration suite.

The CI integration-test configuration is:

```text
RUN_MONGO_INTEGRATION=1
MONGO_INTEGRATION_URI=mongodb://mongodb:27017/event-management-data01-test?replicaSet=rs-data01-test&retryWrites=false
MONGO_URI=mongodb://mongodb:27017/event-management-data01-test?replicaSet=rs-data01-test&retryWrites=false
JWT_SECRET=integration-test-secret
```

The hostname `mongodb` is the MongoDB service name used by the GitHub Actions job container. It is different from the local Windows host address used for local integration testing.

## 7. Event Counter Initialization

New events initialize `activeRegistrations` to `0` through the Event schema default. On startup, the transactional backfill recalculates that field for all existing events from active registrations, including events created before the field was introduced.

## 8. Verification Summary

The following results were observed during local testing:

- Backend unit tests: 199 passed and 6 skipped.
- MongoDB integration tests: 6 passed.
- `git diff --check`: clean at the time of the last check.

The unit tests and integration tests were run separately. The GitHub Actions workflow must run successfully before its CI status can be reported as passing.
