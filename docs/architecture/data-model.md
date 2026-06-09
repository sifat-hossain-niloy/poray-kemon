# Data Model Reference — Poray Kemon

**Version:** 1.0  
**Last Updated:** June 2026  
**Source of truth:** `prisma/schema.prisma` (once created)

---

## Entity Relationship Overview

```
universities
    │ 1:N
departments
    │ 1:N
professors
    │ 1:N
professor_courses ──── courses
    │ 1:N             (N:1 from departments)
reviews
    │
    └── helpful_votes (N:M with users)
    └── reports

users
    │ 1:N
review_submissions ──── professor_courses
    (who reviewed what — decoupled from reviews)

admin_users (separate auth system)
```

---

## Tables

### `universities`

| Column          | Type           | Constraints      | Notes                                |
| --------------- | -------------- | ---------------- | ------------------------------------ |
| `id`            | `SERIAL`       | PK               |                                      |
| `name_en`       | `VARCHAR(200)` | NOT NULL, UNIQUE | "North South University"             |
| `name_bn`       | `VARCHAR(200)` |                  | "নর্থ সাউথ ইউনিভার্সিটি"             |
| `short_name`    | `VARCHAR(20)`  | NOT NULL, UNIQUE | "NSU"                                |
| `slug`          | `VARCHAR(50)`  | NOT NULL, UNIQUE | "nsu" — for URL routing              |
| `location_city` | `VARCHAR(100)` |                  | "Dhaka"                              |
| `type`          | `ENUM`         |                  | `public`, `private`, `international` |
| `website_url`   | `VARCHAR(255)` |                  |                                      |
| `created_at`    | `TIMESTAMP`    | DEFAULT NOW()    |                                      |

**Indexes:** `slug` (unique), `short_name` (unique)

---

### `departments`

| Column          | Type           | Constraints          | Notes                                                                                                         |
| --------------- | -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `id`            | `SERIAL`       | PK                   |                                                                                                               |
| `university_id` | `INTEGER`      | FK → universities    |                                                                                                               |
| `name_en`       | `VARCHAR(200)` | NOT NULL             | "Computer Science & Engineering"                                                                              |
| `name_bn`       | `VARCHAR(200)` |                      |                                                                                                               |
| `short_name`    | `VARCHAR(20)`  |                      | "CSE"                                                                                                         |
| `slug`          | `VARCHAR(50)`  |                      | "cse"                                                                                                         |
| `status`        | `ENUM`         | DEFAULT 'unverified' | `verified \| unverified`. Seed-curated rows are verified. Anything created via the review form is unverified. |
| `created_at`    | `TIMESTAMP`    | DEFAULT NOW()        |                                                                                                               |

**Unique constraint:** `(university_id, short_name)`, `(university_id, slug)`

Departments are created in two ways: (a) by the seed, with `status='verified'`; (b) by the review submission flow when a user types a new department in the review form's typeahead. The auto-create branch (b) parses `"CSE - Computer Science and Engineering"` style input via `lib/department-parser.ts` and stores `status='unverified'`. Duplicates that survive ("CSE" + "C.S.E." + "Computer Science and Engineering" as three rows) can be collapsed by an admin via `POST /api/admin/departments/merge` — a single transaction that repoints `professors.department_id` + `courses.department_id`, marks the target verified, and deletes the source rows.

---

### `professors`

| Column          | Type           | Constraints          | Notes                                                                         |
| --------------- | -------------- | -------------------- | ----------------------------------------------------------------------------- |
| `id`            | `SERIAL`       | PK                   |                                                                               |
| `university_id` | `INTEGER`      | FK → universities    |                                                                               |
| `department_id` | `INTEGER`      | FK → departments     |                                                                               |
| `name_en`       | `VARCHAR(200)` | NOT NULL             | "Dr. Mohammad Rahman"                                                         |
| `name_bn`       | `VARCHAR(200)` |                      |                                                                               |
| `designation`   | `ENUM`         |                      | lecturer, assistant_professor, associate_professor, professor, adjunct, other |
| `status`        | `ENUM`         | DEFAULT 'unverified' | active, retired, unverified                                                   |
| `slug`          | `VARCHAR(255)` | UNIQUE               | "dr-mohammad-rahman"                                                          |
| `search_vector` | `tsvector`     | GENERATED            | For full-text search                                                          |
| `created_at`    | `TIMESTAMP`    | DEFAULT NOW()        |                                                                               |

**Indexes:**

