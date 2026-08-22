"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { findUserByEmail } from "@/lib/repositories/user-repository";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";
import { EmailAlreadyRegisteredError, registerUser } from "@/lib/services/auth-service";

export type AuthFormState = { error?: string; needsTotp?: boolean };

export async function signInAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Whether this account has 2FA turned on is checked by email alone, with
  // no password verification — that check happens for real inside
  // authorize() either way, so there's no reason to pay bcrypt's cost
  // twice on every ordinary sign-in. A wrong password on a 2FA account
  // still surfaces, just one step later than on a non-2FA account — never
  // silently, and the final error message doesn't say which of email,
  // password, or code was wrong.
  if (!parsed.data.code) {
    const user = await findUserByEmail(parsed.data.email);
    if (user?.totpEnabled) {
      return { needsTotp: true };
    }
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      code: parsed.data.code,
      redirectTo: "/today",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return parsed.data.code
        ? { needsTotp: true, error: "Incorrect email, password, or code." }
        : { error: "Incorrect email or password." };
    }
    throw error;
  }

  return {};
}

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await registerUser(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { error: error.message };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created. Sign in to continue." };
    }
    throw error;
  }

  return {};
}
