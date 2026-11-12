# Private hosted dashboard

ShiftLens supports three explicit modes: `demo`, `local`, and `hosted`. **Use one Vercel project in hosted mode for both the public demo and your private dashboard.** Signed-out visitors see fictional, read-only demo records. Signing in with your owner email/password opens private verified hours; signing out returns to the demo. The private area supports **one business and one administrator-provisioned owner account**. It is not a multi-tenant employee portal.

Public demo pages use only the in-memory fictional database, never Turso snapshots. Private data is read through a separate server-side authenticated path. Signed-in owners can explicitly choose “View demo”; those pages remain clearly labeled fictional, including after client-side navigation. Login does not merge real data into demo records.

## Privacy boundary

- Local SQLite remains authoritative. Photos, PDFs, document pages, filenames, paths, raw OCR, review reasons, aliases, roster data, and correction history never enter the sync payload.
- Sync sends an explicit allowlist: opaque hashed week/employee/shift identifiers, week dates, employee names on verified records, verified daily worked minutes, and verified paid-minute categories/totals. Local IDs are hashed because some OCR IDs contain filename-derived text. This is not anonymization: employee names and hours are still personal data; choose an appropriate hosting region, retention policy, and access policy.
- Only confirmed/manually entered, complete shifts with no uncertain fields or outstanding employee reviews are included. Payroll requires explicit verification; legacy payroll defaults to unverified. Review the values and check the verification box on the local paid-hours page, then save. Editing a value clears the box.
- Actual and paid minutes use existing deterministic calculations. Missing values stay unavailable, not zero. The dashboard labels worked values as confirmed subtotals, because excluding uncertain data does not make an entire week complete.
- Each local edit saves the approved snapshot in a SQLite outbox in the same transaction. A background worker in the local Next.js server checks every 15 seconds, catches up existing verified records at startup, and retries failures. **No publishing button.** Changes, verification revocations, and deletions replace the hosted snapshot atomically.
- The latest snapshot coalesces offline changes. The local server must be running and connected to sync; the dashboard remains readable while it is off, but may be stale. Refresh the dashboard to see updates. Local status shows pending/synced/error and hosted status shows the last accepted change.

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

`SHIFT_LENS_HOSTED_COMPANY_ID` is a stable identifier for this business. Reads and sync writes take it from the server configuration, **never from the browser or payload**.

Initialize the remote tables once using those variables in a trusted shell:

```bash
bun run hosted:init
```

This runs only idempotent `CREATE TABLE/INDEX IF NOT EXISTS` statements and does not read or upload a local profile. It creates Better Auth tables and the separate verified-snapshot table. Future schema changes require explicit migrations; do not change an existing table definition and assume this initializer will migrate it.

With the same hosted variables configured in your trusted local terminal, create the owner:

```bash
bun run hosted:owner
```

Enter and confirm a unique password of 12–128 characters. Input is hidden, never accepted as a command argument or environment variable, and only Better Auth's scrypt password hash is stored in Turso. Use a password manager. The admin command marks the configured account approved; no mailbox verification link is needed. The password itself does **not** go in Vercel environment settings or `.env.local`.

To recover a forgotten password or deliberately replace it:

```bash
bun run hosted:owner --reset
```

Reset requires trusted database access, replaces the password atomically, and revokes existing owner sessions. Without `--reset`, an existing password cannot accidentally be overwritten. There is no public password-reset email flow. Converting an existing Google-only owner with `hosted:owner` removes obsolete OAuth tokens and revokes its old sessions; Google environment variables can be removed.

Deploy the Next.js application to your existing Vercel project with `bun install --frozen-lockfile` and `bun run build`. Configure the hosted secrets for **Production only**; leave Preview deployments in `SHIFT_LENS_DATA_MODE=demo` without production Turso/sync credentials. Signed-out visitors at `/` land in the demo. Use “Sign in” or `/login` for private access; signed-in visitors at `/` land at `/dashboard`. No public sign-up is available. Never configure `SHIFT_LENS_PROFILE_DIR`, `SHIFT_LENS_SYNC_URL`, OCR, or OpenAI credentials on the host. Do not package profile folders with the deployment. Do not expose a production development server.

Build/dev scripts use Next.js's supported Webpack mode: Turbopack's file tracing fails on the existing local Python virtualenv symlink. Local data and OCR files are explicitly excluded from deployment traces, and pages render at request time rather than embedding local data during builds.

## 3. Configure the local computer

Add to ignored `.env.local`, alongside your existing local profile settings:

```dotenv
SHIFT_LENS_DATA_MODE=local
SHIFT_LENS_PROFILE_DIR=profiles/restaurant-a
SHIFT_LENS_SYNC_URL=https://YOUR-DASHBOARD-DOMAIN/api/sync
SHIFT_LENS_SYNC_TOKEN=YOUR-SECOND-SECRET
SHIFT_LENS_SYNC_SOURCE_ID=YOUR-SOURCE-UUID
```

Restart the local app with `bun run dev`. Startup sync includes existing verified shifts automatically. Legacy payroll is not silently promoted to verified. The local status banner confirms whether sync is configured, pending, successful, or failing. Local processing does not require a network connection.

For a long-running production local server, build with local mode and start with `bun run start:local`; the same instrumentation starts its sync worker. The local dev and production scripts bind to loopback so local document access is not exposed to the LAN. The sync token grants write access to this one hosted business, so protect the local machine and environment file.

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

Run `bun run test:unit` and `bun run test:e2e:hosted` for privacy, retry, revision, password login/reset, auth, and hosted-route tests. Hosted browser tests use a disposable fictional database and real password login to test the public/private transition, failed login, logout, and data separation. Remote Turso connectivity still needs a deployment smoke test with your credentials.
