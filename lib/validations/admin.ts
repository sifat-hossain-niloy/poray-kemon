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
  .extend({
    // Verify workflow: admin flips `unverified` → `verified` from the queue.
    // Downgrading (verified → unverified) is also permitted for the merge/undo
    // flow, but there's no UI for it today.
    status: z.enum(['verified', 'unverified']).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined && v !== ''), {
    message: 'At least one field is required',
  })

// Reviewer-submitted request to add a university that's not in the catalog.
// The admin queue turns approved rows into real `universities` records.
export const universityRequestCreateSchema = z.object({
  nameEn: z.string().trim().min(2).max(200),
  nameBn: z.string().trim().max(200).optional().or(z.literal('')),
  type: z.enum(['public', 'private', 'international']),
})

export const universityRequestResolveSchema = z.object({
  action: z.enum(['approve', 'reject']),
  admin_note: z.string().trim().max(500).optional(),
  // Optional overrides on approve — admin can polish the requester's input
  // before it becomes a canonical university row.
  short_name: z.string().trim().min(1).max(20).optional(),
  slug: slug.optional(),
  location_city: z.string().trim().max(100).optional().or(z.literal('')),
})

// Staff (admin_users) — role-restricted creation.
// Note that role='super_admin' is intentionally NOT accepted here — the DB
// partial unique index enforces "at most one" and the migration seeded the
// initial super_admin. Adding another via POST is impossible by design.
export const adminUserCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Letters, digits, dot, underscore, hyphen only'),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long (bcrypt cap)'),
  role: z.enum(['admin', 'moderator']),
})

// Self-service password change. Any authenticated staff row (super_admin,
// admin, moderator) can update their own password by proving they know the
// current one. Not gated by role.
export const adminPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password is too long (bcrypt cap)'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Confirmation does not match the new password',
    path: ['confirmNewPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  })

export type UniversityCreateInput = z.infer<typeof universityCreateSchema>
export type UniversityUpdateInput = z.infer<typeof universityUpdateSchema>
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>
export type UniversityRequestCreateInput = z.infer<typeof universityRequestCreateSchema>
export type UniversityRequestResolveInput = z.infer<typeof universityRequestResolveSchema>
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>
export type AdminPasswordChangeInput = z.infer<typeof adminPasswordChangeSchema>
