# Contributing Guide — Poray Kemon

---

## Getting Started

See [Deployment Runbook](../deployment/runbook.md) for first-time setup.

---

## Branch Strategy

We use **trunk-based development** with short-lived feature branches.

```
main          ← production. Always deployable.
  └─ feat/review-submission-form
  └─ fix/duplicate-professor-detection
  └─ chore/upgrade-prisma-5
  └─ docs/update-api-spec
```

**Rules:**

- Never push directly to `main` — always open a PR
- Feature branches must be merged within 3 days of creation (keep them short)
- Branch names: `feat/`, `fix/`, `chore/`, `docs/`, `test/`
- Delete branches after merging

---

## Commit Convention

We follow **Conventional Commits** (enforced by Commitlint):

```
<type>(<scope>): <short description>

[optional body — explain WHY, not WHAT]

[optional footer — BREAKING CHANGE, closes #issue]
```

**Types:**

| Type    | When to use                                   |
| ------- | --------------------------------------------- |
| `feat`  | New feature                                   |
| `fix`   | Bug fix                                       |
| `chore` | Dependency updates, config changes, refactors |
| `docs`  | Documentation only                            |
| `test`  | Adding or fixing tests                        |
| `perf`  | Performance improvement                       |
| `ci`    | CI/CD pipeline changes                        |

**Examples:**

```
feat(reviews): add duplicate submission check before INSERT

fix(search): handle empty query string in professor search

chore: upgrade Prisma to 5.12

docs(api): update openapi spec for helpful votes endpoint

test(moderation): add edge cases for Bangla profanity detection
```

**Scope** is optional but encouraged. Use the feature/module name: `reviews`, `auth`, `search`, `admin`, `moderation`, `professors`.

---

## Pull Request Process

1. Open a PR against `main`
2. Fill in the PR template (summary, test plan, screenshots if UI change)
3. CI must pass (typecheck + lint + unit tests + integration tests)
4. At least one review approval (if working solo, self-review is acceptable with a note)
5. Squash and merge (keep main history clean)

### PR Title Format

Same as commit convention:

```
feat(auth): add Google OAuth session management
fix(reviews): prevent race condition in duplicate check
```

---

## Code Standards

### TypeScript

- **Strict mode** — `"strict": true` in `tsconfig.json`
- No `any` type — if you need an escape hatch, use `unknown` + type narrowing
- No non-null assertions (`!`) unless the value is guaranteed by schema
- Prefer `type` over `interface` for data shapes; `interface` for class contracts

### React & Next.js

- **Server Components by default** — only add `'use client'` when using browser APIs, event handlers, or hooks
- Never `useEffect` for data fetching — use Server Components or `use()` hook
- No `getServerSideProps` — App Router only

### Database

- All database access through Prisma Client — no raw SQL in application code except:
  - Running average UPDATEs (use `$executeRaw`)
  - Complex search queries with `tsvector` (use `$queryRaw`)
- All multi-table writes in a `prisma.$transaction()`
- Never read from `review_submissions` and `reviews` in the same query context — keep them decoupled

### Error Handling

- API routes return structured JSON errors:
  ```typescript
  { error: string, code?: string }
  ```
- Use HTTP status codes correctly:
  - `400` — validation error or hard moderation block
  - `401` — not authenticated
  - `403` — authenticated but not authorized
  - `409` — duplicate submission conflict
  - `500` — unexpected server error (never expose stack traces)

### Bangla Strings

- Never hardcode Bangla text inline in components
- Keep all user-facing strings in `lib/strings.ts`
  ```typescript
  export const STRINGS = {
    REVIEW_SUBMITTED: 'রিভিউ জমা হয়েছে',
    ALREADY_REVIEWED: 'আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন।',
    // ...
  }
  ```

### Comments

Write comments only for **why**, never for **what**:

```typescript
// Good — explains a non-obvious constraint
// Running avg formula: new = ((old * count) + value) / (count + 1)
// We use $executeRaw here because Prisma's update API can't express
// the self-referencing column arithmetic atomically.
await prisma.$executeRaw`UPDATE professor_courses SET ...`

// Bad — restates what the code clearly says
// Increment review count by 1
review_count = review_count + 1
```

---

## Testing Requirements

- All new features must include unit tests
- All API routes must have at least one integration test
- Bug fixes must include a regression test
- Run before pushing:
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```

See [Test Plan](./test-plan.md) for detailed testing strategy.

---

## File Naming Conventions

| Type             | Convention                 | Example                     |
| ---------------- | -------------------------- | --------------------------- |
| React components | PascalCase                 | `ProfessorCard.tsx`         |
| Utilities / lib  | camelCase                  | `moderation.ts`             |
| API routes       | Next.js convention         | `app/api/reviews/route.ts`  |
| Test files       | `*.test.ts` or `*.spec.ts` | `moderation.test.ts`        |
| E2E tests        | `*.spec.ts` in `e2e/`      | `review-submission.spec.ts` |

---

## CI Checks (must pass before merge)

```
✓ pnpm typecheck     TypeScript — zero errors
✓ pnpm lint          ESLint — zero warnings
✓ pnpm test          Vitest unit tests — all pass
✓ pnpm test:int      Vitest integration tests — all pass (Docker DB)
✓ pnpm build         Next.js build — no build errors
```

E2E tests (Playwright) run only on PRs to `main`, not on every push.
