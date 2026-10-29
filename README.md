# Contractix — Freelancer Marketplace

A responsive Next.js marketplace backed by **Neon Postgres**. **Clients** post jobs and manage bids; **freelancers** apply, deliver work, and build ratings. **Clerk** handles authentication; roles, jobs, bids, feedback, messaging, and reports live in the database.

**Stack:** Next.js 14 · React 18 · Tailwind CSS · shadcn/ui · TanStack Query · Clerk · `@neondatabase/serverless`

---

## Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) application (Consumer / email + password is fine)
- A [Neon](https://neon.tech) Postgres database

---

## Environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...          # Neon pooled connection string
MESSAGE_ENCRYPTION_KEY=...             # 64-char hex (see migrations below)
```

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | **Server-only.** Never use `NEXT_PUBLIC_DATABASE_URL`. |
| `MESSAGE_ENCRYPTION_KEY` | Required for encrypted chat. `migrate-messaging.mjs` can generate one and append it to `.env.local`. |

---

## Install, migrate, run

```bash
cd DBMS-Project-github
npm install --legacy-peer-deps
node scripts/migrate-db.mjs
node scripts/migrate-messaging.mjs
node scripts/migrate-rebidding.mjs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run build          # production build
npm run start          # serve production build
npm run lint
npx tsc --noEmit
```

### Fresh schema (optional)

```bash
node scripts/apply-schema.mjs   # runs migrate-db + syncs Clerk user to DB if needed
```

### Clear all jobs (dev only)

```bash
node scripts/clear-jobs.mjs
```

Removes all jobs (and cascaded bids/skills). Users and profiles are kept.

### Chunk / layout errors in dev

If the browser shows `ChunkLoadError` after a build, stop the dev server, delete `.next`, and run `npm run dev` again.

---

## First-time user flow

1. **Sign up / sign in** via Clerk (`/sign-in`, `/sign-up`).
2. Open **Profile** and choose **Client** or **Freelancer** (stored in Postgres, not in Clerk).
3. **Clients:** **Post Job** (nav) → review bids on **Dashboard** or the job page → **In Progress** → complete and leave feedback.
4. **Freelancers:** **Find Jobs** → place a bid → track applications on **Dashboard** → message the client after acceptance.

---

## Roles and navigation

| Role | Main actions |
|------|----------------|
| **Client** | Post jobs, accept/reject bids, **In Progress**, feedback, reports |
| **Freelancer** | Browse jobs, bid, view own applications and feedback; no **Post Job** link |

Protected routes (Clerk): `/jobs`, `/create`, `/userjobs`, `/profile`, `/inprogress`, `/reports`, `/messages`.

---

## Product behavior (current)

### Bids

- Only **freelancers** can bid (`create_bid` in Postgres).
- A freelancer may **re-bid** on the same job: pending/rejected bids for that job are replaced; an **accepted** bid cannot be replaced.
- **Bid visibility:** Only the **client who posted the job** sees every bidder, amount, submitted time, and status. Other users do not receive other people’s bids from the API. Freelancers only see **their own** bid on the job page.
- Bid timestamps are stored in UTC and shown in the user’s local timezone in the UI.

### Jobs and dashboards

- **Dashboard (`/userjobs`):** Role-based tabs — clients manage posted jobs and bids; freelancers see applications and feedback.
- **In Progress (`/inprogress`):** Clients only — active jobs, accepted bid amount, messaging, complete, feedback.

### Messaging

- Available after a bid is **accepted**, while the job is **in progress** or **completed**.
- Message bodies are encrypted with **AES-256-GCM** at the app layer (`ciphertext` + `iv` in `Messages`).
- **Freelancers** pick which **company (client)** to chat with per job; messages are scoped to that job and client portal (server checks participants via `job_chat_participants` / `assert_can_message`).

### Notifications

- Rows are created on new bids, bid acceptance, feedback, and messages (DB triggers).
- Opening the notification panel marks items as read (badge clears). **Mark as read** is also available in the panel header.

### Reports

- Server-rendered page using Postgres **views** and the **StatusAudit** log (open jobs, bid vs budget, rankings, jobs without bids, monthly counts, recent status changes).

---

## Auth and security

- Server actions require a Clerk session (`requireClerkEmail` / `requireDbUser`).
- The DB user is resolved from the signed-in email; **client-supplied user IDs are not trusted** for ownership.
- **Ownership and role checks** also run inside Postgres (`post_job`, `create_bid`, `accept_bid`, `reject_bid`, `complete_job`, etc.).

---

## Demo map: constraints, triggers, functions, views

Use this for a viva or walkthrough.

### 1. Constraints

| Object | Demo |
|--------|------|
| `jobs_status_check` | Status only `open` / `in progress` / `completed` |
| `bids_status_check` | Bid status only `pending` / `accepted` / `rejected` |
| `bids_one_per_freelancer` | At most one bid row per freelancer per job (re-bid replaces pending/rejected via `create_bid`) |
| `feedback_rating_check` | Rating 1–5 |
| `feedback_once_per_reviewer` | One feedback row per job + reviewer |
| `users_role_check` | Role only `client` or `freelancer` |

### 2. Triggers

| Trigger | Demo |
|---------|------|
| `bids_prevent_invalid` | Client cannot bid on own job; no new bids when job is not `open` |
| `feedback_refresh_rating` | Feedback updates freelancer `Users.rating` |
| `jobs_audit_status` / `bids_audit_status` | Accept/complete → **Reports → Recent status changes** |
| `bids_notify_insert` / `bids_notify_accepted` / feedback & message triggers | Navbar notifications |

### 3. Stored functions

| Function | Demo |
|----------|------|
| `post_job` | Client posts job + skills; freelancers rejected |
| `create_bid` | Freelancer bids; re-bid replaces pending/rejected |
| `update_bid_amount` / `delete_bid` | Freelancer edits/deletes **pending** bid only |
| `accept_bid` / `reject_bid` | Client actions; accept sets job **in progress** |
| `complete_job` / `complete_job_with_feedback` | Client completes work and rates freelancer |
| `replace_user_skills` | Profile skills synced to `Skill` catalog |
| `assert_can_message` | Only accepted client ↔ freelancer pair |

### 4. Views (Reports page)

| View | Purpose |
|------|---------|
| `open_jobs` | Open listings with client and skills |
| `bid_vs_budget` | Average bid vs budget |
| `freelancer_rank` | Freelancers by rating and accepted jobs |
| `top_clients` | Clients by completed jobs |
| `jobs_without_bids` | Jobs with zero bids |
| `monthly_job_counts` | Jobs by month |

### 5. Suggested live walkthrough

1. Client posts a job with skills.
2. Freelancer bids (show re-bid if rejected).
3. Client accepts → **In Progress**; audit row in **Reports**.
4. Both use **Messages** (encrypted); check unread bell → mark read.
5. Client completes job and leaves feedback → rating updates.
6. Show `schema.sql` for constraints, triggers, functions, and views.

---

## Project layout (high level)

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and layouts |
| `components/` | UI, navbar, notifications, shared shells |
| `server/index.ts` | Server actions (jobs, bids, profile, messages, reports) |
| `schema.sql` | Full Postgres schema (source of truth) |
| `scripts/` | Migrations and maintenance scripts |
| `lib/` | DB client, auth helpers, message crypto, date formatting |

---

## License

Academic / project use unless otherwise specified by your institution.
