import { useEffect, useMemo, useState } from "react";
import AppLink from "../components/AppLink";
import EventCard from "../components/EventCard";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import { apiRequest, fetchPublishedEvents } from "../lib/api";

function getEventId(event) {
  return event._id || event.id;
}

export default function ParticipantDashboard() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState({});
  const [query, setQuery] = useState({ search: "", category: "", from: "", to: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyEvent, setBusyEvent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchPublishedEvents(),
      apiRequest("/events/registrations/history"),
    ]).then(([publishedEvents, history]) => {
      if (!active) return;
      setEvents(publishedEvents);
      setRegistrations(Object.fromEntries(
        (history.registrations || []).filter((registration) => registration.status === "active" && registration.event).map((registration) => [
          getEventId(registration.event),
          registration.status,
        ])
      ));
      setError("");
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => [...new Set(events.map((event) => event.category).filter(Boolean))].sort(),
    [events]
  );
  const filteredEvents = useMemo(() => events.filter((event) => {
    const text = query.search.trim().toLowerCase();
    const matchesText = !text || `${event.title} ${event.venue}`.toLowerCase().includes(text);
    const start = new Date(event.startDate);
    const matchesCategory = !query.category || event.category === query.category;
    const matchesFrom = !query.from || start >= new Date(`${query.from}T00:00:00`);
    const matchesTo = !query.to || start <= new Date(`${query.to}T23:59:59`);
    return matchesText && matchesCategory && matchesFrom && matchesTo;
  }), [events, query]);

  async function updateRegistration(event, cancel) {
    const eventId = getEventId(event);
    setBusyEvent(eventId);
    setError("");
    setNotice("");
    try {
      const result = await apiRequest(`/events/${eventId}/register`, {
        method: cancel ? "DELETE" : "POST",
      });
      setRegistrations((current) => ({ ...current, [eventId]: result.registration.status }));
      setNotice(result.message);
      if (result.registration.status === "active") {
        setEvents((current) => current.map((item) => getEventId(item) === eventId
          ? { ...item, activeRegistrations: Number(item.activeRegistrations || 0) + 1 }
          : item));
      } else {
        setEvents((current) => current.map((item) => getEventId(item) === eventId
          ? { ...item, activeRegistrations: Math.max(0, Number(item.activeRegistrations || 0) - 1) }
          : item));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyEvent("");
    }
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <span className="eyebrow">PARTICIPANT DASHBOARD</span>
        <h1>Find your next experience</h1>
        <p>Browse published events and manage your registrations.</p>
        <AppLink className="text-link" href="/registrations">View my registrations →</AppLink>
      </section>
      <section className="content-section" aria-labelledby="events-title">
        <div className="section-heading">
          <div><h2 id="events-title">Upcoming Events</h2><p>{filteredEvents.length} events</p></div>
        </div>
        <form className="filters" onSubmit={(event) => event.preventDefault()}>
          <input type="search" placeholder="Search by event or venue..." aria-label="Search events by name or venue" value={query.search} onChange={(event) => setQuery({ ...query, search: event.target.value })} />
          <select aria-label="Filter by category" value={query.category} onChange={(event) => setQuery({ ...query, category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <label className="filter-date">From <input type="date" aria-label="Events from date" value={query.from} onChange={(event) => setQuery({ ...query, from: event.target.value })} /></label>
          <label className="filter-date">To <input type="date" aria-label="Events through date" value={query.to} onChange={(event) => setQuery({ ...query, to: event.target.value })} /></label>
        </form>
        <StatusMessage>{error}</StatusMessage>
        <StatusMessage kind="success">{notice}</StatusMessage>
        {loading ? <LoadingState label="Loading published events..." /> : (
          filteredEvents.length ? (
            <div className="event-grid">
              {filteredEvents.map((event) => (
                <EventCard key={getEventId(event)} event={event} registrationStatus={registrations[getEventId(event)]} busy={busyEvent === getEventId(event)} onRegister={updateRegistration} />
              ))}
            </div>
          ) : (
            <div className="empty-state"><h3>No events found</h3><p>Try a different search, category, or date range.</p></div>
          )
        )}
      </section>
    </main>
  );
}
