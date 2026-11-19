# Smart Telesales

**A full-stack CRM that puts the whole telesales cycle in one workspace: from the shared lead pool to a recorded sale, with live dashboards for every level of management.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-764ABC?logo=redux&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

### [Live Demo](https://smart-telesales-demo.vercel.app/) &nbsp;·&nbsp; [API Reference](https://smart-telesalesapis.vercel.app/) &nbsp;·&nbsp; [Project Overview](docs/PROJECT_OVERVIEW.md)

| 5 roles | 14 screens | 70+ API endpoints | 17 database tables | 16 back-end modules |
|:---:|:---:|:---:|:---:|:---:|

---

## The problem

Telesales agents lose hours every day jumping between a leads sheet, a dialer, a calendar, e-mail and manager
spreadsheets. Managers learn about missed targets only at the end of the day, and traditional CRMs show *how many* calls
were made but not *why* deals were lost.

## The solution

One platform replaces that whole stack.

- **Agents** pick up leads, work a daily to-do queue, log every call, book meetings and close sales in one place, so no
  lead is forgotten.
- **Managers** see progress live, with no reports to ask for.
- **Analytics** show where deals are lost and where to focus the team.
- **The system keeps itself fair:** inactive leads return to the shared pool automatically, and two agents can never
  work the same lead.

---

## What each role sees

| Role | What they get |
|---|---|
| **Admin** | Loads leads into the shared pool (single, paste or import), builds campaigns, creates users, manages teams |
| **Operation Manager** | A dashboard of every team under them, analytics, and updates and tasks for their people |
| **Team Leader** | Each agent's calls, emails, meetings and sales against targets; reassigns leads; sends updates |
| **Agent** | A daily **Work Queue** (Today / Next / Stop), call logging, calendar, tasks and tips |
| **Quality** | Records sales, follows a group of agents, sends them coaching tips |

Every response is filtered **on the server** by who may see whom (an Agent sees only themselves, a Team Leader their team,
an Operation Manager all their teams), so the UI cannot be used to read forbidden data.

## How one lead becomes a sale

```mermaid
flowchart LR
  A[Admin loads leads<br/>into the pool] --> B[Agent takes a lead]
  B --> C[Lead gets its campaign steps<br/>call → email → call]
  C --> D[Work Queue<br/>Today · Next · Stop]
  D --> E[Calls logged<br/>with an outcome reason]
  E --> F[Meetings<br/>booked]
  F --> G[Quality records<br/>the sale]
  G --> H[Dashboards and<br/>analytics update]
  D -. "steps done · 15 days idle · removed" .-> P[(Back to the pool)]
  P --> B
```

## Analytics that explain the numbers

- Lead-to-sale **funnel**: leads → contacted → reached → meetings → sold
- **Answer and reach rates**, calls per lead, and **best calling hours**
- Breakdown by **campaign** and by **agent**, for a day, week, month or custom range
- The **outcome reasons** agents log (interested, price, timing, wrong contact…)
- **Data-quality warnings** when numbers are unreliable (for example, calls logged without a reason)

---

## Engineering highlights

| Challenge | How it is solved |
|---|---|
| Two agents take the same lead | Transaction with row locks (`SELECT … FOR UPDATE`) |
| A double click records a call or sale twice | Idempotency keys: the same request returns the first answer |
| Lead rules must run even when nobody is online | Scheduled jobs every 30 seconds, guarded by a PostgreSQL advisory lock so several instances never run them twice |
| Secure sessions | 15-minute JWT access tokens, rotating 30-day refresh tokens stored hashed, login rate limiting |
| Different roles, different data | One scope rule on the server decides which agents each person can see |
| Maintainable code | Front end split by feature (`types / api / thunks / slice / UI`); back end by module (`routes / service`) |
| Bad input | zod validation on every request, one error format everywhere |
| Dates mean the same for everyone | All business dates in Africa/Cairo time, week starts on Saturday |

**Business rules in the code:** a lead with no progress for 15 days returns to the pool; another agent must wait 15 days
to retake it (the previous agent can retake it at once); meeting reminders go out 15 minutes before; only Admin deletes
leads. The full list is in the [project overview](docs/PROJECT_OVERVIEW.md#8-business-rules).

---

## Architecture

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

| Layer | Technologies |
|---|---|
| Front end | React 18, TypeScript, Vite, Redux Toolkit, Tailwind CSS, lucide-react |
| Back end | Node.js, Express, zod, jsonwebtoken, bcryptjs, helmet, cors |
| Database | PostgreSQL (hosted on Neon) |

## Built today and planned

| | Status |
|---|---|
| Operations: leads, campaigns, calls, meetings, tasks, escalations, sales | **Built** |
| Analytics: dashboards, funnel, rates, best hours, reasons, data-quality warnings | **Built** |
| AI layer: call-comment analysis, lead scoring, retrieval-based assistant, speech-to-text | Planned |
| Sending e-mail from the app | Planned |

---

## Repository structure

```
smart-telesales/
├─ frontend/    React application
├─ backend/     Express API: src/, sql/, scripts/
└─ docs/        project overview, code documentation, API reference
```

## Documentation

| Read this | If you want to |
|---|---|
| [Project overview](docs/PROJECT_OVERVIEW.md) | Understand the idea, the full flow, the business rules, and built versus planned |
| [Front End README](frontend/README.md) | Learn the client architecture, roles and pages, and how to add a feature |
| [Back End README](backend/README.md) | Learn the API, authentication, lead lifecycle, background jobs and database |
| [Front end documentation](docs/frontend-documentation.md) | Look up any front-end file or function |
| [Back end documentation](docs/backend-documentation.md) | Look up any back-end file or function |
| [API reference](https://smart-telesalesapis.vercel.app/) | See request and response examples |

---

<details>
<summary><b>Run it locally</b></summary>

**Requirements:** Node.js 18+ and a PostgreSQL database (local or hosted, for example Neon).

**1. Back end**

```bash
cd backend
npm install
```

Create a `.env` file with at least:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=<a long random string>
```

```bash
npm run migrate      # creates the tables
npm run dev          # or: npm start
```

The API runs at `http://localhost:3000/api`. `http://localhost:3000/health` answers `{"status":"ok"}`.

**2. Front end**

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


**3. First admin user**

Sign-in needs an account. `backend/scripts/seed.js` is meant to create the first admin.

</details>

---

## Author

**Anas Hisham** · [LinkedIn](https://www.linkedin.com/in/anashisham/) · [anashisham.dev@gmail.com](mailto:anashisham.dev@gmail.com) · [Source code](https://github.com/Anas-hisham/smart-telesales)
