# Smart Telesales — Back End API

The REST API behind **Smart Telesales**, a CRM for telesales teams. It owns all the data and all the business rules:
who can see what, how leads move between the shared pool and agents, when a lead expires, how sales are counted, and
how the AI call assistant is prompted and validated. The [front end](../frontend/README.md) is only a client of this API.

> See the [project overview](../README.md) for the big picture.

| | |
|---|---|
| **Runtime** | Node.js + Express |
| **Database** | PostgreSQL (tested with Neon) |
| **AI** | Google Gemini (call assistant) |
| **Size** | 16 modules, about 70 routes, 17 tables (before the AI call assistant) |
| **API reference** | [https://smart-telesalesapis.vercel.app/](https://smart-telesalesapis.vercel.app/) |
| **Source code** | [https://github.com/Anas-hisham/smart-telesales](https://github.com/Anas-hisham/smart-telesales) |

---

## Table of contents

1. [Features](#1-features)
2. [Tech stack](#2-tech-stack)
3. [Getting started](#3-getting-started)
4. [Architecture](#4-architecture)
5. [Authentication and roles](#5-authentication-and-roles)
6. [The lead lifecycle](#6-the-lead-lifecycle)
7. [Safe multi-user actions](#7-safe-multi-user-actions)
8. [Background jobs](#8-background-jobs)
9. [AI call assistant](#9-ai-call-assistant)
10. [API overview](#10-api-overview)
11. [Database](#11-database)
12. [Error format](#12-error-format)
13. [Project structure](#13-project-structure)

---

## 1. Features

- **Five roles** (Admin, Operation Manager, Team Leader, Agent, Quality), each with its own permissions and its own
  slice of the data.
- **Lead lifecycle**: a shared pool, agents taking leads, ordered touch-point workflows per campaign, call logging,
  meetings, and automatic return to the pool.
- **Dashboards and analytics**: daily progress against targets, lead-to-sale funnel, answer and reach rates,
  best calling hours, and call reasons, by campaign and agent.
- **Sales tracking** with monthly targets per agent, team and Operation Manager.
- **Internal communication**: team updates, tasks, tips from Quality, escalations, and notifications with menu badges.
- **AI call assistant (Google Gemini)**: before each call, a personalised call script, predicted customer objections
  with ready-to-say answers, a customer brief and next steps, generated from the lead's call history and a company
  knowledge base that Admins and Operation Managers manage. Grounded, validated, cached and rate limited
  (see [section 9](#9-ai-call-assistant)).
- **Safe under concurrency**: row locks, transactions, idempotency keys and a login rate limiter.
- **Scheduled jobs** that enforce the 15-day lead rule and send meeting reminders.

---

## 2. Tech stack

| Technology | Used for |
|---|---|
| **Node.js + Express** | HTTP server and routing |
| **PostgreSQL** (`pg`) | Data, transactions, row locks, advisory locks |
| **zod** | Validation of every request body and query, and of the AI model's JSON output |
| **jsonwebtoken** | Access tokens (JWT) |
| **bcryptjs** | Password hashing |
| **helmet, cors** | Security headers and CORS |
| **dotenv** | Environment configuration |
| **Google Gemini API** | Generates the AI call assistant content (script, objections, brief, next steps) |

---

## 3. Getting started

**Requirements:** Node.js 18+, a PostgreSQL database (local, or a hosted one such as Neon), and a Google Gemini API key
if you want to use the AI call assistant.

### 3.1 Run

```bash
npm install
npm run migrate     # applies every sql/*.sql file once, in order
npm run dev         # or: npm start
```

(`npm run migrate` is the one documented inside `scripts/migrate.js`; the other commands assume the usual scripts in
`package.json`.)

Check that it is alive:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

All API routes live under **`/api`**, for example `POST http://localhost:3000/api/auth/login`.

> The front end defaults to `/api`. Set its `VITE_API_URL` to `http://localhost:3000/api`, or every request will
> return `404`.

### 3.2 AI call assistant configuration

Add your Gemini API key to the back end `.env` (see `src/config/env.js` for the exact variable names, model names and
limits). Without a key, the rest of the API works normally and only the AI call assistant is unavailable.

```env
GEMINI_API_KEY=<your Google Gemini API key>
```

### 3.3 First admin user

`scripts/seed.js` creates the first admin (and, with `--demo`, a small demo company). See
[Known gaps](#13-known-gaps): the script needs a small fix before it runs. Until then you can insert the first admin
with SQL (the `users` table needs a bcrypt password hash).

---

## 4. Architecture

Every module has the same two files:

- `<module>.routes.js` – URL, role check, validation, and a one-line call to the service.
- `<module>.service.js` – the business logic and the SQL.

Request pipeline:

```mermaid
flowchart LR
  R[Request] --> H[helmet / cors / json]
  H --> A[authenticate<br/>JWT + load user]
  A --> RR[requireRole]
  RR --> V[validateRequest<br/>zod]
  V --> I[preventDuplicateRequests<br/>calls and sales only]
  I --> S[service + SQL]
  S --> RES[JSON response]
  S -. error .-> E[errorHandler]
```

Only `/auth/login` and `/auth/refresh` are public. Everything else needs a valid access token.

**Time rules:** all business dates use the **Africa/Cairo** time zone, and the week starts on **Saturday**.

---

## 5. Authentication and roles

### Tokens

- **Access token:** JWT, valid for **15 minutes**, sent as `Authorization: Bearer <token>`.
- **Refresh token:** random 48 bytes, valid for **30 days**, stored **hashed** (SHA-256) in the database.
- **Rotation:** every refresh deletes the old refresh token and issues a new pair, so a stolen token cannot be reused
  after the real user refreshes.
- **Logout:** with a refresh token it ends that device only; without one it ends every session of the person.
- **Login** compares the password with bcrypt even for unknown usernames, so the response time does not reveal
  whether a user exists. It is limited to **5 attempts per minute** per IP and username.
- The user is reloaded from the database on every request, so a deactivated account loses access immediately.

### Who can see what

The `visibleAgentIds` rule decides which agents' data a person can read:

| Role | Can see |
|---|---|
| Admin | Everyone |
| Agent | Only themselves |
| Team Leader | The agents of their team |
| Operation Manager | The agents of all the teams they manage |
| Quality | The agents they follow |

Dashboards, analytics, sales, leads, meetings and **AI call assistant requests** are all filtered by this rule on the
server, so the front end cannot ask for data a role should not have.

---

## 6. The lead lifecycle

```mermaid
flowchart TD
  P[(Lead Pool)] -->|agent takes it by ID| Q[Agent queue<br/>steps copied from the campaign]
  Q -->|calls / complete / skip| Q
  Q -->|every step done or skipped| P
  Q -->|no progress for 15 days| P
  Q -->|agent removes it| P
  Q -->|Team Leader transfers it| Q2[Another agent's queue]
  Q -.->|before a call| AI[AI call assistant]
```

1. **Admin** loads leads into the pool (one by one, or by pasting/importing a list) and assigns a campaign.
2. An **agent** takes a lead by its exact ID. The lead's touch-point steps are copied from the campaign with due dates.
3. The agent works the steps: log calls, complete, skip or restore a step, stop or resume the lead. Before a call, the
   agent can open the **AI call assistant** for the lead.
4. The lead **returns to the pool** when its steps are finished, after **15 days without activity**, or when the agent
   removes it. An upcoming arranged meeting keeps a lead alive until the meeting is over.
5. **Cooldown:** after a lead leaves a queue, only the previous agent can take it again at once. Any other agent must
   wait **15 days**.
6. **Only Admin deletes leads.** Deleting a lead also deletes its sales and cancels its arranged meetings.
   A recorded sale does not keep a lead in the queue: the sale stays with the agent who made it.

---

## 7. Safe multi-user actions

Many people work on the same data at the same time. These mechanisms keep it consistent:

| Problem | Solution |
|---|---|
| Two agents take the same lead | The take runs in a **transaction** with `SELECT … FOR UPDATE` on the lead rows |
| A double click records a call or a sale twice | **Idempotency keys**: the same `Idempotency-Key` header from the same user on the same route returns the first answer (`Idempotent-Replayed: true`). A request that is still running returns `409 REQUEST_IN_PROGRESS` |
| A failed request blocks its key | Failed requests release their key; keys stuck in progress for 60 seconds are cleared |
| A multi-step write fails half way | All multi-step writes use one transaction, so they commit together or roll back together |
| Password guessing | Login limiter: 5 attempts per minute per IP and username |
| One user floods the AI model | Per-user rate limit on AI call assistant requests, plus a per-lead cache |
| Several server instances run the jobs twice | Jobs are guarded by a PostgreSQL **advisory lock** (see below) |

Note: the login limiter keeps its counters in memory, so it is accurate for a single server instance.

---

## 8. Background jobs

A timer starts with the server (unless `RUN_JOBS=false`) and runs **every 30 seconds**. One run is one transaction,
guarded by `pg_try_advisory_xact_lock`, so two instances never run it at the same time. The jobs do not overlap.

| Job | What it does |
|---|---|
| **15-day rule** | A lead with no activity for 15 days returns to the pool and its agent gets a notification. A meeting in the last 15 days, or an upcoming one, counts as activity |
| **Finished workflows** | A lead whose every step is done or skipped returns to the pool |
| **Meeting reminders** | A notification to the participants **15 minutes before** an arranged meeting |
| **Clean-up** | About once an hour: delete idempotency keys older than 24 hours and expired refresh tokens |

The jobs read leads with `FOR UPDATE SKIP LOCKED`, so they never fight with an agent who is working on the same lead.

---

## 9. AI call assistant

Before a call, the agent opens a popup for the lead. The server generates, with Google Gemini:

- a **personalised call script**;
- **predicted customer objections**, each with a ready-to-say answer;
- a **customer brief**;
- **next steps**.

### How a request is handled

```mermaid
flowchart LR
  REQ[Agent request<br/>for a lead] --> PERM[Lead permission check<br/>visibleAgentIds]
  PERM --> RL[Per-user rate limit]
  RL --> CACHE{Cached<br/>for this lead?}
  CACHE -- yes --> OUT[JSON response]
  CACHE -- no --> BUILD[Build grounded prompt<br/>call history + knowledge base<br/>no phone or e-mail]
  BUILD --> LLM[Gemini<br/>streaming · retries · fallback model]
  LLM --> VAL[Validate with zod<br/>repair if needed]
  VAL --> SAVE[Cache per lead]
  SAVE --> OUT
```

1. **Permissions.** The same server-side lead permission rule as every other endpoint applies: an agent can only get
   the assistant for a lead they are allowed to see.
2. **Rate limit and cache.** Requests are limited per user, and results are cached per lead, so repeated opens do not
   cost model calls.
3. **Grounded prompt.** The prompt is built from only two sources: the lead's **call history** and the **company
   knowledge base**. The model is told to use that data only, so it does not invent prices or features.
4. **Privacy.** Contact details (**phone, email**) are never sent to the model.
5. **Model call.** Responses can be **streamed**. Failed calls are **retried**, and a **fallback model** is used if the
   main one keeps failing.
6. **Structured output.** The model must return JSON. The server **validates** it against a schema and **repairs** it
   when it is slightly malformed, so the UI only receives the expected shape.
7. **Cache.** The valid result is stored per lead and returned on later requests.

### Knowledge base

The knowledge base is the company information the assistant is allowed to rely on (for example products, prices,
features and approved answers). **Admin** and **Operation Manager** create and edit it in the app. Agents do not edit
it; they only see its effect in the generated content.

### Operational notes

- The Gemini API key is read from the environment. If it is missing or the model is down, only the AI call assistant
  fails; the rest of the API is unaffected.
- AI errors use the standard [error format](#12-error-format) (for example `403 FORBIDDEN` for a lead the person may
  not see, and `429` when the per-user limit is reached).
- The assistant output is advice for the agent. It is not written to the lead's call history.

---

## 10. API overview

Base path: `/api`. The full request and response examples are in the [API reference](../docs/smart-telesales-apis.html).

| Area | Endpoints | Who |
|---|---|---|
| **Auth** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | Login and refresh are public |
| **Users** | `GET /users`, `POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` | Create and edit: Admin |
| **Teams** | `GET /teams`, `GET /teams/:teamId/quality-choices`, `GET /agents/:agentId/quality-choices`, `PUT /agents/:agentId/team`, `PUT /teams/:teamId/manager`, `PUT /agents/:agentId/quality` | Changes: Admin |
| **Campaigns** (called *workflows*) | `GET /workflows`, `POST /workflows`, `PUT /workflows/:code`, `DELETE /workflows/:code` | Changes: Admin |
| **Admin leads** | `GET/POST /admin/leads`, `POST /admin/leads/import/preview`, `POST /admin/leads/import`, `POST /admin/leads/delete` | Admin |
| **Lead pool** | `POST /lead-pool/preview`, `POST /lead-pool/take` | Agent |
| **Leads** | `GET /leads`, `GET /leads/:id`, `GET /me/work-queue` | Scoped by role |
| **Lead actions** | `POST /leads/:id/touch-points/:order/{complete\|skip\|restore}`, `POST /leads/:id/calls`, `PATCH /leads/:id/calls/:logId`, `POST /leads/:id/{stop\|resume\|remove}` | Agent |
| | `POST /leads/:id/transfer` | Team Leader, OM |
| **AI call assistant** | Generate the call assistant content for a lead (script, objections, brief, next steps; streaming supported) | Agent, scoped by lead permissions; per-user rate limit |
| **AI knowledge base** | List, create, edit and delete knowledge-base entries | Admin, Operation Manager |
| **Meetings** | `GET /meetings/options`, `GET/POST /meetings`, `PATCH /meetings/:id`, `POST /meetings/:id/reschedule` | Agent, TL, OM, Quality |
| **Tasks** | `GET/POST /tasks`, `GET /tasks/assignees`, `POST /tasks/seen`, `POST /tasks/:id/toggle` | Create: leaders |
| **Updates** | `GET/POST /updates`, `POST /updates/seen`, `POST /updates/:id/acknowledge` | Post: OM, TL |
| **Tips** | `GET/POST /tips`, `GET /tips/recipients`, `POST /tips/seen`, `POST /tips/:id/acknowledge` | Post: Quality. Acknowledge: Agent |
| **Sales** | `GET /sales/overview`, `GET /sales/agents/:agentId/details`, `POST /sales`, `DELETE /sales/:id` | Record and delete: Quality |
| **Escalations** | `GET/POST /escalations`, `GET /escalations/subjects`, `GET /escalations/recipients`, `POST /escalations/:id/{forward\|resolve}` | All roles |
| **Notifications** | `GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `GET /me/badges` | All roles |
| **Dashboard / Analytics** | `GET /dashboard`, `GET /analytics` | Agent, TL, OM |
| **Health** | `GET /health` (outside `/api`) | Public |

---

## 11. Database

PostgreSQL, created by `sql/001_schema.sql` (17 tables, plus the tables added for the AI call assistant):

| Group | Tables |
|---|---|
| People and sessions | `users`, `teams`, `refresh_tokens` |
| Sales work | `workflows` (campaigns), `leads`, `lead_assignments`, `call_logs`, `lead_history`, `meetings`, `sales` |
| Communication | `team_updates`, `tasks`, `tips`, `escalations`, `escalation_steps`, `notifications` |
| Infrastructure | `idempotency_keys` |
| AI call assistant | The company knowledge base entries and the per-lead cache of generated results |

Design notes:

- Lead codes, usernames and emails are **unique case-insensitively** (indexes on `lower(...)`).
- Partial indexes keep the hot queries fast (for example, leads that are still in a queue).
- Every important lead event is written to `lead_history`, so each lead has an audit trail.
- Dates are returned as `YYYY-MM-DD` strings and counts as numbers, so the front end never deals with time-zone
  shifts or big-integer strings.

**Migrations:** `npm run migrate` runs every `sql/*.sql` file once, in name order, inside a transaction, and records it
in `schema_migrations`.

---

## 12. Error format

Every error leaves the API in the same shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Check the fields", "details": [] } }
```

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 401 | `TOKEN_EXPIRED` | Access or refresh token expired (the client refreshes once) |
| 401 | `INVALID_CREDENTIALS` | Wrong username or password |
| 403 | `FORBIDDEN` | The role cannot do this |
| 403 | `NOT_OWNER` | The item belongs to someone else |
| 404 | `NOT_FOUND` | Item not found |
| 409 | various, `REQUEST_IN_PROGRESS` | Business conflict, or the same request is still running |
| 422 | `VALIDATION_FAILED` | Invalid input (`details` lists each field) |
| 429 | `TOO_MANY_ATTEMPTS` | Login limit reached (the AI call assistant has its own per-user limit) |

---

## 13. Project structure

```
backend/
├─ sql/
│  └─ 001_schema.sql            all tables and indexes
├─ scripts/
│  ├─ migrate.js                runs the SQL files once
│  └─ seed.js                   first admin and optional demo data
└─ src/
   ├─ server.js                 start, jobs, graceful shutdown
   ├─ app.js                    middleware, /health, routes on /api
   ├─ config/                   env.js (settings and business rules), db.js (pool, transactions)
   ├─ middleware/               auth, validate, idempotency, rateLimit, errorHandler
   ├─ jobs/                     jobs.js (the rules), index.js (the 30-second timer)
   ├─ utils/                    scope (who sees whom), errors, time, notify, history, helpers, schemas, user
   └─ modules/                  one folder per area, each with routes.js and service.js
      auth · users · teams · campaigns · adminLeads · leadPool · leads · meetings · updates
      tasks · tips · sales · escalations · notifications · dashboard · analytics
      · AI call assistant and knowledge base (Gemini client, prompt builder, JSON validation and repair, cache)
```

---

## Related documentation

- [Front End README](../frontend/README.md)
- [Project overview and idea](../docs/PROJECT_OVERVIEW.md)
- [API reference](https://smart-telesalesapis.vercel.app/)
