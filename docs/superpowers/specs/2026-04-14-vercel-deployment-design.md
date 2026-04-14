# Deploy Trip Planner to Vercel

## Context

The trip planner app currently runs only locally. The goal is to make it accessible from anywhere (including mobile devices) by deploying to Vercel. Since this is a personal app shared with a few people, we need security hardening before going public, an access control mechanism, and verification that the mobile experience works well.

## Decision: Vercel

Chosen over Google Cloud Run and GCP Compute Engine because:
- Zero-config Next.js hosting (built by the same team)
- Free tier covers personal use (100GB bandwidth, serverless functions)
- Automatic HTTPS + CDN
- Git-push deploys
- Neon (existing DB) is a Vercel partner with native integration

## Scope

Four workstreams, executed in order:

### 1. Security Hardening

**1a. BYPASS_AUTH production guard**
- File: `src/lib/auth.ts` (line 12)
- Change: `process.env.BYPASS_AUTH === "true"` → add `&& process.env.NODE_ENV !== "production"` guard
- Why: BYPASS_AUTH skips Google OAuth entirely, using the first DB user. Must never activate in production even if the env var is accidentally set.

**1b. NextAuth debug mode**
- File: `src/lib/auth.ts` (line 31)
- Change: `debug: true` → `debug: process.env.NODE_ENV === "development"`
- Why: Debug mode logs sensitive auth information to server console.

**1c. Security headers**
- File: `next.config.ts`
- Add `headers()` config returning security headers for all routes:
  - `X-Frame-Options: DENY` — prevent clickjacking
  - `X-Content-Type-Options: nosniff` — prevent MIME sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=()` — restrict browser APIs (geolocation left open for potential future "nearby" features)
  - `X-DNS-Prefetch-Control: on` — performance
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains` — force HTTPS (omit `preload` — requires domain submission to hstspreload.org, not possible on `.vercel.app`)

**1d. Rate limiting on AI routes**
- Files: `src/app/api/ai/chat/route.ts`, `src/app/api/ai/chat/execute/route.ts`
- Approach: Simple in-memory sliding window rate limiter
- Limit: ~20 requests per minute per user on AI chat endpoints
- Implementation: Small utility in `src/lib/rate-limit.ts` using a Map with timestamps, cleaned up periodically
- Caveat: On Vercel serverless, in-memory state is not shared across function instances and resets on cold starts. This provides best-effort protection, not a hard guarantee. Acceptable for a whitelisted personal app — the whitelist itself is the primary cost control. Can upgrade to Upstash Redis later if needed.
- Why: AI/Gemini calls are the most expensive operations. Even with whitelisted users, prevents accidental abuse.

### 2. Access Control (Email Whitelist)

**2a. ALLOWED_EMAILS environment variable**
- New env var: `ALLOWED_EMAILS` — comma-separated list of Google email addresses
- Example: `ALLOWED_EMAILS=shahar@gmail.com,friend@gmail.com`
- If not set (local dev), all Google accounts are allowed — preserves dev experience

**2b. NextAuth signIn callback**
- File: `src/lib/auth.ts`
- Add `signIn` callback to `authOptions.callbacks`:
  ```
  signIn({ user }) → check user.email against ALLOWED_EMAILS list
  Return true if allowed, false if not
  ```
- Existing users not on the whitelist will be rejected at next login

**2c. Unauthorized error page**
- File: `src/app/auth/error/page.tsx` (new)
- Simple Hebrew page explaining the user is not authorized, with a "try again" link
- NextAuth automatically redirects to `/auth/error?error=AccessDenied` on signIn rejection

### 3. Vercel Deployment Setup

**3a. Prisma adapter switch**
- File: `src/lib/prisma.ts`
- Change: Replace `@prisma/adapter-pg` + `pg.Pool` with `@prisma/adapter-neon` + `@neondatabase/serverless`
- Both packages already in dependencies — just need to swap the imports and adapter creation
- New code uses `neon()` WebSocket driver from `@neondatabase/serverless`, wrapped with `PrismaNeon` adapter
- Why: `pg.Pool` uses TCP connections that don't work in Vercel's serverless environment. Neon's driver uses WebSockets.

