import NextAuth, { type DefaultSession } from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// NextAuth v5 — Google OAuth only, JWT strategy, NO adapter.
//
// We deliberately do not use a Prisma adapter because:
//   - The default adapter wants an `email` column on `users` — we refuse to
//     store email (SRS NFR-PRIV-05).
//   - Sessions in DB would also need a sessions table we don't want.
//
// JWT strategy implication: `user.id` inside callbacks is a NextAuth-generated
// UUID, NOT the Google `sub`. To key our `users.google_id` reliably across
// sessions we must capture the real Google sub from `account.providerAccountId`
// (or `profile.sub` as a fallback) and store IT — not `user.id`.
//
// The session.user.id we expose to the app is the internal `users.id` UUID
// from our DB; never the Google sub, never the JWT token.sub.
// ─────────────────────────────────────────────────────────────────────────────

// Augment the session type so `session.user.id` is typed everywhere.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

// The JWT type's augmentation point lives in @auth/core in v5. We don't need
// a typed token elsewhere — we read/write googleSub & internalUserId locally
// in the callbacks below via narrow casts.
type PkToken = {
  googleSub?: string
  internalUserId?: string
  [key: string]: unknown
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        // We deliberately drop email and picture — reduces PII footprint.
        // `id` here flows into the JWT user object but is NOT what we key on;
        // we capture the Google `sub` from the `account` object in the
        // signIn / jwt callbacks instead.
        return {
          id: profile.sub,
          name: profile.name as string,
          email: '', // string (not undefined) — keeps Auth.js happy without storing it anywhere
          image: null,
        }
      },
    }),
  ],

  callbacks: {
    /**
     * Authorisation gate + first-touch upsert. `account.providerAccountId`
     * is the canonical Google `sub`; `user.id` may be a NextAuth-generated
     * UUID and is unsafe to key on.
     */
    async signIn({ account, profile, user }) {
      const googleSub =
        account?.provider === 'google' && account.providerAccountId
          ? account.providerAccountId
          : (profile?.sub as string | undefined)

      if (!googleSub) return false

      await db.user.upsert({
        where: { googleId: googleSub },
        create: {
          googleId: googleSub,
          displayName: user?.name ?? null,
        },
        update: {
          lastActive: new Date(),
          // Never update displayName after first login — reduces churn
        },
      })

      return true
    },

    /**
     * Runs on every request (with the cookie JWT) plus initial sign-in.
     * On initial sign-in we have `account` + `profile` — capture the Google
     * sub then. On subsequent calls we already have `token.googleSub` from
     * the prior pass; just preserve it.
     */
    async jwt({ token, account, profile }) {
      const t = token as PkToken
      if (account?.provider === 'google' && account.providerAccountId) {
        t.googleSub = account.providerAccountId
      } else if (profile?.sub) {
        t.googleSub = profile.sub as string
      }
      // internalUserId is filled lazily by the session callback below so we
      // only hit the DB when we actually need the row.
      return token
    },

    async session({ session, token }) {
      const t = token as PkToken
      const googleSub = t.googleSub
      if (!googleSub) return session

      let internalId = t.internalUserId
      if (!internalId) {
        const dbUser = await db.user.findUnique({
          where: { googleId: googleSub },
          select: { id: true, displayName: true },
        })
        if (dbUser) {
          internalId = dbUser.id
          t.internalUserId = dbUser.id
          if (dbUser.displayName) session.user.name = dbUser.displayName
        }
      }

      if (internalId) {
        session.user.id = internalId
        // Keep email/image empty without violating the augmented Session type
        ;(session.user as { email?: string }).email = ''
        ;(session.user as { image?: string | null }).image = null
      }
      return session
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
})
