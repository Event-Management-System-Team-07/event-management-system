import { useState } from "react";
import "./App.css";

const initialEvents = [
  {
    id: 1,
    title: "Tech Innovation Summit",
    date: "2026-11-15",
    time: "10:00 AM",
    location: "Bengaluru",
    category: "Technology",
    description: "Discover new technologies and connect with innovators.",
    seats: 120,
  },
  {
    id: 2,
    title: "Music & Arts Festival",
    date: "2026-11-22",
    time: "5:00 PM",
    location: "Bengaluru",
    category: "Music",
    description: "Enjoy live music, art, and an evening with the community.",
    seats: 80,
  },
  {
    id: 3,
    title: "Startup Networking Meetup",
    date: "2026-12-05",
    time: "2:00 PM",
    location: "Mysuru",
    category: "Business",
    description: "Meet founders, exchange ideas, and build connections.",
    seats: 50,
  },
];

function App() {
  const [events] = useState(initialEvents);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [registered, setRegistered] = useState([]);
  const [notice, setNotice] = useState("");

  const categories = ["All", ...new Set(events.map((event) => event.category))];

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.location.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || event.category === category;

    return matchesSearch && matchesCategory;
  });

  function register(event) {
    if (registered.includes(event.id)) return;
    setRegistered((current) => [...current, event.id]);
    setNotice(`Registration successful for ${event.title}.`);
  }

  function cancelRegistration(event) {
    if (!registered.includes(event.id)) return;
    setRegistered((current) => current.filter((id) => id !== event.id));
    setNotice(`Registration cancelled for ${event.title}.`);
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
              <span className="eyebrow">WHAT'S HAPPENING</span>
              <h2>Upcoming Events</h2>
              <p>Find the perfect event for you.</p>
            </div>
            <span className="event-count">
              {filteredEvents.length} events
            </span>
          </div>

          <div className="filters">
            <input
              type="search"
              placeholder="Search by event or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search events"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All Categories" : item}
                </option>
              ))}
            </select>
          </div>

          {notice && (
            <p className="confirmation-message" role="status" aria-live="polite">
              {notice}
            </p>
          )}

          <div className="event-grid">
            {filteredEvents.map((event) => (
              <article className="event-card" key={event.id}>
                <div className={`event-banner category-${event.category.toLowerCase()}`}>
                  <span>{event.category}</span>
                  <span className="banner-symbol">
                    {event.category === "Technology"
                      ? "✧"
                      : event.category === "Music"
                        ? "♫"
                        : "↗"}
                  </span>
                </div>

                <div className="event-content">
                  <div className="event-date">
                    📅{" "}
                    {new Date(`${event.date}T12:00:00`).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                    <span>🕒 {event.time}</span>
                  </div>

                  <h3>{event.title}</h3>
                  <p className="event-description">{event.description}</p>
                  <p className="event-location">📍 {event.location}</p>

                  <div className="event-footer">
                    <span>{event.seats} seats available</span>
                    {registered.includes(event.id) ? (
                      <button onClick={() => cancelRegistration(event)}>
                        Cancel registration
                      </button>
                    ) : (
                      <button onClick={() => register(event)}>
                        Register →
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredEvents.length === 0 && (
            <div className="empty-state">
              <h3>No events found</h3>
              <p>Try a different search or category.</p>
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
