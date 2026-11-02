import { useState } from "react";
import { useAuth } from "../lib/authContext";
import AppLink from "./AppLink";
import { navigate } from "../lib/navigation";

export default function NavBar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = user?.role === "Participant"
    ? [["Explore Events", "/participant"], ["My Registrations", "/registrations"], ["Profile", "/profile"]]
    : user?.role === "Organizer"
      ? [["Dashboard", "/organizer"], ["My Events", "/organizer#my-events"], ["Create Event", "/organizer/events/new"], ["Profile", "/profile"]]
      : [];

  function handleLogout() {
    logout();
    setMenuOpen(false);
    navigate("/");
  }

  return (
    <header className="navbar">
      <AppLink className="brand" href="/">
        <span className="brand-icon" aria-hidden="true">E</span>
        Eventify
      </AppLink>
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
      </button>
      <nav id="primary-navigation" className={`nav-actions ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
        {links.map(([label, href]) => (
          <AppLink key={`${label}-${href}`} className="nav-link" href={href} onClick={() => setMenuOpen(false)}>{label}</AppLink>
        ))}
        {user ? (
          <button type="button" className="nav-button" onClick={handleLogout}>Log out</button>
        ) : (
          <>
            <AppLink className="nav-link" href="/login" onClick={() => setMenuOpen(false)}>Log in</AppLink>
            <AppLink className="nav-register" href="/register" onClick={() => setMenuOpen(false)}>Register</AppLink>
          </>
        )}
      </nav>
    </header>
  );
}
