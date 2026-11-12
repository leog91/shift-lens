# Private hosted dashboard

ShiftLens supports three explicit modes: `demo`, `local`, and `hosted`. **Use one Vercel project in hosted mode for both the public demo and your private dashboard.** Signed-out visitors see fictional, read-only demo records. Signing in with your owner email/password opens private verified hours; signing out returns to the demo. The private area supports **one business and one administrator-provisioned owner account**. It is not a multi-tenant employee portal.

Public demo pages use only the in-memory fictional database, never Turso snapshots. Private data is read through a separate server-side authenticated path. Signed-in owners can explicitly choose “View demo”; those pages remain clearly labeled fictional, including after client-side navigation. Login does not merge real data into demo records.

## Which environment settings go where?

Both environment files below live in the repository root and are ignored by Git. Create them yourself; `.env.example` is only a template, not a loaded configuration file.

| Location | Purpose | Contents |
| --- | --- | --- |
| `.env.local` | Run your local app and automatic sync | Local mode, optional existing profile path, sync URL, sync token, source UUID |
| `.env.hosted.local` | Run trusted hosted database/account setup from your computer | The hosted variables listed in step 2 |
| Vercel → project Settings → Environment Variables → Production | Run the combined public demo/private dashboard | The same hosted variables as `.env.hosted.local` |
| Vercel → Preview | Demo-only previews | `SHIFT_LENS_DATA_MODE=demo`, without production credentials |

Normal `bun run dev` uses `.env.local`. Admin commands below explicitly select `.env.hosted.local`, so you do not need to change the local app's mode. Settings entered in Vercel are not automatically available in your local terminal. Never store your login password in either file or Vercel settings, and never commit the real environment files.

## Privacy boundary

- Local SQLite remains authoritative. Photos, PDFs, document pages, filenames, paths, raw OCR, review reasons, aliases, roster data, and correction history never enter the sync payload.
- Sync sends an explicit allowlist: opaque hashed week/employee/shift identifiers, week dates, employee names on verified records, verified daily worked minutes, and verified paid-minute categories/totals. Local IDs are hashed because some OCR IDs contain filename-derived text. This is not anonymization: employee names and hours are still personal data; choose an appropriate hosting region, retention policy, and access policy.
- Only confirmed/manually entered, complete shifts with no uncertain fields or outstanding employee reviews are included. Payroll requires explicit verification; legacy payroll defaults to unverified. Review the values and check the verification box on the local paid-hours page, then save. Editing a value clears the box.
- Actual and paid minutes use existing deterministic calculations. Missing values stay unavailable, not zero. The dashboard labels worked values as confirmed subtotals, because excluding uncertain data does not make an entire week complete.
- Each local edit saves the approved snapshot in a SQLite outbox in the same transaction. A background worker in the local Next.js server checks every 15 seconds, catches up existing verified records at startup, and retries failures. **No publishing button.** Changes, verification revocations, and deletions replace the hosted snapshot atomically.
- The latest snapshot coalesces offline changes. The local server must be running and connected to sync; the dashboard remains readable while it is off, but may be stale. Refresh the dashboard to see updates. Local status shows pending/synced/error and hosted status shows the last accepted change.

## Private dashboard views

The private workspace provides read-only browsing closer to the local app, using the same existing verified snapshot. No new document fields or database migrations are needed:

- **Weeks:** choose a synced week and employee, compare confirmed worked/verified paid hours, inspect daily verified entries, browse all synced weeks, and navigate to earlier/later weeks. The initial selection prefers the most recent week with verified data, not an empty newer week.
- **Hours:** choose day, week, month, year, or all time, then apply filters. Rankings show confirmed net hours, distinct days worked, and shift counts. Equal totals share a rank; filtering an employee does not change their rank against the selected period's other employees. Daily entries link to their day or employee history.
- **Employees:** select an employee for confirmed hours history grouped by day/week/month/year/all time, a recent-period chart, first/last recorded dates, and all-time ranking. Period totals use shift dates, including weeks crossing a month or year boundary.
- **Paid hours:** inspect ordinary, Sunday, other, and recorded total paid minutes for a source week. Missing verified payroll remains unavailable (—), not zero. Weekly paid hours are not allocated to calendar days/months. A category sum that differs from the recorded total is reported rather than silently overwritten.

