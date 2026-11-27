@AGENTS.md

# HMS Admin (hospital-admin)

Platform-admin (support team) panel for the HMS SaaS. It does two jobs:
- Review hospital **subscription payment requests**: view the payment proof, then approve
  (activates the subscription's portals) or reject (with a reason the hospital admin sees).
- Process **refund requests** (subscription cancellations): send the money outside the system,
  upload the transfer screenshot and mark it refunded (ends the subscription), or reject.

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
| `app/subscriptions/page.jsx` | List of payment requests: status tabs (All / Queue=pending / Approved), Type filter, search, link to detail |
| `app/subscriptions/[id]/page.jsx` | Detail: "If you approve" preview, contact, portal price table, proof image, summary, history, Approve / Reject modal |
| `app/refunds/page.jsx` | Refund requests list: server-side Status (default In Review) / Tier / date / search filters, paginated, oldest In Review first |
| `app/refunds/[id]/page.jsx` | Refund detail: amount, Send-to account with Copy, payments covered, hospital, subscription, history; Mark as Refunded / Reject |
| `components/refunds/RefundModals.jsx` | Mark-refunded (screenshot upload, then PATCH) and reject modals. 409 → toast + reload; other errors stay in the modal |
| `components/refunds/TierPill.jsx` | Refund tier badge (FULL / HALF / NONE) |
| `components/ProtectedImage.jsx` | Shows an auth-protected image via blob + object URL |
| `components/ui.jsx`, `lib/format.js` | Shared `Card`/`Field` and display helpers (`pkr`, `startDay`/`endDay`, `toMs`, `daysSince`) |
| `components/subscriptions/AdminLogin.jsx` | Sign-in form shown when no/invalid token |
| `components/subscriptions/StatusPill.jsx` | Status badge (pending / approved / rejected) |
| `components/subscriptions/TypePill.jsx` | Payment type badge + `paymentTypeOf()` (missing `payment_type` → `RENEWAL`) |
| `lib/adminApi.js` | **All** backend calls go through here |

Both pages are client components (`"use client"`). They start in `loading` state so the
prerendered HTML matches the first client render; never read `localStorage` during the initial
render outside of that pattern.

## Backend

The API is the Express + MySQL app in the sibling repo **`../hospital-care-api`** (not
`HMS-api`). Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5050/api`). CORS is
`*`. Responses are `{ success, message, code?, data }`; `adminApi.request()` unwraps `data` and on
non-2xx throws an `Error(body.message)` with `.status` (HTTP) and `.code` (the API's code) attached.

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
| `getPaymentRequest(id)` | `GET /subscriptionPayment/admin/get/:id` | Adds `portals[]` (`portal_id`, `portal_name`, `monthly_price`, `billing_days` = days charged, `total`), `subscription_end_date`, and for pending requests `approval_preview` (`period_start`, `period_end`, `can_approve`, `blocked_reason`) |
| `approvePaymentRequest(id)` | `PUT /subscriptionPayment/approve/:id` | Fails 409 if not pending, subscription not `PENDING_PAYMENT`, or amount ≠ subscription total; also 409 with `code` `ADD_ON_PERIOD_ENDED` / `PORTAL_ALREADY_SUBSCRIBED` (the detail page then reloads, since its preview was stale). Sets subscription `ACTIVE`, `paid_at`, `verified_at` |
| `rejectPaymentRequest(id, reason)` | `PUT /subscriptionPayment/reject/:id` `{ reason }` | Reason required, ≤ 500 chars |
| `getPaymentProof(proof_url)` | `GET /subscriptionPayment/proof/:filename` | Auth-protected file; fetched as a blob and shown via an object URL (revoked on cleanup). `proof_url` is an absolute URL built from the API's `PUBLIC_API_URL` |

### Refund endpoints (`/admin/subscriptionCancellation`, spec in `../hospital-care-frontend/docs/backend-prompts/subscription-cancellation.md`)

| Function | Request |
|---|---|
| `getRefundRequests(params)` | `GET /all?status=&tier=&from=&to=&search=&page=&limit=`; normalised to `{ items, total, page, limit }` |
| `getInReviewRefundCount` | Same, `status=IN_REVIEW&limit=1`, reads `total` (sidebar badge: every 60 s, on focus, after refund/reject/sign-in) |
| `getRefundRequest(id)` | `GET /:id` (unwraps `data.cancellation`); includes the **unmasked** account number, never log it |
| `uploadRefundProof(dataUrl)` | `POST /proof` `{ image }` → `proof_url` |
| `markRefundRequestRefunded(id, …)` | `PATCH /:id/refund` `{ refund_proof_url, note? }` |
| `rejectRefundRequest(id, reason)` | `PATCH /:id/reject` `{ rejection_reason }` |

Statuses: `IN_REVIEW`, `REFUNDED`, `REJECTED`, `CANCELLED` (tier NONE, read-only). Never recalculate
refund amounts in the panel; show the API's values. Request IDs are displayed as `REF-{id}`.

Payment row fields used by the UI: `id`, `status` (`PENDING` | `APPROVED` | `REJECTED`, uppercase —
the UI lowercases for display), `amount`, `payment_method` (`JAZZCASH` | `EASYPAISA` |
`BANK_TRANSFER`), `transaction_reference`, `whatsapp_number`, `proof_url`, `rejection_reason`,
`created_at`, `verified_at`, `paid_at`, `payment_type`. Request IDs are displayed as `PAY-{id}`.

Payment types: `RENEWAL` (30 days for the chosen portals, starting at the current end date) and
`ADD_PORTALS` (new portals only, pro-rated for the days left, ending on the hospital's current end
date). Older rows have no `payment_type`; treat them as `RENEWAL`.

Period dates (`period_start`, `period_end`, `subscription_end_date`) are ISO instants on the
API's business calendar, Karachi (UTC+5). Ends are **exclusive**: the midnight that starts the
next day. Show an end as the Karachi day of `end − 1ms` (the API's `endsOnDate`), otherwise the
UI shows one day later than the hospital is told. See `startDay`/`endDay` in the detail page.

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
