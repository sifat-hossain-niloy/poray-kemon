# Entity Relationship Diagram — Poray Kemon

```mermaid
erDiagram
    universities {
        serial id PK
        varchar name_en
        varchar name_bn
        varchar short_name
        varchar slug
        varchar location_city
        enum type
        varchar website_url
        timestamp created_at
    }

    departments {
        serial id PK
        integer university_id FK
        varchar name_en
        varchar name_bn
        varchar short_name
        varchar slug
        timestamp created_at
    }

    professors {
        serial id PK
        integer university_id FK
        integer department_id FK
        varchar name_en
        varchar name_bn
        enum designation
        enum status
        varchar slug
        tsvector search_vector
        timestamp created_at
    }

    courses {
        serial id PK
        integer department_id FK
        varchar course_code
        varchar course_name
        varchar slug
        timestamp created_at
    }

    professor_courses {
        serial id PK
        integer professor_id FK
        integer course_id FK
        integer review_count
        decimal avg_teaching_quality
        decimal avg_grading_fairness
        decimal avg_course_difficulty
        decimal avg_attendance
        decimal would_recommend_pct
        decimal overall_score
        timestamp created_at
        timestamp updated_at
    }

    reviews {
        serial id PK
        integer professor_course_id FK
        smallint teaching_quality
        smallint grading_fairness
        smallint course_difficulty
        smallint attendance_strictness
        boolean would_recommend
        text review_text
        text_array tags
        integer helpful_count
        enum moderation_status
        varchar moderation_reason
        text moderation_notes
        enum status
        timestamp submitted_at
    }

    review_submissions {
        serial id PK
        uuid user_id FK
        integer professor_course_id FK
        timestamp submitted_at
    }

    users {
        uuid id PK
        varchar google_id
        varchar display_name
        timestamp created_at
        timestamp last_active
    }

    helpful_votes {
        serial id PK
        uuid user_id FK
        integer review_id FK
        timestamp created_at
    }

    reports {
        serial id PK
        integer review_id FK
        enum reason
        text details
        enum status
        timestamp submitted_at
        timestamp resolved_at
    }

    admin_users {
        serial id PK
        varchar username
        varchar password_hash
        timestamp created_at
        timestamp last_login
    }

    universities ||--o{ departments : "has"
    universities ||--o{ professors : "employs"
    departments ||--o{ professors : "contains"
    departments ||--o{ courses : "offers"
    professors ||--o{ professor_courses : "teaches"
    courses ||--o{ professor_courses : "taught_via"
    professor_courses ||--o{ reviews : "has"
    professor_courses ||--o{ review_submissions : "tracked_by"
    reviews ||--o{ helpful_votes : "receives"
    reviews ||--o{ reports : "reported_via"
    users ||--o{ review_submissions : "submits"
    users ||--o{ helpful_votes : "casts"
```

---

## Key Design Notes

### Anonymity by Schema

```
reviews                    review_submissions
───────────────────        ──────────────────────────
id                         id
professor_course_id ───┐   user_id          ← WHO reviewed
teaching_quality       │   professor_course_id ← WHAT they reviewed
...                    │   submitted_at
[NO user_id]           │
                       └── same professor_course_id
                           BUT no shared key with reviews
```

There is no foreign key from `reviews` to `review_submissions`.  
There is no foreign key from `review_submissions` to `reviews`.  
A JOIN across the two tables to find "who wrote this review" is structurally impossible.

### Aggregate Flow

```
New review INSERT
        │
        ▼
professor_courses UPDATE
  review_count + 1
  avg_teaching_quality = running avg
  avg_grading_fairness = running avg
  avg_course_difficulty = running avg
  avg_attendance = running avg
  would_recommend_pct = running pct
  overall_score = weighted composite
```

All in one ACID transaction. O(1) update cost regardless of total review count.
