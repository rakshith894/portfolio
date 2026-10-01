# Security

The portfolio uses no Google API key. Its narration uses the browser's speech
engine; dictation may use the browser's remote speech service. AI text requests
use Groq with GROQ_API_KEY held only in server-side secrets. Never add private
API keys to client components, public assets or content JSON. The chat endpoint
uses published server-side facts and an allowlist of portfolio actions; model
output is never executable code. Requests and provider responses are validated,
and provider failures do not expose raw upstream messages or credentials.

Profile, skills, project and image writes are development-only, restricted to
loopback and same-origin JSON requests. They are not deployed in the Worker.

Run `npm run security:scan` from `nocturne` before publishing. This scans tracked
files, including binary files, without printing matching secret values. CI also
checks dependencies, types, lint, tests and the production build.

GitHub secret alert 1 refers to browser test cache files in the initial commit,
not application source. Deleting files in a later commit does not remove the
earlier exposure. A clean history must omit the entire `output/` directory.
Rewriting a published branch requires coordination, and cached GitHub references
may need removal through GitHub Support. If the flagged key belongs to an account
you control, revoke or rotate it at its provider; history cleanup alone cannot
invalidate an exposed key. Keep the alert open until its ownership and remediation
are verified.
