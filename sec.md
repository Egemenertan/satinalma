# Security Q&A Checklist — Next.js Edition

Comprehensive security audit checklist tailored for Next.js (App Router / Pages Router) applications with common stacks: Supabase, Prisma, NextAuth, Stripe, Vercel, etc.

---

## 1. Information Disclosure

### 1.1 Error Handling
- [ ] Is `NODE_ENV=production` set in production?
- [ ] Do error pages (`error.tsx`, `not-found.tsx`) return generic messages (no stack traces)?
- [ ] Are API routes returning generic error responses (not raw Error objects)?
- [ ] Is `next.config.js` → `productionBrowserSourceMaps` set to `false`?
- [ ] Are server-side error details NOT leaking to client components?
- [ ] Is `console.log` / `console.error` NOT exposing sensitive data in production logs?

### 1.2 Sensitive File Exposure
- [ ] Is `.env` / `.env.local` in `.gitignore`?
- [ ] Is `.next/` directory NOT publicly accessible?
- [ ] Is `next.config.js` NOT exposing secrets via `env` or `publicRuntimeConfig`?
- [ ] Are only `NEXT_PUBLIC_*` prefixed vars exposed to the browser?
- [ ] Is `/api/health` or similar debug endpoints removed or protected?
- [ ] Is `package.json` NOT served publicly (Vercel handles this, self-hosted may not)?
- [ ] Are `.map` source files NOT deployed to production?

### 1.3 Build & Bundle Leaks
- [ ] Are server-only secrets NOT imported in client components?
- [ ] Is `server-only` package used to prevent accidental client imports?
- [ ] Are API keys NOT hardcoded in components (use `process.env` server-side)?
- [ ] Does the JS bundle NOT contain database URLs, API secrets, or private keys?
- [ ] Are internal API route paths NOT discoverable from client JS?

---

## 2. Authentication

### 2.1 Auth Provider Configuration (NextAuth / Auth.js / Supabase Auth / Clerk)
- [ ] Is `NEXTAUTH_SECRET` / auth secret strong and unique (min 32 chars)?
- [ ] Is `NEXTAUTH_URL` correctly set for production?
- [ ] Are OAuth callback URLs restricted to your domain only?
- [ ] Is CSRF protection enabled on auth endpoints?
- [ ] Are JWT tokens signed with a secure algorithm (RS256 or HS256 with strong secret)?
- [ ] Is token expiry set to a reasonable duration?
- [ ] Are refresh tokens rotated on use?

### 2.2 Login Security
- [ ] Is there rate limiting on `/api/auth/signin` or login endpoints?
- [ ] Is there brute-force protection (account lockout or progressive delays)?
- [ ] Are login error messages generic? (not "user not found" vs "wrong password")
- [ ] Is CAPTCHA/Turnstile enabled on login after failed attempts?
- [ ] Is credential-based login over HTTPS only?

### 2.3 Password Reset
- [ ] Does password reset return generic messages? ("If account exists, email sent")
- [ ] Is there rate limiting on reset requests?
- [ ] Are reset tokens single-use, time-limited (< 1 hour), and sufficiently random?
- [ ] Does password reset NOT enable user/email enumeration?

### 2.4 Registration
- [ ] Is email verification required before account activation?
- [ ] Is there rate limiting on registration?
- [ ] Is CAPTCHA enabled on registration?
- [ ] Can users NOT set their own role/permissions during signup?
- [ ] Are registration fields validated server-side (zod/yup schema)?
- [ ] Is mass assignment prevented? (only allow expected fields)

### 2.5 Session Management
- [ ] Are session cookies set with `httpOnly: true`?
- [ ] Are session cookies set with `secure: true`?
- [ ] Are session cookies set with `sameSite: 'lax'` or `'strict'`?
- [ ] Is session ID regenerated after login?
- [ ] Is session expiry configured (not infinite)?
- [ ] Are sessions invalidated on password change?
- [ ] Are sessions invalidated on logout (server-side, not just cookie deletion)?

---

## 3. Authorization & Access Control

### 3.1 Route Protection
- [ ] Are protected pages checking auth in `middleware.ts` (not just client-side)?
- [ ] Is `middleware.ts` matcher configured to cover all protected routes?
- [ ] Are API routes (`/api/*`) checking authentication before processing?
- [ ] Are Server Actions checking authentication before executing?
- [ ] Are admin routes protected with role-based middleware?
- [ ] Is there a centralized auth check (not scattered `if (!session)` in every file)?

### 3.2 Middleware Security
- [ ] Is `middleware.ts` running on all sensitive paths?
- [ ] Does middleware check both authentication AND authorization (role)?
- [ ] Is middleware NOT bypassable via direct API calls?
- [ ] Are static assets excluded from auth middleware (performance)?
- [ ] Is middleware using `NextResponse.redirect` (not just `NextResponse.next`)?

