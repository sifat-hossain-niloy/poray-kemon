// ─────────────────────────────────────────────────────────────────────────────
// Staff audit trail.
//
// Every state-changing admin endpoint records one row: who (staff id +
// username snapshot), what (action), on which row (target), and a small
// details blob. Writes go through the caller's transaction when there is
// one, so an action and its audit entry commit or roll back together.
//
// Privacy: details must never contain end-user identifiers (users.id,
// google ids, email domains). Staff act on reviews, reports and catalog
// rows — those ids are what belong here.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { AdminSession } from '@/lib/admin-auth'

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.password_change',
  'review.approve',
  'review.hide',
  'review.delete',
  'report.keep',
  'report.remove',
  'professor.update',
  'department.update',
  'department.create',
  'department.merge',
  'university.create',
  'university.update',
  'university_request.approve',
  'university_request.reject',
  'staff.create',
  'staff.delete',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_TARGET_TYPES = [
  'admin_user',
  'review',
  'report',
  'professor',
  'department',
  'university',
  'university_request',
] as const
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number]

type Client = Prisma.TransactionClient | typeof db

export interface AuditEntry {
  action: AuditAction
  targetType: AuditTargetType
  targetId: number | string
  details?: Prisma.InputJsonObject
}

/** The verb group an action belongs to, for the audit page's filter tabs. */
export function auditCategory(action: AuditAction): string {
  return action.slice(0, action.indexOf('.'))
}

export async function recordAudit(
  client: Client,
  session: AdminSession,
  entry: AuditEntry,
): Promise<void> {
  const admin = await client.adminUser.findUnique({
    where: { id: session.adminId },
    select: { username: true },
  })
  await client.adminAuditLog.create({
    data: {
      adminId: admin ? session.adminId : null,
      adminUsername: admin?.username ?? `#${session.adminId}`,
      action: entry.action,
      targetType: entry.targetType,
      targetId: String(entry.targetId),
      details: entry.details,
    },
  })
}
