import { useEffect, useState } from "react";
import { useAuth } from "../lib/authContext";
import AppLink from "../components/AppLink";
import StatusMessage from "../components/StatusMessage";
import { apiRequest } from "../lib/api";

export default function ProfilePage() {
  const { user } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/events?limit=1").catch((requestError) => {
      if (active) setError(requestError.message);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="page-shell narrow-shell">
      <section className="page-heading">
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h1>Profile</h1>
        <p>Account information returned by the authentication service.</p>
      </section>
      <section className="profile-card" aria-label="Profile information">
        <StatusMessage>{error}</StatusMessage>
        <dl className="detail-facts">
          <div><dt>Name</dt><dd>{user?.name || "Not provided"}</dd></div>
          <div><dt>Email</dt><dd>{user?.email || "Not provided"}</dd></div>
          <div><dt>Role</dt><dd>{user?.role || "Not provided"}</dd></div>
        </dl>
        <p className="field-hint">Role changes are managed by the server and cannot be changed in your profile.</p>
        <AppLink className="button" href={user?.role === "Organizer" ? "/organizer" : "/participant"}>Back to dashboard</AppLink>
      </section>
    </main>
  );
}
