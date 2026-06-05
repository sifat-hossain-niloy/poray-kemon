# Software Requirements Specification

## Poray Kemon (পড়ায় কেমন)

### Anonymous Professor & Course Rating Platform for Bangladesh

---

**Version:** 1.3  
**Status:** Draft  
**Last Updated:** June 2026  
**Changelog:**

- v1.1 — Review model changed to professor + course combo (Model B), auto-aggregated per course (Option 2). Semester field removed from MVP. `professor_courses` join table added.
- v1.2 — Helpful/upvote system added (login required to vote). Lightweight Google OAuth added for voters only. Soft moderation (Approach 2) confirmed.
- v1.3 — **Core philosophy change:** Login (Google OAuth) required to submit reviews AND vote. Reading remains fully public. Anonymity preserved by never storing `user_id` on the `reviews` record — a separate `review_submissions` table tracks who reviewed which professor+course without exposing review content. IP rate limiting replaced by one-review-per-professor-course-per-account enforcement.

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

**FR-DIR-01:** The system shall maintain a curated list of Bangladeshi universities. Seed data shall include at minimum:

| University                                          | Short Name |
| --------------------------------------------------- | ---------- |
| Bangladesh University of Engineering and Technology | BUET       |
| University of Dhaka                                 | DU         |
| BRAC University                                     | BRACU      |
| North South University                              | NSU        |
| Independent University, Bangladesh                  | IUB        |
| BRAC University                                     | BRACU      |
| American International University Bangladesh        | AIUB       |
| Dhaka University of Engineering & Technology        | DUET       |
| Rajshahi University of Engineering & Technology     | RUET       |
| Chittagong University of Engineering & Technology   | CUET       |
| University of Chittagong                            | CU         |
| Shahjalal University of Science and Technology      | SUST       |
| Khulna University of Engineering & Technology       | KUET       |
| Islamic University of Technology                    | IUT        |
| Daffodil International University                   | DIU        |
| East West University                                | EWU        |
| United International University                     | UIU        |
| University of Asia Pacific                          | UAP        |
| Military Institute of Science and Technology        | MIST       |
| Bangladesh Agricultural University                  | BAU        |

**FR-DIR-02:** Each university shall have a list of departments. Departments are pre-seeded by admin and not user-created.

**FR-DIR-03:** The system shall allow admins to add universities and departments via a protected admin interface.

**FR-DIR-04:** Universities and departments shall not be deletable if they have linked professors with reviews.

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

**FR-PROF-04:** Duplicate professor detection — before creating a new profile, the system shall fuzzy-match against existing professors in the same department and display potential matches to the reviewer.

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

| Field                   | Type          | Required | Details                                                                                                                                        |
| ----------------------- | ------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `university`            | Select        | ✅       | Dropdown from directory                                                                                                                        |
| `department`            | Select        | ✅       | Filtered by selected university                                                                                                                |
| `professor_name`        | Text / Select | ✅       | Typeahead from existing professors; allows new name entry                                                                                      |
| `course_code`           | Text          | ✅       | e.g. "CSE 301" — **required in Model B**. If student doesn't know it, they can type the course name instead and it will be matched or created. |
| `course_name`           | Text          | ✅       | e.g. "Data Structures" — required if course_code is not recognized                                                                             |
| `teaching_quality`      | 1–5 stars     | ✅       | "ক্লাসে কতটা ভালো পড়ান?"                                                                                                                      |
| `grading_fairness`      | 1–5 stars     | ✅       | "নম্বর দেওয়া কতটা ন্যায্য?"                                                                                                                   |
| `course_difficulty`     | 1–5 stars     | ✅       | "কোর্সটা কতটা কঠিন?"                                                                                                                           |
| `attendance_strictness` | 1–5           | ✅       | "অ্যাটেনডেন্স কতটা কড়া?" (1 = not strict, 5 = very strict)                                                                                    |
| `would_recommend`       | Boolean       | ✅       | "আবার এই স্যার/ম্যামের এই কোর্স নেবেন?" — Yes / No                                                                                             |
| `review_text`           | Textarea      | ❌       | Optional, max 500 characters, min 20 if provided                                                                                               |
| `tags`                  | Multi-select  | ❌       | See tag list below                                                                                                                             |

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

