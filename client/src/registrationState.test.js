import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveRegistrationIds,
  getRegistrationErrorMessage,
  updateEventRegistrationCount,
} from "./registrationState.js";

test("registration history identifies active registrations", () => {
  const ids = getActiveRegistrationIds([
    { event: "event-1", status: "active" },
    { event: { _id: "event-2" }, status: "cancelled" },
    { event: { _id: "event-3" }, status: "active" },
  ]);

  assert.deepEqual([...ids], ["event-1", "event-3"]);
});

test("registering and cancelling keep the displayed seat count in sync", () => {
  const events = [{ _id: "event-1", activeRegistrations: 1 }];
  const registered = updateEventRegistrationCount(events, "event-1", 1);
  const cancelled = updateEventRegistrationCount(registered, "event-1", -1);

  assert.equal(registered[0].activeRegistrations, 2);
  assert.equal(cancelled[0].activeRegistrations, 1);
});

test("registration errors use backend status and message contracts", () => {
  assert.equal(
    getRegistrationErrorMessage({
      status: 409,
      message: "You are already registered for this event",
    }),
    "You are already registered for this event."
  );
  assert.equal(
    getRegistrationErrorMessage({ status: 409, message: "Event is full" }),
    "This event is full. Please choose another event."
  );
  assert.equal(
    getRegistrationErrorMessage({
      status: 400,
      message: "Registration deadline has passed",
    }),
    "Registration is closed because this event is no longer available."
  );
  assert.equal(
    getRegistrationErrorMessage({
      status: 401,
      message: "Authentication required",
    }),
    "Your session is missing or has expired. Please log in and try again."
  );
});
