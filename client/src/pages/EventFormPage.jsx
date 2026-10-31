import { useEffect, useState } from "react";
import AppLink from "../components/AppLink";
import LoadingState from "../components/LoadingState";
import StatusMessage from "../components/StatusMessage";
import { useAuth } from "../lib/authContext";
import { apiRequest, rememberCreatedEvent } from "../lib/api";
import { navigate } from "../lib/navigation";
import { toDateTimeLocal } from "../lib/formatters";

const EMPTY_EVENT = {
  title: "",
  description: "",
  category: "",
  venue: "",
  startDate: "",
  endDate: "",
  capacity: "1",
};

function getOrganizerId(organizer) {
  if (typeof organizer === "string") return organizer;
  return organizer?._id;
}

export default function EventFormPage({ eventId }) {
  const { user } = useAuth();
  const editing = Boolean(eventId);
  const [values, setValues] = useState(EMPTY_EVENT);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return undefined;
    let active = true;
    apiRequest(`/events/${encodeURIComponent(eventId)}`).then(({ event }) => {
      if (!active) return;
      if (getOrganizerId(event.organizer) !== user?._id) {
        setError("You can only edit events that you own.");
        return;
      }
      setValues({
        title: event.title || "",
        description: event.description || "",
        category: event.category || "",
        venue: event.venue || "",
        startDate: toDateTimeLocal(event.startDate),
        endDate: toDateTimeLocal(event.endDate),
        capacity: String(event.capacity || 1),
      });
    }).catch((requestError) => {
      if (active) setError(requestError.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [editing, eventId, user?._id]);

  function validate() {
    if (values.title.trim().length < 3 || values.title.trim().length > 150) return "Title must be 3 to 150 characters.";
    if (!values.description.trim() || values.description.length > 5000) return "Description is required and must be no more than 5000 characters.";
    if (!values.venue.trim() || values.venue.length > 200) return "Venue is required and must be no more than 200 characters.";
    const capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) return "Capacity must be a whole number of at least 1.";
    const startDate = new Date(values.startDate);
    const endDate = new Date(values.endDate);
    if (!values.startDate || Number.isNaN(startDate.getTime())) return "Enter a valid start date and time.";
    if (!values.endDate || Number.isNaN(endDate.getTime())) return "Enter a valid end date and time.";
    if (!editing && startDate <= new Date()) return "The start date must be in the future.";
    if (endDate < startDate) return "The end date cannot be before the start date.";
    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;

    setBusy(true);
    try {
      const body = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category.trim() || "General",
        venue: values.venue.trim(),
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        capacity: Number(values.capacity),
      };
      const result = await apiRequest(editing ? `/events/${encodeURIComponent(eventId)}` : "/events", {
        method: editing ? "PUT" : "POST",
        body,
      });
      if (!editing) rememberCreatedEvent(user._id, result.event._id);
      navigate(editing ? "/organizer?updated=1" : "/organizer?created=1");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page-shell narrow-shell"><LoadingState label="Loading event..." /></main>;

  return (
    <main className="page-shell narrow-shell">
      <section className="page-heading">
        <span className="eyebrow">ORGANIZER WORKSPACE</span>
        <h1>{editing ? "Edit event" : "Create an event"}</h1>
        <p>{editing ? "Update your event details." : "New events are saved as drafts and can be published from your dashboard."}</p>
        <AppLink className="text-link" href="/organizer">← Back to dashboard</AppLink>
      </section>
      <section className="profile-card">
        <StatusMessage>{error}</StatusMessage>
        <form className="stacked-form" onSubmit={handleSubmit}>
          <label htmlFor="event-title">Event title</label>
          <input id="event-title" required minLength="3" maxLength="150" value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          <label htmlFor="event-description">Description</label>
          <textarea id="event-description" required maxLength="5000" rows="5" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          <label htmlFor="event-category">Category</label>
          <input id="event-category" maxLength="100" placeholder="e.g. Technology, Music, Business" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} />
          <label htmlFor="event-venue">Venue</label>
          <input id="event-venue" required maxLength="200" value={values.venue} onChange={(event) => setValues({ ...values, venue: event.target.value })} />
          <div className="form-row">
            <div><label htmlFor="event-start">Start date and time</label><input id="event-start" type="datetime-local" required value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} /></div>
            <div><label htmlFor="event-end">End date and time</label><input id="event-end" type="datetime-local" required value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} /></div>
          </div>
          <label htmlFor="event-capacity">Capacity</label>
          <input id="event-capacity" type="number" min="1" step="1" required value={values.capacity} onChange={(event) => setValues({ ...values, capacity: event.target.value })} />
          <button type="submit" disabled={busy || Boolean(error && editing)}>{busy ? "Saving..." : editing ? "Save changes" : "Create draft event"}</button>
        </form>
      </section>
    </main>
  );
}
