# ADR-004: NextAuth.js v5 with Google OAuth

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

Reviews and helpful votes require a login mechanism to enforce:

1. One review per professor+course per person
2. One helpful vote per review per person

We need a solution that stores minimal PII (Bangladesh PDPO compliance), integrates naturally with Next.js, and supports Google OAuth as the sole provider.

---

## Decision

Use **NextAuth.js v5 (Auth.js)** with **Google OAuth only**. Sessions stored in **Redis**.

---

## Rationale

### Why NextAuth over Clerk / Auth0 / Supabase Auth

| Factor              | NextAuth v5               | Clerk                         | Auth0                   |
| ------------------- | ------------------------- | ----------------------------- | ----------------------- |
| Self-hosted         | Yes                       | No (SaaS)                     | No (SaaS)               |
| Data control        | Full                      | Clerk stores user data        | Auth0 stores user data  |
| PII stored          | Only what we configure    | Email, name stored by default | Email stored by default |
| Cost                | Free                      | Free tier limited             | Free tier limited       |
| Next.js integration | Purpose-built             | Good                          | Good                    |
| No-email design     | Possible (custom adapter) | Difficult                     | Difficult               |

The core requirement — **store no email address** — is uniquely easy with NextAuth because we control the adapter. The custom Prisma adapter stores only `google_id` (the `sub` claim) and `display_name`.

### Why Google OAuth only

- Students already have Google accounts (university GSuite or personal)
- Google is the most trusted OAuth provider in Bangladesh
- Single provider reduces attack surface
- Adding more providers (Facebook, GitHub) is a future phase decision

### Why Redis for sessions

- Sessions need to be revokable (important: if a user is flagged for abuse, admin can invalidate their session by deleting the Redis key)
- Redis TTL handles session expiry automatically (30-day sliding window)
- Avoids JWT session tokens which are non-revokable without a denylist

---

## The No-Email Design

Standard NextAuth stores `email` in the `users` table. We override this:

```typescript
// lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub, // Google unique ID — store this
          name: profile.name, // Display name — store this
          email: undefined, // Explicitly drop email
        }
      },
    }),
  ],
  adapter: CustomPrismaAdapter(prisma), // Custom adapter — no email column
  session: { strategy: 'database' }, // Redis-backed via custom store
})
```

---

## Consequences

**Positive:**

- No email stored — compliant with Bangladesh PDPO (forthcoming)
- Sessions are revokable from admin panel
- Google OAuth popup is a single click for most users (already signed in to Google)
- The session object only exposes `{ userId, displayName }` to the app

**Negative:**

- Custom adapter requires maintenance when NextAuth updates
- Redis dependency for sessions — if Redis goes down, all sessions are lost (users must re-login)
- No password reset flow (not applicable — no passwords)

**Constraints:**

- Session cookie is `httpOnly`, `secure`, `sameSite: lax`
- Never expose `google_id` to the client — internal identifier only
- `displayName` is for UI only (e.g., "Signed in as Sifat") — never link it to review content
