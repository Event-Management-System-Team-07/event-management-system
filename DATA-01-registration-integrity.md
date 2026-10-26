# DATA-01: Registration Data Integrity and Concurrency Testing

## Objective

Document registration data-integrity rules, capacity boundaries, cancellation behavior, and concurrency limitations.

## 1. Duplicate Active Registrations

The Registration model defines a unique compound index on `user` and `event`, with a partial filter for `status: "active"`.

This is intended to prevent multiple active registrations for the same user and event while allowing a cancelled registration to be followed by a new active registration.

The schema test verifies that this index is defined. Actual enforcement depends on the index being created in MongoDB.

## 2. Event Capacity Boundaries

The registration controller counts active registrations before creating a new registration.

- When active registrations are below capacity, registration may proceed.
- When active registrations equal capacity, the controller returns HTTP 409 with the message `Event is full`.
- Cancelled registrations are excluded from the active registration count.

The current unit tests use mocked model methods to verify these controller decisions.

## 3. Cancellation and Re-registration

Cancellation changes an active registration to `cancelled` and saves the document.

The tests verify the controller's cancellation response and status update using mocks. They do not verify persistence against a real MongoDB instance.

## 4. Concurrency Limitation

The current registration flow performs `countDocuments()` followed by `Registration.create()` as separate operations.

Concurrent requests can both observe an available seat and then both create registrations. Therefore, the current implementation does not guarantee that event capacity is respected under concurrent requests.

The partial unique index protects duplicate active registrations for the same user and event, but it does not prevent different users from exceeding an event's capacity.

## 5. Verification Status

The Jest test suite currently passes 196 tests across 12 suites.

The existing registration tests use mocked model operations. They verify selected controller behaviors but do not establish real database index enforcement, transaction consistency, or concurrent capacity safety.

A real MongoDB integration test and a concurrency-safe capacity enforcement strategy are still needed to verify those properties.
