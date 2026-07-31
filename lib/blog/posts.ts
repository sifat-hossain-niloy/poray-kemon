// Blog posts stored as structured data (not MDX) so we avoid a new
// build-time dependency. Each post is a small article that targets a
// specific long-tail query and links back into the catalog.

export type BlockNode =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'quote'; text: string }

export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string
  readingMinutes: number
  body: BlockNode[]
}

const HOW_TO_WRITE: BlogPost = {
  slug: 'how-to-write-a-fair-professor-review',
  title: 'How to write a fair professor review',
  description:
    'A short guide to writing professor reviews that help other students without turning into a personal attack.',
  publishedAt: '2026-07-31',
  readingMinutes: 4,
  body: [
    {
      type: 'p',
      text: 'Anonymous review platforms live or die on the quality of what students actually write. A page full of "worst teacher ever" is useless to the person deciding which section to enroll in. A page full of specific, calm observations is exactly what that person is looking for. Here is how to write one.',
    },
    { type: 'h2', text: 'Focus on the class, not the person' },
    {
      type: 'p',
      text: 'The other students reading this want to know what the class is like. They do not want to know whether you personally liked the professor as a human being. Every sentence you write should answer one of these questions:',
    },
    {
      type: 'ul',
      items: [
        'How is material actually explained in this class?',
        'How predictable is grading?',
        'Is attendance strict enough to affect planning?',
        'How much outside work does this course really need?',
        'Would you take another course from this professor knowing what you know now?',
      ],
    },
    { type: 'h2', text: 'Be specific' },
    {
      type: 'p',
      text: 'A review that says "grading was unfair" tells a future student nothing. A review that says "midterm was multiple-choice but the syllabus was fine, and 40% of the final grade came from an unannounced project we heard about in week 12" tells them everything.',
    },
    {
      type: 'p',
      text: 'Specifics are also what protect you. A vague accusation reads as spite. A specific observation reads as testimony.',
    },
    { type: 'h2', text: 'Separate your opinion from the facts' },
    {
      type: 'p',
      text: 'It is fine to say "I found the pace too fast", because that is your opinion, clearly marked. It is not fine to say "the pace is too fast" as if it were an objective claim about the class. The next student may be perfectly comfortable at that pace.',
    },
    { type: 'h2', text: 'Do not write about anyone but the professor' },
    {
      type: 'p',
      text: 'Never name other students, TAs, or classmates in a review. If a specific incident is important context, describe it in a way that identifies only the professor. If you cannot do that, the incident probably does not belong in a review. It belongs in a complaint to the department.',
    },
    { type: 'h2', text: 'Skip the personal stuff' },
    {
      type: 'p',
      text: 'Physical appearance, mannerisms, accent, dress, religious observance: none of that has any place in a review of a class. If a reader has to work to figure out whether your review is about teaching or about the professor as a person, you have written the wrong review.',
    },
    { type: 'h2', text: 'A useful review is short' },
    {
      type: 'p',
      text: 'Three or four honest sentences beat six paragraphs of frustration. The star ratings are already doing the heavy lifting. Your text is there to add the specifics the numbers cannot capture.',
    },
    {
      type: 'quote',
      text: 'The purpose is not to score-settle. The purpose is to spare the next student a surprise.',
    },
  ],
}

const ANONYMITY_EXPLAINED: BlogPost = {
  slug: 'how-anonymity-works-on-poray-kemon',
  title: 'How anonymity actually works on Poray Kemon',
  description:
    'A plain-language walkthrough of what happens to your identity when you write a review, and why even a full database dump cannot reveal who wrote what.',
  publishedAt: '2026-07-31',
  readingMinutes: 5,
  body: [
    {
      type: 'p',
      text: 'Saying "anonymous" is easy. Most platforms do. The question a careful student should ask is: what would an attacker with full access to the database actually see? On Poray Kemon, the answer is: nothing that could re-pair a review to its author. This post walks through why.',
    },
    { type: 'h2', text: 'What we know about you' },
    {
      type: 'p',
      text: 'You sign in with Google, and that is the only identity we ever touch. From that sign-in, we store two things: an opaque internal identifier that Google gives us, and the display name you chose to show. We do not store your email address. We do not store your profile photo. We do not track IP addresses.',
    },
    { type: 'h2', text: 'What happens when you submit a review' },
    {
      type: 'p',
      text: 'When you press submit, three separate things happen inside a single database transaction:',
    },
    {
      type: 'ul',
      items: [
        'A row is inserted into the reviews table. This row contains your ratings, the tags you picked, and your written text. Nothing else. There is no column on this row that names you or points to your account.',
        'A row is inserted into a completely separate table that tracks which account has reviewed which course. This table exists so you cannot review the same course twice. It holds no review content and no reference back to any specific review.',
        'The running average scores on that professor-course are updated.',
      ],
    },
    { type: 'h2', text: 'Why the two tables cannot be re-paired' },
    {
      type: 'p',
      text: 'A naive design would leak authorship in three different ways. We spent real time making sure ours does not:',
    },
    {
      type: 'ul',
      items: [
        'No foreign key. There is no column that joins the two tables. A single SQL query cannot line them up.',
        'Different identifier styles. The reviews table uses sequential ids. The submissions table uses random UUIDs. That prevents an attacker from lining them up by sorted id order.',
        'No submission timestamp. The submissions table does not store when the submission happened. That prevents matching by time. This one detail is easy to miss and matters a lot: without it, two rows written in the same transaction share the exact same server time and could be paired by anyone with access.',
      ],
    },
    { type: 'h2', text: 'What we cannot do (even if we wanted to)' },
    {
      type: 'p',
      text: 'Because there is no bridge between the two tables, there is no query we can run (nor any query someone with a stolen database dump can run) that would answer "who wrote this review?" This is not a policy commitment. It is a structural property of the schema.',
    },
    {
      type: 'p',
      text: 'The one thing this design does prevent: it prevents us from ever offering an "edit your reviews" feature. That is a tradeoff we made deliberately. Being unable to edit is the same property that makes the anonymity honest.',
    },
    { type: 'h2', text: 'Verifying this for yourself' },
    {
      type: 'p',
      text: 'The codebase will be open source once the initial launch settles. When that happens, anyone can inspect the schema, the migration history, and the review submission code and confirm the guarantee holds. Trust matters more when you can check it.',
    },
    {
      type: 'quote',
      text: 'The right question is not "do they promise anonymity?" The right question is "could they violate it if they wanted to?" Here, the answer is no.',
    },
  ],
}

const POSTS: BlogPost[] = [HOW_TO_WRITE, ANONYMITY_EXPLAINED]

export function getAllPosts(): BlogPost[] {
  return [...POSTS].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
}

export function getPost(slug: string): BlogPost | null {
  return POSTS.find((p) => p.slug === slug) ?? null
}

export function getAllSlugs(): string[] {
  return POSTS.map((p) => p.slug)
}
