import { useEffect, useState } from "react";
import AppLink from "../components/AppLink";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../lib/authContext";
import { apiRequest, fetchPublishedEvents, getRememberedEventIds } from "../lib/api";
import { formatDate, formatTime } from "../lib/formatters";

function getId(value) {
  return typeof value === "string" ? value : value?._id;
}

function eventId(event) {
  return event._id || event.id;
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [participantEvent, setParticipantEvent] = useState("");
  const [participants, setParticipants] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantError, setParticipantError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadEvents() {
      try {
        const published = await fetchPublishedEvents();
        const rememberedIds = getRememberedEventIds(user._id);
        const rememberedResults = await Promise.allSettled(rememberedIds.map((id) => apiRequest(`/events/${encodeURIComponent(id)}`)));
        const remembered = rememberedResults.filter((result) => result.status === "fulfilled").map((result) => result.value.event);
        const rejected = rememberedResults.filter((result) => result.status === "rejected");
        const owned = [...published, ...remembered]
          .filter((event) => getId(event.organizer) === user._id)
          .filter((event, index, list) => list.findIndex((item) => eventId(item) === eventId(event)) === index);
        if (active) {
          setEvents(owned);
          if (rejected.length) {
            setError(`Could not reload ${rejected.length} saved event${rejected.length === 1 ? "" : "s"}: ${rejected[0].reason.message}`);
          }
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadEvents();
    return () => { active = false; };
  }, [user._id]);

  useEffect(() => {
    if (!participantEvent) return undefined;
    let active = true;
    apiRequest(`/events/${encodeURIComponent(participantEvent)}/registrations`).then((result) => {
      if (!active) return;
      setParticipants(result.registrations || []);
      setParticipantCount(result.registrationCount || 0);
    }).catch((requestError) => {
      if (active) setParticipantError(requestError.message);
    }).finally(() => {
      if (active) setParticipantsLoading(false);
    });
    return () => { active = false; };
  }, [participantEvent]);

  async function updateEvent(event, action) {
    if (action === "cancel" && !window.confirm(`Cancel "${event.title}"? Participants will no longer be able to register.`)) return;
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/events/${eventId(event)}/${action}`, { method: "PATCH" });
      setEvents((current) => current.map((item) => eventId(item) === eventId(event) ? result.event : item));
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const query = new URLSearchParams(window.location.search);
  const savedNotice = query.get("created") ? "Draft event created successfully." : query.get("updated") ? "Event updated successfully." : "";

  return (
    <main className="page-shell">
      <section className="page-heading page-heading-row">
        <div>
          <span className="eyebrow">ORGANIZER WORKSPACE</span>
          <h1>My events</h1>
          <p>Manage events created by you.</p>
        </div>
        <AppLink className="button" href="/organizer/events/new">Create event</AppLink>
      </section>
      <StatusMessage kind="success">{savedNotice || notice}</StatusMessage>
      <StatusMessage>{error}</StatusMessage>
      <p className="info-message">Published events are loaded from Eventify. Drafts created in this browser are reopened using their saved event IDs. Older drafts created elsewhere cannot be discovered because the backend does not provide an organizer event-list endpoint.</p>
      {loading ? <LoadingState label="Loading your events..." /> : events.length ? (
        <div id="my-events" className="organizer-events">
          {events.map((event) => (
            <article className="organizer-event-card" key={eventId(event)}>
              <div className="organizer-event-heading">
                <div>
                  <span className={`status-badge status-${event.status}`}>{event.status}</span>
                  <h2>{event.title}</h2>
                  <p>{formatDate(event.startDate)} · {formatTime(event.startDate)} · {event.venue}</p>
                </div>
                <span className="capacity-label">{Math.max(0, Number(event.capacity || 0) - Number(event.activeRegistrations || 0))} / {event.capacity} available</span>
              </div>
              <p className="event-description">{event.description}</p>
              <div className="organizer-actions">
                <AppLink className="button button-secondary" href={`/events/${eventId(event)}`}>View details</AppLink>
                {event.status !== "cancelled" && <AppLink className="button button-secondary" href={`/organizer/events/${eventId(event)}/edit`}>Edit</AppLink>}
                {event.status === "draft" && <button type="button" onClick={() => updateEvent(event, "publish")}>Publish</button>}
                {event.status !== "cancelled" && <button type="button" className="button-danger" onClick={() => updateEvent(event, "cancel")}>Cancel event</button>}
                {event.status !== "draft" && <button type="button" className="button button-secondary" onClick={() => {
                  setParticipants([]);
                  setParticipantsLoading(true);
                  setParticipantError("");
                  setParticipantEvent(eventId(event));
                }}>View participants</button>}
              </div>
              {participantEvent === eventId(event) && (
                <section className="participants-panel" aria-label={`Participants for ${event.title}`}>
                  <div className="participants-heading">
                    <h3>Active participants <span>({participantCount})</span></h3>
                    <button className="icon-button" type="button" aria-label="Close participants list" onClick={() => setParticipantEvent("")}>×</button>
                  </div>
                  <StatusMessage>{participantError}</StatusMessage>
                  {participantsLoading ? <LoadingState label="Loading participants..." /> : participants.length ? (
                    <ul className="participant-list">
                      {participants.map((registration) => (
                        <li key={registration._id}>
                          <span>{registration.user?.name || "Name unavailable"}</span>
                          <a href={`mailto:${registration.user?.email || ""}`}>{registration.user?.email || "Email unavailable"}</a>
                        </li>
                      ))}
                    </ul>
                  ) : !participantError ? <p>No active registrations yet.</p> : null}
                </section>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><h2>No events to show yet</h2><p>Create your first event to get started. New events begin as drafts.</p><AppLink className="button" href="/organizer/events/new">Create event</AppLink></div>
      )}
    </main>
  );
}
