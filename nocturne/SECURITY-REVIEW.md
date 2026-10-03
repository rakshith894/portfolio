# Security review — 3 October 2026

Changes in this review:

- Published content comes from versioned JSON files. Browser-local profile, skill and project drafts no longer override the shared portfolio.
- Removed the client-side admin passcode, URL bypass and browser-storage unlock. Editors are available only in development; local endpoints retain loopback/origin validation. This is local editing, not hosted administration.
- Failed content saves report errors rather than pretending a browser-only update was published.
- The Vercel chat function shares the application handler: same-origin requests, JSON and message-size limits, allowed message roles, server-owned portfolio facts, bounded provider timeout, and validated action responses. Removed wildcard CORS and unvalidated model actions.
- Vercel responses include `nosniff`, same-origin framing and a restrictive referrer policy.
- The repository credential scan passed. This source/dependency review is not a penetration test or a claim that all possible vulnerabilities have been eliminated.

## Remaining upstream advisory

`npm audit` reports nine high-severity dependency entries, all tracing to `braces <=3.0.3` through shadcn and vinext build-tool dependencies. npm's latest `braces` release is 3.0.3 and the [upstream advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched version as of this review. The issue concerns stack exhaustion while parsing deeply nested brace patterns.

The reviewed application does not pass visitor input into these glob parsers. Keep the development server on loopback and build only trusted source. The audit's proposed shadcn/vinext downgrades were not applied because they replace the framework with older incompatible releases rather than patching the parser. Recheck the advisory and update the lockfile when a compatible fix is released. No clean dependency-audit result is claimed.

The public AI endpoint depends on hosting/provider quotas for distributed abuse protection; in-process limits would not provide a reliable deployment-wide quota.
