# User Flow Diagrams — Poray Kemon

---

## Flow 1: Course Planner (Read Path)

```mermaid
flowchart TD
    Start(["User arrives at poraykemon.com"])

    Start --> Search["Types professor name or\nuniversity in search bar"]
    Search --> Results["Search results page\n— professor name\n— university + dept\n— overall score ⭐\n— review count\n— top 2 tags"]

    Results --> Click["Clicks on a professor"]
    Click --> ProfProfile["Professor Profile Page\n\nCombined score across all courses\n+ Per-course score cards (always visible)"]

    ProfProfile --> ReadAggs["Reads aggregated scores\nfor each course:\n★ Teaching quality\n★ Grading fairness\n★ Course difficulty\n★ Attendance strictness\n✓ Would recommend %"]

    ReadAggs --> ReadReviews["Reads individual reviews\n(sorted by helpful count by default)"]

    ReadReviews --> Decision{Decision made?}
    Decision -->|"Yes — pick this professor"| Done(["Closes tab, enrolls in course"])
    Decision -->|"No — compare another"| Results
    Decision -->|"Want more context"| CourseDeep["Drill into professor+course page\nSee all reviews for that specific course"]
    CourseDeep --> Decision
```

---

## Flow 2: Review Submission (Write Path)

```mermaid
flowchart TD
    Start(["User wants to submit a review"])

    Start --> IsLoggedIn{Logged in\nwith Google?}

    IsLoggedIn -->|No| ClickReview["Clicks 'রিভিউ লিখুন'"]
    ClickReview --> SignInPrompt["See prompt:\n'রিভিউ দিতে Google দিয়ে\nসাইন ইন করুন'"]
    SignInPrompt --> GoogleOAuth["Google OAuth popup"]
    GoogleOAuth --> LoggedIn["Logged in — no email stored\nReturns to review form"]

    IsLoggedIn -->|Yes| ReviewForm

    LoggedIn --> ReviewForm["Review Form\n\n① Select University (dropdown)\n② Select Department\n③ Type/select Professor name\n④ Type/select Course"]

    ReviewForm --> DuplicateCheck{Already reviewed\nthis prof+course?}
    DuplicateCheck -->|Yes| ShowError["আপনি এই কোর্সে\nইতিমধ্যে রিভিউ দিয়েছেন।"]
    ShowError --> Done2(["User exits"])

    DuplicateCheck -->|No| FillRatings["Fill ratings:\n★ Teaching quality (1-5)\n★ Grading fairness (1-5)\n★ Course difficulty (1-5)\n★ Attendance strictness (1-5)\n● Would recommend (yes/no)"]

    FillRatings --> OptionalFields["Optional:\n— Select tags (multi-select)\n— Write review text (max 500 chars)"]

    OptionalFields --> Submit["Click 'রিভিউ জমা দিন'"]

    Submit --> Validation{Passes\nvalidation?}
    Validation -->|No| ShowFieldErrors["Show inline field errors\nin Bangla"]
    ShowFieldErrors --> FillRatings

    Validation -->|Yes| ModerationCheck{Moderation\ncheck?}
    ModerationCheck -->|Hard block| BlockError["400 error with\nBangla reason"]
    BlockError --> OptionalFields

    ModerationCheck -->|Soft flag| SubmitSuccess["201 — Review live immediately\nQueued for admin review"]
    ModerationCheck -->|Clean| SubmitSuccess

    SubmitSuccess --> Confirmation["'রিভিউ জমা হয়েছে' ✓\nRedirect to professor profile"]
    Confirmation --> Done3(["User sees their review\non professor page"])
```

---

## Flow 3: Helpful Voting