Use **Apply filters** after changing selections. Filters are encoded in private `/dashboard` URLs for bookmarking. **Refresh data** rechecks authentication and loads the latest accepted snapshot. **Last updated** shows the date and time (UTC) of the latest verified-data change accepted by Turso, not the page-load or deployment time; before the first sync it shows **Not yet synced**. Comparison cards aggregate differences only for employees with both actual and paid values; they never subtract incomplete paid totals from everyone else's actual hours.

All worked totals are confirmed subtotals, not a claim that the week or month is complete. Days worked counts unique dates, so split shifts count as one day. Clock times, breaks, original sheets, roster context, and review details are not in the hosted snapshot; use the local app for those. No missing document coverage is inferred from the absence of an unverified row online.

## 1. Create credentials

Create a **dedicated private Turso database** and a server-side database token. Never point the hosted app at the local SQLite file, and do not use embedded replication of the local database.

Generate two distinct secrets and a source UUID (run each command separately):

```bash
openssl rand -hex 32
openssl rand -hex 32
bun -e 'console.log(crypto.randomUUID())'
```

Use one secret for `BETTER_AUTH_SECRET`, the other for `SHIFT_LENS_SYNC_TOKEN`. Keep the UUID as `SHIFT_LENS_SYNC_SOURCE_ID`. This source ID identifies a single authoritative profile, not a user or a secret.

Choose the owner's email address; it acts as the login username. No Google Cloud, OAuth credentials, or email delivery service is required. Public account registration and account linking are disabled. Create the password interactively with the trusted admin command below, not through a browser sign-up page.

## 2. Configure the hosted deployment

Set these server-only environment variables on your hosting provider:

```dotenv
SHIFT_LENS_DATA_MODE=hosted
TURSO_DATABASE_URL=libsql://YOUR-DATABASE.turso.io
TURSO_AUTH_TOKEN=YOUR-DATABASE-TOKEN
BETTER_AUTH_URL=https://YOUR-DASHBOARD-DOMAIN
BETTER_AUTH_SECRET=YOUR-FIRST-SECRET
SHIFT_LENS_HOSTED_COMPANY_ID=YOUR-BUSINESS-ID
SHIFT_LENS_HOSTED_OWNER_EMAIL=YOUR-OWNER-EMAIL
SHIFT_LENS_SYNC_TOKEN=YOUR-SECOND-SECRET
SHIFT_LENS_SYNC_SOURCE_ID=YOUR-SOURCE-UUID
```

`SHIFT_LENS_HOSTED_COMPANY_ID` is a stable identifier for this business. Reads and sync writes take it from the server configuration, **never from the browser or payload**. Use the same value in Vercel and `.env.hosted.local`. It is not a folder path and does not need to match `SHIFT_LENS_PROFILE_DIR`.

Save those hosted variables in the ignored `.env.hosted.local` file as well as Vercel Production. From the repository directory, initialize the remote tables once:

```bash
bun --env-file=.env.hosted.local run hosted:init
```

This runs only idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements and does not read or upload a local profile. It creates Better Auth tables and the separate verified-snapshot table. Future schema changes require explicit migrations; do not change an existing table definition and assume this initializer will migrate it.

Create the owner using the same hosted file:

```bash
bun --env-file=.env.hosted.local run hosted:owner
```

Enter and confirm a unique password of 12–128 characters. Input is hidden, never accepted as a command argument or environment variable, and only Better Auth's scrypt password hash is stored in Turso. Use a password manager. The admin command marks the configured account approved; no mailbox verification link is needed. The password itself does **not** go in Vercel environment settings or `.env.local`.

To recover a forgotten password or deliberately replace it:

```bash
bun --env-file=.env.hosted.local run hosted:owner --reset
```

Reset requires trusted database access, replaces the password atomically, and revokes existing owner sessions. Without `--reset`, an existing password cannot accidentally be overwritten. There is no public password-reset email flow. Converting an existing Google-only owner with `hosted:owner` removes obsolete OAuth tokens and revokes its old sessions; Google environment variables can be removed.