**3a-ii. Prisma generate in Vercel build**
- File: `package.json`
- Add `"postinstall": "prisma generate"` script so `prisma generate` runs automatically on Vercel after `npm install`
- Why: The generated Prisma client (`src/generated/prisma`) is gitignored. Without this, the Vercel build will fail because the client code won't exist.
- Verify: Confirm `npx prisma generate` works without a `url` field in the datasource block (Prisma 7 with driver adapters should handle this). If it fails, add `url = env("DATABASE_URL")` to the datasource block in `prisma/schema.prisma`.

**3b. Viewport export in layout**
- File: `src/app/layout.tsx`
- Add Next.js `viewport` export:
  ```ts
  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
  }
  ```
- Why: Without this, mobile browsers may not scale the page correctly.

**3c. Environment variables configuration** (manual step)
- Set in Vercel dashboard (not in code):
  - `DATABASE_URL` — Neon pooled connection string
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth credentials
  - `NEXTAUTH_SECRET` — generate a new random secret for production
  - `NEXTAUTH_URL` — Vercel app URL (e.g., `https://trip-planner-xxx.vercel.app`)
  - `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_CLIENT_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY`
  - `GEMINI_API_KEY`
  - `TRIPADVISOR_API_KEY`
  - `ALLOWED_EMAILS` — comma-separated authorized emails
  - Do NOT set `BYPASS_AUTH`

**3d. Google OAuth redirect URI** (manual step)
- In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
- Add authorized redirect URI: `https://<your-vercel-domain>/api/auth/callback/google`
- Add authorized JavaScript origin: `https://<your-vercel-domain>`

**3e. Google Maps API key restrictions** (manual step)
- In Google Cloud Console → APIs & Services → Credentials
- Restrict the client-side Maps key (`GOOGLE_MAPS_CLIENT_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_CLIENT_KEY`) to your Vercel domain
- This prevents abuse of the exposed client key

### 4. Mobile Polish

**4a. Viewport meta** — covered in 3b above.

**4b. Visual mobile audit** — After deployment, test these flows on mobile viewport:
- Trip list page
- Trip dashboard with tab navigation
- Schedule view (already uses `flex-col` → `lg:flex-row-reverse`)
- AI chat drawer (already uses `lg:hidden` toggle)
- Forms (create trip, add items)

The app already uses mobile-first Tailwind patterns (`flex-col`, `sm:grid-cols-2`, `lg:` breakpoints, `overflow-x-auto`). No major layout changes expected, but the audit may surface small issues.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/auth.ts` | BYPASS_AUTH guard, debug conditional, signIn callback for email whitelist |
| `src/lib/prisma.ts` | Switch to Neon adapter |
| `package.json` | Add `postinstall` script for `prisma generate` |
| `src/lib/rate-limit.ts` | New — simple in-memory rate limiter |
| `src/app/api/ai/chat/route.ts` | Add rate limiting |
| `src/app/api/ai/chat/execute/route.ts` | Add rate limiting |
| `next.config.ts` | Security headers |
| `src/app/layout.tsx` | Viewport export |
| `src/app/auth/error/page.tsx` | New — unauthorized access page |
| `.env.example` | Add `ALLOWED_EMAILS` |

## Out of Scope

- PWA / service worker (nice-to-have for later)
- Input validation with Zod (existing validation is adequate for whitelisted users)
- Custom domain (can add later via Vercel dashboard)
- CI/CD pipeline (Vercel handles this automatically on git push)

## Verification

1. **Local:** `npm run build` succeeds with all changes
2. **Local:** Run dev server, confirm auth still works with `BYPASS_AUTH=true` in development
3. **Local:** Confirm auth is NOT bypassed when `NODE_ENV=production` (can test with `npm run build && npm start`)
4. **Deploy:** Push to GitHub, connect repo in Vercel, set env vars
5. **Production:** Verify Google OAuth login works with authorized email
6. **Production:** Verify unauthorized email is rejected with error page
7. **Production:** Test AI chat rate limiting (rapid requests get 429)
8. **Production:** Check security headers via browser DevTools → Network → Response Headers
9. **Mobile:** Open on phone, test trip list → dashboard → schedule → chat flows
