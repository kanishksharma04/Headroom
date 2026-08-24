import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { authConfig } from "@/lib/auth.config";
import { findUserByEmail } from "@/lib/repositories/user-repository";
import { verifyTwoFactorCode } from "@/lib/services/auth-service";
import { clearLoginAttempts } from "@/lib/services/login-rate-limit-service";
import { signInSchema } from "@/lib/validation/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
        code: { label: "Code" },
      },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) {
          return null;
        }

        const user = await findUserByEmail(parsed.data.email);
        if (!user) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        if (user.totpEnabled) {
          if (!parsed.data.code || !(await verifyTwoFactorCode(user, parsed.data.code))) {
            return null;
          }
        }

        // Past failed attempts shouldn't count against future legitimate
        // access. Done here, not in the calling Server Action, since a
        // successful signIn() redirects internally — this is the one place
        // guaranteed to run to completion first.
        await clearLoginAttempts(user.email);

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
