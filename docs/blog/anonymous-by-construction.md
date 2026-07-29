# Anonymous by construction: how Poray Kemon protects your identity

**Author:** Poray Kemon team · **Reading time:** ~6 min

---

Every student we've spoken to says some version of the same thing:

> "I'd love to warn my juniors about this professor, but if it ever traces back to me, I'm cooked."

That fear is rational. The Bangladeshi academic world is small. A single leaked screenshot from an internal panel, a database dump served in response to a legal notice, or one careless log line is enough to end a career before it starts. So when we designed Poray Kemon, we didn't treat anonymity as a feature we'd add later once the app was working. We designed the database around it, and we wrote the app to fit the database, not the other way around.

This post walks through how that works. It's meant to be honest, not comforting: we'll show you both what we've done and what we can't promise.

## What "anonymous" means here

Anonymity is a technical property, not a feeling. So let's define exactly what we mean before we describe how we get there.

The promise is this: **given the review database, no one, including us, can tell who wrote which review.** That includes:

- Us, the maintainers, with full production database access.
- A curious admin or moderator who logs in with the right credentials.
- A future employee who joins after you've written a review.
- Someone who obtains a database backup, whether legally or otherwise.
- A court that asks us "who wrote this specific review?"

The promise is NOT:

- That Google doesn't know who you are. You sign in with them.
- That your ISP can't see you visited the site. That's what a VPN is for.
- That state-level actors with full network taps couldn't correlate traffic. We can't defeat that and neither can anyone else.

We're solving the realistic threat: your review sitting in our database, and someone with access to that database wanting to know who wrote it. Everything below is about making that specific attack impossible by construction, not by policy.

## The architecture, in four moves

### 1. The reviews table has no user_id column

This is the first and most important design decision. The `reviews` table, the one that holds every rating, tag, and free-text comment ever submitted, literally has no foreign key back to the person who wrote it.

```
reviews
  id                      SERIAL
  professor_course_id     INTEGER  →  professor_courses
  teaching_quality        INTEGER
  grading_fairness        INTEGER
  course_difficulty       INTEGER
  attendance_strictness   INTEGER
  would_recommend         BOOLEAN
  review_text             TEXT
  tags                    TEXT[]
  submitted_at            TIMESTAMP
  ...
```

There's no `user_id` column on this table. Not hidden, not encrypted, not soft-deleted, not "we could look it up if we needed to." **The column does not exist.**

We enforce this at three levels: the Prisma schema, a migration, and an integration test that queries `information_schema` on every CI run and fails the build if the column ever reappears. If a well-meaning future contributor tries to add it "just for admin purposes", CI will refuse the merge.

### 2. A separate table tracks "who reviewed what", without touching content

You might now be wondering: how do we prevent the same person from reviewing the same professor+course twice? Because if we can't identify a submitter, we can't detect duplicates.

The answer is a second table, deliberately decoupled from `reviews`:

```
review_submissions
  id                    SERIAL
  user_id               UUID  →  users
  professor_course_id   INTEGER  →  professor_courses
  submitted_at          TIMESTAMP

  UNIQUE(user_id, professor_course_id)
```

That's the whole table. It records the fact that user X has reviewed the (professor, course) pair Y. It says nothing about the review's stars, tags, or text.

When you submit a review, both tables are written to inside a single database transaction: `reviews` gets your ratings, `review_submissions` gets the "I've already reviewed this course" fact. The two rows have no foreign key between them, no shared timestamp precision, no shared id. They live in the same transaction and then diverge forever.

The unique constraint prevents duplicates. The decoupling means that even a full SQL dump of both tables, joined arbitrarily, can't recover the mapping from a specific `reviews` row to a specific `users` row. There is no key to join them on.

### 3. We store the minimum possible about you as a user

Login happens through Google OAuth. The obvious thing to do would be to store your email, your full name, your Google avatar, and a hashed password. We store none of that.

The `users` table has three columns you'd notice:

