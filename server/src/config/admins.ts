// Emails granted the ADMIN role automatically on first SSO sign-in.
// Configure via the ADMIN_EMAILS env var (comma-separated).
// Read lazily because dotenv.config() runs after modules are imported.
export const getAdminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
