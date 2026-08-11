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

2. **Configure database**:
   Edit `.env.local` with your PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/designer_studio"
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   ```

3. **Push schema to database**:
   ```bash
   npm run db:push
   ```

4. **Seed default users**:
   ```bash
   npm run db:seed
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

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
