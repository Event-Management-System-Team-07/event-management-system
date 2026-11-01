export function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Date not available";
  return new Date(value).toLocaleDateString("en-IN", options);
}

export function formatTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Time not available";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function toDateTimeLocal(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function availableCapacity(event) {
  return Math.max(0, Number(event.capacity || 0) - Number(event.activeRegistrations || 0));
}

export function organizerName(organizer) {
  if (organizer && typeof organizer === "object" && organizer.name) return organizer.name;
  return "Organizer profile not provided by the API";
}
