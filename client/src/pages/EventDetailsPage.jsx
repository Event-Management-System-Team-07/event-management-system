import { useEffect, useState } from "react";
import AppLink from "../components/AppLink";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../lib/authContext";
import { apiRequest } from "../lib/api";
import { availableCapacity, formatDate, formatTime, organizerName } from "../lib/formatters";

function getOrganizerId(organizer) {
  if (typeof organizer === "string") return organizer;
  return organizer?._id;
}

export default function EventDetailsPage({ eventId }) {
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest(`/events/${encodeURIComponent(eventId)}`),
      user?.role === "Participant" ? apiRequest("/events/registrations/history") : Promise.resolve({ registrations: [] }),
    ]).then(([eventResult, history]) => {
      if (!active) return;
      setEvent(eventResult.event);
      const current = (history.registrations || []).find((registration) =>
        (registration.event?._id || registration.event?.id) === eventId && registration.status === "active"
      );
      setRegistrationStatus(current ? "active" : "");
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [eventId, user?.role]);

  const remaining = event ? availableCapacity(event) : 0;
  const deadlinePassed = event && new Date(event.startDate) <= new Date();
  const organizer = event && typeof event.organizer === "object" ? event.organizer : null;

  async function changeRegistration() {
    if (!event) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/events/${encodeURIComponent(eventId)}/register`, {
        method: registrationStatus === "active" ? "DELETE" : "POST",
      });
      setRegistrationStatus(result.registration.status === "active" ? "active" : "");
      setEvent((current) => ({
        ...current,
        activeRegistrations: Math.max(0, Number(current.activeRegistrations || 0) + (result.registration.status === "active" ? 1 : -1)),
      }));
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page-shell"><LoadingState label="Loading event details..." /></main>;
  if (error && !event) {
    return <main className="page-shell narrow-shell"><StatusMessage>{error}</StatusMessage><AppLink className="text-link" href={user?.role === "Organizer" ? "/organizer" : "/participant"}>← Back to dashboard</AppLink></main>;
  }
  if (!event) return null;

  return (
    <main className="page-shell narrow-shell">
      <AppLink className="text-link" href={user?.role === "Organizer" ? "/organizer" : "/participant"}>← Back to events</AppLink>
      <article className="detail-card">
        <div className="detail-banner">
          <span className="status-badge">{event.category || "General"}</span>
          <span className={`status-badge status-${event.status}`}>{event.status}</span>
        </div>
        <div className="detail-body">
          <span className="eyebrow">EVENT DETAILS</span>
          <h1>{event.title}</h1>
          <p className="detail-description">{event.description}</p>
          <dl className="detail-facts">
            <div><dt>Date</dt><dd>{formatDate(event.startDate)}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(event.startDate)}</dd></div>
            <div><dt>Venue</dt><dd>{event.venue}</dd></div>
            <div><dt>Category</dt><dd>{event.category || "General"}</dd></div>
            <div><dt>Organizer</dt><dd>{organizerName(organizer)}{organizer?.email ? ` · ${organizer.email}` : ""}</dd></div>
            <div><dt>Capacity</dt><dd>{remaining} of {event.capacity} places available</dd></div>
            <div><dt>Registration deadline</dt><dd>{formatDate(event.startDate)} at {formatTime(event.startDate)}</dd></div>
          </dl>
          {event.status === "cancelled" && <StatusMessage>This event has been cancelled.</StatusMessage>}
          {event.status === "draft" && <StatusMessage>This event has not been published yet.</StatusMessage>}
          {deadlinePassed && <StatusMessage>Registration is closed because the event has started.</StatusMessage>}
          {remaining === 0 && <StatusMessage>This event is full.</StatusMessage>}
          <StatusMessage>{error}</StatusMessage>
          <StatusMessage kind="success">{notice}</StatusMessage>
          {user?.role === "Participant" && (
            <button type="button" className="detail-action" disabled={busy || (registrationStatus !== "active" && (event.status !== "published" || deadlinePassed || remaining === 0))} onClick={changeRegistration}>
              {busy ? "Please wait..." : registrationStatus === "active" ? "Cancel registration" : "Register for this event"}
            </button>
          )}
          {user?.role === "Organizer" && getOrganizerId(event.organizer) === user._id && (
            <AppLink className="button" href={`/organizer/events/${eventId}/edit`}>Edit event</AppLink>
          )}
        </div>
      </article>
    </main>
  );
}
