# Smart Telesales

**A full-stack CRM for call-center sales teams.** One platform covers the whole sales cycle, from the shared lead pool
to a recorded sale, with live dashboards for every level of management.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-764ABC?logo=redux&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

**[Live Demo](https://smart-telesales-demo.vercel.app/)** &nbsp;|&nbsp; **[Source Code](https://github.com/Anas-hisham/smart-telesales)** &nbsp;|&nbsp; **[API Reference](https://smart-telesalesapis.vercel.app/)**

---

## The problem

Telesales agents lose hours every day jumping between a leads sheet, a dialer, a calendar, e-mail and manager
spreadsheets. Managers find out about missed targets only at the end of the day, and traditional CRMs show *how many*
calls were made but not *why* deals were lost.

## The solution

Smart Telesales replaces that whole stack with one workspace:

- **Agents** take leads, follow a daily to-do queue of calls and follow-ups, log every call, book meetings and close
  sales, all in one screen, so no lead gets forgotten.
- **Managers** see their people's progress live, with no reports to ask for. Team Leaders see each agent's calls,
  meetings and sales against the daily target; Operation Managers see every team under them.
- **Analytics** show where deals are lost: the lead-to-sale funnel, answer and reach rates, best calling hours, and the
  reasons customers give, by campaign and agent.
- **Fair and reliable by design:** inactive leads return to the shared pool automatically, two agents can never work the
  same lead, and each person sees only their own team's data.

## Highlights

| Area | What was built |
|---|---|
| **Roles** | 5 roles (Admin, Operation Manager, Team Leader, Agent, Quality), each with its own pages and its own slice of the data |
| **Front end** | 14 role-based screens, daily Work Queue, calendar, dashboards, analytics; feature-based architecture |
| **Back end** | REST API with about 70 routes across 16 modules, JWT with rotating refresh tokens, validation on every request |
| **Safe for many users** | Row locks and transactions, idempotency keys against double clicks, login rate limiting |
| **Automation** | Background jobs every 30 seconds: 15-day lead rule, finished workflows, meeting reminders |
| **Database** | PostgreSQL with 17 tables, migrations, and an audit trail for every lead |

---

## How it fits together

```mermaid
flowchart LR
  UI[Front end<br/>React · TypeScript · Redux Toolkit · Tailwind]
  API[Back end<br/>Node.js · Express]
  DB[(PostgreSQL)]
  JOBS[Background jobs<br/>every 30 s]
  UI -- "REST /api · JWT" --> API
  API --> DB
  JOBS --> DB
```

The server is the **source of truth**. The browser keeps a copy of the data and refreshes it every 30 seconds.
Permissions are enforced on the server, so the UI cannot be used to read data a role should not see.

## Tech stack

| Layer | Technologies |
|---|---|
| Front end | React 18, TypeScript, Vite, Redux Toolkit, Tailwind CSS, lucide-react |
| Back end | Node.js, Express, zod, jsonwebtoken, bcryptjs, helmet, cors |
| Database | PostgreSQL (hosted on Neon) |

## Repository structure

```
smart-telesales/            (repository: https://github.com/Anas-hisham/smart-telesales)
├─ README.md                 you are here
├─ frontend/                 React application (src/ and its README)
├─ backend/                  Express API (src/, sql/, scripts/ and its README)
└─ docs/
   ├─ PROJECT_OVERVIEW.md                 the idea, the flow, and what is built vs planned
   ├─ frontend-documentation.md           every file and function of the client
   ├─ backend-documentation.md            every file and function of the server
   └─ smart-telesales-apis.html           API reference
```

---

## Quick start

**Requirements:** Node.js 18+ and a PostgreSQL database (local or hosted, for example Neon).

### 1. Back end

```bash
cd backend
npm install
```

Create a `.env` file with at least:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=<a long random string>
```

Then create the tables and start the server:

```bash
npm run migrate
npm run dev          # or: npm start
```

The API is now at `http://localhost:3000/api`, and `http://localhost:3000/health` answers `{"status":"ok"}`.

### 2. Front end

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

```bash
npm run dev
```

> **Why the `.env`?** The back end serves its routes on `/api`, while the front end defaults to `/api/v1`. Without
> this line every request returns `404`.

### 3. First admin user

Sign-in needs an account. The seed script (`backend/scripts/seed.js`) is meant to create the first admin, but it calls
functions that were renamed and needs a small fix first (details in the
[Back End README](backend/README.md#13-known-gaps)). Until then, insert the first admin directly in the database.

(The commands above assume the usual `npm` scripts in each `package.json`; `npm run migrate` is the one documented in
`scripts/migrate.js`.)

---

## Roles

| Role | Main job |
|---|---|
| **Admin** | Loads leads and campaigns, creates users, manages teams |
| **Operation Manager** | Runs one line of business; sees all its teams |
| **Team Leader** | Leads one team; tracks agents against daily targets |
| **Agent** | Works the daily queue: calls, meetings, follow-ups |
| **Quality** | Records sales, coaches agents with tips |

## Documentation

| Read this | If you want to |
|---|---|
| [Project overview](docs/PROJECT_OVERVIEW.md) | Understand the idea, the lead-to-sale flow, the business rules, and what is built versus planned |
| [Front End README](frontend/README.md) | Learn the client architecture, roles and pages, and how to add a feature |
| [Back End README](backend/README.md) | Learn the API, authentication, lead lifecycle, background jobs and database |
| [Front end documentation](docs/frontend-documentation.md) | Look up any front-end file or function |
| [Back end documentation](docs/backend-documentation.md) | Look up any back-end file or function |
| [API reference](https://smart-telesalesapis.vercel.app/) | See request and response examples (also in the repo: [`docs/smart-telesales-apis.html`](docs/smart-telesales-apis.html)) |

## Status

**Built:** the operations layer (leads, campaigns, calls, meetings, tasks, escalations, sales) and the analytics layer
(dashboards, funnel, rates, best hours, call reasons, data-quality warnings).

**Planned:** an AI layer (analysis of call comments, lead scoring, a retrieval-based assistant, speech-to-text) and
sending e-mail from the app. See the [project overview](docs/PROJECT_OVERVIEW.md#10-built-today-vs-planned) for the
full list and the known gaps between the code and the older documents.

## Author

**Anas Hisham** · [LinkedIn](https://www.linkedin.com/in/anashisham/) · [anashisham.dev@gmail.com](mailto:anashisham.dev@gmail.com)
