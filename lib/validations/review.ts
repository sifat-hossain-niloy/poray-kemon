import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Review submission schema
//
// Identifying the (uni, dept, professor) triple is hierarchical. Each layer
// can be passed in by id (already known) or by name (auto-create on the
// server). The handler runs three find-or-create steps in order:
//
//   1. department — needs university_id + (department_id OR department_name_en)
//   2. professor  — needs university_id + dept (from step 1) + (professor_id OR professor_name_en)
//   3. course     — needs dept (from step 1) + course_name
//
// Auto-created departments are stored with status='unverified' and surface
// in the admin merge tool. Auto-created professors stay status='unverified'
// (existing behaviour).
//
// professor_id and department_id are optimisation hints — when the client
// already knows the record (e.g. coming from a professor page), the lookups
// are skipped.
// ─────────────────────────────────────────────────────────────────────────────

export const reviewSubmitSchema = z
  .object({
    // Optional hint when reviewing an already-known professor
    professor_id: z.number().int().positive().optional(),

    // Otherwise these identify the professor
    university_id: z.number().int().positive().optional(),
    department_id: z.number().int().positive().optional(),
    // Free-text department name. Server parses "CSE - Computer Science and
    // Engineering" into shortName + nameEn at insert time, UNLESS
    // department_short_name is provided too — then we trust the explicit
    // split from the typeahead's add-new micro-form and skip parsing.
    department_name_en: z.string().trim().min(2).max(200).optional(),
    department_short_name: z.string().trim().max(20).optional(),
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
    (data) => {
      // Path A: professor_id alone is enough (their uni/dept are looked up server-side).
      if (typeof data.professor_id === 'number') return true
      // Path B: we need university_id, some way to identify the department,
      // and a professor name.
      const hasUni = typeof data.university_id === 'number'
      const hasDept = typeof data.department_id === 'number' || !!data.department_name_en
      const hasProf = !!data.professor_name_en
      return hasUni && hasDept && hasProf
    },
    {
      message:
        'Either professor_id, or (university_id + (department_id|department_name_en) + professor_name_en) is required',
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