```
users
  id            UUID
  google_id     VARCHAR   -- Google's opaque "sub" identifier
  display_name  VARCHAR   -- your first name only, from Google
  created_at    TIMESTAMP
  last_active   TIMESTAMP
```

**We do not store your email address.** We never receive it from Google, we don't ask for it, and there's no column to put it in. Google's `sub` field is an opaque identifier, a string like `115625890740223442891`, that we use only to recognize you when you sign in again. It's not something Bangladeshi law enforcement or a curious admin can google to find your Facebook profile.

Your display name is your first name, cosmetic only, used for the "Signed in as Abdul" line in the corner of the UI. It never appears on a review. It's not indexed. It's not searchable.

### 4. Professor names on public pages are visually obfuscated

This is a defense against a specific attack: a professor who suspects a student has left a bad review googling their own name, finding the review, and pursuing the student for defamation.

Every English professor name on a public page is transformed for display:

- `a` → `@`, `l` → `!`, `i` → `!`, `e` → `3`, `o` → `0`, `s` → `$`, `t` → `7`

So "Mohammad Rahman" appears as "M0h@mm@d R@hm@n". A human who already knows the professor reads through it without effort. A search engine crawling the page indexes gibberish. This isn't a substitute for anonymity, it's an extra layer that makes the review harder to find by search in the first place.

## What we don't claim

We think honesty about the boundaries of what we can guarantee is worth more than aspirational marketing.

- **Google knows who you are.** When you sign in through Google OAuth, Google records that you signed in to Poray Kemon. If Google is compelled by a court to disclose "who signed in to poraykemon.com on date X", they can. We can't defend against that. What we can defend against is anyone (including us) using our own database to link you to your review.

- **Our hosting providers see your traffic.** Vercel serves the pages, Neon holds the data, Cloudflare (if we put it in front) sees your IP. None of them can tell "which review this specific person wrote" because that mapping doesn't exist anywhere. But they can see that a person from IP X submitted a POST to `/api/reviews`. Traffic-level correlation is out of our design scope.

- **A subpoena could compel us to enable identification going forward.** We won't voluntarily change the design, but if a court orders us to start recording user_id on new reviews, we'd have to comply or shut down. This is why keeping the app tiny (and moving on if it ever gets big enough to matter to a state actor) is part of the plan.

The threat model we win against is the everyday one: an admin poking around the database, a moderator with a grudge, a database backup being leaked or subpoenaed, or someone joining the team years from now and rifling through history. Against all of these, the architecture, not policy, not intent, makes identification impossible.

## Verify for yourself

Everything above is open, the source code is on GitHub. If you'd rather trust code than blog posts, here's what to check:

1. **`prisma/schema.prisma`**, the `Review` model. Confirm there is no `userId` field or `user` relation.
2. **`prisma/schema.prisma`**, the `ReviewSubmission` model. Confirm it has `userId` and `professorCourseId` and no fields that copy anything from `Review`.
3. **`app/api/reviews/route.ts`**, the write path. Read the transaction block: `reviews` and `review_submissions` are both inserted, with no shared identifier passed between them.
4. **`__tests__/integration/reviews-api.test.ts`**, search for "anonymity". There's an integration test that queries the DB's `information_schema` and fails the build if a `user_id` column ever appears on `reviews`.
5. **`prisma/schema.prisma`**, the `User` model. Confirm no `email` column.
6. **`lib/name-obfuscation.ts`**, the character-substitution transform applied at render time.

If any of the above ever stops matching this post, that's a bug in either our code or this claim. Please open an issue, we'll take it seriously.

---

We're not the last line of defense, you should still use a VPN if your threat model demands it, and think twice before writing anything that identifies you by content ("I was the only student who wore a yellow shirt to that class"). But for the everyday case of "I want to warn future students without gambling my career on it", we've built the app so the answer is: **the trace doesn't exist to be followed.**

That's the promise. The code backs it up.
