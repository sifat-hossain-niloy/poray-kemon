# ADR-001: Next.js 15 with App Router as the Application Framework

**Status:** Accepted  
**Date:** June 2026  
**Deciders:** Project team

---

## Context

We need a full-stack web framework that handles:

- Server-side rendering for SEO (professor pages need to be indexed by search engines)
- Static generation with incremental revalidation (professor profiles change infrequently)
- Built-in API routes (to avoid maintaining a separate backend service)
- TypeScript support
- Good performance on mobile (Bangladesh has significant 4G-only users)

Candidates evaluated: Next.js 15, Remix, SvelteKit, plain Express + React SPA.

---

## Decision

Use **Next.js 15 with App Router**.

---

## Rationale

| Requirement             | How Next.js satisfies it                                     |
| ----------------------- | ------------------------------------------------------------ |
| SEO for professor pages | ISR with `generateStaticParams` — pages are HTML at the edge |
| Fast mobile load        | Server Components reduce JS bundle size by default           |
| API routes              | Built-in — no separate Express server needed                 |
| Auth integration        | NextAuth.js is purpose-built for Next.js                     |
| TypeScript              | First-class support                                          |
| Deployment              | Vercel zero-config; also works in Docker for self-hosting    |
| Learning value          | App Router + RSC is the current industry standard            |

React Server Components (RSC) are specifically valuable here: the professor profile page, which fetches professor data + all course aggregates + tag clouds, can be rendered entirely on the server with zero client JS for the read path.

---

## Consequences

**Positive:**

- Professor and university pages are statically generated at the CDN edge — sub-200ms loads globally
- Read path has no client-side data fetching overhead
- Single deployment artifact (no separate API server)

**Negative:**

- App Router has a learning curve over Pages Router
- Some third-party libraries (older React libs) may not support RSC
- Server Actions, while convenient, add coupling between UI and data layer — use only for form mutations

**Constraints:**

- Keep `'use client'` to a minimum — only interactive components (star rater, search typeahead, helpful vote button)
- Never use `useEffect` for data fetching — all data fetching in Server Components or Server Actions
