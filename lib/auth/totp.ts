import * as OTPAuth from "otpauth";

const ISSUER = "Headroom";
const DIGITS = 6;
const PERIOD = 30;
/** Tolerance either side of the current 30s step, to absorb clock drift between server and phone. */
const VALIDATION_WINDOW = 1;

function totpFor(secret: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** A fresh base32 TOTP secret — 20 random bytes, the size every major authenticator app expects. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

/** The `otpauth://` URI an authenticator app's QR scanner (or manual entry) expects. */
export function totpProvisioningUri(secret: string, accountLabel: string): string {
  return totpFor(secret, accountLabel).toString();
}

export type VerifyTotpOptions = {
  /** Overrides the clock for testing. Defaults to the real current time. */
  timestamp?: number;
};

/** Whether `code` is valid for `secret` at (or within one 30s step of) the given time. */
export function verifyTotpCode(secret: string, code: string, options?: VerifyTotpOptions): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const delta = totpFor(secret, "").validate({
    token: code,
    window: VALIDATION_WINDOW,
    timestamp: options?.timestamp,
  });
  return delta !== null;
}
