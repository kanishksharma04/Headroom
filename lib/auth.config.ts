import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/today", "/ahead", "/worth", "/decide", "/records"];
const AUTH_PAGE_PREFIXES = ["/sign-in", "/sign-up"];

/**
 * Edge-safe config used directly by middleware. Kept free of the Credentials
 * provider (and therefore bcrypt/Prisma), which cannot run on the Edge runtime.
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
      const isAuthPage = AUTH_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

      if (isProtected && !isLoggedIn) {
        return false;
      }
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/today", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
