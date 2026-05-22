# CLAUDE.md — OpenNotes.in Project Reference

## Project Overview

**OpenNotes.in** is a peer-to-peer marketplace for **BITS Pilani WILP** (Work Integrated Learning Programmes) students to buy and sell printed study notes for open-book exams. It is NOT a digital content delivery platform — the core flow is physical: buyers and sellers coordinate in-person meetups to exchange printed materials for cash.

**Live URL:** `https://opennotes.in`
**Repository:** `the-sarvesh/OpenNotes.in`

---

## Architecture

```
bits-notes-exchange/            # npm workspaces monorepo
├── client/                     # React 19 + Vite + Tailwind CSS v4 (SPA)
│   ├── src/
│   │   ├── App.tsx             # Root component, client-side router, all views
│   │   ├── components/         # Reusable UI components (20 files)
│   │   ├── views/              # Page-level views (7 files)
│   │   ├── contexts/           # React contexts (Auth, Cart, Settings)
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # API client, socket, formatters, constants
│   ├── vite.config.ts          # Dev proxy → localhost:5000, Tailwind plugin
│   └── vercel.json             # Production rewrites for /api and /uploads
├── server/                     # Node.js + Express + TypeScript (ESM)
│   ├── src/
│   │   ├── index.ts            # Entry point, middleware, route mounting, cron jobs
│   │   ├── socket.ts           # Socket.IO handler (messaging, meetups, presence)
│   │   ├── routes/             # Express route handlers (13 files)
│   │   ├── middleware/         # Auth (JWT) and Admin middleware
│   │   ├── db/                 # LibSQL database, schema init, migrations
│   │   └── utils/              # Cloudinary, email, notifications, orders, Telegram
│   ├── data.db                 # SQLite database file (production uses Turso)
│   └── tsconfig.json
├── uploads/                    # Local file storage (dev only, prod uses Cloudinary)
├── package.json                # Root workspace config with concurrently
└── render.yaml                 # Render.com deployment blueprint
```

### Tech Stack

| Layer        | Technology                                                           |
|------------- |--------------------------------------------------------------------- |
| Frontend     | React 19, Vite 6, Tailwind CSS v4, Framer Motion, Lucide React     |
| Backend      | Node.js, Express 4, TypeScript (ESM, `"type": "module"`)           |
| Database     | LibSQL/SQLite (local dev), Turso (production remote)                |
| Auth         | JWT (httpOnly cookies + Bearer tokens), Google OAuth 2.0 (Passport) |
| Real-time    | Socket.IO 4 (messaging, typing indicators, presence)               |
| File Storage | Cloudinary (prod), local `uploads/` dir (dev)                       |
| Email        | Nodemailer (OTP verification, password reset)                       |
| Notifications| In-app (DB + Socket.IO), Web Push (VAPID), Telegram bot            |
| Deployment   | Backend: Render.com, Frontend: Vercel                               |

---

## Business Logic — Core Domain

### 1. User Registration & Auth

- **Email-based signup** with OTP verification (6-digit code sent via Nodemailer)
- **Google OAuth** login (auto-creates accounts, auto-verifies)
- **Domain restriction** (production): Only `@pilani.bits-pilani.ac.in`, `@wilp.bits-pilani.ac.in`, `@hyderabad.bits-pilani.ac.in`, `@goa.bits-pilani.ac.in`, and `@gmail.com` are allowed
- Dev mode allows all domains
- JWT tokens last 7 days, stored in httpOnly cookies + localStorage fallback
- Rate limiting: 10 auth attempts / 15 min, 5 password resets / hour, 5 OTP attempts / 10 min
- Password reset uses OTP flow (not magic links)
- Blocked users are denied auth at every level (login, OAuth callback, middleware)
- User roles: `user` (default), `admin`

### 2. Listings (Notes for Sale)

- Sellers create listings with: title, description, course_code, semester (Sem1–Sem8), condition, price (₹), original_price, quantity, material_type, location, images, delivery_method, meetup preferences
- **Material types**: `handwritten`, `printed`, `digital`, `book`, `ppt`, `other`
- **Multi-subject support**: A single listing can cover multiple subjects via `listing_subjects` junction table
- **Multiple images**: Stored in `listing_images` table, first image is `is_main`
- Images uploaded to Cloudinary via pre-upload endpoint (`POST /api/listings/upload-image`)
- **Soft delete only**: Listings are set to `status = 'archived'`, never hard-deleted by users
- Sellers CANNOT delete listings that have active pending orders
- Sellers CANNOT edit price/quantity/images while an active order exists
- **Auto-archive cron**: Hourly job archives listings with `quantity = 0`
- **Re-activation**: Restocking an archived listing auto-sets status back to `active`
- **View tracking**: Each listing view is incremented via `POST /api/listings/:id/view`

### 3. Cart & Checkout