### 3.3 API Route Protection
- [ ] Do all API routes validate the session/token before processing?
- [ ] Are admin API routes checking for admin role?
- [ ] Are API routes using proper HTTP methods (not GET for mutations)?
- [ ] Is request body validated with schema (zod) before processing?
- [ ] Are responses filtered to only include authorized data?

### 3.4 Server Actions
- [ ] Do all Server Actions verify authentication?
- [ ] Do Server Actions validate input with zod/schema?
- [ ] Are Server Actions NOT exposing internal IDs or secrets in closures?
- [ ] Is `"use server"` directive only on files that should be server actions?
- [ ] Are Server Actions rate-limited for sensitive operations?

### 3.5 IDOR Prevention
- [ ] Are database queries scoped to the current user? (`WHERE userId = session.user.id`)
- [ ] Can users NOT access other users' data by changing IDs in URLs?
- [ ] Are UUIDs used instead of sequential IDs for public-facing resources?
- [ ] Is ownership verified before update/delete operations?

---

## 4. Input Validation & Injection

### 4.1 XSS Prevention
- [ ] Is React's default escaping relied upon (no `dangerouslySetInnerHTML`)?
- [ ] If `dangerouslySetInnerHTML` is used, is input sanitized (DOMPurify)?
- [ ] Is user input NOT directly interpolated into `<script>` tags?
- [ ] Is `Content-Security-Policy` header configured?
- [ ] Are URL parameters sanitized before rendering?
- [ ] Is Markdown content sanitized before rendering?
- [ ] Are SVG uploads sanitized (can contain inline scripts)?

### 4.2 SQL Injection
- [ ] Is Prisma/Drizzle ORM used with parameterized queries?
- [ ] Are raw SQL queries (`$queryRaw`, `$executeRaw`) using tagged templates?
- [ ] Is user input NEVER concatenated into SQL strings?
- [ ] Are database queries in Server Actions using parameterized input?
- [ ] Is Supabase client using `.eq()`, `.filter()` (not raw SQL via RPC)?

### 4.3 CSRF Protection
- [ ] Are Server Actions automatically CSRF-protected (Next.js default)?
- [ ] Are API routes checking `Origin` / `Referer` headers for mutations?
- [ ] Is `SameSite=Lax` or `Strict` set on auth cookies?
- [ ] Are external API consumers using API keys (not cookies)?
- [ ] Is CSRF token validated on custom form endpoints?

### 4.4 Server-Side Request Forgery (SSRF)
- [ ] Are user-provided URLs validated before server-side fetching?
- [ ] Are internal IP ranges blocked in URL fetches? (`127.0.0.1`, `10.*`, `172.16-31.*`, `169.254.*`)
- [ ] Are webhook URLs validated against allowlists?
- [ ] Is `next/image` remote patterns configured restrictively?
- [ ] Are redirect URLs validated (open redirect prevention)?

### 4.5 Path Traversal
- [ ] Are file paths constructed safely (no user input in `fs.readFile`)?
- [ ] Are dynamic route params validated before file system access?
- [ ] Is `..` blocked in file path construction?

---

## 5. File Upload Security

### 5.1 Upload Validation
- [ ] Are file types validated server-side (MIME type + magic bytes, not just extension)?
- [ ] Is file size limited server-side (`bodyParser: { sizeLimit }` or middleware)?
- [ ] Are filenames sanitized (random UUID, not user-supplied)?
- [ ] Are dangerous file types blocked (`.exe`, `.php`, `.sh`, `.svg` with scripts)?
- [ ] Is content-type header validated against actual file content?

### 5.2 Storage
- [ ] Are files uploaded to a separate storage service (S3, Supabase Storage, Cloudinary)?
- [ ] Are signed URLs used for private file access?
- [ ] Is direct file URL access restricted with proper bucket policies?
- [ ] Are upload presigned URLs scoped to specific file types and sizes?
- [ ] Is virus/malware scanning enabled on uploads?

---

## 6. API Security

### 6.1 Rate Limiting
- [ ] Is rate limiting implemented on API routes? (use `next-rate-limit`, Vercel WAF, or custom)
- [ ] Is rate limiting applied per-user/per-IP?
- [ ] Are authentication endpoints rate-limited (login, register, reset)?
- [ ] Are expensive operations rate-limited (search, export, email sending)?
- [ ] Is rate limit info returned in headers (`X-RateLimit-Remaining`)?

### 6.2 Input Validation
- [ ] Are all API inputs validated with zod/yup schemas?
- [ ] Are query parameters validated (not just body)?
- [ ] Are path parameters validated (dynamic route segments)?
- [ ] Is request body size limited?
- [ ] Are unexpected fields stripped from request body?

