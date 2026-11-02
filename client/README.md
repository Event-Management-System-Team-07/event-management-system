# Eventify frontend

The React/Vite client integrates with the Express API in `../server`.

## Run locally

Start the backend on port `5000`, then start Vite:

```sh
npm run dev
```

Vite proxies `/api` requests to `http://localhost:5000` by default. Override the proxy target with `VITE_API_PROXY_TARGET` when the backend runs elsewhere. Set `VITE_API_BASE_URL` to change the API URL used by the browser; it defaults to `/api`. For production, route `/api` through a same-origin reverse proxy or configure the backend to allow the deployed frontend origin.

## Frontend workflows

- Public registration supports the backend's `Participant` and `Organizer` roles only.
- Bearer tokens from login are held in `sessionStorage` and sent by the shared API service. This supports refreshes in the same browser session; the backend currently issues tokens for the `Authorization` header and does not provide an HttpOnly-cookie session or a current-user endpoint.
- Participants browse published events, filter by title/venue, category, and date, register/cancel, and view registration history.
- Organizers create drafts, edit and publish events, cancel events, and view active participant registrations. The backend has no organizer-owned event-list route, so the dashboard combines published events returned by `GET /api/events` with event IDs created in this browser. Drafts created elsewhere cannot be discovered from this API.
- The event model uses `startDate` as the registration cutoff. It does not expose a separate registration deadline or populated organizer profile information.

## Checks

```sh
npm run build
npm run lint
```
