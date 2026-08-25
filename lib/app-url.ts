/** The deployment's own base URL, for links inside emails and push notifications. */
export function resolveAppUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
