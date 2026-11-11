const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const token = window.localStorage.getItem("token");
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection and try again.");
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    const error = new Error(
      payload.message || "Something went wrong. Please try again."
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function getEvents() {
  return request("/api/events");
}

export function getRegistrationHistory() {
  return request("/api/events/registrations/history");
}

export function registerForEvent(eventId) {
  return request(`/api/events/${eventId}/register`, {
    method: "POST",
  });
}

export function cancelRegistration(eventId) {
  return request(`/api/events/${eventId}/register`, {
    method: "DELETE",
  });
}