**FR-MOD-05:** Admin login shall be protected by a strong password. No social login. Admin panel accessible at `/admin` with session-based auth.

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
name_en         VARCHAR(200) NOT NULL               -- "Computer Science & Engineering"
name_bn         VARCHAR(200)                        -- "কম্পিউটার সায়েন্স"
short_name      VARCHAR(20)                         -- "CSE"
created_at      TIMESTAMP DEFAULT NOW()

UNIQUE(university_id, short_name)
```

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
password_hash   VARCHAR(255) NOT NULL              -- bcrypt
created_at      TIMESTAMP DEFAULT NOW()
last_login      TIMESTAMP
```

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

| Route                                     | Page                    | Description                                                                        |
| ----------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `/`                                       | Homepage                | Search bar, site stats, recently reviewed, top professors                          |
| `/universities`                           | University list         | All universities with review counts                                                |
| `/universities/[slug]`                    | University page         | Departments list, top professors                                                   |
| `/universities/[slug]/[dept-slug]`        | Department page         | All professors in dept, sortable                                                   |
| `/professors/[slug]`                      | Professor profile       | All courses this professor has been reviewed for, with per-course aggregate scores |
| `/professors/[slug]/[course-slug]`        | Professor + course page | All reviews for this specific professor teaching this specific course              |
| `/professors/[slug]/[course-slug]/review` | Review form             | Submit a review pre-filled with professor + course                                 |
| `/review/new`                             | New review form         | Start from scratch — select university → dept → professor → course                 |
| `/search?q=`                              | Search results          | Results across professors, courses, universities                                   |
| `/about`                                  | About page              | Mission, privacy policy, how anonymity works                                       |

### Admin Routes (Protected)

| Route                 | Page                                        |
| --------------------- | ------------------------------------------- |
| `/admin`              | Dashboard — recent reviews, pending reports |
| `/admin/reports`      | Reported reviews queue                      |
| `/admin/professors`   | Professor management                        |
| `/admin/universities` | University + department management          |
| `/admin/reviews/[id]` | Single review detail + delete/hide action   |

---

## 8. API Specification

All endpoints return JSON. All write endpoints require CSRF token.

### Public API

```
GET  /api/universities
     → Returns all universities with dept count + review count

GET  /api/universities/:slug/departments
     → Returns departments for a university

GET  /api/professors/search?q=&university=&department=
     → Full-text search across professors
     → Returns: id, slug, name_en, name_bn, university, department,
                overall_score, total_review_count, course_count, top_tags[]

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
       professor_id,
       course_code,
       course_name,
       teaching_quality,
       grading_fairness,
       course_difficulty,
       attendance_strictness,
       would_recommend,
       review_text?,
       tags[],
       honeypot_field
     }
     Server logic:
       1. Verify session — reject 401 if not logged in
       2. Validate honeypot is empty
       3. Check review_submissions: has this user already reviewed this professor+course?
          └── Yes → reject 409 "আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন"
       4. Run keyword moderation check
       5. Find or create `courses` record
       6. Find or create `professor_courses` record
       7. BEGIN TRANSACTION:
          a. INSERT into reviews (no user_id)
          b. INSERT into review_submissions (user_id, professor_course_id)
          c. UPDATE running averages on professor_courses
          COMMIT
     Response: 201 { message: "রিভিউ জমা হয়েছে" }

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
POST   /api/admin/departments             Body: department data
```

---

## 9. Tech Stack

### Recommended Stack

| Layer             | Technology                            | Reason                                                                                |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| **Framework**     | Next.js 14+ (App Router)              | SSG/ISR for professor pages, API routes built-in, SEO-friendly                        |
| **Language**      | TypeScript                            | Type safety, better DX with Cursor/Claude Code                                        |
| **Database**      | PostgreSQL                            | Relational, handles aggregations well, strong ecosystem                               |
| **ORM**           | Prisma                                | Type-safe queries, great with TypeScript, easy migrations                             |
| **Auth**          | NextAuth.js v5 (Google provider only) | Handles Google OAuth session management; minimal config; only used for helpful voting |
| **Hosting — App** | Vercel                                | Free tier sufficient for MVP, seamless Next.js deployment                             |
| **Hosting — DB**  | Supabase (Postgres) or Railway        | Free/cheap Postgres, Supabase has generous free tier                                  |
| **Styling**       | Tailwind CSS                          | Fast utility-first, good for Bangla text rendering                                    |
| **Analytics**     | Umami (self-hosted) or Plausible      | Privacy-first, no cookies, no personal data                                           |

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
