export function getActiveRegistrationIds(registrations = []) {
  return new Set(
    registrations
      .filter((registration) => registration?.status === "active")
      .map((registration) =>
        typeof registration.event === "object"
          ? registration.event?._id
          : registration.event
      )
      .filter(Boolean)
  );
}

export function updateEventRegistrationCount(events, eventId, change) {
  return events.map((event) => {
    if (event._id !== eventId || typeof event.activeRegistrations !== "number") {
      return event;
    }

    return {
      ...event,
      activeRegistrations: Math.max(0, event.activeRegistrations + change),
    };
  });
}

export function getRegistrationErrorMessage(error = {}) {
  const message =
    typeof error.message === "string" ? error.message : "Something went wrong. Please try again.";
  const normalizedMessage = message.toLowerCase();

  if (error.status === 401) {
    return "Your session is missing or has expired. Please log in and try again.";
  }
  if (error.status === 403) {
    return "You do not have permission to manage event registrations.";
  }
  if (error.status === 404 && normalizedMessage.includes("registration")) {
    return "No active registration was found for this event.";
  }
  if (error.status === 404) {
    return "This event could not be found. Refresh the page and try again.";
  }
  if (error.status === 409 && normalizedMessage.includes("full")) {
    return "This event is full. Please choose another event.";
  }
  if (error.status === 409 && normalizedMessage.includes("already registered")) {
    return "You are already registered for this event.";
  }
  if (
    error.status === 400 &&
    (normalizedMessage.includes("deadline") ||
      normalizedMessage.includes("published"))
  ) {
    return "Registration is closed because this event is no longer available.";
  }
  if (error.status === 400) {
    return message;
  }
  if (error.status >= 500) {
    return "The registration service is temporarily unavailable. Please try again.";
  }
  return message;
}
