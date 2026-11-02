import { useState } from "react";
import AppLink from "../components/AppLink";
import StatusMessage from "../components/StatusMessage";
import { apiRequest } from "../lib/api";
import { navigate } from "../lib/navigation";

export default function RegisterPage() {
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "", role: "Participant" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const name = values.name.trim();
    if (name.length < 2 || name.length > 100) {
      setError("Name must be between 2 and 100 characters.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) || values.email.length > 254) {
      setError("Enter a valid email address (maximum 254 characters).");
      return;
    }
    if (values.password.length < 8 || new TextEncoder().encode(values.password).length > 72) {
      setError("Password must be 8 to 72 bytes long.");
      return;
    }
    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!["Participant", "Organizer"].includes(values.role)) {
      setError("Choose Participant or Organizer.");
      return;
    }

    setBusy(true);
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        authenticated: false,
        body: { name, email: values.email.trim(), password: values.password, role: values.role },
      });
      navigate("/login?registered=1", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="form-panel">
        <span className="eyebrow">JOIN EVENTIFY</span>
        <h1>Create your account</h1>
        <p className="form-intro">Register as a participant or organizer. Admin accounts cannot be created here.</p>
        <StatusMessage>{error}</StatusMessage>
        <form className="stacked-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full name</label>
          <input id="register-name" type="text" autoComplete="name" minLength="2" maxLength="100" required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          <label htmlFor="register-email">Email address</label>
          <input id="register-email" type="email" autoComplete="email" maxLength="254" required value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
          <label htmlFor="register-password">Password</label>
          <input id="register-password" type="password" autoComplete="new-password" minLength="8" required value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} aria-describedby="password-hint" />
          <span id="password-hint" className="field-hint">Use 8 to 72 bytes. Your password is sent only to the authentication API.</span>
          <label htmlFor="register-confirm-password">Confirm password</label>
          <input id="register-confirm-password" type="password" autoComplete="new-password" minLength="8" required value={values.confirmPassword} onChange={(event) => setValues({ ...values, confirmPassword: event.target.value })} />
          <label htmlFor="register-role">I am joining as</label>
          <select id="register-role" value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value })}>
            <option value="Participant">Participant</option>
            <option value="Organizer">Organizer</option>
          </select>
          <button type="submit" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
        </form>
        <p className="form-switch">Already registered? <AppLink href="/login">Log in</AppLink></p>
      </section>
    </main>
  );
}
