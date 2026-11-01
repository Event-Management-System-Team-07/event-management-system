import { useEffect, useState } from "react";
import AppLink from "../components/AppLink";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import { apiRequest } from "../lib/api";
import { availableCapacity, formatDate, formatTime } from "../lib/formatters";

export default function RegistrationHistoryPage() {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest("/events/registrations/history").then((result) => {
      if (active) setRegistrations(result.registrations || []);
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="page-shell narrow-shell">
      <section className="page-heading">
        <span className="eyebrow">PARTICIPANT DASHBOARD</span>
        <h1>My registrations</h1>
        <p>Registration history returned by Eventify.</p>
        <AppLink className="text-link" href="/participant">← Explore events</AppLink>
      </section>
      <StatusMessage>{error}</StatusMessage>
      {loading ? <LoadingState label="Loading your registrations..." /> : registrations.length ? (
        <div className="history-list">
          {registrations.map((registration) => {
            const event = registration.event;
            const eventId = event?._id || event?.id;
            return (
              <article className="history-card" key={registration._id}>
                <div className="history-card-heading">
                  <div>
                    <span className={`status-badge status-${registration.status}`}>{registration.status === "active" ? "Registered" : "Cancelled"}</span>
                    <h2>{event?.title || "Event no longer available"}</h2>
                  </div>
                  {eventId && <AppLink className="button button-secondary" href={`/events/${eventId}`}>Event details</AppLink>}
                </div>
                {event && (
                  <div className="event-facts">
                    <span>{formatDate(event.startDate)} · {formatTime(event.startDate)}</span>
                    <span>{event.venue}</span>
                    <span>{availableCapacity(event)} seats remaining</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><h2>No registrations yet</h2><p>When you register for an event, it will appear here.</p><AppLink className="button" href="/participant">Explore events</AppLink></div>
      )}
    </main>
  );
}
