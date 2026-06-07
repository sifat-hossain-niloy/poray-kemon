import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Review submission schema
//
// We always require university_id + department_id + professor_name_en. The
// API does a find-or-create on (university_id, department_id, name_en) so a
// reviewer can submit for a brand-new professor without a separate flow.
//
// professor_id is accepted only as an optimisation hint — when the client
// already knows the existing record id (e.g. coming from a professor page),
// the lookup is skipped.
// ─────────────────────────────────────────────────────────────────────────────

export const reviewSubmitSchema = z
  .object({
    // Optional hint when reviewing an already-known professor
    professor_id: z.number().int().positive().optional(),

    // Otherwise these three identify the professor
    university_id: z.number().int().positive().optional(),
    department_id: z.number().int().positive().optional(),
    professor_name_en: z.string().trim().min(2).max(200).optional(),
    professor_name_bn: z.string().trim().max(200).optional().or(z.literal('')),

    // Course — code optional, name required
    course_code: z.string().trim().max(20).optional().or(z.literal('')),
    course_name: z.string().trim().min(2).max(200),

    // Ratings — all required
    teaching_quality: z.coerce.number().int().min(1).max(5),
    grading_fairness: z.coerce.number().int().min(1).max(5),
    course_difficulty: z.coerce.number().int().min(1).max(5),
    attendance_strictness: z.coerce.number().int().min(1).max(5),

    // Recommendation
    would_recommend: z.coerce.boolean(),

    // Optional free text — if provided must be 20–500 chars
    review_text: z
      .string()
      .trim()
      .max(500, 'রিভিউ সর্বোচ্চ ৫০০ অক্ষর হতে পারে')
      .optional()
      .or(z.literal('')),

    // Multi-select tags
    tags: z.array(z.string()).max(10).default([]),

    // Honeypot — must be empty. Bots fill this in.
    honeypot_field: z.string().max(0, 'Bot detected').default(''),
  })
  .refine(
    (data) =>
      typeof data.professor_id === 'number' ||
      (typeof data.university_id === 'number' &&
        typeof data.department_id === 'number' &&
        !!data.professor_name_en),
    {
      message:
        'Either professor_id, or (university_id + department_id + professor_name_en) is required',
      path: ['professor_id'],
    },
  )
  .refine(
    (data) => {
      const text = data.review_text?.trim()
      return !text || text.length >= 20
    },
    { message: 'রিভিউ কমপক্ষে ২০ অক্ষরের হতে হবে', path: ['review_text'] },
  )

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>

export const reportSchema = z.object({
  review_id: z.number().int().positive(),
  reason: z.enum(['personal', 'fake', 'offensive', 'wrong_professor', 'other']),
  details: z.string().trim().max(500).optional(),
})

export type ReportInput = z.infer<typeof reportSchema>
