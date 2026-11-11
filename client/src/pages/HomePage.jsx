import AppLink from "../components/AppLink";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <span className="eyebrow">YOUR NEXT EXPERIENCE STARTS HERE</span>
        <h1>Discover events.<br /><span>Make memories.</span></h1>
        <p>Find exciting events, meet amazing people, and register for experiences that inspire you.</p>
        <AppLink className="hero-button" href="/login">Explore events <span aria-hidden="true">→</span></AppLink>
        <span className="hero-decoration" aria-hidden="true">✦</span>
      </section>
      <section className="home-intro">
        <span className="eyebrow">EVENTIFY</span>
        <h2>Bring your next gathering to life.</h2>
        <p>Discover upcoming events as a participant or create and manage events as an organizer.</p>
        <div className="home-actions">
          <AppLink className="button" href="/register">Create an account</AppLink>
          <AppLink className="button button-secondary" href="/login">Log in</AppLink>
        </div>
      </section>
    </main>
  );
}
