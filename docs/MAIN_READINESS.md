# Main application readiness — 2026-10-27

## Source identity

Repository: `ncovtam-art/shopee-ads-manager`, base main `82896c6`.
Branch: `fix/main-auth-readiness`. This application uses Supabase Auth/Postgres
and manual CSV reporting. The old `fix/meta-setup-diagnostics` branch has unrelated
application history; its 80 tests and Docker/Meta runtime do not validate this
application. No unrelated-history merge was performed.

## Changes

- Staff creation now checks exact configured Origin, active caller status,
  role hierarchy, input types/lengths, JSON type/size and server administration
  configuration. Leaders can create only EMPLOYEE accounts. Privileged account
  creation uses Supabase Admin; there is no anonymous-key fallback or public
  signup with client-supplied role metadata.
- A successful response requires a confirmed profile update. Failure attempts
  cleanup of only the newly returned Auth user ID. Cleanup failure returns an
  explicit incomplete-operation error; upstream exceptions are not returned.
- Staff UI matches the hierarchy, prevents self role/status changes, requires
  12-character passwords and reports failed profile updates instead of success.
- Next 16 Proxy replaces deprecated middleware, forwards refreshed cookies on
  both requests and redirects, denies inactive/missing profiles and returns JSON
  errors for API requests. A dot in a dynamic path no longer bypasses auth.
- Security migration v5 removes role grants from signup metadata, avoids recursive
  profile policies, blocks direct REST self-promotion and privilege changes,
  restricts assignment/mapping writes to managers, requires active identities on
  existing RLS tables and makes public views respect caller policies. No existing
  user/role is reassigned automatically.
- Type annotations, stable callbacks and reusable tooltip remove all 42 baseline
  lint errors without disabling rules. Financial screens show an error when
  queries fail instead of treating failure as confirmed zero income/spend.
- CSV export escapes embedded quotes and neutralizes spreadsheet formulas.
- Migration v6 and the import UI use atomic, caller-scoped RPCs for report import
  and batch deletion. A SHA-256 identity ignores filename/row order within the
  same Page/source/report date. Numeric amounts are normalized to stored decimal
  precision before hashing. Duplicate retries return the existing batch without
  adding detail rows. Failed detail writes roll back metadata. Bulk deletion
  validates the whole selection and cascades in one transaction.
- Migration v7 makes Page deletion atomic and administrator-only. Historical
  references may refuse deletion; all prior financial deletions then roll back.
  Page assignment/reward edits require confirmed rows before updating UI state;
  unset reward configuration no longer displays a fabricated cash prize.
- Node 24, test/typecheck scripts, frozen-install metadata and independent CI
  are included. Private environment files and TypeScript output are ignored.
- Upgrade Next/ESLint config from 16.2.12 to 16.4.3 and refresh vulnerable
  transitive packages within their existing semver ranges. The baseline
  production audit had one critical and four high findings; the final full
  dependency audit reports zero. No force or peer-dependency bypass was used.

## Verification

- PASS: `npm ci --offline --no-fund --no-audit --cache /tmp/shopee-npm-cache`
  after standard npm lockfile refresh; no force/legacy-peer-deps or skipped
  integrity/TLS validation.
- PASS: `npm run typecheck`.
- PASS: `npm run lint`, zero errors; one existing advisory about manual Google
  font stylesheet placement remains. No rule was disabled.
- PASS: `npm test`, 31 tests, zero failures or skipped tests.
- PASS: full schema + migrations v2/v3/v4/v5 + SQL acceptance on an isolated
  PostgreSQL 17 container with no network, published ports or persistent volume.
  Supabase auth tables/UID claims are fixture shims, not real Auth verification.
  Checks cover metadata role injection, employee/leader self-promotion, revenue
  permissions, self assignment, safe profile edits, admin directory recursion,
  admin self lockout, inactive and anonymous access.
- PASS: final `npm run build` on Next 16.4.3 after clean install, 21 routes. CI results
  are recorded with the commit/PR after completion; build is not deployment.
- PASS: local production HTTP smoke on Next 16.4.3 without provider credentials:
  login 200 with disabled unconfigured form, known public asset 200,
  protected pages (including a dotted dynamic path) redirect to login, finance
  API returns configuration-required 503. This is not authenticated browser or
  real Supabase acceptance. CI reproduces it with `scripts/http-smoke.mjs`.
- Repeat-migration/idempotency check: NOT RUN; the Docker tool request was
  cancelled. No replacement execution or PASS claim is made for that check.
- PASS: final full `npm audit`, zero vulnerabilities in production and dev.
- PASS: v6 atomic import SQL acceptance on the same isolated fixture: canonical
  duplicate detection, decimal amounts, retained negative commission adjustment,
  actual same-Page campaign matching, rollback after injected detail failure,
  rejection of unknown fields, partial-selection deletion refusal, cascade
  deletion and employee role denial.
- PASS: two real PostgreSQL clients submitted the same report concurrently and
  retained exactly one batch and one detail. Both clients completed successfully.
- PASS: v7 SQL acceptance covers complete deletion, history-reference failure
  restoring all financial data and refusal of Leader deletion.

## Review before applying migration

No migration, account creation, cleanup, data deletion, DNS change or production
deploy has been run on the owner's services. The SQL fixture uses only synthetic
identities. Keep existing profiles/keys and first verify a backup and staging
restore. Review public views and any SECURITY DEFINER RPCs in the actual Supabase
project before applying new RLS. Existing unauthorized roles, if any, require
owner review; this migration does not silently demote users. Disabling signup in
Supabase Auth is still recommended for the internal staff-only application.

## Remaining FAIL/BLOCKED/UNVERIFIED work

1. Supabase RPC definitions `get_dashboard_summary`, `get_page_summary`,
   `get_page_daily` and `get_page_campaigns` are called by the UI but not versioned
   in the supplied SQL. Their current live implementations, grants, date/financial
   semantics and row scopes need export/review plus independent fixtures. This
   is a fresh-install and data-authorization acceptance blocker.
2. Version v6 must be reviewed and applied to a staging restore before the new
   import UI is activated. Existing hash-less legacy batches are preserved and
   are not retroactively deduplicated. Concurrency/load and large real CSV
   production acceptance remain unverified. Migration v7 also requires staging review;
   Pages with protected history are intentionally retained on delete failure.
3. Authenticated browser sessions, role-specific UI, real Supabase Auth,
   backup/restore, Vercel Preview and custom-domain acceptance require private
   provider bindings/access that are absent in this workspace.
4. Preview credentials need the correct Supabase project URL/public key and
   server-only service-role key. Never reuse leaked secrets. Keep the existing
   production domain/project untouched until a separate Preview is reviewed.
5. No LIVE Meta/Shopee/AI integration, publishing or Ads acceptance is claimed.
   No paid provider call, worker, merge or production deploy is authorized by
   a passing unit test. Trial safety defaults remain in the example configuration.

CI uses only a disposable PostgreSQL service, synthetic users and public packages;
it does not consume any repository/live secrets or run a deployment command.
