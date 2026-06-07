import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma Client instances in Next.js dev mode (hot reload creates new instances).
// In production a single instance is created and reused.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
