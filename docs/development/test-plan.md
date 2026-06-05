# Test Plan — Poray Kemon

**Version:** 1.0  
**Last Updated:** June 2026

---

## 1. Testing Objectives

1. **Anonymity contract** — verify that no JOIN between `reviews` and `review_submissions` is possible
2. **Review submission integrity** — one review per user per professor+course, enforced atomically
3. **Moderation correctness** — keyword filter blocks and flags the right content
4. **Search accuracy** — professor search returns relevant results with fuzzy matching
5. **Auth flows** — unauthenticated users can read, must authenticate to write

---

## 2. Test Stack

| Layer             | Tool                  | Config file                    |
| ----------------- | --------------------- | ------------------------------ |
| Unit tests        | Vitest                | `vitest.config.ts`             |
| Integration tests | Vitest + real test DB | `vitest.integration.config.ts` |
| E2E tests         | Playwright            | `playwright.config.ts`         |
| Coverage          | Vitest c8             | —                              |

---

## 3. Unit Tests

**Location:** `__tests__/unit/`  
**Run:** `pnpm test:unit`  
**DB required:** No (all dependencies mocked)

### Moderation (`lib/moderation.test.ts`)

| Test case                           | Expected                                            |
| ----------------------------------- | --------------------------------------------------- |
| Clean review text                   | `{ status: 'pass' }`                                |
| English profanity in review_text    | `{ status: 'hard_block', reason: 'profanity_en' }`  |
| Bangla profanity                    | `{ status: 'hard_block', reason: 'profanity_bn' }`  |
| Slur (religious)                    | `{ status: 'hard_block', reason: 'slur' }`          |
| ALL CAPS review text                | `{ status: 'soft_flag', reason: 'all_caps' }`       |
| Review text under 20 chars          | `{ status: 'soft_flag', reason: 'too_short' }`      |
| 3+ exclamation marks                | `{ status: 'soft_flag', reason: 'high_emotion' }`   |
| "he ruined my semester"             | `{ status: 'soft_flag', reason: 'grudge_pattern' }` |
| Empty review_text (optional field)  | `{ status: 'pass' }`                                |
| Duplicate review text (exact match) | `{ status: 'hard_block', reason: 'duplicate' }`     |

### Validation (`lib/validations/review.test.ts`)

| Test case                            | Expected                             |
| ------------------------------------ | ------------------------------------ |
| Valid review payload                 | `{ success: true }`                  |
| Missing `teaching_quality`           | Zod error on field                   |
| `teaching_quality` = 6               | Zod error (out of range)             |
| `review_text` = 501 chars            | Zod error (too long)                 |
| `review_text` = 10 chars (non-empty) | Zod error (too short if provided)    |
| Unknown extra field in body          | Stripped (Zod `.strip()`)            |
| Honeypot field populated             | `{ success: false, honeypot: true }` |

### Running Average Formula (`lib/aggregation.test.ts`)

| Test case                         | Expected                         |
| --------------------------------- | -------------------------------- |
| First review (count=0)            | new_avg = new_value              |
| Second review                     | (v1 + v2) / 2                    |
| 100 reviews, add one              | Matches float AVG() result ±0.01 |
| would_recommend_pct with all Yes  | 100.00                           |
| would_recommend_pct with half Yes | 50.00                            |

### Slug Generation (`lib/slug.test.ts`)

| Input                           | Expected slug               |
| ------------------------------- | --------------------------- |
| "Dr. Mohammad Rahman"           | "dr-mohammad-rahman"        |
| "MD. SIFAT HOSSAIN"             | "md-sifat-hossain"          |
| "Prof. A.K.M. Shahadat Hossain" | "prof-akm-shahadat-hossain" |
| Name with Bangla chars          | ASCII-normalized slug       |

---

## 4. Integration Tests

**Location:** `__tests__/integration/`  
**Run:** `pnpm test:integration`  
**DB required:** Yes — test PostgreSQL on port 5433

### Review Submission (`api/reviews.test.ts`)

| Test                                     | Method                 | Expected                                                |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------- |
| Submit valid review (authenticated)      | POST /api/reviews      | 201, review in DB, review_submissions record created    |
| Submit without session                   | POST /api/reviews      | 401                                                     |
| Submit duplicate review same prof+course | POST /api/reviews      | 409 with Bangla message                                 |
| Submit with honeypot populated           | POST /api/reviews      | 400                                                     |
| Submit with hard-block profanity         | POST /api/reviews      | 400 with Bangla reason                                  |
| Submit with soft-flag content            | POST /api/reviews      | 201, `moderation_status = 'soft_flagged'`               |
| Auto-create professor if new name        | POST /api/reviews      | 201, new professor record in DB                         |
| Auto-create professor_course if new      | POST /api/reviews      | 201, new professor_course in DB                         |
| Running averages updated correctly       | POST /api/reviews (×3) | professor_courses.avg_teaching_quality matches expected |

### Atomicity Test (`api/reviews-atomic.test.ts`)

