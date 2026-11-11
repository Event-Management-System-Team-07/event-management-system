# Event Management System

Team 07's Software Engineering mini project: a web application for creating,
publishing, discovering, and managing events and participant registrations.

## Problem and objectives

Event information and registration are often handled through disconnected
messages or manual lists. This project provides one authenticated system for:

- registering users and enforcing Participant, Organizer, and Admin roles;
- creating, editing, publishing, and cancelling events;
- browsing published events with search, category, date, and pagination filters;
- registering for an event, cancelling a registration, and viewing registration
  history; and
- enforcing capacity, duplicate-registration, authorization, and registration
  cutoff rules.

## Implemented features

### Participants

- Create a Participant account and log in.
- Browse published events and view event details.
- Search by event title or venue, filter by category/date, and view available
  capacity.
- Register for an event or cancel an active registration.
- View active and cancelled registration history.
- Receive loading, success, authentication, validation, duplicate, full-event,
  and general API/network error messages in the UI.

### Organizers

- Create draft events with validated event details.
- Edit owned events, publish them, and cancel them.
- View registration counts and active participant registrations for events
  discoverable through the current API.

The frontend includes authenticated routing, login/account creation, profile
views, participant and organizer dashboards, event details, and registration
history pages.

### Admin capability

The backend recognizes the `Admin` role for authorization and for selected
event-management operations. Dedicated administrator user-management routes or
an administrator dashboard are not currently implemented.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Authentication | JSON Web Tokens, bcryptjs |
| API format | JSON over REST |
| Testing | Node test runner, Jest, Supertest |
| Tooling | ESLint, Nodemon |

## Architecture

```text
React/Vite client
  -> authenticated REST requests
Express API
  -> controllers, middleware, validators, and models
MongoDB
```

The frontend uses `client/src/App.jsx` for route selection, shared components
and pages for workflows, and `client/src/lib/api.js` for authentication-aware
API requests. The backend mounts route modules in `server/src/app.js`;
authentication and role authorization are applied by middleware before
controller logic.

Registration integrity is enforced with an active-registration unique partial
index and MongoDB transaction support. Event `activeRegistrations` counters are
maintained when registrations are created or cancelled.

## Repository structure

```text
client/                 React/Vite frontend
  src/components/       Shared UI components
  src/lib/              API, auth, navigation, and formatting helpers
  src/pages/             Home, auth, participant, organizer, and detail pages
server/                 Express/Mongoose backend
  src/controllers/      Request handlers and business rules
  src/models/            User, Event, and Registration schemas
  src/routes/            Auth, event, browsing, and registration routes
  src/middleware/        Authentication and role authorization
  tests/                 Backend unit, route, and integration tests
docs/                   Project reference documents
tests/                  Additional project test assets
```

## Prerequisites

- Node.js with npm
- MongoDB configured as a replica set, because registration writes use
  transactions

The default local database URI targets a MongoDB instance at
`127.0.0.1:27017` with replica set name `rs0`. Use an equivalent MongoDB
deployment if your local configuration differs.

## Installation and configuration

Install dependencies in both applications:

```sh
cd server
npm install

cd ../client
npm install
```

Create `server/.env` from `server/.env.example` and replace the placeholders:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/event-management?replicaSet=rs0&retryWrites=false
JWT_SECRET=<long-random-secret>
JWT_EXPIRES_IN=1d
```

Never commit real secrets. The server requires `MONGO_URI` and `JWT_SECRET` at
startup. The client uses `/api` by default and Vite proxies it to
`http://localhost:5000`; set `VITE_API_PROXY_TARGET` to change the development
proxy or `VITE_API_BASE_URL` when the browser must call a different API base
URL.

## Run locally

Start the backend:

```sh
cd server
npm run dev
```

The API listens on `http://localhost:5000` by default. Start the frontend in a
second terminal:

```sh
cd client
npm run dev
```

Open the Vite URL shown in the terminal. The client expects the backend to be
available through the configured `/api` proxy.

## Database setup

Start MongoDB as a replica set named `rs0`, or update `MONGO_URI` to point to a
transaction-capable MongoDB deployment. On startup the server:

1. connects to MongoDB;
2. verifies transaction support;
3. creates registration indexes; and
4. backfills event registration counters before listening.

No separate migration command is provided.

## Implemented workflows

1. A user creates an account through `POST /api/auth/register` and logs in
   through `POST /api/auth/login`.
2. The client stores the returned session in browser `sessionStorage` and sends
   the JWT in the `Authorization` header.
3. An authenticated participant opens the participant dashboard. The client
   loads published events and registration history in parallel.
4. Selecting **Register** sends a `POST` request. A successful response marks
   the event active and increments the displayed count.
5. Selecting **Cancel registration** sends a `DELETE` request. A successful
   response marks the registration cancelled and restores one displayed seat.
6. The registration history page displays both active and cancelled records.

Registration is rejected when the event is not published, has started, is
full, or the participant already has an active registration. The UI displays
the backend response message and disables the action while a request is in
flight.

## API overview

All paths are prefixed with `/api`. Protected routes require
`Authorization: Bearer <token>`.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Create Participant or Organizer account |
| POST | `/auth/login` | Public | Authenticate and return a JWT |
| GET | `/events` | Authenticated | List published events with search, category, date, and pagination filters |
| GET | `/events/:id` | Authenticated | View an event |
| POST | `/events` | Organizer/Admin | Create a draft event |
| PUT | `/events/:id` | Owner Organizer/Admin | Update an event |
| PATCH | `/events/:id/publish` | Owner Organizer/Admin | Publish an event |
| PATCH | `/events/:id/cancel` | Owner Organizer/Admin | Cancel an event |
| GET | `/events/registrations/history` | Participant | Return the participant's registration history |
| POST | `/events/:eventId/register` | Participant | Register for an event |
| DELETE | `/events/:eventId/register` | Participant | Cancel an active registration |

## Testing and checks

Frontend:

```sh
cd client
npm test
npm run lint
npm run build
```

Backend:

```sh
cd server
npm test
```

The MongoDB integration suite is opt-in. Run it only with a test database
configured through `MONGO_INTEGRATION_URI` and `RUN_MONGO_INTEGRATION=1`.

## Current limitations

- There is no dedicated Admin dashboard or administrator user-management API.
- The backend has no organizer-owned event-list route. The organizer dashboard
  combines published events with event IDs remembered in the current browser;
  drafts created elsewhere cannot be discovered through the current API.
- Authentication is token-based in browser `sessionStorage`; the backend does
  not provide an HttpOnly-cookie session or a current-user endpoint.
- Notifications and audit records are not implemented in the current source.
- No production deployment configuration is included.

## Team

The repository identifies the project as Team 07. Individual contributor
assignments are maintained in the project planning materials rather than in
this README.
