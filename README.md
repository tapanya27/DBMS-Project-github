# Contractix — Contractor Job Marketplace

Next.js marketplace backed by Neon Postgres. Clients post jobs; freelancers bid; clients accept work, complete jobs, and leave ratings. Clerk handles sign-in. App profiles and all business rules live in Postgres.

## Setup

1. Copy env values into `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
DATABASE_URL=postgresql://...   # server-only Neon URL
```

`DATABASE_URL` must stay server-only. Do not prefix it with `NEXT_PUBLIC_`.

2. Install and migrate:

```bash
npm install --legacy-peer-deps
node scripts/migrate-db.mjs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo map: views, triggers, and functions

Use this sequence in a viva or presentation.

### 1. Constraints (integrity)

| Object | Demo |
|---|---|
| `jobs_status_check` | Job status only `open` / `in progress` / `completed` |
| `bids_status_check` | Bid status only `pending` / `accepted` / `rejected` |
| `bids_one_per_freelancer` | Same freelancer cannot bid twice on one job |
| `feedback_rating_check` | Rating must be 1–5 |
| `feedback_once_per_reviewer` | One feedback row per job + reviewer |
| `users_role_check` | Role only `client` or `freelancer` |

### 2. Triggers

| Trigger | Demo step |
|---|---|
| `bids_prevent_invalid` | As a client, open your own job and try to bid → blocked. Accept a bid, then try a new bid on that job → blocked because status is not `open`. |
| `feedback_refresh_rating` | Client gives feedback → freelancer `Users.rating` updates to the average. |
| `jobs_audit_status` / `bids_audit_status` | Accept a bid or complete a job → new rows appear in **Reports → Recent status changes**. |

### 3. Stored functions

| Function | Demo step |
|---|---|
| `post_job` | Sign in as **client**, post a job with skills → `Jobs` + `JobSkill` written together. Freelancer posting is rejected. |
| `create_bid` | Sign in as **freelancer**, apply with an amount → bid inserted; non-freelancers are rejected. |
| `update_bid_amount` / `delete_bid` | Freelancer edits or deletes a **pending** bid. Accepted bids cannot be changed. |
| `accept_bid` | Client accepts one bid → that bid accepted, others rejected, job set to `in progress`. Non-owners fail. |
| `reject_bid` | Client rejects a pending bid. |
| `complete_job` | Client marks an in-progress job completed. |
| `complete_job_with_feedback` | Client submits stars → job completed (if needed) and feedback saved; rating trigger runs. |
| `replace_user_skills` | Profile skill save replaces `UserSkill` links through the `Skill` catalog. |

### 4. Views (Reports page)

Open **Reports** after you have at least one posted job and one bid.

| View | What it shows |
|---|---|
| `open_jobs` | Open listings with client name and skills |
| `bid_vs_budget` | Average bid vs posted budget |
| `freelancer_rank` | Freelancers by rating and accepted jobs |
| `top_clients` | Clients by completed jobs |
| `jobs_without_bids` | Jobs that still have zero bids |
| `monthly_job_counts` | Jobs posted / completed by month |

### 5. Suggested live walkthrough

1. Client posts a job with skills.
2. Freelancer bids.
3. Client accepts → job moves to **In Progress**; audit row appears.
4. Client gives feedback → freelancer rating updates; **Reports** refreshes.
5. Show `schema.sql` for constraints, triggers, functions, and views.

## Auth and ownership

- Mutations require a Clerk session.
- Server actions resolve the DB user from the signed-in email. Client-supplied user IDs are not trusted.
- Ownership and role checks also run inside Postgres functions (`accept_bid`, `create_bid`, `complete_job`, and related).

## Messaging and notifications

- **Messages** (`/messages`): available only after a bid is accepted (client ↔ accepted freelancer). Bodies are encrypted with AES-256-GCM before insert (`ciphertext` + `iv` columns). Set `MESSAGE_ENCRYPTION_KEY` in `.env.local`.
- **Notifications**: DB triggers create rows when someone bids, a bid is accepted, or feedback is saved. The navbar bell shows unread items.

Demo: accept a bid → freelancer gets a notification → both open **Messages** → send a note → confirm `Messages.ciphertext` is not readable plaintext in Neon.
