import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Admin entity schemas — universities + departments.
// Slug constraints mirror what we generate elsewhere: lowercase ASCII,
// digits, and hyphens only.
// ─────────────────────────────────────────────────────────────────────────────

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slug = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(slugRegex, 'Slug must be lowercase ASCII letters/digits separated by single hyphens')

export const universityCreateSchema = z.object({
  nameEn: z.string().trim().min(2).max(200),
  nameBn: z.string().trim().max(200).optional().or(z.literal('')),
  shortName: z.string().trim().min(1).max(20),
  slug,
  locationCity: z.string().trim().max(100).optional().or(z.literal('')),
  type: z.enum(['public', 'private', 'international']),
  websiteUrl: z.string().trim().url().max(255).optional().or(z.literal('')),
})

export const universityUpdateSchema = universityCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined && v !== ''), {
    message: 'At least one field is required',
  })

export const departmentCreateSchema = z.object({
  nameEn: z.string().trim().min(2).max(200),
  nameBn: z.string().trim().max(200).optional().or(z.literal('')),
  shortName: z.string().trim().min(1).max(20).optional().or(z.literal('')),
  slug: slug.optional().or(z.literal('')),
})

export const departmentUpdateSchema = departmentCreateSchema
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined && v !== ''), {
    message: 'At least one field is required',
  })

export type UniversityCreateInput = z.infer<typeof universityCreateSchema>
export type UniversityUpdateInput = z.infer<typeof universityUpdateSchema>
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>