- Cart is stored in **localStorage** (`opennotes_cart`) — no server-side cart
- Cart validation: `POST /api/listings/validate-cart` checks availability, stock, and price freshness on page load
- Self-purchase prevention: Buyers cannot buy their own listings
- **Order quote**: `POST /api/orders/quote` previews subtotal, platform fee, and cash-at-meetup before checkout
- **Platform fee**: Configurable percentage via `settings.platform_fee_percentage` (currently `0`)
- **Coupon system**: Coupons can waive or reduce platform fees (percentage or fixed discount). Default `FREE100` coupon gives 100% fee waiver.
- Checkout requires `buyer_availability` (mandatory), optional: location, preferred_spot, note, meetup_details

### 4. Order Lifecycle (The Critical Flow)

```
Cart → Checkout → Order Created (pending_meetup)
                       ↓
              Seller Acknowledges (acknowledged)
                       ↓
              Buyer & Seller coordinate meetup via chat
                       ↓
              In-person meetup: Buyer shows 4-digit PIN
                       ↓
              Seller verifies PIN → Item marked (completed)
                       ↓
              All items completed → Order (completed)
```

- **Order creation** is **transactional** (LibSQL write transaction with race condition protection via re-validation inside tx)
- Each order item gets a cryptographically secure **4-digit meetup PIN** (`crypto.randomInt`)
- Upon order creation:
  - Inventory is decremented atomically
  - Listings auto-archive if sold out
  - A `purchase_notice` structured message is auto-sent from buyer to seller in chat
  - Seller receives in-app notification + Telegram notification
  - Socket.IO emits real-time updates
- **PIN verification** (`POST /api/orders/items/:itemId/verify-pin`):
  - 3 incorrect attempts → 30-minute lockout
  - Correct PIN → item marked `completed`
  - When all items in an order are completed → order status → `completed`
- **No payment gateway** (yet) — platform fee is `0`, all payments are cash at meetup. A `TODO` comment marks where Razorpay will be integrated.

### 5. Messaging System

- **Order-gated**: Users can ONLY message each other if an active (non-completed, non-cancelled) order exists between them
- Conversation IDs are deterministic: `sorted([userId1, userId2]).join('_')`
- Messages support types: `text` (default), `purchase_notice`, `meetup_proposal`, `system`
- `purchase_notice` messages contain structured metadata (listing info, meetup PIN, buyer details)
- Real-time delivery via Socket.IO (`send_message` event) with REST fallback (`POST /api/messages`)
- Socket connections are authenticated via JWT
- **Typing indicators**: `typing_start` / `typing_stop` events
- **Read receipts**: `mark_read` event
- **Presence system**: Tracks `user_came_online` / `user_went_offline` events with `last_seen_at` timestamps. Uses connection counting to handle multiple tabs without flicker.

### 6. Meetup Proposals

- Users can propose meetups via Socket.IO (`propose_meetup` event)
- Proposals are stored in `meetup_proposals` table with status: `pending`, `accepted`, `declined`, `cancelled`
- Proposals create structured `meetup_proposal` messages in the chat
- Automated **meetup reminders**: Cron job runs every 5 minutes, sends notifications 30 minutes before accepted meetups

### 7. Reviews

- Only buyers can leave reviews, and ONLY after the order is fully `completed`
- Rating: 1–5 stars + optional comment
- Duplicate reviews are prevented per (reviewer, order, listing) combination
- Seller average ratings are denormalized to `users.rating_avg` and `users.rating_count`

### 8. Resources (Free Study Materials)

- Separate from the marketplace — users upload free study resources (PDFs, PPTs, etc.)
- **Monthly upload quota**: Default 10/month per user, admins unlimited
- Resources have categories: `midsem`, `endsem`, `ppt`, `assignment`, `quiz`
- Download tracking: Per-user unique downloads tracked in `resource_downloads` table
- Download endpoint proxies files from Cloudinary with streaming and attachment headers
- Soft delete only (`status = 'deleted'`)
- Subject drive links: `subject_drive_links` table stores Google Drive links per semester/subject

### 9. Admin Panel

- Full CRUD on users, listings, orders, resources, coupons
- **User management**: Block/unblock, change roles, adjust upload limits, view activity
- **Order cancellation** (robust): Transactional reversal — restores inventory, reverts coupon usage, inserts system message in chat, hides contact details
- **Coupon management**: Create/edit/deactivate coupons with percentage or fixed discounts, max uses, expiry dates
- **Platform settings**: Adjustable `platform_fee_percentage` and `recommended_discount_percentage`
- **Telegram broadcast**: Queue-based system for mass messaging all Telegram-linked users (batched at 20/sec for rate limiting)
- **Subject drive links**: CRUD for Google Drive links mapped to semesters and subjects
- Admin stats endpoint provides: user count, listing counts, order count, platform revenue/volume, resource count

### 10. Notification System (Triple-Channel)

1. **In-app**: Stored in `notifications` table, delivered via Socket.IO, displayed in UI bell icon
2. **Web Push**: VAPID-based push notifications via `web-push` library
3. **Telegram Bot**: Users link accounts via a unique token. Bot sends order updates, message previews, meetup reminders. Smart online detection: skips Telegram if user is already in the chat room on the web.

---

## Database Schema (Key Tables)

