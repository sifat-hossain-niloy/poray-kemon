import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { db } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        // Extract only sub (Google unique ID) and name.
        // Deliberately drop email and picture — reduces PII footprint.
        return {
          id: profile.sub,
          name: profile.name as string,
          email: undefined, // Never stored
          image: undefined, // Never stored
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      if (!user.id) return false

      // Upsert user — create if new, update last_active if returning
      await db.user.upsert({
        where: { googleId: user.id },
        create: {
          googleId: user.id,
          displayName: user.name ?? null,
        },
        update: {
          lastActive: new Date(),
          // Never update displayName after first login — reduces unnecessary writes
        },
      })

      return true
    },

    async session({ session, token }) {
      if (token.sub) {
        // Attach our internal UUID to the session (not the Google sub)
        const dbUser = await db.user.findUnique({
          where: { googleId: token.sub },
          select: { id: true, displayName: true },
        })

        if (dbUser) {
          session.user.id = dbUser.id
          session.user.name = dbUser.displayName ?? undefined
          // Never attach email or image to session
          session.user.email = undefined as unknown as string
          session.user.image = undefined as unknown as string | null
        }
      }
      return session
    },

    async jwt({ token, profile }) {
      // Store Google sub in JWT for the session callback above
      if (profile) {
        token.sub = profile.sub
      }
      return token
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