### 6.3 Response Security
- [ ] Are API responses NOT including sensitive fields (password hashes, internal IDs)?
- [ ] Is data serialization filtering out private fields? (use DTOs/select)
- [ ] Are error responses NOT leaking internal details?
- [ ] Is pagination enforced to prevent mass data extraction?
- [ ] Are list endpoints limited with `take`/`limit` parameter (max 100)?

### 6.4 Supabase-Specific
- [ ] Are Row Level Security (RLS) policies enabled on ALL tables?
- [ ] Can users only SELECT/UPDATE/DELETE their own rows?
- [ ] Can users NOT INSERT into role/permission tables?
- [ ] Is `auth.users` table NOT accessible via anon key?
- [ ] Are RPC functions checking `auth.uid()` for authorization?
- [ ] Is admin check done via database role (not `user_metadata`)?
- [ ] Is email confirmation required for signups?
- [ ] Are Supabase Storage bucket policies restrictive?
- [ ] Is the `service_role` key NEVER used on the client?
- [ ] Is the anon key restricted to minimum necessary permissions?

---

## 7. Security Headers

### 7.1 Next.js Headers Configuration (`next.config.js` or `middleware.ts`)
- [ ] `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] `Content-Security-Policy` with restrictive directives
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [ ] `X-DNS-Prefetch-Control: off` (if not needed)

### 7.2 CSP (Content Security Policy)
- [ ] Is `script-src` restrictive? (no `unsafe-inline` without nonce, no `unsafe-eval`)
- [ ] Is `style-src` restrictive?
- [ ] Is `img-src` restricted to known domains?
- [ ] Is `connect-src` restricted to your API and third-party services?
- [ ] Is `frame-ancestors` set to `'none'` or `'self'`?
- [ ] Are CSP nonces used for inline scripts (Next.js supports this)?

### 7.3 CORS
- [ ] Are API routes NOT returning `Access-Control-Allow-Origin: *` for authenticated endpoints?
- [ ] Is CORS configured per-route (not globally permissive)?
- [ ] Are credentials (`Access-Control-Allow-Credentials`) only allowed for trusted origins?

---

## 8. Environment & Configuration

### 8.1 Environment Variables
- [ ] Are all secrets in `.env.local` (not `.env` committed to git)?
- [ ] Is `.env*.local` in `.gitignore`?
- [ ] Are only `NEXT_PUBLIC_*` vars exposed to the client?
- [ ] Are production secrets managed via Vercel/platform env vars (not files)?
- [ ] Are secrets rotated periodically?
- [ ] Are different secrets used for development, staging, and production?

### 8.2 Next.js Configuration
- [ ] Is `poweredByHeader: false` set in `next.config.js`?
- [ ] Are `redirects` and `rewrites` NOT exposing internal services?
- [ ] Is `images.remotePatterns` configured restrictively (not `*`)?
- [ ] Are `experimental` features reviewed for security implications?
- [ ] Is `serverExternalPackages` properly configured?

### 8.3 Deployment (Vercel / Self-Hosted)
- [ ] Is HTTPS enforced?
- [ ] Is Vercel's DDoS protection / WAF enabled?
- [ ] Are preview deployments password-protected or restricted?
- [ ] Is the deployment region appropriate for data residency?
- [ ] Are build logs NOT exposing secrets?
- [ ] Is the `_next/` directory NOT exposing sensitive build artifacts?

---

## 9. Database Security

### 9.1 Connection Security
- [ ] Is the database connection using SSL/TLS?
- [ ] Is the database NOT publicly accessible (private network / VPC)?
- [ ] Are connection strings stored in environment variables (not code)?
- [ ] Is connection pooling configured (PgBouncer / Prisma Accelerate)?
- [ ] Is the database user using least-privilege (not superuser)?

### 9.2 Query Security
- [ ] Are all queries parameterized (no string concatenation)?
- [ ] Are Prisma `$queryRaw` / `$executeRaw` using `Prisma.sql` tagged template?
- [ ] Is `select` used to limit returned fields (not `SELECT *`)?
- [ ] Are cascading deletes properly configured?
- [ ] Are database migrations reviewed for security (no data exposure)?

### 9.3 Data Protection
- [ ] Are passwords hashed with bcrypt/argon2 (not MD5/SHA)?
- [ ] Are sensitive fields encrypted at rest (PII, payment data)?
- [ ] Is database backup encrypted?
- [ ] Are soft deletes used where data retention is required?
- [ ] Is PII data anonymized in non-production environments?

---

## 10. Business Logic

### 10.1 E-Commerce / Payments
- [ ] Is pricing calculated server-side only?
- [ ] Can quantity/price NOT be manipulated from client requests?
- [ ] Is Stripe/payment webhook signature verified?
- [ ] Are idempotency keys used for payment requests?
- [ ] Is the order amount validated before creating payment intent?
- [ ] Are refund amounts validated against original order?
- [ ] Is coupon validation done server-side with proper checks?

### 10.2 User Actions
- [ ] Is email change requiring password confirmation or re-verification?
- [ ] Is password change requiring current password?
- [ ] Is account deletion properly cleaning up all user data?
- [ ] Are destructive actions requiring confirmation (re-auth)?
- [ ] Are invite/share links scoped and time-limited?

### 10.3 Rate-Sensitive Operations
- [ ] Is email sending rate-limited?
- [ ] Is SMS/OTP sending rate-limited?
- [ ] Is file export rate-limited?
- [ ] Is search/autocomplete rate-limited?
- [ ] Are webhook deliveries rate-limited?

---

## 11. Third-Party Integrations

### 11.1 Client-Side SDKs
- [ ] Are Supabase/Firebase client keys restricted to minimum permissions?
- [ ] Are analytics scripts (PostHog, GA) NOT leaking PII?
- [ ] Are third-party scripts loaded with `async` / `defer`?
- [ ] Is Subresource Integrity (SRI) used for CDN scripts?
- [ ] Are third-party iframes sandboxed?

### 11.2 Server-Side Integrations
- [ ] Are webhook endpoints validating signatures (Stripe, GitHub, etc.)?
- [ ] Are API keys stored server-side only (not in client bundles)?
- [ ] Are third-party API responses validated before use?
- [ ] Are OAuth tokens stored securely (encrypted, not in localStorage)?
- [ ] Is the principle of least privilege applied to third-party API scopes?

---

## 12. Monitoring & Incident Response

### 12.1 Logging
- [ ] Are authentication events logged (login, logout, failed attempts)?
- [ ] Are authorization failures logged?
- [ ] Are sensitive data changes logged (role changes, email changes)?
- [ ] Are logs NOT containing sensitive data (passwords, tokens, PII)?
- [ ] Is log aggregation configured (Vercel Logs, Sentry, Axiom)?

### 12.2 Error Tracking
- [ ] Is Sentry or similar error tracking configured?
- [ ] Are error reports NOT including sensitive user data?
- [ ] Are source maps uploaded to Sentry (not served publicly)?
- [ ] Are alert rules configured for unusual error patterns?

### 12.3 Security Monitoring
- [ ] Is uptime monitoring configured?
- [ ] Are unusual traffic patterns detected (DDoS, scraping)?
- [ ] Is dependency vulnerability scanning enabled (Dependabot / Snyk)?
- [ ] Are npm audit warnings reviewed and addressed?
- [ ] Is there an incident response plan documented?

---

## Quick Reference: Next.js Specific Patterns

| Pattern | Risk | Fix |
|---------|------|-----|
| `"use client"` with server secrets | Secret exposure in bundle | Use `server-only` package |
| `dangerouslySetInnerHTML` | XSS | Use DOMPurify or avoid entirely |
| API route without auth check | Unauthorized access | Check session in every route |
| Server Action without auth | Unauthorized mutation | Verify `auth()` at top of action |
| `NEXT_PUBLIC_` for secrets | Client-side secret exposure | Remove prefix, use server-only |
| `fetch()` with user URL | SSRF | Validate URL against allowlist |
| `$queryRaw` with string concat | SQL injection | Use `Prisma.sql` tagged template |
| Missing `middleware.ts` matcher | Unprotected routes | Configure matcher for `/dashboard/*`, `/api/*` |
| `images.remotePatterns: [{ hostname: '*' }]` | Image proxy abuse | Restrict to known domains |
| Cookie without `httpOnly` | XSS cookie theft | Set `httpOnly: true` in cookie options |
| No rate limiting on `/api/*` | DoS, brute force | Add `next-rate-limit` or Vercel WAF |
| Supabase `service_role` on client | Full database access | Only use on server, use `anon` on client |

---

## Implementation Examples

### Middleware Auth Check
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session-token');
  
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/admin/:path*'],
};
```

### Secure API Route
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 });
  }

  // Scope query to current user (prevent IDOR)
  await db.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true }, // Don't return sensitive fields
  });

  return NextResponse.json({ success: true });
}
```

### Secure Server Action
```typescript
// app/actions/update-profile.ts
'use server';

import { auth } from '@/lib/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const schema = z.object({
  name: z.string().min(1).max(100),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const parsed = schema.safeParse({ name: formData.get('name') });
  if (!parsed.success) throw new Error('Invalid input');

  await db.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath('/dashboard/profile');
}
```

### Security Headers in next.config.js
```javascript
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

module.exports = {
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'your-cdn.com' },
    ],
  },
};
```
