# DATA-01: Registration Data Integrity and Concurrency Testing

## Objective

Document registration data-integrity rules, capacity boundaries, cancellation behavior, and concurrency verification.

## 1. Duplicate Active Registrations

The Registration model defines a unique compound index on `user` and `event`, with a partial filter for `status: "active"`.

This is intended to prevent multiple active registrations for the same user and event while allowing a cancelled registration to be followed by a new active registration.

The schema test verifies that this index is defined. Actual enforcement depends on the index being created in MongoDB.

## 2. Event Capacity Boundaries

The event document maintains an `activeRegistrations` counter. In production,
registration requires a connected MongoDB replica-set topology and runs inside
one transaction. The transaction atomically increments the counter only when
the counter is below `capacity`, then inserts the registration.

- When active registrations are below capacity, registration may proceed.
- When active registrations equal capacity, the controller returns HTTP 409 with the message `Event is full`.
- Cancelled registrations are excluded from the active registration count.

The mock-based unit tests verify response behavior. The integration tests verify
the persisted counter and registration documents against MongoDB.

## 3. Cancellation and Re-registration

Cancellation atomically changes one active registration to `cancelled` and
decrements the counter in the same transaction. The status predicate means a
second cancellation finds no document and cannot decrement the counter again.

## 4. Concurrency Safety

The production database path does not use a disconnected count fallback.
Concurrent requests compete on the same event document inside transactions, so
MongoDB can commit at most `capacity` reservations. If registration creation
fails, the transaction aborts and the counter increment is rolled back.

The partial unique index still protects duplicate active registrations for the
same user and event. A duplicate-key response aborts the transaction and
returns HTTP 409.

## 5. Counter backfill

On server startup, before the HTTP listener starts, active registrations are
aggregated and every event's counter is set to that authoritative count. This
handles events created before the counter field existed and does not treat a
missing field as zero. The same backfill helper is used by the integration
suite.

The backfill runs in a transaction and coordinates with registration and
cancellation transactions through a dedicated lock collection. Every current
application writer touches that lock in its transaction, so it cannot commit
while the backfill transaction is updating counters. This is safe only when
all application instances use this version of the code; an older instance
that writes registrations without the coordination lock must be stopped before
startup backfill.

## 6. Local MongoDB connectivity and tests

The Docker container currently advertises `127.0.0.1:27017`, but the Windows
Node driver cannot discover it as a replica set. `directConnection=true` is
intentionally rejected for transactional registration because MongoDB does not
expose replica-set transaction support in that topology. The server now fails
with a clear startup error instead of silently using an unsafe fallback.

Run real integration tests only with a routable replica-set URI:

```powershell
$env:RUN_MONGO_INTEGRATION = "1"
$env:MONGO_INTEGRATION_URI = "mongodb://<routable-member>:27017/event-management?replicaSet=rs0&retryWrites=false"
npm test -- --runTestsByPath tests/registration.integration.test.js
```

The integration suite requires `MONGO_INTEGRATION_URI`; it never falls back to
the application `.env`. It verifies discovery and a committed transaction
before starting the application in a separate Node process, then runs the five
real HTTP/database scenarios. The Jest worker uses an external MongoDB helper
for setup and assertions because the local Jest VM has a driver-handshake
compatibility issue; this does not change the application's transaction path.

Without `RUN_MONGO_INTEGRATION=1`, the integration suite is skipped; mock tests
must not be reported as concurrency evidence.
