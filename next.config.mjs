/** @type {import('next').NextConfig} */
// CSP mirrors the interview coach's lockdown, scoped to what this app touches:
//  - connect-src api.anthropic.com: the BYOK browser path posts the user's own
//    key straight to Anthropic (the key never hits our server).
//  - worker-src 'self' blob:: pdfjs runs its PDF-parsing worker from a blob.
// Phase 2 (auth/paywall/analytics) will widen this to supabase.co, posthog, and
// challenges.cloudflare.com — same as the coach.
const csp = [
  "default-src 'self'",
  "connect-src 'self' https://api.anthropic.com https://us.i.posthog.com https://us-assets.i.posthog.com",
  "img-src 'self' data: https://us.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us-assets.i.posthog.com",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
