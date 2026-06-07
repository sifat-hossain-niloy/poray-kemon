import { z } from 'zod'

export const reviewSubmitSchema = z.object({
  professor_id: z.number().int().positive(),

  course_code: z.string().trim().max(20).optional(),
  course_name: z.string().trim().min(2).max(200).optional(),

  teaching_quality: z.number().int().min(1).max(5),
  grading_fairness: z.number().int().min(1).max(5),
  course_difficulty: z.number().int().min(1).max(5),
  attendance_strictness: z.number().int().min(1).max(5),

  would_recommend: z.boolean(),

  review_text: z
    .string()
    .trim()
    .min(20, 'রিভিউ কমপক্ষে ২০ অক্ষরের হতে হবে')
    .max(500, 'রিভিউ সর্বোচ্চ ৫০০ অক্ষর হতে পারে')
    .optional()
    .or(z.literal('')),

  tags: z.array(z.string()).max(10).default([]),

  // Honeypot — must be empty. Bots fill this in.
  honeypot_field: z.string().max(0, 'Bot detected').default(''),
})

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>

export const reportSchema = z.object({
  review_id: z.number().int().positive(),
  reason: z.enum(['personal', 'fake', 'offensive', 'wrong_professor', 'other']),
  details: z.string().trim().max(500).optional(),
})

export type ReportInput = z.infer<typeof reportSchema>
