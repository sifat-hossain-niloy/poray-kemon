# Software Requirements Specification

## Poray Kemon (পড়ায় কেমন)

### Anonymous Professor & Course Rating Platform for Bangladesh

---

**Version:** 1.7  
**Status:** Draft  
**Last Updated:** July 2026  
**Changelog:**

- v1.1 — Review model changed to professor + course combo (Model B), auto-aggregated per course (Option 2). Semester field removed from MVP. `professor_courses` join table added.
- v1.2 — Helpful/upvote system added (login required to vote). Lightweight Google OAuth added for voters only. Soft moderation (Approach 2) confirmed.
- v1.3 — **Core philosophy change:** Login (Google OAuth) required to submit reviews AND vote. Reading remains fully public. Anonymity preserved by never storing `user_id` on the `reviews` record — a separate `review_submissions` table tracks who reviewed which professor+course without exposing review content. IP rate limiting replaced by one-review-per-professor-course-per-account enforcement.
- v1.4 — **Catalog scope-up + crowdsourced extensions.** University seed grew from 20 to **161 Wikipedia-sourced entries** (every BD university with canonical acronym + Bangla name + city). Departments are no longer admin-only — the review form now lets students add a new department inline via a two-field micro-form (Acronym + Full name); rows land as `status='unverified'` and surface in a new admin **merge-departments** tool. Course code and course name fields became a twin autocomplete that prepopulates both fields from one pick. Professor selection became a scoped typeahead. The static `<select>` dropdowns for university/department are gone.
- v1.7 — **Staff roles + separate staff login pages.** `admin_users` gains a `role` column (`super_admin | admin | moderator`) plus optional `email`. A partial unique index at the DB level enforces "exactly one super_admin" (FR-MOD-06). Two visually distinct login pages (`/admin/login` and `/moderator/login`) share one endpoint — login accepts email OR username. Admin-only endpoints (uni/dept CRUD, department merge) are gated by `requireAdmin`; a new `/admin/users` page (FR-MOD-08) lets super-admins/admins create and remove staff.
- v1.6 — **Deployment path locked in.** Production stack is Vercel Hobby (Mumbai edge) + Neon Postgres (ap-south-1) + Upstash Redis (ap-south-1) — all free-tier. Prisma schema now carries `directUrl` so Neon's pooler works with migrations. Redis client made optional (falls back to no-cache when `REDIS_URL` is unset). `docker-compose.prod.yml` and the VPS runbook stay in the repo as an escape hatch.
- v1.5 — **Reviewer-requested universities.** The uni field is now a scoped typeahead, and reviewers whose university isn't in the catalog can file a request ticket (name + Bangla name + type) via a new `UniversityRequest` table. Unlike departments, universities require admin approval before they appear in the directory. New `/admin/university-requests` queue with approve (creates the row, admin polishes short_name/slug/city first) and reject (with note) actions.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [User Personas](#3-user-personas)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Model](#6-data-model)
7. [Page & Route Map](#7-page--route-map)
8. [API Specification](#8-api-specification)
9. [Tech Stack](#9-tech-stack)
10. [MVP vs Future Phases](#10-mvp-vs-future-phases)
11. [Open Questions](#11-open-questions)

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete software requirements for **Poray Kemon** — a web platform that allows Bangladeshi university students to anonymously rate and review their professors and courses. It is intended to serve as the single source of truth for development using Claude Code, Cursor, or any other AI-assisted development environment.

### 1.2 The Problem

Bangladeshi university students pick courses and professors almost entirely through informal senior WhatsApp groups and word-of-mouth. No structured, searchable, persistent platform exists.

The global equivalent — **RateMyProfessors.com** — covers over 8,000 schools and 19 million ratings, but covers **only US, Canada, and UK institutions**. Not a single Bangladeshi university (BUET, DU, BRAC, NSU, DIU, IUT, RUET, CUET, etc.) is listed on the platform.

### 1.3 The Solution

**Poray Kemon** is a Bangla-first, anonymous, no-login-required professor and course rating platform built exclusively for Bangladeshi universities. The name "পড়ায় কেমন" literally means "How does he/she teach?" — the exact question students already ask each other.

### 1.4 Core Design Philosophy

These principles must not be violated during development:

| Principle                       | Description                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **No login to read**            | Any visitor can browse and read all reviews without any account                                                                |
| **Login to submit reviews**     | Google OAuth required to submit a review — prevents spam, enables one-review-per-course enforcement                            |
| **Login to vote**               | Google OAuth required to mark a review as Helpful                                                                              |
| **Anonymous reviews by design** | Login is required to submit, but the review record itself has NO `user_id` — your identity is never attached to what you wrote |
| **Bangladesh-only scope**       | Only Bangladeshi universities and institutions                                                                                 |
| **Bangla-first**                | All UI labels, tags, and prompts written in Bangla. English content allowed in reviews.                                        |
| **No paid features**            | No premium tiers, no promoted professors, no ads from institutions                                                             |

### 1.5 Inspiration & Differentiation

| Platform            | What it does        | Why it fails for Bangladesh                        |
| ------------------- | ------------------- | -------------------------------------------------- |
| RateMyProfessors    | Professor ratings   | US/Canada/UK only — zero BD coverage               |
| Google Maps reviews | Business ratings    | Not professor-specific, no academic context        |
| Facebook groups     | Informal discussion | Not searchable, posts disappear, not anonymous     |
| Beton Kemon         | Salary transparency | Different domain — this is the academic equivalent |

**Poray Kemon breaks the same barrier Beton Kemon broke for salaries** — it takes an existing global model and removes the friction that made it inaccessible locally.

### 1.6 Scope

**In scope:**

- University and department directory (Bangladesh only)
- Professor profiles with anonymous ratings and reviews
- Course-specific reviews linked to professor + course code
- Tag-based review metadata
- Search and filter
- Spam/abuse reporting

**Out of scope (MVP):**

- User accounts and profiles
- Professor responses
- School/university ratings
- Mobile apps (web-first, but must be mobile-responsive)
- Payment of any kind

---

## 2. Overall Description

### 2.1 How It Works — User Flow

```
Visitor arrives
    │
    ├──► Search for a university + department + professor name
    │         │
    │         └──► View professor profile
    │                   │
    │                   ├──► Read anonymous reviews
    │                   └──► Click "Write a Review"
    │                               │
    │                               └──► Fill form (no login)
    │                                       │
    │                                       └──► Submit → Review appears after basic validation
    │
    └──► Browse top-rated professors by university
```

### 2.2 Key Entities

- **University** — e.g., BUET, University of Dhaka, BRAC University
- **Department** — e.g., CSE, EEE, BBA, English, Law
- **Professor** — linked to university + department
- **Course** — linked to professor + course code (e.g., CSE 301)
- **Review** — linked to professor + optional course. Contains ratings + tags + text.

---

## 3. User Personas

### Persona A — The Course Planner (Primary)

- **Who:** 2nd or 3rd year undergrad at NSU/BRAC/DU/BUET
- **Goal:** Choosing between two professors for an elective next semester
- **Behavior:** Searches professor name, reads 3–5 reviews, decides
- **Pain point today:** Asks in WhatsApp group, gets 2 subjective replies, still unsure

### Persona B — The Reviewer (Primary)

- **Who:** Student who just finished a semester with a great or terrible professor
- **Goal:** Help future students make the same (or opposite) decision
- **Behavior:** Finds the professor on the site, submits a review in 2 minutes
- **Pain point today:** No platform to do this — the knowledge dies in their head

### Persona C — The Explorer (Secondary)

- **Who:** Freshman who doesn't know which department is known for good teaching
- **Goal:** Get a general sense of teaching culture across departments
- **Behavior:** Browses top-rated professors at their university

### Persona D — The New Student (Secondary)

- **Who:** Just got admission, researching the institution
- **Goal:** Understand what learning is like at this university
- **Behavior:** Reads department-level review summaries

---

## 4. Functional Requirements

### 4.1 University & Department Directory

**FR-DIR-01:** The system shall maintain a curated catalog of every Bangladeshi university. Seed data is sourced from Wikipedia's _List of universities in Bangladesh_ (English names + canonical acronyms) and the equivalent Bangla Wikipedia page (Bangla names). Each row carries:

| Field           | Required | Notes                                                                                                                                                                                                                                                                                                   |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name_en`       | ✅       | E.g. "University of Dhaka"                                                                                                                                                                                                                                                                              |
| `name_bn`       | ✅       | E.g. "ঢাকা বিশ্ববিদ্যালয়"                                                                                                                                                                                                                                                                              |
| `short_name`    | ✅       | Canonical acronym from Wikipedia (e.g. `DU`, `BUET`). No auto-generated initials, no numeric suffixes. When two institutions share an acronym, the most-recognised owner keeps it and the others get readable suffixes (`BdshU` for Bangladesh University, `BritU` for Britannia, `BdU` for Bandarban). |
| `slug`          | ✅       | URL-safe form of `short_name`.                                                                                                                                                                                                                                                                          |
| `location_city` | ✅       | E.g. "Dhaka", "Sylhet".                                                                                                                                                                                                                                                                                 |
| `type`          | ✅       | `public` \| `private` \| `international`.                                                                                                                                                                                                                                                               |

Seed is **idempotent and self-healing** — re-running it parks every `short_name`/`slug` under a `__tmp_<id>` placeholder, runs canonical upserts matched by `name_en`, then prunes any row still holding a placeholder if it has no professors attached (or flags it for admin review otherwise). This means a deployment seeded with an older version gets healed by a single `pnpm db:seed`. Initial seed delivers **161 universities**.

**FR-DIR-02:** Each university shall have a list of departments. Departments are populated in three ways:

1. **Curated seed** — 15 anchor universities (BUET, DU, NSU, BRACU, IUB, AIUB, RUET, CUET, KUET, SUST, IUT, DIU, EWU, UIU, MIST) ship with 3–7 departments each, stored as `status='verified'`. ~60 rows total.
2. **Admin creation** — admins can add departments via `/admin/universities/<id>`; they default to `status='verified'`.
3. **Reviewer auto-create (FR-DIR-05)** — students adding a review for a department not yet in the catalog can spawn the row inline; it lands as `status='unverified'` until an admin verifies or merges it.

**FR-DIR-03:** Admins shall be able to add universities and departments via a protected admin interface (`/admin/universities`).

**FR-DIR-04:** Universities and departments shall not be deletable if they have linked professors with reviews.

**FR-DIR-05 — Reviewer-created departments:** The review submission form (FR-REV-01) shall expose an "Add a new department" affordance below the department typeahead's search results. Activating it opens a two-field inline micro-form:

| Field     | Required | Notes                                                 |
| --------- | -------- | ----------------------------------------------------- |
| Acronym   | ❌       | E.g. "CSE". Max 20 chars.                             |
| Full name | ✅       | E.g. "Computer Science and Engineering". 2–200 chars. |

Both fields are pre-filled by parsing the user's typed query (`"CSE - Computer Science and Engineering"` auto-splits via `lib/department-parser.ts`). The user must explicitly confirm before submission. Rows created this way land as `status='unverified'` and surface with a "Pending review" badge in both the typeahead dropdown and the admin department list.

**FR-DIR-06 — Admin merge-departments tool:** Admins shall be able to collapse duplicate department rows (e.g. "CSE", "C.S.E.", "Computer Science and Engineering" as three rows) into one canonical row. From `/admin/universities/<id>`, the admin ticks ≥ 2 department rows, picks one as the canonical target, and confirms. A single transactional API call (`POST /api/admin/departments/merge`) shall:

1. Sanity-check that every selected department belongs to the same university (cross-university merges rejected).
2. Re-point all `professors.department_id` and `courses.department_id` from sources → target.
3. Mark the target `status='verified'`.
4. Delete the source rows.

The endpoint shall reject merges where the target appears in the source list.

**FR-DIR-07 — Reviewer-requested universities:** The review submission form's university field is a scoped typeahead (FR-REV-01) backed by `/api/universities/search`. If the reviewer's typed input doesn't match any existing university, a "Request '<name>' as a new university" affordance shall appear at the bottom of the dropdown. Activating it opens an inline micro-form:

| Field                | Required | Notes                                                 |
| -------------------- | -------- | ----------------------------------------------------- |
| University name (EN) | ✅       | 2–200 chars. Pre-filled from the typed query.         |
| Bangla name          | ❌       | Optional at request time; an admin can fill it later. |
| Type                 | ✅       | Radio: `public` / `private` / `international`.        |

Submitting the form calls `POST /api/university-requests` and creates a `UniversityRequest` row with `status='pending'`. Unlike departments (FR-DIR-05), universities are **NOT** auto-created — the review submission cannot proceed until an admin approves the request. The user sees a "Request sent — an admin will review it" confirmation card in place of the typeahead.

**Rate limits:**

- Per-user: 5 pending requests at a time (`429 TOO_MANY_PENDING`).
- Per-user duplicates: identical name (case- and formatting-insensitive) returns `409 DUPLICATE_REQUEST` with the existing request id.
- Already-a-real-uni: if the requested name matches an existing university row, the endpoint returns `409 ALREADY_EXISTS` with the existing slug so the client can nudge the user back into the typeahead.

**FR-DIR-08 — Admin queue for university requests:** Admins shall have a `/admin/university-requests` queue that lists pending requests oldest-first. The admin dashboard shall show a live count of `pending` requests as an action card. For each pending row, the admin can:

- **Approve** — opens an inline polish panel to override the auto-suggested `short_name`, `slug`, and `location_city` before publishing. `POST /api/admin/university-requests/[id]/resolve` with `action='approve'` creates the University row and flips the request to `status='approved'` in one transaction. Unique-constraint clashes (e.g. taken short_name) return 409 with a targeted error message so the admin can retry.
- **Reject** — flips the request to `status='rejected'` with an optional admin note surfaced back to the requester. No side effects on other tables.

---

### 4.2 Professor Profiles

**FR-PROF-01:** Professor profiles are created in two ways:

- (a) A reviewer submits a review for a professor who doesn't exist yet — the system creates the profile stub automatically from the submitted name.
- (b) Admin creates the profile directly.

**FR-PROF-02:** A professor profile shall contain:

- Full name (required)
- Initial (displayed in search results, e.g., "Dr. M. Rahman")
- University (required)
- Department (required)
- Designation (optional — Lecturer, Assistant Professor, Associate Professor, Professor)
- Profile status: `active` | `retired` | `unverified`

**FR-PROF-03:** Professor names shall be stored in both English and Bangla (Bangla optional, English required).

**FR-PROF-04:** Duplicate professor detection — the review form's professor field is a scoped typeahead (FR-REV-01) that fuzzy-matches against existing professors in the chosen (university, department) via pg_trgm + ILIKE. Existing matches surface in a dropdown before the user can choose "Add as new professor", so accidental duplicates are minimised by construction. Remaining duplicates (e.g. "Dr. Rahman" vs "Mohammad Rahman" entered at different times) are handled administratively via `PATCH /api/admin/professors/[id]`.

**FR-PROF-05:** Each professor profile page shall display:

- Aggregated rating scores (all dimensions — see FR-REVIEW)
- Total review count
- Tag frequency cloud (most-used tags)
- "Would recommend" percentage
- All individual reviews (paginated, newest first)
- Courses this professor has been reviewed for

---

### 4.3 Review Submission

This is the core feature. All reviews are submitted without any account.

**FR-REV-01 — Required fields:**

| Field                   | Control                                | Required | Details                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `university`            | Select                                 | ✅       | Dropdown from the directory (FR-DIR-01). Sorted by short_name.                                                                                                                                                                                     |
| `department`            | Scoped typeahead                       | ✅       | Search-as-you-type against `/api/departments/search` scoped to the chosen university. Verified rows rank above unverified. Empty-query reveals the full department list. Unmatched input shows a "+ Add as new department" affordance (FR-DIR-05). |
| `professor_name`        | Scoped typeahead                       | ✅       | Search-as-you-type against `/api/professors/search` scoped to (university, department). pg_trgm fuzzy match for typo-tolerance. Unmatched input shows a "+ Add 'xxxx' as a new professor" row that stages a new Professor on submit.               |
| `course_code`           | Twin autocomplete (with `course_name`) | ✅       | Search-as-you-type against `/api/courses/search` scoped to the chosen department. Empty-query reveals the dept's full course list. Selecting any hit prepopulates BOTH `course_code` and `course_name`; both stay editable.                        |
| `course_name`           | Twin autocomplete (with `course_code`) | ✅       | Shares the same dropdown as `course_code` — picking on either side prefills both. Unmatched input creates a new Course row on submit via `resolveCourse`'s find-or-create.                                                                         |
| `teaching_quality`      | 1–5 stars                              | ✅       | "ক্লাসে কতটা ভালো পড়ান?"                                                                                                                                                                                                                          |
| `grading_fairness`      | 1–5 stars                              | ✅       | "নম্বর দেওয়া কতটা ন্যায্য?"                                                                                                                                                                                                                       |
| `course_difficulty`     | 1–5 stars                              | ✅       | "কোর্সটা কতটা কঠিন?"                                                                                                                                                                                                                               |
| `attendance_strictness` | 1–5                                    | ✅       | "অ্যাটেনডেন্স কতটা কড়া?" (1 = not strict, 5 = very strict)                                                                                                                                                                                        |
| `would_recommend`       | Boolean                                | ✅       | "আবার এই স্যার/ম্যামের এই কোর্স নেবেন?" — Yes / No                                                                                                                                                                                                 |
| `review_text`           | Textarea                               | ❌       | Optional, max 500 characters, min 20 if provided                                                                                                                                                                                                   |
| `tags`                  | Multi-select                           | ❌       | See tag list below                                                                                                                                                                                                                                 |

**FR-REV-01a — Cascading typeahead scope:** Switching `university` shall clear both the `department` and `professor_name` selections (a department is scoped to a university). Switching `department` shall clear `professor_name` (a professor is scoped to a department). When the user picks "Add as new department", the `professor_name` field falls back to a plain text input — no `department_id` exists yet to scope a typeahead against, and both the department and the professor are auto-created on submit.

**FR-REV-01b — Hierarchical auto-create on submit:** `POST /api/reviews` shall resolve the (department, professor, course) triple in that order. Each layer accepts either an id (already known) or a name (auto-create). Auto-created departments default to `status='unverified'`; auto-created professors default to `status='unverified'`; auto-created courses have no status field (their structured course code makes duplicates rare and the admin merge-departments tool already covers the harder case).

> **Note:** `semester` has been removed entirely from MVP. All reviews for the same professor + course are pooled together regardless of when they were submitted (Option 2: auto-aggregate). Semester tracking is deferred to Phase 2.

**FR-REV-02 — Tag options** (pre-defined, multi-select, in Bangla):

| Tag (Bangla)              | Meaning                      |
| ------------------------- | ---------------------------- |
| স্লাইড পড়েন              | Just reads slides            |
| বোর্ডে বোঝান              | Explains on board            |
| উদাহরণ দিয়ে বোঝান        | Teaches with examples        |
| প্রশ্ন নেন                | Encourages questions         |
| প্রশ্ন নেন না             | Does not entertain questions |
| অফিস আওয়ার দেন           | Available outside class      |
| পরীক্ষা ক্লাস থেকে আসে    | Exams match lectures         |
| পরীক্ষা ক্লাস থেকে আসে না | Exams don't match lectures   |
| নম্বরে কঞ্জুস             | Stingy with marks            |
| গ্রেড ভালো দেন            | Generous grader              |
| উপস্থিতি কড়া             | Strict attendance            |
| উপস্থিতি নমনীয়           | Flexible attendance          |
| ইংরেজিতে পড়ান            | Teaches in English           |
| বাংলায় পড়ান             | Teaches in Bangla            |
| সহজলভ্য                   | Approachable                 |
| দূরত্ব বজায় রাখেন        | Unapproachable               |
| পক্ষপাতমূলক               | Shows favoritism             |
| অনুপ্রেরণাদায়ক           | Inspiring teacher            |

**FR-REV-03 — Computed overall score:**

```
overall_score = (teaching_quality × 0.5) + (grading_fairness × 0.3) + ((6 - attendance_strictness) × 0.2)
```

> Note: attendance_strictness is inverted in the formula — stricter attendance drags the score slightly. This is debatable; see Open Questions.

**FR-REV-04 — Submission rules:**

- **Google login required** — the review form is only accessible to authenticated users. Unauthenticated visitors see a "রিভিউ দিতে Google দিয়ে সাইন ইন করুন" prompt.
- **One review per professor+course per account** — enforced via the `review_submissions` table (see Data Model). If a user has already reviewed Dr. Rahman → CSE 301, they cannot submit a second review for the same combination. They see: "আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন।"
- **Anonymity preserved** — the `reviews` table has no `user_id` column. The `review_submissions` table tracks who reviewed which professor+course but not what they wrote. These two tables are intentionally decoupled.
- Honeypot field included to catch automated bots that bypass the auth layer.
- IP-based rate limiting **removed** — replaced entirely by the account-based one-review-per-course rule.

**FR-REV-05 — Review editing:** Reviews cannot be edited after submission. This is intentional — prevents retroactive whitewashing.

**FR-REV-06 — Review deletion:** Reviews can only be deleted by admin after a valid report is reviewed.

---

### 4.4 Search & Discovery

**FR-SEARCH-01:** The homepage shall have a prominent search bar. Search input shall query professor names, department names, and university names simultaneously.

**FR-SEARCH-02:** Search results shall show:

- Professor name
- University + Department
- Overall score (stars)
- Review count
- Top 2 most-used tags

**FR-SEARCH-03:** Professor page URL shall be human-readable and shareable:

```
/professors/buet/cse/dr-mohammad-rahman
```

**FR-SEARCH-04:** University page shall list all departments with review counts and average scores.

**FR-SEARCH-05:** Department page shall list all professors sorted by overall score (default), with filter options:

- Sort by: highest rated / most reviewed / most recently reviewed
- Filter by: course difficulty (easy / medium / hard), would recommend (yes only)

**FR-SEARCH-06:** A "recently reviewed" feed on the homepage shall show the 10 most recent reviews (professor name + university visible, review text optionally hidden).

---

### 4.5 Reporting & Moderation

**FR-MOD-01:** Every review shall have a "Report" button.

**FR-MOD-02:** Report reasons (select one):

- এটি আমার সম্পর্কে (This is about me personally)
- এটি ভুয়া রিভিউ (Fake/spam review)
- এটি আপত্তিজনক (Offensive content)
- প্রফেসর ভুল (Wrong professor)
- অন্যান্য (Other)

**FR-MOD-03:** Reports are queued in an admin dashboard. No automatic removal on report — admin manually reviews.

**FR-MOD-04:** Admin shall be able to:

- Delete a review
- Hide a review pending investigation
- Mark a professor profile as "unverified" or "retired"
- Add/edit universities and departments
- View all submitted reports with review content

**FR-MOD-05:** Staff (admin/moderator) login shall be protected by a username-or-email + strong password. **No social login for staff** — the admin panel intentionally does not share Google OAuth with regular users. Sessions are signed with HMAC-SHA256 (Web Crypto) and expire after 8 hours; the cookie carries `adminId` and `role`.

**FR-MOD-06 — Staff roles:** Three tiers, enforced both in the session cookie and by handler-level `require*` helpers in `lib/admin-auth.ts`:

| Role          | Count      | Powers                                                                                                                   |
| ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `super_admin` | Exactly 1  | Everything, including creating/deleting other `admin` and `moderator` users. Cannot be deleted.                          |
| `admin`       | Any number | Everything except managing `admin`/`super_admin` users. Can create/delete `moderator` accounts. Can reshape the catalog. |
| `moderator`   | Any number | Moderation queues only — reports, review moderation, university-request resolve, marking a department verified.          |

The "exactly one super_admin" invariant is enforced by a **partial unique index** on `admin_users(role) WHERE role = 'super_admin'`. Attempting to INSERT/UPDATE a second super_admin fails at the DB level. The migration seeds the bootstrap admin (`username='admin'`) as the initial super_admin.

**Permission matrix:**

| Action                                     | super_admin | admin | moderator |
| ------------------------------------------ | ----------- | ----- | --------- |
| Resolve reports / moderate reviews         | ✓           | ✓     | ✓         |
| Approve / reject university requests       | ✓           | ✓     | ✓         |
| Mark department verified                   | ✓           | ✓     | ✓         |
| Merge departments (destructive FK repoint) | ✓           | ✓     | ✗         |
| Create / edit universities                 | ✓           | ✓     | ✗         |
| Create / edit / delete departments         | ✓           | ✓     | ✗         |
| Add / remove moderators                    | ✓           | ✓     | ✗         |
| Add / remove admins                        | ✓           | ✗     | ✗         |
| Delete self / super_admin                  | ✗           | ✗     | ✗         |

**FR-MOD-07 — Separate login pages:** Two visually distinct login pages, one shared endpoint:

- `/admin/login` — copy tailored for admins/super-admins.
- `/moderator/login` — copy tailored for moderators.

Both POST to `/api/admin/login` and accept **either** username OR email as the identifier (the server sniffs which by looking for `@`). Both pages accept any staff role — a moderator logging in via `/admin/login` is not rejected, they just land on `/admin` with moderator-scoped features. Cross-linking between the two pages is provided in each page's footer.

**FR-MOD-08 — Staff user management:** Super-admins and admins can manage staff via `/admin/users`. Server-side gate: page redirects to `/admin` for moderators. Behaviours:

- **Create** via `POST /api/admin/users` — validates username (letters/digits/`._-`, 3–100 chars), optional email, password (8–72 chars bcrypt-hashed at cost 12), and role (`admin` | `moderator`). Admins can only create moderators; the role enum in the schema does not accept `super_admin` so accidental promotion is impossible.
- **Delete** via `DELETE /api/admin/users/[id]` — rejects self-delete (`SELF_DELETE_FORBIDDEN`), super_admin deletion (`SUPER_ADMIN_IMMUTABLE`), and non-super admins trying to remove other admins (`FORBIDDEN`).

---

### 4.6 Statistics & Aggregation

**FR-STAT-01:** Aggregate scores live on the `professor_courses` table (denormalized). They are updated incrementally using a running average formula on every new review insert — no full `AVG()` scan required.

**FR-STAT-02:** A professor profile page shall display scores in a two-level hierarchy:

**Level 1 — Combined professor score (top of page):**

- Single overall score: weighted average of all `professor_courses.overall_score` values, weighted by `review_count`
- Breakdown of each dimension averaged across all courses: teaching quality, grading fairness, course difficulty, attendance, would_recommend %
- Total review count across all courses

**Level 2 — Per-course score cards (below the combined score):**

- One card per course the professor has been reviewed for
- Each card shows: course code + name, per-course averages for all 4 dimensions, would_recommend % for that course, review count for that course, top tags for that course
- Cards sorted by review count descending (most-reviewed course first)
- Both levels are always visible simultaneously — no tabs, no click to expand

**FR-STAT-03:** The platform shall display site-wide stats on the homepage:

- Total reviews submitted
- Total professors rated
- Total universities covered
- Total courses reviewed

**FR-STAT-04:** "Top Professors" list per university — top 5 by weighted overall score with minimum 3 reviews across all their courses.

---

### 4.7 Helpful Voting System

**FR-VOTE-01:** Every review shall display a "সহায়ক ছিল" (Helpful) button showing the current helpful count.

**FR-VOTE-02:** Clicking the Helpful button **requires a logged-in account**. Visitors who are not logged in shall see the button but clicking it prompts: "ভোট দিতে Google দিয়ে সাইন ইন করুন" (Sign in with Google to vote) — a single-click Google OAuth popup.

**FR-VOTE-03:** Each user account can mark a given review helpful **once only**. The button toggles — clicking again removes the vote.

**FR-VOTE-04:** Reviews on a professor+course page shall be sorted by `helpful_count DESC` by default. A secondary sort option "সর্বশেষ" (Most Recent) shall also be available.

**FR-VOTE-05:** A user **cannot** mark their own review as helpful. Since reviews are anonymous (no user*id on the review), this is enforced by: storing the `session_token` in a honeypot field at submission time and cross-referencing in the helpful_votes table. *(See note below.)\_

> **Important privacy note:** The helpful voting system introduces the only place in the product where a user identity (Google account) is stored. It is stored in `helpful_votes` only — never linked to a review. A user who submits a review anonymously and then logs in to vote on other reviews cannot be connected to their own review.

**FR-VOTE-06:** Helpful count is displayed on review cards as: `৪২ জন সহায়ক মনে করেছেন` (42 people found this helpful).

---

### 4.8 User Accounts (Google OAuth — For Submitting Reviews and Voting)

**FR-AUTH-01:** Account creation is via **Google OAuth only**. No email/password, no OTP, no other providers in MVP.

**FR-AUTH-02:** Login is required for:

- Submitting a review
- Marking a review as Helpful (voting)

Login is **not** required for:

- Reading reviews
- Browsing professors, universities, departments
- Searching

**FR-AUTH-03:** The only data stored per user account:

```sql
users
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  google_id     VARCHAR(255) UNIQUE NOT NULL   -- Google 'sub' — no email stored
  display_name  VARCHAR(100)                    -- from Google, display-only
  created_at    TIMESTAMP DEFAULT NOW()
  last_active   TIMESTAMP
```

> No email column — intentional. Reduces data liability under Bangladesh's forthcoming Personal Data Protection Ordinance. Google `sub` is sufficient for identity.

**FR-AUTH-04:** No public user profile page. Accounts exist to enforce submission integrity and voting, not to create a social layer.

**FR-AUTH-05:** A logged-in user can see:

- "আপনি এই কোর্সে রিভিউ দিয়েছেন" — confirmation that they've reviewed a given professor+course (not the review content itself, since it's anonymous)
- Which reviews they've marked helpful (within their session)

**FR-AUTH-06:** Session via NextAuth.js. Expires after 30 days of inactivity.

**FR-AUTH-07 — The anonymity contract:**

```
User logs in with Google
    ↓
Submits review form
    ↓
Server checks review_submissions: has this user reviewed this professor+course?
    ├── Yes → reject with "already reviewed" message
    └── No  → INSERT into reviews (no user_id)
              INSERT into review_submissions (user_id, professor_course_id)
              These two inserts happen in a transaction but are in separate tables.
              The review content is never linked to the user_id.
```

This means: even if the database is fully compromised, you cannot determine who wrote any specific review. You can only determine that a given user has reviewed a given professor+course at some point.

---

### 4.9 Content Moderation (Approach 2: Soft Moderation)

**Decided: Reviews go live immediately. Keyword-flagged reviews auto-hide and are queued for admin review within 24 hours.**

**FR-MOD-A-01 — Hard blocklist (auto-reject on submission):**

The following content types are blocked before the review record is even created. The API returns a `400` error with a user-friendly Bangla message explaining which rule was violated:

| Rule                              | Examples                          | Response message                                |
| --------------------------------- | --------------------------------- | ----------------------------------------------- |
| Bangla profanity                  | [internal list]                   | "আপত্তিজনক শব্দ ব্যবহার করা যাবে না"            |
| English profanity                 | fuck, shit, bastard…              | "আপত্তিজনক শব্দ ব্যবহার করা যাবে না"            |
| Slurs (religious, ethnic, gender) | [internal list]                   | "বৈষম্যমূলক ভাষা গ্রহণযোগ্য নয়"                |
| Unsubstantiated accusations       | "took bribe", "sexually harassed" | "ব্যক্তিগত অভিযোগ এই প্ল্যাটফর্মে প্রযোজ্য নয়" |
| Spam patterns                     | Same review text repeated         | "এই রিভিউটি আগে জমা হয়েছে"                     |

**FR-MOD-A-02 — Soft flag (review goes live, queued for admin):**

Reviews matching the following patterns are published immediately but added to the admin moderation queue with a yellow flag:

| Pattern                                                                    | Why flagged                  |
| -------------------------------------------------------------------------- | ---------------------------- |
| Review text under 20 characters                                            | Too short to be informative  |
| ALL CAPS text                                                              | High emotion indicator       |
| Contains personal pronoun + negative emotion ("he ruined", "she hates me") | Possible grudge content      |
| Multiple exclamation marks (3+)                                            | High emotion indicator       |
| Contains a name other than the reviewed professor                          | Possible third-party mention |

**FR-MOD-A-03 — Admin moderation queue:**

Admin sees a dashboard of all soft-flagged reviews. For each, admin can:

- ✅ **Approve** — remove the flag, review stays live
- ✏️ **Edit** — remove a specific word or phrase, then approve
- 🚫 **Hide** — remove from public view pending further review
- ❌ **Delete** — permanently remove

Target: admin processes the queue within **24 hours** of flag creation.

**FR-MOD-A-04 — Auto-hide on 3 reports:**

If a review accumulates 3 or more community reports (from the existing Report button), it is automatically set to `moderation_status = 'flagged_hidden'` and removed from public view. Admin must explicitly approve to reinstate.

**FR-MOD-A-05 — Moderation transparency:**

When a review is hidden or deleted, the space where it was is replaced with:
`"এই রিভিউটি আমাদের নীতিমালা লঙ্ঘনের কারণে সরিয়ে নেওয়া হয়েছে।"`
(This review was removed for violating our guidelines.)

This prevents "ghost deletions" and builds trust with the community.

---

## 5. Non-Functional Requirements

### 5.1 Privacy & Anonymity

| Requirement     | Detail                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-PRIV-01** | No IP addresses stored anywhere in the system                                                                                                        |
| **NFR-PRIV-02** | No cookies set on visitors who only read                                                                                                             |
| **NFR-PRIV-03** | Session cookie set only after Google OAuth login (for submitters and voters)                                                                         |
| **NFR-PRIV-04** | No third-party analytics — use Plausible or Umami (self-hosted)                                                                                      |
| **NFR-PRIV-05** | No email address stored — only Google `sub` identifier                                                                                               |
| **NFR-PRIV-06** | `reviews` table has no `user_id` column — review authorship is permanently unattributable                                                            |
| **NFR-PRIV-07** | `review_submissions` table (who reviewed what) and `reviews` table (what was written) are decoupled — no JOIN can reveal who wrote a specific review |
| **NFR-PRIV-08** | Privacy policy clearly explains: you must log in to submit, but your review is anonymous and cannot be traced back to you                            |

### 5.2 Performance

| Requirement     | Target                                                                |
| --------------- | --------------------------------------------------------------------- | ------------------------ |
| **NFR-PERF-01** | Homepage load time                                                    | < 2 seconds on 4G mobile |
| **NFR-PERF-02** | Search results                                                        | < 500ms                  |
| **NFR-PERF-03** | Professor page load                                                   | < 1.5 seconds            |
| **NFR-PERF-04** | Review submission response                                            | < 1 second               |
| **NFR-PERF-05** | The app must remain functional under 1,000 concurrent users at launch |

### 5.3 Usability

| Requirement   | Detail                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| **NFR-UX-01** | Fully functional on mobile (responsive design, tested on Android Chrome) |
| **NFR-UX-02** | Minimum touch target size: 44×44px                                       |
| **NFR-UX-03** | Review form must be completable in under 2 minutes                       |
| **NFR-UX-04** | All core flows must work without JavaScript (progressive enhancement)    |
| **NFR-UX-05** | Bangla Unicode text must render correctly on all major browsers          |

### 5.4 Scalability

| Requirement      | Detail                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| **NFR-SCALE-01** | Database schema must support 100,000+ reviews without structural changes |
| **NFR-SCALE-02** | Stateless API design to allow horizontal scaling                         |
| **NFR-SCALE-03** | Static generation (SSG/ISR) for university and professor pages           |

### 5.5 Security

| Requirement    | Detail                                                               |
| -------------- | -------------------------------------------------------------------- |
| **NFR-SEC-01** | All traffic over HTTPS                                               |
| **NFR-SEC-02** | Input sanitization on all text fields (prevent XSS, SQL injection)   |
| **NFR-SEC-03** | Honeypot field on review form to catch bots                          |
| **NFR-SEC-04** | CSRF protection on all POST endpoints                                |
| **NFR-SEC-05** | Admin panel protected by session auth; no public registration        |
| **NFR-SEC-06** | Blocked keyword list applied on submission (profanity filter, slurs) |
| **NFR-SEC-07** | Rate limiting: max 3 review submissions per hashed IP per 24 hours   |

### 5.6 Localization

| Requirement     | Detail                                                            |
| --------------- | ----------------------------------------------------------------- |
| **NFR-L10N-01** | Default language: Bangla                                          |
| **NFR-L10N-02** | All UI labels, navigation, form prompts in Bangla                 |
| **NFR-L10N-03** | Review text can be submitted in Bangla or English                 |
| **NFR-L10N-04** | Date display in Bengali format (optional, can be localized later) |
| **NFR-L10N-05** | English toggle is a future phase feature, not MVP                 |

---

## 6. Data Model

### 6.1 Entity Relationship Overview

**Decided: Model B (professor + course combo), Option 2 (auto-aggregate, no semester tracking)**

Reviews are attached to a `professor_courses` record — a join entity representing one professor teaching one specific course. This is the unit of aggregation. A professor's overall profile page shows all their courses side by side, each with its own independent aggregate scores.

```
University ──< Department ──< Professor ──< ProfessorCourse ──< Review
                                  │               │
                                  └──< Course ────┘
```

**Key rules:**

- A `ProfessorCourse` record is created automatically when a reviewer selects a professor + course combination that doesn't exist yet
- All reviews for "Dr. Rahman → CSE 301" are aggregated independently from "Dr. Rahman → CSE 401"
- No semester tracking in MVP — all semesters for the same professor + course are pooled together
- A professor with no reviews yet has no `ProfessorCourse` records — the professor profile page shows "no courses reviewed yet"

### 6.2 Table Definitions

#### `universities`

```sql
id              SERIAL PRIMARY KEY
name_en         VARCHAR(200) NOT NULL UNIQUE       -- "North South University"
name_bn         VARCHAR(200)                        -- "নর্থ সাউথ ইউনিভার্সিটি"
short_name      VARCHAR(20) NOT NULL UNIQUE        -- "NSU"
location_city   VARCHAR(100)                        -- "Dhaka"
type            ENUM('public', 'private', 'international')
website_url     VARCHAR(255)
created_at      TIMESTAMP DEFAULT NOW()
```

#### `departments`

```sql
id              SERIAL PRIMARY KEY
university_id   INTEGER REFERENCES universities(id)
name_en         VARCHAR(200) NOT NULL                          -- "Computer Science & Engineering"
name_bn         VARCHAR(200)                                   -- "কম্পিউটার সায়েন্স"
short_name      VARCHAR(20)                                    -- "CSE" — nullable; user-typed full names may not have one
slug            VARCHAR(50)                                    -- "cse" — URL-safe form
status          department_status NOT NULL DEFAULT 'unverified'
                -- ENUM('verified', 'unverified'). Seed-curated rows + admin-created
                -- rows + merge-tool targets are 'verified'. Reviewer auto-created
                -- rows start 'unverified' until an admin verifies or merges them.
created_at      TIMESTAMP DEFAULT NOW()

UNIQUE(university_id, short_name)
UNIQUE(university_id, slug)
```

> Migration `20260609193125_add_department_status` introduced the `status` column. Seed sets curated rows to `verified` on every run.

#### `professors`

```sql
id              SERIAL PRIMARY KEY
university_id   INTEGER REFERENCES universities(id)
department_id   INTEGER REFERENCES departments(id)
name_en         VARCHAR(200) NOT NULL
name_bn         VARCHAR(200)
designation     ENUM('lecturer', 'assistant_professor', 'associate_professor', 'professor', 'adjunct', 'other')
status          ENUM('active', 'retired', 'unverified') DEFAULT 'unverified'
slug            VARCHAR(255) UNIQUE                 -- "dr-mohammad-rahman"
created_at      TIMESTAMP DEFAULT NOW()
```

#### `courses`

```sql
id              SERIAL PRIMARY KEY
department_id   INTEGER REFERENCES departments(id) NOT NULL
course_code     VARCHAR(20)                         -- "CSE 301"
course_name     VARCHAR(200) NOT NULL               -- "Data Structures"
created_at      TIMESTAMP DEFAULT NOW()

UNIQUE(department_id, course_code)

-- Courses belong to a department, NOT to a professor.
-- The same course (CSE 301) can be taught by many professors.
-- The professor-course pairing is handled in professor_courses.
```

#### `professor_courses`

```sql
id                    SERIAL PRIMARY KEY
professor_id          INTEGER REFERENCES professors(id) NOT NULL
course_id             INTEGER REFERENCES courses(id) NOT NULL
review_count          INTEGER DEFAULT 0              -- denormalized for fast display
avg_teaching_quality  DECIMAL(3,2)                   -- recomputed on each new review
avg_grading_fairness  DECIMAL(3,2)
avg_course_difficulty DECIMAL(3,2)
avg_attendance        DECIMAL(3,2)
would_recommend_pct   DECIMAL(5,2)                   -- % of reviewers who said yes
overall_score         DECIMAL(3,2)                   -- weighted aggregate
created_at            TIMESTAMP DEFAULT NOW()
updated_at            TIMESTAMP DEFAULT NOW()

UNIQUE(professor_id, course_id)

-- This record is created automatically when the first review
-- is submitted for a professor + course pair that doesn't exist yet.
-- Aggregate columns are updated (not recomputed from scratch) on each insert
-- using a running average formula to avoid full table scans.
```

#### `reviews`

```sql
id                    SERIAL PRIMARY KEY
professor_course_id   INTEGER REFERENCES professor_courses(id) NOT NULL
                      -- ↑ Replaces the old professor_id + course_id split.
                      --   A review always belongs to a specific professor+course pair.
teaching_quality      SMALLINT CHECK (teaching_quality BETWEEN 1 AND 5) NOT NULL
grading_fairness      SMALLINT CHECK (grading_fairness BETWEEN 1 AND 5) NOT NULL
course_difficulty     SMALLINT CHECK (course_difficulty BETWEEN 1 AND 5) NOT NULL
attendance_strictness SMALLINT CHECK (attendance_strictness BETWEEN 1 AND 5) NOT NULL
would_recommend       BOOLEAN NOT NULL
review_text           TEXT                               -- nullable, max 500 chars
tags                  TEXT[]                             -- array of tag keys
status                ENUM('visible', 'hidden', 'deleted') DEFAULT 'visible'
submitted_at          TIMESTAMP DEFAULT NOW()

-- REMOVED: semester — not tracked in MVP (Option 2: auto-aggregate)
-- REMOVED: overall_score — now lives on professor_courses as avg, not per review
-- Note: No user_id, no IP address stored here
```

**Running average update on each new review insert:**

```sql
-- On INSERT into reviews, update professor_courses using incremental formula:
-- new_avg = ((old_avg * old_count) + new_value) / (old_count + 1)
-- This avoids recomputing AVG() across all rows on every submission.
UPDATE professor_courses
SET
  avg_teaching_quality  = ((avg_teaching_quality * review_count) + $teaching_quality) / (review_count + 1),
  avg_grading_fairness  = ((avg_grading_fairness * review_count) + $grading_fairness) / (review_count + 1),
  avg_course_difficulty = ((avg_course_difficulty * review_count) + $course_difficulty) / (review_count + 1),
  avg_attendance        = ((avg_attendance * review_count) + $attendance_strictness) / (review_count + 1),
  would_recommend_pct   = ((would_recommend_pct * review_count) + ($would_recommend::int * 100)) / (review_count + 1),
  overall_score         = (new weighted combination),
  review_count          = review_count + 1,
  updated_at            = NOW()
WHERE id = $professor_course_id;
```

#### `reports`

```sql
id              SERIAL PRIMARY KEY
review_id       INTEGER REFERENCES reviews(id)
reason          ENUM('personal', 'fake', 'offensive', 'wrong_professor', 'other')
details         TEXT                               -- optional reporter note
status          ENUM('pending', 'resolved_kept', 'resolved_removed') DEFAULT 'pending'
submitted_at    TIMESTAMP DEFAULT NOW()
resolved_at     TIMESTAMP
```

#### `admin_users`

```sql
id              SERIAL PRIMARY KEY
username        VARCHAR(100) UNIQUE NOT NULL
email           VARCHAR(255) UNIQUE                     -- Optional secondary login identifier
password_hash   VARCHAR(255) NOT NULL                   -- bcrypt cost 12
role            admin_role NOT NULL DEFAULT 'moderator' -- ENUM super_admin | admin | moderator
created_by      INTEGER                                 -- admin_users.id — audit trail; null for the bootstrap super_admin
created_at      TIMESTAMP DEFAULT NOW()
last_login      TIMESTAMP

-- Partial unique index — the DB itself enforces "at most one super_admin".
-- Set by migration 20260715_add_admin_roles_and_email.
CREATE UNIQUE INDEX admin_users_only_one_super_admin
  ON admin_users ((role))
  WHERE role = 'super_admin';
```

Introduced by migration `20260715_add_admin_roles_and_email` which adds `role`, `email`, `created_by`, the partial unique index, and promotes the seed-created bootstrap admin (`username='admin'`) to `super_admin`.

#### `review_submissions`

```sql
id                    SERIAL PRIMARY KEY
user_id               UUID REFERENCES users(id) ON DELETE CASCADE
professor_course_id   INTEGER REFERENCES professor_courses(id)
submitted_at          TIMESTAMP DEFAULT NOW()

UNIQUE(user_id, professor_course_id)
-- One review per user per professor+course.
-- This table is intentionally decoupled from the reviews table.
-- It tells us WHO reviewed WHICH professor+course.
-- It does NOT tell us what they wrote — that's in reviews with no user_id.
```

#### `university_requests`

```sql
id           SERIAL PRIMARY KEY
user_id      UUID REFERENCES users(id) ON DELETE CASCADE
name_en      VARCHAR(200) NOT NULL
name_bn      VARCHAR(200)
type         university_type NOT NULL              -- ENUM public|private|international
status       uni_request_status NOT NULL DEFAULT 'pending'
                                                    -- ENUM pending|approved|rejected
admin_note   VARCHAR(500)                            -- surfaces back to the requester
created_at   TIMESTAMP DEFAULT NOW()
resolved_at  TIMESTAMP

INDEX(status)                                       -- admin queue reads pending fast
```

Introduced by migration `20260710_add_university_requests`. Approving a row via `POST /api/admin/university-requests/[id]/resolve` creates the corresponding `universities` row in the same transaction; rejecting just flips the status and (optionally) captures a note.

#### `users`

```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
google_id       VARCHAR(255) UNIQUE NOT NULL       -- Google OAuth 'sub' field
display_name    VARCHAR(100)                        -- from Google profile
created_at      TIMESTAMP DEFAULT NOW()
last_active     TIMESTAMP

-- Intentionally no email column — reduces data liability.
-- Google sub is sufficient to identify unique users for voting.
```

#### `helpful_votes`

```sql
id              SERIAL PRIMARY KEY
user_id         UUID REFERENCES users(id) ON DELETE CASCADE
review_id       INTEGER REFERENCES reviews(id) ON DELETE CASCADE
created_at      TIMESTAMP DEFAULT NOW()

UNIQUE(user_id, review_id)
-- One vote per user per review. Toggling removes this row.
```

> **Why `helpful_votes` is a separate table and not just a counter:**
> A counter on `reviews` would allow double-voting and couldn't be toggled. The join table ensures one vote per user per review, supports un-voting (DELETE the row), and allows future features like "reviews I've found helpful."

Update `reviews` table to include moderation and helpful fields:

#### `reviews` (updated)

```sql
id                    SERIAL PRIMARY KEY
professor_course_id   INTEGER REFERENCES professor_courses(id) NOT NULL
teaching_quality      SMALLINT CHECK (teaching_quality BETWEEN 1 AND 5) NOT NULL
grading_fairness      SMALLINT CHECK (grading_fairness BETWEEN 1 AND 5) NOT NULL
course_difficulty     SMALLINT CHECK (course_difficulty BETWEEN 1 AND 5) NOT NULL
attendance_strictness SMALLINT CHECK (attendance_strictness BETWEEN 1 AND 5) NOT NULL
would_recommend       BOOLEAN NOT NULL
review_text           TEXT                               -- nullable, max 500 chars
tags                  TEXT[]
helpful_count         INTEGER DEFAULT 0                  -- denormalized for fast sort
moderation_status     ENUM('live', 'soft_flagged', 'flagged_hidden', 'deleted') DEFAULT 'live'
moderation_reason     VARCHAR(200)                       -- which rule triggered flag
moderation_notes      TEXT                               -- admin notes on resolution
status                ENUM('visible', 'hidden', 'deleted') DEFAULT 'visible'
submitted_at          TIMESTAMP DEFAULT NOW()

INDEX(professor_course_id, helpful_count DESC)
INDEX(professor_course_id, submitted_at DESC)
-- No user_id, no IP — review authorship remains fully anonymous
```

---

## 7. Page & Route Map

### Public Routes

| Route                                     | Page                    | Description                                                                                                                             |
| ----------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                       | Homepage                | Search bar, site stats, recently reviewed, top professors                                                                               |
| `/universities`                           | University list         | All universities with review counts                                                                                                     |
| `/universities/[slug]`                    | University page         | Departments list, top professors                                                                                                        |
| `/universities/[slug]/[dept-slug]`        | Department page         | All professors in dept, sortable                                                                                                        |
| `/professors/[slug]`                      | Professor profile       | All courses this professor has been reviewed for, with per-course aggregate scores                                                      |
| `/professors/[slug]/[course-slug]`        | Professor + course page | All reviews for this specific professor teaching this specific course                                                                   |
| `/professors/[slug]/[course-slug]/review` | Review form             | Submit a review pre-filled with professor + course                                                                                      |
| `/review/new`                             | New review form         | Select university → typeahead dept → typeahead professor → twin-autocomplete course code/name. Any layer can be auto-created on submit. |
| `/search?q=`                              | Search results          | Results across professors, courses, universities                                                                                        |
| `/about`                                  | About page              | Mission, privacy policy, how anonymity works                                                                                            |

### Admin Routes (Protected)

| Route                        | Page                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `/admin`                     | Dashboard — recent reviews, pending reports                                                         |
| `/admin/reports`             | Reported reviews queue                                                                              |
| `/admin/professors`          | Professor management                                                                                |
| `/admin/universities`        | University list                                                                                     |
| `/admin/universities/[id]`   | University detail — edit fields, add/edit/merge departments (FR-DIR-06)                             |
| `/admin/university-requests` | Reviewer-submitted uni request queue — approve (creates the row) or reject (with note). (FR-DIR-08) |
| `/admin/users`               | Staff user management — create/remove admins & moderators. Super-admin + admin only. (FR-MOD-08)    |
| `/admin/login`               | Admin sign-in page (username-or-email + password).                                                  |
| `/moderator/login`           | Moderator sign-in page — same endpoint as admin login, different copy.                              |
| `/admin/reviews/[id]`        | Single review detail + delete/hide action                                                           |

---

## 8. API Specification

All endpoints return JSON. All write endpoints require CSRF token.

### Public API

```
GET  /api/universities
     → Returns all universities with dept count + review count

GET  /api/universities/:slug/departments
     → Returns departments for a university

GET  /api/universities/search?q=&limit=
     → Scoped typeahead — for the review form's university field.
     → pg_trgm + ILIKE over short_name / name_en / name_bn. Empty q returns
       the full uni catalog (capped).
     → Returns: { results: [{ id, slug, name_en, name_bn, short_name, type, location_city }, ...] }

POST /api/university-requests
     Auth: required (returns 401 if not logged in)
     Body: { nameEn, nameBn?, type: 'public'|'private'|'international' }
     Server logic:
       1. Verify session — reject 401
       2. Reject 409 if a real University with the same name/short_name exists
       3. Reject 409 if this user already has a pending request with the same normalised name
       4. Reject 429 if this user already has ≥ 5 pending requests
       5. Create UniversityRequest with status='pending'
     Response: 201 { request: { id, nameEn, type, status, createdAt } }

GET  /api/professors/search?q=&university_id=&department_id=&limit=
     → Scoped typeahead — for the review form's professor field.
     → pg_trgm + ILIKE over name_en / name_bn. Requires both
       university_id and department_id; ranks by trgm score then review_count.
     → Returns: { results: [{ id, slug, name_en, name_bn, designation, review_count }, ...] }

GET  /api/departments/search?q=&university_id=&limit=
     → Scoped typeahead — for the review form's department field.
     → pg_trgm + ILIKE over short_name / name_en. Empty q returns the full
       dept list for the chosen university. Verified rows rank above unverified.
     → Returns: { results: [{ id, slug, name_en, name_bn, short_name, status, professor_count }, ...] }

GET  /api/courses/search?q=&department_id=&limit=
     → Scoped twin-autocomplete — drives both course_code and course_name fields.
     → pg_trgm + ILIKE over course_code / course_name. Empty q returns the dept's full
       course list. Selecting a hit on the client prepopulates both fields.
     → Returns: { results: [{ id, course_code, course_name, slug, review_count }, ...] }

GET  /api/search?q=&limit=
     → Cross-entity homepage/navbar search (universities + departments + professors).
     → UNION ALL with similarity ranking; min 2 chars.
     → Returns: { results: [{ kind, id, slug, title, subtitle, href, score }, ...] }

GET  /api/professors/:slug
     → Professor profile
     → Returns: professor info + array of professor_courses[], each with:
                { course_code, course_name, avg_teaching_quality, avg_grading_fairness,
                  avg_course_difficulty, avg_attendance, would_recommend_pct,
                  overall_score, review_count, top_tags[] }

GET  /api/professors/:slug/:course-slug/reviews?page=1&per_page=10
     → Paginated reviews for a specific professor + course combination

POST /api/reviews
     Auth: required (returns 401 if not logged in)
     Body: {
       // Path A — known professor
       professor_id?,

       // Path B — auto-create one or more layers
       university_id?,
       department_id?,            // OR department_name_en (auto-create)
       department_name_en?,
       department_short_name?,    // optional explicit acronym from the typeahead's add-new form
       professor_name_en?,
       professor_name_bn?,

       // Always required
       course_code?,
       course_name,
       teaching_quality, grading_fairness, course_difficulty, attendance_strictness,
       would_recommend,
       review_text?,
       tags[],
       honeypot_field
     }
     Server logic:
       1. Verify session — reject 401 if not logged in
       2. Validate honeypot is empty
       3. Run keyword moderation (hard-block returns 400; soft-flag still writes)
       4. Resolve DEPARTMENT — by id, or find-or-create by (university_id, parsed name).
          New rows land as status='unverified'. Skipped if professor_id given.
       5. Resolve PROFESSOR — by id, or find-or-create by (university_id, department_id, name_en).
          New rows land as status='unverified'.
       6. Resolve COURSE — find-or-create by (department_id, course_code) — code wins as the
          unique key; if absent, match on (department_id, course_name).
       7. Find-or-create the professor_courses join row
       8. Check review_submissions: has this user already reviewed this professor+course?
          └── Yes → reject 409 "আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন"
       9. BEGIN TRANSACTION:
          a. INSERT into reviews (no user_id)
          b. INSERT into review_submissions (user_id, professor_course_id)
          c. UPDATE running averages on professor_courses
          COMMIT
       10. Invalidate caches (stats:site + prof:<slug>)
     Response: 201 { message, professor_slug, moderation_status }

POST /api/reports
     Body: { review_id, reason, details? }
     Response: 201 { message }

GET  /api/stats
     → { total_reviews, total_professors, total_courses_reviewed, total_universities }

-- Auth endpoints (NextAuth handles most of this automatically)
GET  /api/auth/signin          → Redirect to Google OAuth
GET  /api/auth/callback/google → OAuth callback, creates user record if new
GET  /api/auth/session         → Returns current session or null
POST /api/auth/signout         → Clear session

-- Helpful voting (requires active session)
POST /api/reviews/:id/helpful
     Auth: required (returns 401 if not logged in)
     Behaviour: toggles — inserts helpful_vote if not exists, deletes if exists
     Response: { helpful_count: 47, voted: true }

GET  /api/reviews/:id/helpful
     Auth: required
     Response: { helpful_count: 47, voted: false }
     -- voted: whether the current user has voted on this review
```

### Admin API (Session Required)

```
GET    /api/admin/reports?status=pending
POST   /api/admin/reports/:id/resolve     Body: { action: 'keep' | 'remove' }
DELETE /api/admin/reviews/:id
PATCH  /api/admin/reviews/:id/status      Body: { status: 'visible' | 'hidden' }
POST   /api/admin/professors              Body: professor data
PATCH  /api/admin/professors/:id
POST   /api/admin/universities            Body: university data
PATCH  /api/admin/universities/:id
POST   /api/admin/universities/:id/departments    Body: { name_en, name_bn?, short_name?, slug? }
PATCH  /api/admin/departments/:id         Body: partial department fields
POST   /api/admin/departments/merge       Body: { target_id, source_ids[] }
                                           Transactional: same-uni check → repoint
                                           professors + courses → mark target verified
                                           → delete sources. (FR-DIR-06)
GET    /api/admin/university-requests?status=pending    (page-rendered; no dedicated JSON endpoint yet)
POST   /api/admin/university-requests/:id/resolve
                                           Body: { action: 'approve'|'reject',
                                                   admin_note?,
                                                   short_name?, slug?, location_city? }
                                           On approve: creates University in a single tx
                                           and flips request to 'approved'. On reject:
                                           flips to 'rejected' with the admin_note. (FR-DIR-08)
POST   /api/admin/users                    Body: { username, email?, password, role: 'admin'|'moderator' }
                                           Rules: admin creates moderators only;
                                           super_admin creates both. role='super_admin'
                                           is not accepted at the schema layer.
                                           Auth: requireAdmin. (FR-MOD-08)
DELETE /api/admin/users/:id                Rules: never delete self, never delete
                                           super_admin, admin can only delete moderators.
                                           Auth: requireAdmin. (FR-MOD-08)
```

**Login endpoint** — the shared entry point for both `/admin/login` and `/moderator/login` pages:

```
POST /api/admin/login
     Body: { login, password, from? }
     - `login` accepts either username OR email; server sniffs based on '@'
     - `from` is honoured only if it starts with /admin or /moderator
     - Sets an HMAC-SHA256 signed cookie carrying { adminId, role, exp }
     - On success: 303 redirect to `from` or `/admin`
     - On failure: 303 redirect to the referring login page with ?error=1
     Runtime: nodejs (bcryptjs)
```

---

## 9. Tech Stack

### Recommended Stack

| Layer               | Technology                                 | Reason                                                                                                                       |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Framework**       | Next.js 14+ (App Router)                   | SSG/ISR for professor pages, API routes built-in, SEO-friendly                                                               |
| **Language**        | TypeScript                                 | Type safety, better DX with Cursor/Claude Code                                                                               |
| **Database**        | PostgreSQL                                 | Relational, handles aggregations well, strong ecosystem                                                                      |
| **ORM**             | Prisma                                     | Type-safe queries, great with TypeScript, easy migrations                                                                    |
| **Auth**            | NextAuth.js v5 (Google provider only)      | Handles Google OAuth session management; minimal config; only used for helpful voting                                        |
| **Hosting — App**   | Vercel Hobby (region `bom1` — Mumbai)      | Free tier sufficient for MVP, seamless Next.js deployment, Mumbai edge for BD latency. See `docs/deployment/vercel-neon.md`. |
| **Hosting — DB**    | Neon (Postgres, ap-south-1 Mumbai)         | Free tier: 0.5 GB storage + 7-day PITR. Auto-suspend when idle. Pooled + direct URLs for Prisma.                             |
| **Hosting — Cache** | Upstash Redis (ap-south-1)                 | Optional; free tier 500 k commands/mo. App falls back to no-cache when `REDIS_URL` is unset.                                 |
| **VPS fallback**    | Docker Compose (`docker-compose.prod.yml`) | Escape hatch if the app ever needs to leave the managed stack. See `docs/deployment/runbook.md`.                             |
| **Styling**         | Tailwind CSS                               | Fast utility-first, good for Bangla text rendering                                                                           |
| **Analytics**       | Umami (self-hosted) or Plausible           | Privacy-first, no cookies, no personal data                                                                                  |

### Why Not...

| Alternative                | Reason skipped                                                   |
| -------------------------- | ---------------------------------------------------------------- |
| Firebase / MongoDB         | Relational data (professors → courses → reviews) fits SQL better |
| MySQL                      | PostgreSQL's `TEXT[]` array type is useful for tags              |
| Express + React (separate) | Next.js collocates API + UI, simpler for solo dev                |
| User auth (Clerk, Auth0)   | Not needed — no login in MVP                                     |

### Environment Variables Required

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_URL=https://poraykemon.com
ADMIN_SESSION_SECRET=<random-64-char-string>
RATE_LIMIT_SALT=<random-32-char-string>

# Google OAuth (for helpful voting)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
NEXTAUTH_SECRET=<random-32-char-string>
NEXTAUTH_URL=https://poraykemon.com
```

---

## 10. MVP vs Future Phases

### Phase 1 — MVP (Build This First)

| Feature                                         | Priority |
| ----------------------------------------------- | -------- |
| University + department directory (seed data)   | P0       |
| Professor profile pages                         | P0       |
| Anonymous review submission                     | P0       |
| Star ratings + tags                             | P0       |
| Search by professor / university                | P0       |
| Report a review                                 | P0       |
| Basic admin panel                               | P0       |
| Privacy-first analytics                         | P0       |
| Mobile-responsive UI                            | P0       |
| About + privacy policy page                     | P0       |
| Seed initial 5–10 universities                  | P0       |
| Helpful/upvote button (login required)          | P0       |
| Google OAuth (NextAuth — for voting only)       | P0       |
| Sort reviews by helpful count                   | P0       |
| Soft moderation: keyword blocklist + auto-flag  | P0       |
| Admin moderation queue with approve/edit/delete | P0       |
| Auto-hide on 3 reports                          | P0       |

### Phase 2 — Growth Features

| Feature                            | Notes                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Semester tracking                  | Add semester field to reviews; show "how has this professor improved over time?" |
| "Add a professor" flow             | User-initiated profile creation with duplicate detection                         |
| University ranking by avg score    | Controversial — consider carefully                                               |
| Trending professors widget         | Most reviewed in last 30 days                                                    |
| English language toggle            | Full EN translation                                                              |
| Share a professor + course profile | OG image generation for social sharing                                           |
| Course catalog per department      | Browse all courses in a department, see which ones have most reviews             |

### Phase 3 — Community Features (Validate demand first)

| Feature                          | Notes                                              |
| -------------------------------- | -------------------------------------------------- |
| Optional lightweight accounts    | For users who want to track their own submissions  |
| Professor response system        | Let professors reply to reviews (opt-in, verified) |
| Course catalog per department    | Full department course listings                    |
| Upvote/helpful on reviews        | "Was this helpful?" without login                  |
| API for third-party integrations | Public read-only API for university apps           |

---

## 11. Decisions Log — All Resolved

All questions resolved. No open items remain.

| #   | Question                                                                           | Resolution                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ~~Should attendance strictness negatively affect overall score?~~                  | **RESOLVED:** Neutral — attendance strictness is stored and displayed as informational only. Not factored into the overall score.                                                                                                                              |
| Q2  | ~~Should new professor profiles go live immediately or require admin approval?~~   | **RESOLVED:** Immediate with duplicate flagging — no approval gate. Admin merges duplicates from the dashboard.                                                                                                                                                |
| Q3  | ~~Should reviews require a minimum course code?~~                                  | **RESOLVED:** Required. If student doesn't know the code, they type the course name and the system creates/matches the record.                                                                                                                                 |
| Q4  | ~~Should the site display the semester of a review?~~                              | **RESOLVED:** No semester in MVP. All reviews for the same professor + course auto-aggregate regardless of semester. Semester tracking deferred to Phase 2.                                                                                                    |
| Q5  | ~~How to handle professors who teach across multiple departments?~~                | **RESOLVED:** Single primary department. Multi-department support deferred to Phase 2.                                                                                                                                                                         |
| Q6  | ~~What is the moderation threshold for auto-hiding?~~                              | **RESOLVED:** 3 reports → review auto-hides pending admin review.                                                                                                                                                                                              |
| Q7  | ~~Domain name~~                                                                    | **RESOLVED:** `poraykemon.com` — `.com` preferred for accessibility.                                                                                                                                                                                           |
| Q8  | ~~How to seed professor data?~~                                                    | **RESOLVED:** Community submission only at launch — reviews create both professor and course records automatically. No manual admin seeding of professors.                                                                                                     |
| Q9  | ~~Should tag cloud be visible before reading reviews?~~                            | **RESOLVED:** Yes — tags are the quickest signal on the professor+course page and appear above the review list.                                                                                                                                                |
| Q10 | ~~Do we show review count prominently or downplay it?~~                            | **RESOLVED:** Prominent — social proof drives contribution. Review count displayed alongside score everywhere.                                                                                                                                                 |
| Q11 | ~~What happens when the same course code exists in multiple departments?~~         | **RESOLVED:** Dept-specific — `UNIQUE(department_id, course_code)` prevents cross-dept collisions. CSE 301 at BUET ≠ CSE 301 at NSU.                                                                                                                           |
| Q12 | ~~Should the professor profile show a combined overall score across all courses?~~ | **RESOLVED:** Two-level display. (1) Combined overall score at the top of the professor profile — weighted average across all courses by review count. (2) Individual per-course score cards below, always visible simultaneously. No tabs or click-to-expand. |

---

## Appendix A — Seed Data Structure (JSON)

Use this structure to seed the database on first deploy:

```json
{
  "universities": [
    {
      "name_en": "Bangladesh University of Engineering and Technology",
      "name_bn": "বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়",
      "short_name": "BUET",
      "location_city": "Dhaka",
      "type": "public",
      "departments": ["CSE", "EEE", "ME", "CE", "ChE", "URP", "Arch"]
    },
    {
      "name_en": "North South University",
      "name_bn": "নর্থ সাউথ ইউনিভার্সিটি",
      "short_name": "NSU",
      "location_city": "Dhaka",
      "type": "private",
      "departments": ["CSE", "EEE", "BBA", "ECO", "ENG", "PHY", "ENV", "MIC", "GEB", "LAW"]
    },
    {
      "name_en": "BRAC University",
      "name_bn": "ব্র্যাক ইউনিভার্সিটি",
      "short_name": "BRACU",
      "location_city": "Dhaka",
      "type": "private",
      "departments": ["CSE", "EEE", "BBA", "ENH", "ECO", "LAW", "ARCH", "PHY"]
    }
  ]
}
```

---

## Appendix B — Review Form Wireframe (Text)

```
┌─────────────────────────────────────────────────────┐
│  পড়ায় কেমন                              [About]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  রিভিউ লিখুন                                       │
│                                                     │
│  বিশ্ববিদ্যালয় *                                  │
│  [Dropdown ▼]                                       │
│                                                     │
│  বিভাগ *                                            │
│  [Dropdown ▼]                                       │
│                                                     │
│  শিক্ষকের নাম *                                    │
│  [Typeahead input — shows matches as you type]      │
│                                                     │
│  কোর্স *                                           │
│  [CSE 301 — Data Structures        ▼]               │
│   কোর্স না পেলে নিজে লিখুন →                      │
│  [কোর্স কোড] [কোর্সের নাম         ]               │
│                                                     │
│  ── এই কোর্সে তাঁর পড়ানো কেমন? ──                │
│                                                     │
│  ক্লাসে কতটা ভালো পড়ান? *                         │
│  ☆ ☆ ☆ ☆ ☆                                         │
│                                                     │
│  নম্বর দেওয়া কতটা ন্যায্য? *                      │
│  ☆ ☆ ☆ ☆ ☆                                         │
│                                                     │
│  কোর্সটা কতটা কঠিন? *                             │
│  ☆ ☆ ☆ ☆ ☆                                         │
│                                                     │
│  অ্যাটেনডেন্স কতটা কড়া? *                        │
│  ☆ ☆ ☆ ☆ ☆                                         │
│                                                     │
│  আবার এই কোর্সটা এই শিক্ষকের কাছে নেবেন? *       │
│  ● হ্যাঁ   ○ না                                    │
│                                                     │
│  ট্যাগ বেছে নিন (ঐচ্ছিক)                          │
│  [স্লাইড পড়েন] [বোর্ডে বোঝান] [প্রশ্ন নেন]      │
│  [নম্বরে কঞ্জুস] [অনুপ্রেরণাদায়ক] [...]           │
│                                                     │
│  আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)                   │
│  ┌─────────────────────────────────┐               │
│  │                                 │               │
│  └─────────────────────────────────┘               │
│  সর্বোচ্চ ৫০০ অক্ষর                               │
│                                                     │
│  [        রিভিউ জমা দিন        ]                   │
│                                                     │
│  আপনার পরিচয় সম্পূর্ণ গোপন থাকবে।               │
│  কোনো লগইন বা ইমেইল লাগবে না।                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

_This SRS is a living document. Update it as decisions in Section 11 are resolved._
