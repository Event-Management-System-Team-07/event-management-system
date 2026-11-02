import AppLink from "./AppLink";
import { availableCapacity, formatDate, formatTime } from "../lib/formatters";

export default function EventCard({ event, registrationStatus, onRegister, busy = false }) {
  const eventId = event._id || event.id;
  const remaining = availableCapacity(event);

  return (
    <article className="event-card">
      <div className={`event-banner category-${String(event.category || "general").toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}>
        <span>{event.category || "General"}</span>
        <span className="banner-symbol" aria-hidden="true">✦</span>
      </div>
      <div className="event-content">
        <div className="event-date">
          <span>{formatDate(event.startDate)}</span>
          <span>{formatTime(event.startDate)}</span>
        </div>
        <h3><AppLink href={`/events/${eventId}`}>{event.title}</AppLink></h3>
        <p className="event-description">{event.description}</p>
        <p className="event-location">{event.venue}</p>
        <div className="event-footer">
          <span>{remaining} of {event.capacity} seats available</span>
          <AppLink
            className="button button-secondary"
            href={`/events/${eventId}`}
            aria-label={`View details for ${event.title}`}
          >
            View details
          </AppLink>
          {registrationStatus === "active" ? (
            <button type="button" className="button button-secondary" disabled={busy} onClick={() => onRegister(event, true)}>
              {busy ? "Please wait..." : "Cancel registration"}
            </button>
          ) : (
            <button type="button" disabled={busy || event.status === "cancelled" || remaining === 0 || new Date(event.startDate) <= new Date()} onClick={() => onRegister(event, false)}>
              {busy ? "Please wait..." : event.status === "cancelled" ? "Event cancelled" : remaining === 0 ? "Event full" : new Date(event.startDate) <= new Date() ? "Registration closed" : "Register"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
