const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
const SESSION_KEY = "eventify_session";

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function readSession() {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (typeof session?.token === "string" && session.user) return session;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }

  window.sessionStorage.removeItem(SESSION_KEY);
  return null;
}

export function saveSession(session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

function getErrorMessage(data, fallback) {
  const messages = [];
  if (typeof data?.message === "string") messages.push(data.message);
  if (Array.isArray(data?.errors)) messages.push(...data.errors.filter((item) => typeof item === "string"));
  if (data?.errors && !Array.isArray(data.errors)) {
    messages.push(...Object.values(data.errors).filter((item) => typeof item === "string"));
  }
  return messages.join(". ") || fallback;
}

export async function apiRequest(path, { method = "GET", body, signal, authenticated = true } = {}) {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const token = authenticated ? readSession()?.token : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Unable to reach the Eventify server. Check your connection and try again.", 0);
  }

  let data;
  try {
    data = response.status === 204 ? {} : await response.json();
  } catch {
    throw new ApiError("The server returned an unreadable response. Please try again.", response.status);
  }

  if (response.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new Event("eventify:session-expired"));
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, `Request failed (${response.status}).`), response.status, data?.errors);
  }

  return data;
}

export async function fetchPublishedEvents() {
  const firstPage = await apiRequest("/events?limit=50");
  const events = [...(firstPage.events || [])];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const result = await apiRequest(`/events?page=${page}&limit=50`);
    events.push(...(result.events || []));
  }
  return events;
}

export function rememberCreatedEvent(userId, eventId) {
  const key = `eventify_created_events_${userId}`;
  const eventIds = getRememberedEventIds(userId);
  if (!eventIds.includes(eventId)) {
    window.localStorage.setItem(key, JSON.stringify([...eventIds, eventId]));
  }
}

export function getRememberedEventIds(userId) {
  const key = `eventify_created_events_${userId}`;
  const value = window.localStorage.getItem(key);
  if (!value) return [];
  try {
    const ids = JSON.parse(value);
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}
