import { useState } from "react";
import AppLink from "../components/AppLink";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../lib/authContext";
import { apiRequest } from "../lib/api";
import { navigate } from "../lib/navigation";

export default function LoginPage() {
  const { setSession } = useAuth();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const query = new URLSearchParams(window.location.search);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!values.email.trim() || !values.password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        authenticated: false,
        body: { email: values.email.trim(), password: values.password },
      });
      setSession({ token: result.token, user: result.user });
      navigate(result.user.role === "Organizer" ? "/organizer" : "/participant", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="form-panel">
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Log in to Eventify</h1>
        <p className="form-intro">Sign in to discover events or manage the ones you organize.</p>
        {query.get("registered") && <StatusMessage kind="success">Your account is ready. Log in to continue.</StatusMessage>}
        {query.get("expired") && <StatusMessage>Your session expired or is no longer valid. Please log in again.</StatusMessage>}
        <StatusMessage>{error}</StatusMessage>
        <form className="stacked-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email address</label>
          <input id="login-email" type="email" autoComplete="email" maxLength="254" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} />
          <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Log in"}</button>
        </form>
        <p className="form-switch">New to Eventify? <AppLink href="/register">Create an account</AppLink></p>
      </section>
    </main>
  );
}