- `slug` (unique)
- `search_vector` (GIN index for full-text search)
- `(university_id, department_id)` (composite for filtering)

---

### `courses`

| Column          | Type           | Constraints                | Notes                     |
| --------------- | -------------- | -------------------------- | ------------------------- |
| `id`            | `SERIAL`       | PK                         |                           |
| `department_id` | `INTEGER`      | FK → departments, NOT NULL |                           |
| `course_code`   | `VARCHAR(20)`  |                            | "CSE 301"                 |
| `course_name`   | `VARCHAR(200)` | NOT NULL                   | "Data Structures"         |
| `slug`          | `VARCHAR(100)` |                            | "cse-301-data-structures" |
| `created_at`    | `TIMESTAMP`    | DEFAULT NOW()              |                           |

**Unique constraint:** `(department_id, course_code)` — CSE 301 at BUET ≠ CSE 301 at NSU  
**Note:** Courses belong to a department, NOT a professor. The professor-course pairing is in `professor_courses`.

---

### `professor_courses`

The core aggregation unit. One record = one professor teaching one course.

| Column                  | Type           | Constraints               | Notes                                 |
| ----------------------- | -------------- | ------------------------- | ------------------------------------- |
| `id`                    | `SERIAL`       | PK                        |                                       |
| `professor_id`          | `INTEGER`      | FK → professors, NOT NULL |                                       |
| `course_id`             | `INTEGER`      | FK → courses, NOT NULL    |                                       |
| `review_count`          | `INTEGER`      | DEFAULT 0                 | Denormalized — updated on each review |
| `avg_teaching_quality`  | `DECIMAL(3,2)` |                           | Running average                       |
| `avg_grading_fairness`  | `DECIMAL(3,2)` |                           | Running average                       |
| `avg_course_difficulty` | `DECIMAL(3,2)` |                           | Running average                       |
| `avg_attendance`        | `DECIMAL(3,2)` |                           | Running average                       |
| `would_recommend_pct`   | `DECIMAL(5,2)` |                           | % of yes votes × 100                  |
| `overall_score`         | `DECIMAL(3,2)` |                           | Weighted composite                    |
| `created_at`            | `TIMESTAMP`    | DEFAULT NOW()             |                                       |
| `updated_at`            | `TIMESTAMP`    | DEFAULT NOW()             | Updated on each new review            |

**Unique constraint:** `(professor_id, course_id)`

**Running average formula (applied on each review INSERT):**

```sql
new_avg = ((old_avg * old_count) + new_value) / (old_count + 1)
```

---

### `reviews`

The content table. **No `user_id` column** — this is by design.

| Column                  | Type           | Constraints                      | Notes                                       |
| ----------------------- | -------------- | -------------------------------- | ------------------------------------------- |
| `id`                    | `SERIAL`       | PK                               |                                             |
| `professor_course_id`   | `INTEGER`      | FK → professor_courses, NOT NULL |                                             |
| `teaching_quality`      | `SMALLINT`     | CHECK 1-5, NOT NULL              |                                             |
| `grading_fairness`      | `SMALLINT`     | CHECK 1-5, NOT NULL              |                                             |
| `course_difficulty`     | `SMALLINT`     | CHECK 1-5, NOT NULL              |                                             |
| `attendance_strictness` | `SMALLINT`     | CHECK 1-5, NOT NULL              |                                             |
| `would_recommend`       | `BOOLEAN`      | NOT NULL                         |                                             |
| `review_text`           | `TEXT`         | nullable, max 500 chars          |                                             |
| `tags`                  | `TEXT[]`       |                                  | Array of tag keys                           |
| `helpful_count`         | `INTEGER`      | DEFAULT 0                        | Denormalized — updated on vote              |
| `moderation_status`     | `ENUM`         | DEFAULT 'live'                   | live, soft_flagged, flagged_hidden, deleted |
| `moderation_reason`     | `VARCHAR(200)` |                                  | Which rule triggered flag                   |
| `moderation_notes`      | `TEXT`         |                                  | Admin notes                                 |
| `status`                | `ENUM`         | DEFAULT 'visible'                | visible, hidden, deleted                    |
| `submitted_at`          | `TIMESTAMP`    | DEFAULT NOW()                    |                                             |

**Indexes:**

- `(professor_course_id, helpful_count DESC)` — for sort by helpful
- `(professor_course_id, submitted_at DESC)` — for sort by recent
- `moderation_status` — for admin queue

**Critical invariant:** No `user_id`. No `ip_address`. Review authorship is permanently unattributable.

