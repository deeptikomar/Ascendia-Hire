# Ascendia Hire

A campus hiring and startup-team-building platform built for NITK students and recruiters. Students can build a profile, browse and apply to jobs, pitch startup ideas, form teams, chat with teammates in real time, and see exactly which skills they're missing for a role or a startup they want to join.

## Features

- **Role-based auth** — students must sign up with a `@nitk.edu.in` email; access automatically expires once a student's graduation year has passed.
- **JWT-secured API** — every write action (posting a job, editing a profile, joining a startup) requires a valid token, and the server always acts as the logged-in user, never as whatever email a client claims to be.
- **Job board** — recruiters post jobs with required skills; students apply, track applications, and recruiters review applicants.
- **Startup hub** — students pitch startup ideas, others join teams, and everyone chats in a live per-startup room over Socket.IO.
- **Skill-gap analysis** — for any job or startup, the app diffs the required skills against your profile and tells you exactly what's missing.
- **XML-based storage** — a lightweight, dependency-free persistence layer built directly on `xml2js`, with a per-file write queue to keep concurrent read-modify-write operations from clobbering each other.

## Tech stack

- **Backend:** Node.js, Express 5, Socket.IO, JWT (`jsonwebtoken`), `bcryptjs`, `xml2js`
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Storage:** Flat XML files (see [Architecture notes](#architecture-notes))

## Getting started

### Prerequisites
- Node.js 18+ and npm

### Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit JWT_SECRET to a random string
npm start
```

The server serves the frontend directly, so once it's running, open:

```
http://localhost:3000
```

### Demo accounts

Seed data ships with two accounts you can log in with immediately:

| Role      | Email                     | Password     |
|-----------|----------------------------|---------------|
| Student   | student@gmail.com          | student123    |
| Recruiter | recruiter@techcorp.com     | recruit123    |

(These were created before the bcrypt migration and still work — the login endpoint transparently supports both legacy plaintext rows and newly hashed ones.)

## Environment variables

See `backend/.env.example`. At minimum, set:

- `JWT_SECRET` — required; the server refuses to start without it.
- `PORT` — defaults to 3000.
- `FRONTEND_URL` — comma-separated list of allowed origins for CORS. Defaults to `*` if unset (fine for local dev, should be restricted for a real deployment).

## Running tests

```bash
cd backend
npm install
npm test
```

40 Jest + Supertest tests cover signup/login validation, password hashing, JWT issuance, and — most importantly — the ownership and role checks: a user can't edit another user's profile, a student can't post a job, a recruiter can't see another recruiter's applicants, and so on. Every test file spins up its own isolated temp "database" (via `DATA_DIR`), so running the suite never touches the real XML data in `backend/database/`.

## Architecture notes

This project intentionally uses flat XML files instead of a database, as a way to build the full read/parse/mutate/serialize cycle by hand rather than relying on an ORM. A few things worth knowing if you're reading the code:

- **Per-file write queue** (`backend/utils/fileQueue.js`) — since two requests hitting the same XML file at nearly the same time could otherwise race (both read the old version, both write, one silently overwrites the other), every read-modify-write sequence for a given file is serialized through a promise queue.
- **Known limitation** — this works well for a small, single-instance app but doesn't scale horizontally the way a real database would. A natural next step would be migrating each XML file to a MongoDB collection; the controller functions are already isolated per entity (`auth`, `profile`, `jobs`, `startup`), so the swap is localized rather than a full rewrite.

## Security

- Passwords are hashed with `bcryptjs` before being stored.
- All state-changing routes require a `Bearer` JWT and verify the caller owns the resource they're modifying (you can't edit or delete another user's profile/job/startup by changing an ID in the request).
- Socket.IO connections must also present a valid JWT; the chat's `author` field is always derived from the authenticated socket, never trusted from the client payload.
- Input is validated on signup/login/job/startup creation (email format, password length, required fields).

## Project structure

```
backend/
  auth/            signup & login controllers
  jobs/             job board routes
  profile/          student profile routes
  startup/          startup hub + chat REST fallback
  middleware/auth.js  JWT verification middleware
  utils/fileQueue.js  per-file write serialization
  config/paths.js     data directory (overridable for tests)
  database/         XML data files
  tests/             Jest + Supertest suite
  app.js             Express app (routes, middleware) — imported directly by tests
  socket.js           Socket.IO chat, attached to the HTTP server
  server.js           app entrypoint: boots HTTP server + Socket.IO
frontend/
  index.html        login / signup
  dashboard.html     main app shell
  JS/dashboard.js     dashboard logic + API calls
```

## Possible next steps

- Migrate storage from XML to MongoDB/Postgres for concurrency and scale.
- Deploy (Render/Railway for the backend, or all-in-one) and add a live demo link here.
