# PRD: User Accounts & Data Isolation

**Status:** Draft — under review
**Replaces:** The token-based household sharing sketch in PRD-features-backlog.md §5
**Scope:** Full user account system; each user owns their own cats and measurements

---

## Background

The MVP was intentionally single-tenant and trust-based — no login, no data isolation. Anyone with the URL could read and write all data. This was the right call for an MVP on a known URL, but it becomes a problem the moment a second person uses the app, or the app is shared publicly.

The original TDD noted "Auth (if needed)" in Phase 2. The features backlog proposed a lightweight token-sharing model (secret token in the URL, full access). That model is simpler but doesn't support:
- Multiple independent users with separate cat lists
- A shelter with staff who each see their own intake cases
- Sharing an app link publicly without exposing everyone's data

This PRD proposes a full (but lightweight) user account system.

---

## Goals

1. Each user sees only their own cats and measurements
2. Logging in is frictionless — no passwords, no email/password signup form
3. The app still works on Cloudflare free tier
4. A path exists for optional household sharing (one user invites another to their cats)

---

## Non-Goals

- Native mobile app or push notifications (web only)
- Role-based permissions (owner vs. read-only) in v1
- SSO / enterprise identity
- Billing / subscription tiers

---

## Recommended Auth Model: OAuth (Google + GitHub)

### Why OAuth over passwords / magic links

| Option | Pros | Cons |
|--------|------|------|
| Password | Familiar | Requires hashing (bcrypt is slow on Workers), reset flows, breach risk |
| Magic link (email OTP) | No password | Requires email infrastructure (Resend/Mailgun); adds external dependency |
| OAuth (Google/GitHub) | No passwords, no email infra, users already logged in, free | Requires redirect flow, storing provider tokens |
| Passkeys/WebAuthn | Passwordless, phishing-resistant | Complex to implement, limited browser support for some flows |

OAuth wins for this stack: zero email infrastructure, users have accounts already, simpler than passkeys, and the Hono OAuth helper libraries handle most of the flow.

**Providers to support at launch:** Google (broadest reach) + GitHub (developer users likely to use this app)

---

## Auth Flow

```
User taps "Sign in with Google"
  → Worker redirects to Google OAuth consent screen
  → Google redirects to /api/auth/callback?code=...&state=...
  → Worker exchanges code for user profile (email, name, avatar)
  → Worker upserts user in D1 users table
  → Worker creates session in D1 sessions table
  → Worker sets httpOnly session cookie (7 day expiry)
  → Worker redirects to /  (now authenticated)
```

Logout: DELETE /api/auth/logout → clears session from D1 + expires cookie.

Session validation: every Worker request checks the session cookie against the sessions table. If missing or expired → 401.

---

## Schema Changes

```sql
-- New: users table
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  oauth_provider  TEXT NOT NULL,   -- 'google' | 'github'
  oauth_id        TEXT NOT NULL,   -- provider's stable user ID
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(oauth_provider, oauth_id)
);

-- New: sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Modify: add user_id to cats
ALTER TABLE cats ADD COLUMN user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
```

The `user_id` on cats is nullable at first to support the data migration (see below).

---

## API Changes

### New routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/login?provider=google` | Redirects to OAuth consent |
| GET | `/api/auth/callback` | OAuth callback; creates session; redirects to `/` |
| POST | `/api/auth/logout` | Deletes session; clears cookie |
| GET | `/api/auth/me` | Returns current user `{ id, email, display_name, avatar_url }` |

### Modified routes

All existing routes gain an auth middleware that:
1. Reads the `session` httpOnly cookie
2. Looks up the session in D1 (checking `expires_at`)
3. Injects `c.env.userId` into the Hono context
4. Returns 401 if session missing or expired

All `SELECT` queries on cats and measurements are scoped: `WHERE user_id = ?` (from session).
All `INSERT` into cats sets `user_id` from the session.

---

## Frontend Changes

### New components / pages

- **`/login`** — simple page: "Sign in with Google" + "Sign in with GitHub" buttons; shown only if unauthenticated
- **`AuthContext`** — React context providing `user`, `loading`, `logout()`; fetches `/api/auth/me` on mount
- **`ProtectedRoute`** wrapper — redirects to `/login` if not authenticated
- **User avatar** in BottomNav or top corner — tapping opens a simple popover with name + "Sign out"

### Auth state management

On app load, fetch `/api/auth/me`:
- 200 → store user in context, render the app
- 401 → redirect to `/login`

No localStorage tokens — session is entirely cookie-based (httpOnly, secure, SameSite=Lax).

---

## Data Migration

**Existing data:** 3 cats (Gemini, Kylo, Luna) with measurements, owned by no one (`user_id = NULL`).

**Strategy — claim on first login:**
- After a user's first successful OAuth login, show a one-time prompt: "We found existing cats in this account. Claim them as yours?"
- If accepted: `UPDATE cats SET user_id = ? WHERE user_id IS NULL`
- If declined: cats remain orphaned (visible only to an admin or via direct DB query)

This is simpler than trying to automatically assign ownership and avoids surprising a second user with someone else's cats.

---

## Cloudflare Constraints & Notes

### OAuth redirect URIs
- Production: `https://cat-tracker-api.stevej-67b.workers.dev/api/auth/callback`
- Must be registered in Google Cloud Console / GitHub OAuth App settings

### Cookie security
- `httpOnly: true` — not accessible to JavaScript
- `Secure: true` — HTTPS only (Cloudflare Workers always HTTPS)
- `SameSite: Lax` — protects against CSRF for cross-site navigation, allows top-level redirects

### Session expiry
- 7-day rolling sessions: on each authenticated request, extend `expires_at` by 7 days
- Periodic D1 cleanup: a Cron trigger (`0 3 * * *`) deletes `WHERE expires_at < datetime('now')`

### Worker secrets
OAuth credentials must be stored as Worker secrets (not in wrangler.toml):
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET   # for signing cookies if needed
```

### D1 session lookup performance
Sessions table will have at most a few hundred rows for this app. Index on `id` (PK) is sufficient — no additional indexes needed.

---

## Implementation Order

1. Schema migration (users + sessions tables; nullable user_id on cats)
2. Worker: OAuth routes (login redirect, callback, logout, me)
3. Worker: auth middleware + inject userId into all existing routes
4. Worker: scope all cat/measurement queries to user_id
5. Frontend: AuthContext + /login page
6. Frontend: ProtectedRoute wrapper on all routes
7. Frontend: user avatar / sign-out in nav
8. Frontend: first-login "claim existing cats" prompt
9. Worker: session cleanup Cron

---

## Open Questions (for review)

1. **Google + GitHub, or just Google?** GitHub is dev-friendly but Google covers the broadest audience (especially non-technical users like shelter staff). We could launch with Google only and add GitHub later.

2. **Household sharing scope?** The features backlog's token-sharing idea (share a link to give someone access to your cats) could still work on top of this auth model — a separate `cat_invites` table and a `/share/:token` route. Not needed in v1 but easy to add.

3. **What happens to the existing cats (Gemini, Kylo, Luna)?** The "claim on first login" approach is proposed but could also be: first user to log in automatically owns them. Recommend explicit prompt.

4. **Session length?** 7 days proposed. Could be longer (30 days) for a low-stakes personal app.

5. **PKCE?** Should be used for the OAuth flow to prevent authorization code interception. Hono's OAuth helpers support this.
