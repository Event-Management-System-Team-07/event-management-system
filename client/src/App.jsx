import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelRegistration,
  getEvents,
  getRegistrationHistory,
  registerForEvent,
} from "./api";
import {
  getActiveRegistrationIds,
  getRegistrationErrorMessage,
  updateEventRegistrationCount,
} from "./registrationState";
import "./App.css";

const formatDate = (date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

function App() {
  const [events, setEvents] = useState([]);
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [actionEventId, setActionEventId] = useState(null);
  const [notice, setNotice] = useState(null);
  const processingEventIds = useRef(new Set());

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const [eventResponse, historyResponse] = await Promise.all([
        getEvents(),
        getRegistrationHistory(),
      ]);
      setEvents(eventResponse.events || []);
      setRegisteredIds(
        getActiveRegistrationIds(historyResponse.registrations || [])
      );
    } catch (error) {
      setNotice({ type: "error", message: getRegistrationErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialEvents() {
      await loadEvents();
    }

    loadInitialEvents();
  }, [loadEvents]);

  const categories = useMemo(
    () => ["All", ...new Set(events.map((event) => event.category))],
    [events]
  );

  const filteredEvents = events.filter((event) => {
    const query = search.toLowerCase();
    const matchesSearch =
      event.title.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query) ||
      event.venue.toLowerCase().includes(query);
    const matchesCategory =
      category === "All" || event.category === category;
    return matchesSearch && matchesCategory;
  });

  async function handleRegistration(event) {
    const eventId = event._id;
    if (processingEventIds.current.has(eventId)) return;
    processingEventIds.current.add(eventId);
    setActionEventId(eventId);
    setNotice(null);

    try {
      await registerForEvent(eventId);
      setRegisteredIds((current) => new Set(current).add(eventId));
      setEvents((current) => updateEventRegistrationCount(current, eventId, 1));
      setNotice({
        type: "success",
        message: `You are registered for ${event.title}.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getRegistrationErrorMessage(error) });
    } finally {
      processingEventIds.current.delete(eventId);
      setActionEventId((current) => (current === eventId ? null : current));
    }
  }

  async function handleCancellation(event) {
    const eventId = event._id;
    if (processingEventIds.current.has(eventId)) return;
    processingEventIds.current.add(eventId);
    setActionEventId(eventId);
    setNotice(null);

    try {
      await cancelRegistration(eventId);
      setRegisteredIds((current) => {
        const next = new Set(current);
        next.delete(eventId);
        return next;
      });
      setEvents((current) => updateEventRegistrationCount(current, eventId, -1));
      setNotice({
        type: "success",
        message: `Your registration for ${event.title} was cancelled.`,
      });
    } catch (error) {
      setNotice({ type: "error", message: getRegistrationErrorMessage(error) });
    } finally {
      processingEventIds.current.delete(eventId);
      setActionEventId((current) => (current === eventId ? null : current));
    }
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="#">
          <span className="brand-icon">E</span>
          Eventify
        </a>
        <a className="nav-link" href="#events">
          Explore Events
        </a>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">YOUR NEXT EXPERIENCE STARTS HERE</span>
          <h1>
            Discover events.
            <br />
            <span>Make memories.</span>
          </h1>
          <p>
            Find exciting events, meet amazing people, and register for
            experiences that inspire you.
          </p>
          <a className="hero-button" href="#events">
            Explore Events ↓
          </a>
          <div className="hero-decoration">✦</div>
        </section>

        <section className="events-section" id="events">
          <div className="section-heading">
            <div>
              <span className="eyebrow">WHAT&apos;S HAPPENING</span>
              <h2>Upcoming Events</h2>
              <p>Find the perfect event for you.</p>
            </div>
            <span className="event-count">
              {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
            </span>
          </div>

          {notice && (
            <div className={`notice notice-${notice.type}`} role="status">
              <span>{notice.message}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
                ×
              </button>
            </div>
          )}

          <div className="filters">
            <input
              type="search"
              placeholder="Search by event, description, or venue..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search events"
            />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Categories" : item}
                </option>
              ))}
            </select>
          </div>

          {loading && <div className="empty-state"><p>Loading events...</p></div>}

          {!loading && filteredEvents.length > 0 && (
            <div className="event-grid">
              {filteredEvents.map((event) => {
                const eventId = event._id;
                const isRegistered = registeredIds.has(eventId);
                const isProcessing = actionEventId === eventId;
                const seatsAvailable =
                  Math.max(0, event.capacity - (event.activeRegistrations || 0));

                return (
                  <article className="event-card" key={eventId}>
                    <div className={`event-banner category-${event.category.toLowerCase()}`}>
                      <span>{event.category}</span>
                      <span className="banner-symbol">✧</span>
                    </div>
                    <div className="event-content">
                      <div className="event-date">
                        <span>📅 {formatDate(event.startDate)}</span>
                        <span>🕒 {formatTime(event.startDate)}</span>
                      </div>
                      <h3>{event.title}</h3>
                      <p className="event-description">{event.description}</p>
                      <p className="event-location">📍 {event.venue}</p>
                      <div className="event-footer">
                        <span>{seatsAvailable} seats available</span>
                        {isRegistered ? (
                          <button
                            className="cancel-button"
                            type="button"
                            onClick={() => handleCancellation(event)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? "Cancelling..." : "Cancel registration"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRegistration(event)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? "Registering..." : "Register →"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && filteredEvents.length === 0 && (
            <div className="empty-state">
              <h3>{events.length === 0 ? "No events available" : "No events found"}</h3>
              <p>
                {events.length === 0
                  ? "Published events will appear here."
                  : "Try a different search or category."}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <a className="brand" href="#">
          <span className="brand-icon">E</span>
          Eventify
        </a>
        <p>Bringing people together, one event at a time.</p>
        <span>Event Management System · 2026</span>
      </footer>
    </div>
  );
}

export default App;