---

### `review_submissions`

Tracks who reviewed which professor+course. **Decoupled from `reviews`.**

| Column                | Type        | Constraints                      | Notes |
| --------------------- | ----------- | -------------------------------- | ----- |
| `id`                  | `SERIAL`    | PK                               |       |
| `user_id`             | `UUID`      | FK → users, NOT NULL             |       |
| `professor_course_id` | `INTEGER`   | FK → professor_courses, NOT NULL |       |
| `submitted_at`        | `TIMESTAMP` | DEFAULT NOW()                    |       |

**Unique constraint:** `(user_id, professor_course_id)` — one review per user per course  
**On delete:** `CASCADE` on `user_id` — if user account deleted, submission record deleted too

---

### `users`

| Column         | Type           | Constraints                   | Notes                            |
| -------------- | -------------- | ----------------------------- | -------------------------------- |
| `id`           | `UUID`         | PK, DEFAULT gen_random_uuid() |                                  |
| `google_id`    | `VARCHAR(255)` | UNIQUE, NOT NULL              | Google OAuth `sub` field         |
| `display_name` | `VARCHAR(100)` |                               | From Google profile, for UI only |
| `created_at`   | `TIMESTAMP`    | DEFAULT NOW()                 |                                  |
| `last_active`  | `TIMESTAMP`    |                               | Updated on login                 |

**Intentionally no `email` column** — reduces PII footprint. Google `sub` is sufficient for identity.

---

### `helpful_votes`

| Column       | Type        | Constraints            | Notes |
| ------------ | ----------- | ---------------------- | ----- |
| `id`         | `SERIAL`    | PK                     |       |
| `user_id`    | `UUID`      | FK → users, NOT NULL   |       |
| `review_id`  | `INTEGER`   | FK → reviews, NOT NULL |       |
| `created_at` | `TIMESTAMP` | DEFAULT NOW()          |       |

**Unique constraint:** `(user_id, review_id)` — one vote per user per review  
**On delete:** `CASCADE` on both FKs

---

### `reports`

| Column         | Type        | Constraints       | Notes                                             |
| -------------- | ----------- | ----------------- | ------------------------------------------------- |
| `id`           | `SERIAL`    | PK                |                                                   |
| `review_id`    | `INTEGER`   | FK → reviews      |                                                   |
| `reason`       | `ENUM`      | NOT NULL          | personal, fake, offensive, wrong_professor, other |
| `details`      | `TEXT`      |                   | Optional reporter note                            |
| `status`       | `ENUM`      | DEFAULT 'pending' | pending, resolved_kept, resolved_removed          |
| `submitted_at` | `TIMESTAMP` | DEFAULT NOW()     |                                                   |
| `resolved_at`  | `TIMESTAMP` |                   |                                                   |

**Auto-hide trigger:** When `COUNT(reports WHERE review_id = X AND status = 'pending') >= 3`, update `reviews.moderation_status = 'flagged_hidden'`.

---

### `admin_users`

| Column          | Type           | Constraints      | Notes                 |
| --------------- | -------------- | ---------------- | --------------------- |
| `id`            | `SERIAL`       | PK               |                       |
| `username`      | `VARCHAR(100)` | UNIQUE, NOT NULL |                       |
| `password_hash` | `VARCHAR(255)` | NOT NULL         | bcrypt, min 12 rounds |
| `created_at`    | `TIMESTAMP`    | DEFAULT NOW()    |                       |
| `last_login`    | `TIMESTAMP`    |                  |                       |

---

## Key Constraints Summary

| Constraint                               | Enforcement                                                    |
| ---------------------------------------- | -------------------------------------------------------------- |
| One review per user per professor+course | `UNIQUE(user_id, professor_course_id)` on `review_submissions` |
| One vote per user per review             | `UNIQUE(user_id, review_id)` on `helpful_votes`                |
| Course code unique per department        | `UNIQUE(department_id, course_code)` on `courses`              |
| Professor+course pair unique             | `UNIQUE(professor_id, course_id)` on `professor_courses`       |
| Review text max 500 chars                | Application-level (Zod) + DB trigger (optional)                |
| Ratings between 1 and 5                  | `CHECK (column BETWEEN 1 AND 5)`                               |

---

## Seed Data Plan

On first deployment, seed:

1. `universities` — 20 BD universities (see SRS Appendix A)
2. `departments` — ~5-10 departments per university
3. `admin_users` — one admin account

Professor and course records are created automatically by the first review submission.