Deploy the Next.js application to your existing Vercel project with `bun install --frozen-lockfile` and `bun run build`. Configure the hosted secrets for **Production only**; leave Preview deployments in `SHIFT_LENS_DATA_MODE=demo` without production Turso/sync credentials. Signed-out visitors at `/` land in the demo. Use “Sign in” or `/login` for private access; signed-in visitors at `/` land at `/dashboard`. No public sign-up is available. Never configure `SHIFT_LENS_PROFILE_DIR`, `SHIFT_LENS_SYNC_URL`, OCR, or OpenAI credentials on the host. Do not package profile folders with the deployment. Do not expose a production development server.

Build/dev scripts use Next.js's supported Webpack mode: Turbopack's file tracing fails on the existing local Python virtualenv symlink. Local data and OCR files are explicitly excluded from deployment traces, and pages render at request time rather than embedding local data during builds.

## 3. Configure the local computer

Create or update the ignored `.env.local` file in the repository root. For existing root-level `data/` and `photo-inbox/` folders, use:

```dotenv
SHIFT_LENS_DATA_MODE=local
SHIFT_LENS_SYNC_URL=https://YOUR-DASHBOARD-DOMAIN/api/sync
SHIFT_LENS_SYNC_TOKEN=YOUR-SECOND-SECRET
SHIFT_LENS_SYNC_SOURCE_ID=YOUR-SOURCE-UUID
```

Only add `SHIFT_LENS_PROFILE_DIR` if you already use a separate profile directory containing its own `data/shiftlens.sqlite` and `photo-inbox/`. For example:

```dotenv
SHIFT_LENS_PROFILE_DIR=profiles/your-existing-business
```

Do not copy a sample profile path that does not exist: it selects a different storage location and does not move your current data. If the database is at `data/shiftlens.sqlite` in the repository root, omit the variable. The hosted company ID is independent of this path. Do not set a profile path on Vercel.

`SHIFT_LENS_SYNC_TOKEN` and `SHIFT_LENS_SYNC_SOURCE_ID` must exactly match their Vercel values. Use your actual deployed HTTPS domain followed by `/api/sync` for `SHIFT_LENS_SYNC_URL`. The local app does not need Turso credentials, `BETTER_AUTH_SECRET`, the hosted company ID, or your login password.

Restart the local app with `bun run dev`. Startup sync includes existing verified shifts automatically. Legacy payroll is not silently promoted to verified. The local status banner confirms whether sync is configured, pending, successful, or failing. Local processing does not require a network connection.

For a long-running production local server, build with local mode and start with `bun run start:local`; the same instrumentation starts its sync worker. The local dev and production scripts bind to loopback so local document access is not exposed to the LAN. The sync token grants write access to this one hosted business, so protect the local machine and environment file.

## After configuring Vercel and redeploying

1. Run `hosted:init` and `hosted:owner` with the explicit hosted environment file if you have not done so already. Changing Vercel settings and redeploying does not create database tables or a password automatically. Do not reset an existing password just to redeploy.
2. Open the deployed site in an incognito window. `/` should show the fictional demo and a **Sign in** link.
3. Sign in with `SHIFT_LENS_HOSTED_OWNER_EMAIL` and the password chosen in the owner command. A new dashboard may be empty until the first sync.
4. Restart the local app with `bun run dev`. Wait for its status banner to report **synced**. The local app must remain running and connected for future automatic updates.
5. Refresh the online dashboard and check verified hours. Use **View demo** to confirm sample pages remain fictional; signing out should return to the demo.

