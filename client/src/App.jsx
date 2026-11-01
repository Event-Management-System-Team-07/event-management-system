import { useEffect } from "react";
import { AuthProvider } from "./components/AuthContext";
import { useAuth } from "./lib/authContext";
import AppLink from "./components/AppLink";
import NavBar from "./components/NavBar";
import { navigate, usePathname } from "./lib/navigation";
import EventDetailsPage from "./pages/EventDetailsPage";
import EventFormPage from "./pages/EventFormPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import RegistrationHistoryPage from "./pages/RegistrationHistoryPage";
import "./App.css";

function dashboardPath(role) {
  if (role === "Organizer") return "/organizer";
  if (role === "Participant") return "/participant";
  return "/";
}

function decodePathParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function ProtectedPage({ roles, children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const allowedRoles = roles?.join("|");
  const hasAccess = !allowedRoles || allowedRoles.split("|").includes(user?.role);

  useEffect(() => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(pathname)}`, { replace: true });
    } else if (!hasAccess) {
      navigate(dashboardPath(user.role), { replace: true });
    }
  }, [hasAccess, pathname, user]);

  if (!user || !hasAccess) {
    return <main className="page-shell"><p className="loading-state">Taking you to the right page...</p></main>;
  }
  return children;
}

function RouteContent() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    const handleExpiredSession = () => navigate("/login?expired=1", { replace: true });
    window.addEventListener("eventify:session-expired", handleExpiredSession);
    return () => window.removeEventListener("eventify:session-expired", handleExpiredSession);
  }, []);

  useEffect(() => {
    if (pathname === "/" && user) navigate(dashboardPath(user.role), { replace: true });
    if ((pathname === "/login" || pathname === "/register") && user) navigate(dashboardPath(user.role), { replace: true });
  }, [pathname, user]);

  let page;
  if (pathname === "/") {
    page = user ? null : <HomePage />;
  } else if (pathname === "/login") {
    page = user ? null : <LoginPage />;
  } else if (pathname === "/register") {
    page = user ? null : <RegisterPage />;
  } else if (pathname === "/participant") {
    page = <ProtectedPage roles={["Participant"]}><ParticipantDashboard /></ProtectedPage>;
  } else if (pathname === "/registrations") {
    page = <ProtectedPage roles={["Participant"]}><RegistrationHistoryPage /></ProtectedPage>;
  } else if (pathname === "/organizer") {
    page = <ProtectedPage roles={["Organizer"]}><OrganizerDashboard /></ProtectedPage>;
  } else if (pathname === "/organizer/events/new") {
    page = <ProtectedPage roles={["Organizer"]}><EventFormPage /></ProtectedPage>;
  } else if (pathname === "/profile") {
    page = <ProtectedPage><ProfilePage /></ProtectedPage>;
  } else {
    const editMatch = pathname.match(/^\/organizer\/events\/([^/]+)\/edit$/);
    const detailsMatch = pathname.match(/^\/events\/([^/]+)$/);
    if (editMatch) {
      page = <ProtectedPage roles={["Organizer"]}><EventFormPage eventId={decodePathParam(editMatch[1])} /></ProtectedPage>;
    } else if (detailsMatch) {
      page = <ProtectedPage roles={["Participant", "Organizer", "Admin"]}><EventDetailsPage eventId={decodePathParam(detailsMatch[1])} /></ProtectedPage>;
    } else {
      page = <main className="page-shell narrow-shell"><div className="empty-state"><h1>Page not found</h1><p>The page you requested does not exist.</p><AppLink className="button" href="/">Return home</AppLink></div></main>;
    }
  }

  return (
    <div className="app">
      <NavBar />
      {page}
      <footer className="site-footer">
        <AppLink className="brand" href="/"><span className="brand-icon" aria-hidden="true">E</span>Eventify</AppLink>
        <p>Bringing people together, one event at a time.</p>
        <span>Event Management System · 2026</span>
      </footer>
    </div>
  );
}

function App() {
  return <AuthProvider><RouteContent /></AuthProvider>;
}

export default App;
