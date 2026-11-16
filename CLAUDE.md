@AGENTS.md

# HMS Admin (hospital-admin)

Platform-admin (support team) panel for the HMS SaaS. Its one job: review hospital
**subscription payment requests** — view the payment proof, then approve (activates the
subscription's portals) or reject (with a reason the hospital admin sees).

## Stack

- Next.js **16.4.5** App Router, Turbopack, React 19.3 — read `node_modules/next/dist/docs/` before
  using any Next API; this version differs from older training data.
- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, `experimental.agentFeedback`.
  Because of Cache Components, any client component using `useParams`/`usePathname` is wrapped in
  `<Suspense>` (see `AdminShell.jsx` and `app/subscriptions/[id]/page.jsx`) — keep that pattern.
- Tailwind CSS v4 via the `@tailwindcss/turbopack` loader (configured in `next.config.ts`, no
  PostCSS config). Arbitrary spacing like `min-w-105`, `max-h-120`, `flex-2` is valid in v4.
- `react-hot-toast` for notifications (`<Toaster>` lives in `AdminShell`).
- Pages/components are plain `.jsx`; only `app/layout.tsx`, `app/page.tsx` and config are TS.

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint     # eslint (next core-web-vitals + typescript)
npx tsc --noEmit
```

There are no tests. Verify changes with lint + build and by loading the pages in a browser.

## Frontend structure

| Path | Role |
|---|---|
| `app/page.tsx` | Redirects `/` → `/subscriptions` |
| `app/subscriptions/layout.jsx` | Wraps pages in `AdminShell` (sidebar + toaster) |
| `app/subscriptions/page.jsx` | List of payment requests: tabs (All / Queue=pending / Approved), search, link to detail |
| `app/subscriptions/[id]/page.jsx` | Detail: contact, selected portals, proof image, summary, history, Approve / Reject modal |
| `components/subscriptions/AdminLogin.jsx` | Sign-in form shown when no/invalid token |
| `components/subscriptions/StatusPill.jsx` | Status badge (pending / approved / rejected) |
| `lib/adminApi.js` | **All** backend calls go through here |
| `lib/subscriptionsData.js` | Old mock data — unused, safe to delete |

Both pages are client components (`"use client"`). They start in `loading` state so the
prerendered HTML matches the first client render; never read `localStorage` during the initial
render outside of that pattern.

## Backend

The API is the Express + MySQL app in the sibling repo **`../hospital-care-api`** (not
`HMS-api`). Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5050/api`). CORS is
`*`. Responses are `{ success, message, data }`; `adminApi.request()` unwraps `data` and throws
`Error(body.message)` on non-2xx.

### Auth flow

1. `POST /users/login` `{ email, password }` → `data.token` (JWT with `sub` + `hospital_id`).
2. Token stored in `localStorage` under `hms_platform_admin_token`, sent as `Authorization: Bearer`.
3. Right after login the app calls `GET /subscriptionPayment/admin/all` as a probe; a 403 means the
   user is not a platform admin, so the token is cleared and the error shown.
4. "Platform admin" = row in `platform_admins` with `is_active = 1`. Platform admins need no hospital
   context; the `/api` middlewares `hospitalOwnerOnly`, `memberPortalAccess` and
   `portalSubscriptionAccess` explicitly let them through on `/subscriptionPayment/admin/*`,
   `/proof/*`, `/approve/*`, `/reject/*`.

### Endpoints used (`modules/subscription/subscriptionPayments/` in the API)

| Function in `lib/adminApi.js` | Request | Notes |
|---|---|---|
| `getPaymentRequests` | `GET /subscriptionPayment/admin/all` | Pending first, then newest. Includes `hospital_name`, `requester_name/email`, `portal_names` (comma-joined) |
| `getPaymentRequest(id)` | `GET /subscriptionPayment/admin/get/:id` | Adds `portals[]` (`portal_id`, `portal_name`, `billing_days`, `total`) |
| `approvePaymentRequest(id)` | `PUT /subscriptionPayment/approve/:id` | Fails 409 if not pending, subscription not `PENDING_PAYMENT`, or amount ≠ subscription total. Sets subscription `ACTIVE`, `paid_at`, `verified_at` |
| `rejectPaymentRequest(id, reason)` | `PUT /subscriptionPayment/reject/:id` `{ reason }` | Reason required, ≤ 500 chars |
| `getPaymentProof(proof_url)` | `GET /subscriptionPayment/proof/:filename` | Auth-protected file; fetched as a blob and shown via an object URL (revoked on cleanup). `proof_url` is an absolute URL built from the API's `PUBLIC_API_URL` |

Payment row fields used by the UI: `id`, `status` (`PENDING` | `APPROVED` | `REJECTED`, uppercase —
the UI lowercases for display), `amount`, `payment_method` (`JAZZCASH` | `EASYPAISA` |
`BANK_TRANSFER`), `transaction_reference`, `whatsapp_number`, `proof_url`, `rejection_reason`,
`created_at`, `verified_at`, `paid_at`. Request IDs are displayed as `PAY-{id}`.

Hospitals submit these payments from `../hospital-care-frontend` (`POST /subscriptionPayment/proof`
then `/create`); amounts are calculated server-side from the portal catalogue.

## Local end-to-end setup

1. Start the API in `../hospital-care-api` (port 5050, needs its MySQL DB).
2. Make sure your user has an active row in `platform_admins` and a verified email.
3. `npm run dev` here and sign in at `/subscriptions`.

## Conventions

- Add new API calls to `lib/adminApi.js`; don't call `fetch` from components.
- Surface backend `message` text to the user (toasts for actions, inline text for load errors).
- Colours: teal for primary, rose for destructive, amber for pending.
