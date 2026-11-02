import { useEffect, useState } from "react";
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

function getPageFromPath() {
  if (window.location.pathname === "/login") return "login";
  if (window.location.pathname === "/signup") return "signup";
  if (window.location.pathname === "/registrations") return "registrations";
  return "home";
}

function App() {
  const [events] = useState(initialEvents);
  const [page, setPage] = useState(getPageFromPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signup, setSignup] = useState({
    name: "",
    email: "",
    password: "",
    role: "Participant",
  });
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupErrors, setSignupErrors] = useState({});
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [registered, setRegistered] = useState([]);
  const [registrationHistory, setRegistrationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function syncPageWithLocation() {
      setPage(getPageFromPath());
    }

    window.addEventListener("popstate", syncPageWithLocation);
    return () => window.removeEventListener("popstate", syncPageWithLocation);
  }, []);

  useEffect(() => {
    if (page !== "registrations") return undefined;

    const token = sessionStorage.getItem("eventifyToken");
    if (!token) return undefined;

    const controller = new AbortController();
    async function loadRegistrationHistory() {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch("/api/events/registrations/history", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          setHistoryError(result.message || "Unable to load your registrations.");
          return;
        }

        setRegistrationHistory(result.registrations || []);
      } catch (error) {
        if (error.name !== "AbortError") {
          setHistoryError("Could not reach the server. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    }

    loadRegistrationHistory();
    return () => controller.abort();
  }, [page]);

  function navigateTo(path) {
    window.history.pushState({}, "", path);
    setPage(getPageFromPath());
    setLoginError("");
    setSignupError("");
    setSignupErrors({});
  }

  async function submitLogin(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setLoginError(result.message || "Unable to log in. Please try again.");
        return;
      }

      sessionStorage.setItem("eventifyToken", result.token);
      setNotice(`Welcome${result.user?.name ? `, ${result.user.name}` : ""}!`);
      setPassword("");
      navigateTo("/");
    } catch {
      setLoginError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    if (signup.password !== signupConfirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setSignupError("");
    setSignupErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signup),
      });
      const result = await response.json();

      if (!response.ok) {
        setSignupErrors(result.errors || {});
        setSignupError(
          result.message === "Validation failed"
            ? ""
            : result.message || "Unable to create your account. Please try again."
        );
        return;
      }

      setEmail(signup.email);
      setPassword("");
      setSignupConfirmPassword("");
      setSignup({ name: "", email: "", password: "", role: "Participant" });
      setSignupSuccess("Account created. Log in with your new account.");
      navigateTo("/login");
    } catch {
      setSignupError("Could not reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const categories = ["All", ...new Set(events.map((event) => event.category))];
  const hasAuthToken = Boolean(sessionStorage.getItem("eventifyToken"));

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
        <a className="brand" href="/" onClick={(event) => {
          event.preventDefault();
          navigateTo("/");
        }}>
          <span className="brand-icon">E</span>
          Eventify
        </a>
        {page !== "home" ? (
          <a className="nav-link" href="/" onClick={(event) => {
            event.preventDefault();
            navigateTo("/");
          }}>
            ← Back to events
          </a>
        ) : (
          <nav className="nav-actions">
            <a className="nav-link" href="#events">Explore Events</a>
            <a
              className="nav-link"
              href="/registrations"
              onClick={(event) => {
                event.preventDefault();
                navigateTo("/registrations");
              }}
            >
              My registrations
            </a>
            <a
              className="login-link"
              href="/login"
              onClick={(event) => {
                event.preventDefault();
                navigateTo("/login");
              }}
            >
              Log in
            </a>
            <a
              className="signup-link"
              href="/signup"
              onClick={(event) => {
                event.preventDefault();
                navigateTo("/signup");
              }}
            >
              Sign up
            </a>
          </nav>
        )}
      </header>

      {page === "login" ? (
        <main className="login-page">
          <section className="login-card" aria-labelledby="login-title">
            <span className="eyebrow">WELCOME BACK</span>
            <h1 id="login-title">Log in to Eventify</h1>
            <p className="login-description">
              Sign in to continue to your events and registrations.
            </p>

            {signupSuccess && (
              <p className="signup-success" role="status">{signupSuccess}</p>
            )}

            <form className="login-form" onSubmit={submitLogin}>
              <label htmlFor="login-email">Email address</label>
              <input
                autoComplete="email"
                id="login-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />

              <label htmlFor="login-password">Password</label>
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />

              {loginError && <p className="login-error" role="alert">{loginError}</p>}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="login-help">
              New to Eventify? <a href="/signup" onClick={(event) => {
                event.preventDefault();
                navigateTo("/signup");
              }}>Create an account</a>
            </p>
          </section>
        </main>
      ) : page === "signup" ? (
        <main className="login-page">
          <section className="login-card" aria-labelledby="signup-title">
            <span className="eyebrow">JOIN EVENTIFY</span>
            <h1 id="signup-title">Create your account</h1>
            <p className="login-description">
              Sign up to discover events and manage your registrations.
            </p>

            <form className="login-form" onSubmit={submitSignup}>
              <label htmlFor="signup-name">Full name</label>
              <input
                autoComplete="name"
                id="signup-name"
                maxLength={100}
                minLength={2}
                onChange={(event) => setSignup({ ...signup, name: event.target.value })}
                required
                value={signup.name}
              />
              {signupErrors.name && <p className="login-error">{signupErrors.name}</p>}

              <label htmlFor="signup-email">Email address</label>
              <input
                autoComplete="email"
                id="signup-email"
                maxLength={254}
                onChange={(event) => setSignup({ ...signup, email: event.target.value })}
                required
                type="email"
                value={signup.email}
              />
              {signupErrors.email && <p className="login-error">{signupErrors.email}</p>}

              <label htmlFor="signup-password">Password</label>
              <input
                autoComplete="new-password"
                id="signup-password"
                maxLength={72}
                minLength={8}
                onChange={(event) => setSignup({ ...signup, password: event.target.value })}
                required
                type="password"
                value={signup.password}
              />
              <span className="password-hint">Use 8 to 72 characters.</span>
              {signupErrors.password && <p className="login-error">{signupErrors.password}</p>}

              <label htmlFor="signup-confirm-password">Confirm password</label>
              <input
                autoComplete="new-password"
                id="signup-confirm-password"
                maxLength={72}
                minLength={8}
                onChange={(event) => {
                  setSignupConfirmPassword(event.target.value);
                  setSignupError("");
                }}
                required
                type="password"
                value={signupConfirmPassword}
              />

              <label htmlFor="signup-role">I want to join as</label>
              <select
                id="signup-role"
                onChange={(event) => setSignup({ ...signup, role: event.target.value })}
                value={signup.role}
              >
                <option value="Participant">Participant</option>
                <option value="Organizer">Organizer</option>
              </select>
              {signupErrors.role && <p className="login-error">{signupErrors.role}</p>}

              {signupError && <p className="login-error" role="alert">{signupError}</p>}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="login-help">
              Already have an account? <a href="/login" onClick={(event) => {
                event.preventDefault();
                navigateTo("/login");
              }}>Log in</a>
            </p>
          </section>
        </main>
      ) : page === "registrations" ? (
        <main className="events-section registrations-page">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR EVENT ACTIVITY</span>
              <h2>My registrations</h2>
              <p>Events you have registered for.</p>
            </div>
            <a className="login-link" href="/" onClick={(event) => {
              event.preventDefault();
              navigateTo("/");
            }}>Explore events</a>
          </div>

          {historyLoading && <p className="history-message">Loading your registrations...</p>}
          {historyError && <p className="login-error" role="alert">{historyError}</p>}
          {!hasAuthToken && (
            <p className="history-message">
              Log in to see registrations saved to your account.{" "}
              <a href="/login" onClick={(event) => {
                event.preventDefault();
                navigateTo("/login");
              }}>Log in</a>
            </p>
          )}

          {registrationHistory.length > 0 && (
            <section className="registration-list" aria-label="Account registration history">
              <h3>Account registrations</h3>
              {registrationHistory.map((registration) => {
                const event = registration.event;
                if (!event) return null;

                return (
                  <article className="registration-item" key={registration._id}>
                    <div>
                      <h4>{event.title}</h4>
                      <p>
                        {event.startDate
                          ? new Date(event.startDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                          : "Date not available"}
                        {event.venue ? ` · ${event.venue}` : ""}
                      </p>
                    </div>
                    <span className={`registration-status status-${registration.status}`}>
                      {registration.status}
                    </span>
                  </article>
                );
              })}
            </section>
          )}

          {registered.length > 0 && (
            <section className="registration-list" aria-label="Current session registrations">
              <h3>Current session</h3>
              {events.filter((event) => registered.includes(event.id)).map((event) => (
                <article className="registration-item" key={event.id}>
                  <div>
                    <h4>{event.title}</h4>
                    <p>{event.date} · {event.location}</p>
                  </div>
                  <span className="registration-status status-active">Registered</span>
                </article>
              ))}
            </section>
          )}

          {!historyLoading && !historyError && hasAuthToken && !registrationHistory.length && !registered.length && (
            <div className="empty-state registration-empty">
              <h3>No registrations yet</h3>
              <p>When you register for an event, it will appear here.</p>
            </div>
          )}
        </main>
      ) : (
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
      )}

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