```mermaid
flowchart TD
    Start(["User reading reviews on professor page"])

    Start --> SeeButton["Sees '৪২ জন সহায়ক মনে করেছেন'\nbutton on a review"]

    SeeButton --> IsLoggedIn{Logged in?}

    IsLoggedIn -->|No| ClickAnyway["Clicks Helpful button"]
    ClickAnyway --> LoginPrompt["Inline prompt:\n'ভোট দিতে Google দিয়ে\nসাইন ইন করুন'"]
    LoginPrompt --> OAuthPopup["Google OAuth popup\n(single click if already signed in)"]
    OAuthPopup --> LoggedIn["Logged in — count not yet changed"]
    LoggedIn --> CanVote

    IsLoggedIn -->|Yes| CanVote["Can vote"]

    CanVote --> HasVoted{Already voted\non this review?}

    HasVoted -->|No| VoteUp["Click Helpful\nCount +1\nButton highlighted"]
    VoteUp --> ToggleOff{Click again?}
    ToggleOff -->|Yes| VoteRemoved["Count -1\nButton unhighlighted"]
    ToggleOff -->|No| Done(["Done"])
    VoteRemoved --> Done

    HasVoted -->|Yes| ButtonHighlighted["Button already highlighted\n(was voted before)"]
    ButtonHighlighted --> ClickToRemove["Click to un-vote\nCount -1"]
    ClickToRemove --> Done
```

---

## Flow 4: Reporting a Review

```mermaid
flowchart TD
    Start(["User sees a review they want to report"])

    Start --> ClickReport["Clicks '⚑ রিপোর্ট করুন' on review"]
    ClickReport --> ReportModal["Report modal opens\n\nSelect reason:\n○ এটি আমার সম্পর্কে\n○ এটি ভুয়া রিভিউ\n○ এটি আপত্তিজনক\n○ প্রফেসর ভুল\n○ অন্যান্য"]

    ReportModal --> SelectReason["Selects a reason"]
    SelectReason --> OptionalNote["Optional: add note\n(text input)"]
    OptionalNote --> SubmitReport["Clicks 'রিপোর্ট জমা দিন'"]

    SubmitReport --> Confirmation["'রিপোর্ট জমা হয়েছে।\nআমরা শীঘ্রই দেখব।'"]

    Confirmation --> ReportCount{Total reports\non this review?}
    ReportCount -->|"< 3"| StaysVisible["Review stays visible\nAdmin queue updated"]
    ReportCount -->|"≥ 3"| AutoHide["Review auto-hidden\n'এই রিভিউটি আমাদের নীতিমালা\nলঙ্ঘনের কারণে সরিয়ে নেওয়া হয়েছে।'"]

    AutoHide --> AdminQueue["Admin queue\n(flagged_hidden status)"]
    AdminQueue --> AdminDecision{Admin reviews}
    AdminDecision -->|Approve| Reinstated["Review reinstated"]
    AdminDecision -->|Delete| PermanentRemoval["Permanently deleted"]
```

---

## Flow 5: Admin Moderation

```mermaid
flowchart TD
    Start(["Admin logs in at /admin"])

    Start --> Dashboard["Admin Dashboard\n— Pending reports count\n— Soft-flagged reviews count\n— Recent activity"]

    Dashboard --> ChooseQueue{Which queue?}

    ChooseQueue -->|Reports| ReportQueue["Reports Queue\n/admin/reports\nSorted by: most reports first"]
    ChooseQueue -->|Soft-flagged| FlagQueue["Soft-flagged Queue\nAll 'soft_flagged' reviews\nWith flag reason shown"]

    ReportQueue --> ReviewItem["View review + context\n— Review text\n— Flag reason\n— Reporter notes\n— Professor + course info"]

    FlagQueue --> ReviewItem

    ReviewItem --> AdminAction{Admin decision}

    AdminAction -->|"✅ Approve"| Approved["moderation_status = 'live'\nFlagged state cleared\nStays in public view"]
    AdminAction -->|"✏️ Edit"| EditMode["Edit specific words\nThen approve\n(log edit in moderation_notes)"]
    AdminAction -->|"🚫 Hide"| Hidden["moderation_status = 'flagged_hidden'\nRemoved from public view\nPlaceholder text shown"]
    AdminAction -->|"❌ Delete"| Deleted["status = 'deleted'\nPermanently removed\nPlaceholder text shown"]

    EditMode --> Approved
```