| Test                                             | Expected                                                   |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Simulate DB failure during aggregate UPDATE      | reviews INSERT rolled back, review_submissions NOT created |
| Simulate unique constraint on review_submissions | reviews INSERT rolled back                                 |

This is the most critical test — validates the anonymity contract is enforced transactionally.

### Helpful Votes (`api/helpful.test.ts`)

| Test                             | Method                        | Expected                                                  |
| -------------------------------- | ----------------------------- | --------------------------------------------------------- |
| Vote on a review (authenticated) | POST /api/reviews/:id/helpful | 200, `voted: true`, helpful_count incremented             |
| Toggle vote off                  | POST /api/reviews/:id/helpful | 200, `voted: false`, helpful_count decremented            |
| Vote without session             | POST /api/reviews/:id/helpful | 401                                                       |
| Double-vote same review          | POST (×2)                     | Second returns `voted: true` (idempotent, not duplicated) |

### Search (`api/search.test.ts`)

| Test                        | Expected                                  |
| --------------------------- | ----------------------------------------- |
| Search "Rahman"             | Returns professors with Rahman in name    |
| Search "CSE"                | Returns departments + professors with CSE |
| Fuzzy search "Rhman" (typo) | Returns Rahman results (pg_trgm)          |
| Empty query                 | Returns empty array, not 500              |
| SQL injection in query      | Sanitized, returns empty, no DB error     |

### Reports (`api/reports.test.ts`)

| Test                          | Expected                                    |
| ----------------------------- | ------------------------------------------- |
| Submit report                 | 201, pending report in DB                   |
| 3rd report on same review     | review.moderation_status = 'flagged_hidden' |
| Report already deleted review | 404                                         |

---

## 5. End-to-End Tests (Playwright)

**Location:** `e2e/`  
**Run:** `pnpm test:e2e`  
**Requires:** Production build (`pnpm build && pnpm start`)

### Homepage (`e2e/homepage.spec.ts`)

- [ ] Page loads in < 3 seconds
- [ ] Site stats are visible (total reviews count, etc.)
- [ ] Search bar is present and focusable
- [ ] Recently reviewed section shows reviews
- [ ] Bangla text renders correctly (no tofu boxes)

### Search & Navigation (`e2e/search.spec.ts`)

- [ ] Typing in search shows professor results
- [ ] Clicking a result navigates to professor profile
- [ ] Professor profile shows course score cards
- [ ] Navigating back works correctly
- [ ] University page lists departments
- [ ] Department page lists professors sorted by score

### Review Submission (`e2e/review-submission.spec.ts`)

- [ ] Unauthenticated user sees sign-in prompt on review form
- [ ] Authenticated user sees review form pre-filled with professor name
- [ ] All star rating inputs are clickable and update
- [ ] Form validation shows errors for missing required fields
- [ ] Successful submission shows confirmation message in Bangla
- [ ] Submitted review appears on professor+course page
- [ ] Submitting second review for same course shows duplicate error

### Helpful Voting (`e2e/helpful-vote.spec.ts`)

- [ ] Unauthenticated user clicking Helpful sees login prompt
- [ ] Authenticated user can vote and see count increment
- [ ] Clicking again removes the vote
- [ ] Vote state persists on page refresh

### Reporting (`e2e/report.spec.ts`)

- [ ] Report button visible on each review
- [ ] Report modal opens with reason options in Bangla
- [ ] Submitting report shows confirmation

### Admin Panel (`e2e/admin.spec.ts`)

- [ ] `/admin` redirects to login if not authenticated
- [ ] Admin login with correct credentials succeeds
- [ ] Admin login with wrong credentials shows error
- [ ] Reported reviews appear in the queue
- [ ] Admin can hide a review
- [ ] Hidden review shows placeholder text on public page

---

## 6. Accessibility Tests

Run as part of E2E suite using `@axe-core/playwright`:

- [ ] No WCAG 2.1 AA violations on homepage
- [ ] No violations on professor profile page
- [ ] No violations on review form
- [ ] All interactive elements have accessible names
- [ ] Color contrast ratio ≥ 4.5:1 for all text
- [ ] Touch targets ≥ 44×44px on mobile viewport

---

## 7. Performance Tests

Manual benchmarks (not automated in CI):

| Page                        | Target     | Measure with    |
| --------------------------- | ---------- | --------------- |
| Homepage (cold)             | < 2s on 4G | Lighthouse      |
| Professor profile (ISR hit) | < 500ms    | Chrome DevTools |
| Search results              | < 500ms    | Chrome DevTools |
| Review form load            | < 1.5s     | Lighthouse      |

---

## 8. Coverage Targets

| Module                     | Target |
| -------------------------- | ------ |
| `lib/moderation.ts`        | 95%    |
| `lib/validations/`         | 90%    |
| `lib/aggregation.ts`       | 100%   |
| `app/api/reviews/route.ts` | 85%    |
| `app/api/auth/`            | 70%    |
| Overall                    | 75%    |

Run coverage: `pnpm test:coverage`
