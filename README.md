# Designer Studio Management

A production-ready Designer Studio / Bridal Boutique management application built with Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod, Prisma ORM, and PostgreSQL.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State/Data**: TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (jose) + bcryptjs
- **File Uploads**: Local filesystem (configurable)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or pnpm

### Setup

1. **Install dependencies**:
   ```bash
   cd desiner_studio
   npm install
   ```

2. **Configure server environment**:
   Set the master registry connection, encryption key, and JWT secret in `.env.local`:
   ```
   MASTER_DATABASE_URL="postgresql://..."
   ENCRYPTION_KEY="base64-encoded-32-byte-key"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   NEXT_PUBLIC_ENABLE_WHATSAPP_NOTIFICATIONS="false"
   ```
   Set `NEXT_PUBLIC_ENABLE_WHATSAPP_NOTIFICATIONS="false"` to disable the WhatsApp prompt entirely. Omit it or set it to `true` to keep the prompt enabled.

3. **Prepare each studio database**:
   Set `DATABASE_URL` temporarily to that studio's PostgreSQL connection string, then run:
   ```bash
   npm run db:push
   ```
   Repeat for each studio database. The application reads each studio's database URL and
   Cloudinary credentials from the encrypted master registry at runtime; it does not use
   `DATABASE_URL` or `CLOUDINARY_*` environment values for requests.

4. **Seed default users**:
   ```bash
   npm run db:seed
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:4000](http://localhost:4000)

### Studio registry (initial multi-studio setup)

The owner registry uses a separate PostgreSQL database configured by `MASTER_DATABASE_URL`.
Never expose database URLs or Cloudinary credentials to the browser. The application resolves
the request host to an active studio in the master registry, then uses that studio's database
and Cloudinary credentials for its requests. `MASTER_DATABASE_URL`, `ENCRYPTION_KEY`, and
`JWT_SECRET` remain server environment settings; `DATABASE_URL` is only used by database
management scripts.

Keep these server-only settings in `.env.local` and the Vercel project environment:

```env
MASTER_DATABASE_URL="postgresql://..."
ENCRYPTION_KEY="base64-encoded-32-byte-key"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
```

For the initial owner setup only, temporarily add these values to `.env.local` (do not deploy
them as runtime environment variables):

```env
OWNER_EMAIL="owner@example.com"
OWNER_PASSWORD_HASH="$2b$12$..."
```

Generate a 32-byte encryption key and a bcrypt owner password hash locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('bcryptjs').hashSync('replace-with-a-strong-password', 12))"
```

Run `npm run db:migrate:master` to create the studio registry and owner account tables, then
run `npm run db:owner:seed` once to copy the configured owner email and bcrypt hash into the
master database. The login flow reads the hash from that database; after seeding, remove
`OWNER_EMAIL` and `OWNER_PASSWORD_HASH` from `.env.local`. The seed command does not overwrite
an existing account.

Start the app after seeding. Sign in at `/owner/login`. The combined owner dashboard remains
at `/owner`; use `/owner/studios` to manage registered studios, `/owner/newStudio` to add one,
and `/owner/editStudio/<studio-id>` to edit one. The logo field accepts an HTTPS image URL;
database and Cloudinary URLs are encrypted with `ENCRYPTION_KEY` before they are stored.
`MASTER_DATABASE_URL` and `ENCRYPTION_KEY` must have the same values across deployments that
read the registry.

Only register a studio after its database schema has been prepared. Login sessions are bound
to the studio that issued them, and studio database/Cloudinary secrets remain server-side.

### Default Credentials

| Role       | Email                   | Password      |
|------------|-------------------------|---------------|
| Admin      | admin@studio.com        | admin123      |
| Reception  | reception@studio.com    | reception123  |
| Designer   | designer@studio.com     | designer123   |
| Master     | master@studio.com       | master123     |

## Roles & Permissions

- **Admin**: Full access to all features
- **Reception**: Customer management, orders, appointments, payments
- **Designer**: Outfit design, measurements, references, production release
- **Master**: Production cards, progress updates, dependency management

## Features

- Customer management with order history
- Order creation with multiple outfits
- Per-outfit independent production workflow
- Measurement recording with reusable templates
- Reference image management (Pattern + Maggam)
- Image upload with select/lock workflow
- Production dependency tracking
- Role-based dashboards
- Customer portal with secure shareable links
- Payment tracking
- Production timeline/audit logs
- Dark mode support
- Mobile-responsive design

## Production Workflow

```
Reception → Create Customer → Create Order → Add Outfits
→ Designer Consultation → Measurements → Upload References
→ Customer Uploads → Review & Select → Lock References
→ Designer Notes → Dependency Check → Production Ready
→ Release to Production → Master: Pattern Drafting
→ (Optional) Maggam Work → Fabric Cutting → Stitching
→ Production Completed → Trial → (Alteration) → QC
→ Ready for Delivery → Delivered
```

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── dashboard/     # Protected dashboard pages
│   ├── login/         # Authentication
│   └── portal/        # Customer portal
├── components/
│   ├── ui/            # shadcn/ui components
│   ├── providers.tsx  # React Query + Theme
│   └── sidebar.tsx    # Navigation
├── lib/
│   ├── auth.ts        # JWT auth utilities
│   ├── prisma.ts      # Database client
│   ├── utils.ts       # Helpers
│   └── validations.ts # Zod schemas
└── middleware.ts      # Route protection
```