Vercel environment changes require a new deployment. Local environment changes require restarting the local app. Production uses `bun install --frozen-lockfile` and `bun run build`; Vercel manages the production server, so do not configure `bun run dev` as a Vercel start command.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| No sign-in link online | Production must use `SHIFT_LENS_DATA_MODE=hosted`; redeploy after changing it. Preview/demo-only deployments intentionally have no login. |
| Admin command says hosted storage is disabled | Use `bun --env-file=.env.hosted.local run ...` and put `SHIFT_LENS_DATA_MODE=hosted` in that file. |
| Login fails or tables are missing | Run the initializer and owner command against the same Turso database used by Vercel. The email must match the configured owner. |
| Local data appears missing | Remove a copied sample `SHIFT_LENS_PROFILE_DIR` if your existing database is in root-level `data/`, or select your actual existing profile. Restart; do not initialize a new empty profile to recover data. |
| Cloud sync is not configured | Set the `/api/sync` URL, shared sync token, and source UUID in `.env.local`, then restart. |
| Sync reports HTTP 401 | Check that the sync token matches Vercel and that the deployed endpoint is the intended production site. |
| Sync reports HTTP 409 | Investigate a source/revision conflict before changing anything; see the restore guidance below. |
| Sync reports HTTP 404 or 503 | Check the URL, hosted mode, deployment readiness, hosted credentials, and table initialization. |
| Verified paid hours are missing | Legacy payroll is unverified by default. Review all values, check the verification box, save locally, and wait for sync. |

Share error messages when seeking help, not passwords, tokens, environment-file contents, or real payroll records.

## Security and operations

- HTTPS is required in production. Loopback HTTP and `file:` hosted databases are permitted only outside production for testing.
- Turso and auth secrets stay server-side. The browser never gets a Turso or publishing token. The local computer only needs its scoped publishing token, not Turso credentials.
- Better Auth uses database-backed, secure production sessions and database-backed rate limiting, with five email/password sign-in attempts per minute per client key. Authorization checks the approved owner email on every dashboard read; cached session cookies are disabled. This initial version has password login only, without MFA.
- Hosted routing permits public, read-only demo pages and bundled fictional documents, login, private dashboard, auth, sync, and framework static assets. Local photo-serving APIs, OCR, backup APIs, uploads, and editing requests are blocked for everyone. Dashboard reads independently verify the session and company scope. Hosted responses use `no-store` and `noindex`, including demo pages, to avoid cross-user cache confusion.
- Strict recursive payload schemas reject unexpected fields (including document details). Sync accepts a maximum 5 MiB snapshot. Very large histories need a future chunked protocol; 413 errors remain visible and queued rather than dropping records.
- Sync writes use a transaction and monotonically increasing revisions. Retries of identical revisions are safe; stale, conflicting, or different-source snapshots are rejected. Use only one authoritative local profile/server per hosted business.
- After a profile restore, the source's revision can move backwards. A 409 must be investigated, not automatically overwritten. Back up both sides and confirm the restored profile is authoritative before an administrator removes that company's `published_snapshots` row to permit a fresh snapshot. Do not delete auth tables. The local status may initially show an older successful sync; the next changed snapshot detects the conflict.
- Rotate a compromised sync token on the host and local computer, then restart both. Changing the owner email denies previous owners on subsequent reads; also revoke their sessions. Database/provider backups can retain prior snapshots even after live deletion; manage retention with the providers.
- Do not log payloads, secrets, auth headers, or employee data. Never commit real data or credentials. Back up the local profile separately using the existing backup workflow.

## Dependency check

Web dependencies are pinned to tested versions in `package.json` and `bun.lock`. Run `bun outdated` and `bun audit` regularly. This implementation updates Next.js to 16.4.6, React to 19.3.1, Better Auth to 1.7.22, and the other formerly floating web dependencies. The remaining audit finding at implementation time is moderate `minimatch` glob amplification in the ESLint/typescript-eslint toolchain; the upstream dependency range has not adopted minimatch 11. Do not force a major override across legacy minimatch callers. ESLint 10 and TypeScript 7 are separate major migrations, not silently included here. Python OCR dependencies have not been upgraded or audited as part of this web/auth change.

Run `bun run test:unit` and `bun run test:e2e:hosted` for privacy, retry, revision, password login/reset, auth, and hosted-route tests. Hosted browser tests use a disposable fictional database and real password login to test the public/private transition, failed login, logout, and data separation. Local review browser tests explicitly clear sync and hosted credentials, even when `.env.local` is populated, so fictional profiles cannot publish to production. Remote Turso connectivity still needs a deployment smoke test with your credentials.