| Table               | Purpose                                      |
|--------------------- |---------------------------------------------- |
| `users`             | User accounts, auth, profile, Telegram link   |
| `listings`          | Notes for sale                                |
| `listing_images`    | Multiple images per listing                   |
| `listing_subjects`  | Multiple subjects per listing                 |
| `orders`            | Purchase orders (buyer, totals, meetup info)  |
| `order_items`       | Individual items in an order (per seller)     |
| `messages`          | Chat messages with type + metadata            |
| `meetup_proposals`  | Proposed meetup times/locations                |
| `reviews`           | Buyer reviews of sellers                      |
| `notifications`     | In-app notification queue                     |
| `coupon_codes`      | Discount coupons for platform fees            |
| `settings`          | Key-value platform settings                   |
| `resources`         | Free study material uploads                   |
| `resource_downloads`| Per-user download tracking                    |
| `push_subscriptions`| Web push subscription endpoints               |
| `password_reset_tokens`| OTP-based password reset tokens            |
| `broadcast_jobs`    | Telegram broadcast queue                      |
| `subject_drive_links`| Google Drive links per subject               |
| `app_feedback`      | User feedback submissions                     |

---

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Initialize database
npm run server:init-db

# Run both client + server concurrently
npm run dev

# Individual
npm run dev:client        # Frontend on :3001
npm run dev:server        # Backend on :5000

# Build
npm run build             # Build both
npm run build:client      # Vite production build
npm run build:server      # TypeScript compilation (tsc)
```

**Environment:** Create `server/.env` from `.env.example`. Key variables:
- `JWT_SECRET`, `SESSION_SECRET` — mandatory in production
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for OAuth
- `DATABASE_URL` or `DB_URL` — `file:local.db` for dev, Turso URL for prod
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — image storage
- `TELEGRAM_BOT_TOKEN`, `BACKEND_URL` — for Telegram integration
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — for Web Push

---

## Code Conventions

### TypeScript
- ESM modules (`"type": "module"` in both workspaces)
- All server imports use `.js` extensions (required for ESM compatibility with tsc output)
- Server compiled with `tsc` → `dist/`
- Client uses Vite with `@vitejs/plugin-react`

### Backend
- Express route files export a default Router
- All routes use `async (req, res, next)` pattern with centralized error handler
- Auth middleware: `authenticate` (required), `optionalAuthenticate` (optional), `requireAdmin`
- UUIDs via `uuid` v4 for all primary keys
- Database access via `@libsql/client` — SQL queries with parameterized args
- Migrations run on every server boot (idempotent ALTER TABLE with try/catch for "already exists")

### Frontend
- Single-page app with `react-router-dom` v7
- State: React Context (Auth, Cart, Settings) — no external state library
- API calls: Custom `apiRequest()` wrapper that handles auth headers, cookies, session expiry redirects, and blocked account detection
- Styling: Tailwind CSS v4 (CSS-first config via `@tailwindcss/vite` plugin)
- Animations: Framer Motion (`motion` package)
- Icons: Lucide React
- Toasts: `react-hot-toast`

### API Design
- RESTful routes under `/api/` prefix
- Real-time operations via Socket.IO (messaging, meetup proposals, presence)
- Vite dev proxy forwards `/api` and `/uploads` to `:5000`
- Vercel production uses `vercel.json` rewrites

### Security Patterns
- JWT in httpOnly cookies (primary) with Bearer token fallback
- `timingSafeEqual` for OTP/PIN comparisons
- Rate limiting on auth endpoints
- CORS whitelist with Vercel preview URL pattern matching
- Production startup aborts if `JWT_SECRET` or `SESSION_SECRET` are defaults
- PIN lockout after 3 failed attempts (30-min cooldown)
- Blocked users are rejected at middleware level (auth, OAuth, Socket.IO)

---

## Deployment

### Backend (Render.com)
- Service defined in `render.yaml`
- Build: `npm install && npm run build` (in `server/` root)
- Start: `npm start` → `node dist/index.js`
- DB: Turso (remote LibSQL)
- File storage: Cloudinary

### Frontend (Vercel)
- Root directory: `client`
- Build: `vite build`
- Environment: `VITE_BACKEND_URL` pointing to Render backend
- API proxy via `vercel.json` rewrites

---

## Key Business Rules Summary

1. **Only BITS Pilani students can register** (domain-restricted in production)
2. **Messaging requires a purchase** — no cold messaging allowed
3. **Physical meetup is the exchange method** — no digital delivery or payment gateway
4. **PIN verification completes transactions** — prevents disputes
5. **Sellers cannot modify listings with pending orders** — protects buyers
6. **Soft-delete everywhere** — data is archived, never destroyed (except admin hard-delete)
7. **Platform fee is currently 0%** — coupon system is ready for when fees are introduced
8. **Semesters are Sem1–Sem8** — matches BITS WILP curriculum structure
9. **Locations are physical cities** (Noida, Bengaluru, Hyderabad, etc.) — students are spread across India
10. **Telegram integration is optional but deeply integrated** — order updates, message previews, meetup reminders, admin broadcasts
