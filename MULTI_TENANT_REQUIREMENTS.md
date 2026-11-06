# Multi-Tenant Designer Studio - Requirements Document

**Project**: Convert Urumi Designer Studio to Multi-Tenant SaaS
**Version**: 1.0
**Date**: 2026-11-05
**Current System**: Single Studio Application (Next.js 15 + PostgreSQL)
**Target System**: Multi-Tenant SaaS Platform

---

## 1. Executive Summary

### 1.1 Business Goal
Transform the current single-studio application into a multi-tenant SaaS platform that can serve multiple independent designer studios, each with their own:
- Custom domain (e.g., `designer.studiobrand.com`)
- Branding (logo, colors, business name)
- Isolated data (customers, orders, measurements)
- Subscription billing

### 1.2 Target Customers
- Bridal boutiques
- Designer studios
- Custom tailoring shops
- Fashion ateliers
- Each paying $150-300/month

### 1.3 Success Criteria
- Support 100+ studios on single infrastructure
- < 200ms page load time per studio
- 99.9% uptime SLA
- Zero data leakage between studios
- Complete brand customization per studio

---

## 2. Architecture Requirements

### 2.1 Database Architecture

**Chosen Approach**: Single Deployment + Multiple Databases (Database-per-Tenant)

#### 2.1.1 Master Database (`master_db`)
Stores metadata about all studios:

**Tables Required**:
```sql
-- Studios (Tenants)
CREATE TABLE studios (
  id VARCHAR(20) PRIMARY KEY,
  domain VARCHAR(255) UNIQUE NOT NULL,           -- designer.studiobrand.com
  database_name VARCHAR(100) UNIQUE NOT NULL,    -- studio_abc_db
  status ENUM('active', 'suspended', 'trial', 'cancelled') DEFAULT 'trial',
  
  -- Branding
  brand_name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(7),                      -- #FF69B4
  secondary_color VARCHAR(7),
  
  -- Business Info
  business_name VARCHAR(255),
  business_email VARCHAR(255),
  business_phone VARCHAR(50),
  business_address TEXT,
  timezone VARCHAR(50) DEFAULT 'UTC',
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Subscription
  plan_type ENUM('trial', 'basic', 'premium', 'enterprise') DEFAULT 'trial',
  trial_ends_at TIMESTAMP,
  subscription_id VARCHAR(100),                  -- Stripe subscription ID
  subscription_status ENUM('active', 'past_due', 'cancelled'),
  mrr DECIMAL(10,2),                             -- Monthly recurring revenue
  
  -- Technical
  dns_verified BOOLEAN DEFAULT FALSE,
  ssl_status ENUM('pending', 'active', 'failed') DEFAULT 'pending',
  database_size_mb INTEGER DEFAULT 0,
  last_backup_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(20),                        -- Admin user ID
  
  -- Feature Flags
  features JSONB DEFAULT '{}'::jsonb             -- {whatsapp: true, instagram: false}
);

-- Studio Custom Settings
CREATE TABLE studio_settings (
  studio_id VARCHAR(20) PRIMARY KEY REFERENCES studios(id),
  
  -- UI Customization
  custom_css TEXT,
  homepage_layout ENUM('default', 'minimal', 'gallery', 'custom'),
  show_customer_portal BOOLEAN DEFAULT TRUE,
  
  -- Email Templates
  email_header_html TEXT,
  email_footer_html TEXT,
  
  -- Integrations
  whatsapp_business_id VARCHAR(100),
  instagram_handle VARCHAR(100),
  google_analytics_id VARCHAR(50),
  
  -- Notifications
  notification_email VARCHAR(255),
  notification_phone VARCHAR(50),
  
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Super Admin Users (manage all studios)
CREATE TABLE admin_users (
  id VARCHAR(20) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'support', 'billing') DEFAULT 'support',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DNS Verification Records
CREATE TABLE dns_records (
  id VARCHAR(20) PRIMARY KEY,
  studio_id VARCHAR(20) REFERENCES studios(id),
  domain VARCHAR(255) NOT NULL,
  record_type ENUM('CNAME', 'A', 'TXT') NOT NULL,
  record_name VARCHAR(255) NOT NULL,
  record_value TEXT NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs (Who did what)
CREATE TABLE audit_logs (
  id VARCHAR(20) PRIMARY KEY,
  studio_id VARCHAR(20) REFERENCES studios(id),
  user_id VARCHAR(20),
  action VARCHAR(100) NOT NULL,                  -- 'studio.created', 'studio.suspended'
  entity_type VARCHAR(50),                       -- 'studio', 'user', 'customer'
  entity_id VARCHAR(20),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Billing & Invoices
CREATE TABLE subscriptions (
  id VARCHAR(20) PRIMARY KEY,
  studio_id VARCHAR(20) REFERENCES studios(id),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  stripe_customer_id VARCHAR(100),
  plan_type ENUM('trial', 'basic', 'premium', 'enterprise'),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('active', 'past_due', 'cancelled', 'incomplete') DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE studio_usage (
  id VARCHAR(20) PRIMARY KEY,
  studio_id VARCHAR(20) REFERENCES studios(id),
  metric_date DATE NOT NULL,
  
  -- Usage Metrics
  total_customers INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_outfits INTEGER DEFAULT 0,
  storage_used_mb DECIMAL(10,2) DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(studio_id, metric_date)
);
```

#### 2.1.2 Studio Databases (`studio_xyz_db`)
Each studio has a complete copy of the application schema:

**Tables** (from existing schema):
- users
- sessions
- customers
- orders
- outfits
- customerMeasurements
- measurementTemplates
- referenceImages
- dependencies
- payments
- invoices
- productionLogs
- auditLogs
- consultations
- employees
- employeeAttendance
- employeeSalaryPayments
- employeeAdvances
- storeExpenditures

**Changes Required**:
- ❌ Remove any `studioId` columns (not needed with separate databases)
- ✅ Keep all existing functionality
- ✅ Add studio context to all queries

---

### 2.2 Application Architecture

#### 2.2.1 Request Flow

```
User visits: designer.studiobrand.com
         ↓
    DNS resolves to YOUR_SERVER_IP
         ↓
    Caddy (Web Server)
         ↓
    Next.js Middleware
         ↓
    1. Read domain: "designer.studiobrand.com"
    2. Query master_db: Find studio by domain
    3. Check studio.status
         ├─ 'suspended' → Show suspension page
         ├─ 'cancelled' → Show account closed page
         └─ 'active' → Continue
    4. Load studio branding & settings
    5. Get database connection for studio.database_name
         ↓
    Application Routes
         ↓
    Database Queries (studio-specific database)
         ↓
    Response with branded UI
```

#### 2.2.2 Directory Structure

```
src/
├── app/
│   ├── (dashboard)/              # Main application
│   ├── (portal)/                 # Customer portal
│   ├── (admin)/                  # Super admin panel (NEW)
│   ├── suspended/                # Suspension page (NEW)
│   └── api/
│       ├── admin/                # Admin APIs (NEW)
│       └── webhooks/             # Stripe webhooks (NEW)
│
├── lib/
│   ├── db/
│   │   ├── master.ts             # Master database connection (NEW)
│   │   ├── tenant.ts             # Dynamic tenant DB connection (NEW)
│   │   ├── schema.ts             # Existing schema
│   │   └── migrations/
│   │       ├── master/           # Master DB migrations (NEW)
│   │       └── tenant/           # Tenant DB migrations (existing)
│   │
│   ├── multi-tenant/             # (NEW)
│   │   ├── context.ts            # Studio context provider
│   │   ├── database-manager.ts   # DB connection pooling
│   │   ├── domain-resolver.ts    # Map domain → studio
│   │   └── migration-runner.ts   # Run migrations on all tenants
│   │
│   ├── branding/                 # (NEW)
│   │   ├── theme-provider.tsx    # React context for branding
│   │   └── brand-utils.ts        # Logo, colors utilities
│   │
│   └── billing/                  # (NEW)
│       ├── stripe.ts             # Stripe integration
│       └── subscription.ts       # Subscription logic
│
├── components/
│   ├── admin/                    # Admin panel components (NEW)
│   ├── branding/                 # Branded components (NEW)
│   │   ├── branded-header.tsx
│   │   ├── branded-footer.tsx
│   │   └── logo.tsx
│   └── ui/                       # Existing shadcn components
│
├── middleware.ts                 # Enhanced for multi-tenancy
└── hooks/
    ├── use-studio.ts             # Get current studio context (NEW)
    └── use-branding.ts           # Get studio branding (NEW)
```

---

## 3. Feature Requirements

### 3.1 Core Multi-Tenant Features

#### 3.1.1 Studio Management (Super Admin)
**Admin Panel** (`/admin/*`)

**Features Required**:
- [ ] Dashboard showing all studios
- [ ] Create new studio
  - Enter business details
  - Choose domain (validate available)
  - Set initial admin user
  - Automatically create database
  - Run migrations
  - Generate DNS instructions
- [ ] View studio details
  - Usage metrics (customers, orders, storage)
  - Billing status
  - Last activity
- [ ] Edit studio settings
  - Change branding
  - Toggle features
  - Update subscription plan
- [ ] Suspend/unsuspend studio
- [ ] Delete studio (soft delete with data retention)
- [ ] View audit logs per studio
- [ ] Impersonate studio admin (for support)

#### 3.1.2 Domain Management

**Features Required**:
- [ ] Custom domain setup flow:
  1. Studio admin enters their domain
  2. System generates DNS instructions
  3. System periodically checks DNS
  4. Auto-provision SSL certificate
  5. Mark domain as verified
- [ ] Support both:
  - Subdomains: `designer.studiobrand.com`
  - Root domains: `studiobrand.com`
- [ ] Multiple domains per studio (redirect to primary)
- [ ] Domain transfer between studios
- [ ] DNS verification status page

#### 3.1.3 Branding System

**Studio Branding Settings** (`/dashboard/settings/branding`)

**Fields Required**:
- [ ] Business name (shown everywhere)
- [ ] Logo upload (PNG/SVG, max 2MB)
  - Appears in header, emails, invoices
- [ ] Favicon upload (ICO/PNG, 32x32px)
- [ ] Primary color (color picker)
  - Used for buttons, links, accents
- [ ] Secondary color
- [ ] Custom CSS (premium plan only)
- [ ] Business contact info
  - Email, phone, address
  - Shown in footer, invoices

**Preview Feature**:
- [ ] Live preview of branding changes
- [ ] Preview on different pages (login, dashboard, portal)

#### 3.1.4 Feature Toggles

**Per-Studio Feature Flags**:
```json
{
  "whatsappIntegration": true,
  "instagramFeed": false,
  "customerPortal": true,
  "aiMeasurements": false,
  "multiLanguage": false,
  "customReports": true
}
```

**Implementation**:
- [ ] Feature flag management UI (admin)
- [ ] Runtime check before rendering features
- [ ] Graceful degradation if feature disabled

---

### 3.2 Database Management

#### 3.2.1 Automated Database Provisioning

**Requirements**:
- [ ] When creating studio:
  1. Generate unique database name (`studio_abc123_db`)
  2. Create PostgreSQL database
  3. Run all migrations from `migrations/tenant/`
  4. Create default admin user
  5. Seed default data (measurement templates, etc.)
- [ ] Store database credentials securely
- [ ] Connection pooling per database

#### 3.2.2 Migration Management

**Requirements**:
- [ ] Migrate all tenant databases:
  ```bash
  npm run db:migrate:all-tenants
  ```
- [ ] Migrate specific tenant:
  ```bash
  npm run db:migrate:tenant studio_abc_db
  ```
- [ ] Rollback migrations
- [ ] Migration status dashboard (show which tenants are up-to-date)
- [ ] Lock mechanism (prevent concurrent migrations)

#### 3.2.3 Backup & Restore

**Requirements**:
- [ ] Daily automated backups (all studio databases)
- [ ] Retention: 30 days
- [ ] Store backups in S3/DigitalOcean Spaces
- [ ] Restore UI (admin can restore specific studio)
- [ ] Point-in-time recovery
- [ ] Export studio data (GDPR compliance)

---

### 3.3 Authentication & Authorization

#### 3.3.1 Studio User Authentication

**Current System**: JWT-based auth with sessions table

**Changes Required**:
- [ ] Auth queries use studio-specific database
- [ ] JWT token includes `studioId` and `databaseName`
- [ ] Session validation checks studio status (suspended?)
- [ ] Auto-logout if studio suspended

**Token Structure**:
```json
{
  "user": {
    "id": "usr_abc",
    "email": "admin@studio.com",
    "role": "ADMIN"
  },
  "studio": {
    "id": "stu_xyz",
    "domain": "designer.studiobrand.com",
    "databaseName": "studio_xyz_db",
    "status": "active"
  },
  "sessionId": "ses_123",
  "exp": 1699999999
}
```

#### 3.3.2 Super Admin Authentication

**Requirements**:
- [ ] Separate login: `/admin/login`
- [ ] Uses `master_db.admin_users` table
- [ ] Different JWT with `isSuperAdmin: true`
- [ ] Can access all studios
- [ ] Audit log all super admin actions

#### 3.3.3 Studio User Isolation

**Requirements**:
- [ ] Users cannot access other studios
- [ ] Email can be same across studios (john@gmail.com in Studio A and B)
- [ ] Unique constraint: `(email, studioId)` → handled by separate databases

---

### 3.4 File Storage (Cloudinary Multi-Tenant)

#### 3.4.1 Current Implementation
You're already using **Cloudinary** for image uploads.

**Current setup**:
```
Single Cloudinary Account
└── urumi-by-mounika/  (single folder for all uploads)
```

---

## ⚡ TWO CLOUDINARY APPROACHES

### **Approach A: Separate Cloudinary Account Per Studio** ⭐ (RECOMMENDED)

Each customer gets their **own Cloudinary account** with their own credentials!

#### Architecture:
```
Studio A: Uses their own Cloudinary account
├── cloud_name: "elite-designer-studio"
├── api_key: "123456789"
└── api_secret: "abc...xyz"

Studio B: Uses their own Cloudinary account  
├── cloud_name: "royal-boutique"
├── api_key: "987654321"
└── api_secret: "def...uvw"

Studio C: Uses their own Cloudinary account
├── cloud_name: "urumi-by-mounika"
├── api_key: "456789123"
└── api_secret: "ghi...rst"
```

#### Database Schema (Master DB):
```sql
-- Add Cloudinary credentials to studios table
ALTER TABLE studios ADD COLUMN cloudinary_cloud_name VARCHAR(255);
ALTER TABLE studios ADD COLUMN cloudinary_api_key VARCHAR(255);
ALTER TABLE studios ADD COLUMN cloudinary_api_secret TEXT; -- Encrypted!
ALTER TABLE studios ADD COLUMN cloudinary_account_type ENUM('own', 'shared') DEFAULT 'shared';
```

#### How It Works:

**1. Studio Onboarding (Two Options)**:

**Option 1: Customer Brings Their Own Cloudinary (BYOC)**
```
1. Customer signs up for free Cloudinary account
   → Visit cloudinary.com → Create account
2. Customer gets their credentials:
   - Cloud Name: "their-studio"
   - API Key: "123456789"
   - API Secret: "abc...xyz"
3. Customer enters credentials in your admin panel
4. Your app validates and stores encrypted credentials
5. All uploads use THEIR Cloudinary account ✅
```

**Option 2: You Create Cloudinary Account for Them**
```
1. Use Cloudinary Provisioning API
2. Auto-create sub-account for customer
3. Store credentials in your database
4. Customer never sees Cloudinary
```

#### Implementation:

```typescript
// src/lib/cloudinary/multi-account.ts

export async function getStudioCloudinaryConfig(studioId: string) {
  const studio = await masterDb
    .select({
      cloudName: studios.cloudinary_cloud_name,
      apiKey: studios.cloudinary_api_key,
      apiSecret: studios.cloudinary_api_secret,
      accountType: studios.cloudinary_account_type
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio[0]) {
    throw new Error('Studio not found');
  }

  // If studio has own Cloudinary account, use it
  if (studio[0].accountType === 'own' && studio[0].cloudName) {
    return {
      cloudName: studio[0].cloudName,
      apiKey: studio[0].apiKey!,
      apiSecret: decrypt(studio[0].apiSecret!), // Decrypt before use
    };
  }

  // Otherwise, use shared/default account
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    apiSecret: process.env.CLOUDINARY_API_SECRET!,
  };
}

// Updated upload function
async function uploadToCloudinary(
  buffer: Buffer,
  originalName: string,
  studioId: string,
  uploadType: 'branding' | 'references' | 'customers' | 'audio'
): Promise<string> {
  // Get studio-specific Cloudinary credentials
  const config = await getStudioCloudinaryConfig(studioId);

  const timestamp = Math.round(Date.now() / 1000);
  const folder = uploadType; // Just "references", not "studios/xyz/references"

  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), originalName);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  // Upload to THEIR Cloudinary account
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!res.ok) throw new Error("Cloudinary upload failed");

  const data = await res.json();
  return data.secure_url;
}
```

#### Admin Panel UI:

**Studio Settings → Cloudinary Integration**
```
┌─────────────────────────────────────────────┐
│ Cloudinary Integration                       │
├─────────────────────────────────────────────┤
│                                              │
│ ○ Use Shared Account (Free)                 │
│   Files stored on our Cloudinary            │
│   5GB storage limit                          │
│                                              │
│ ● Use Your Own Account (Recommended)         │
│   Complete control over your files           │
│   Unlimited storage (based on your plan)     │
│   Your branding (no "Powered by")            │
│                                              │
│   Cloud Name:  [elite-designer-studio    ]  │
│   API Key:     [123456789                ]  │
│   API Secret:  [•••••••••••••••••••••••••]  │
│                                              │
│   [Test Connection]  [Save]                  │
│                                              │
│   ℹ️ Get free Cloudinary account:            │
│   https://cloudinary.com/users/register_free │
│                                              │
└─────────────────────────────────────────────┘
```

#### Benefits of Separate Cloudinary Accounts:

✅ **Complete Isolation**
- Customer's files NEVER touch your infrastructure
- If your account is compromised, their files are safe

✅ **Unlimited Storage**
- Not limited by your Cloudinary plan
- Customer upgrades their own Cloudinary plan

✅ **Customer Owns Their Data**
- If they leave, they keep all their images
- GDPR compliant (data portability)

✅ **Branding**
- URLs are theirs: `res.cloudinary.com/elite-studio/...`
- Not `res.cloudinary.com/your-platform/...`

✅ **Cost Savings for You**
- Zero storage cost (they pay Cloudinary)
- You only pay for your app server

✅ **Scalability**
- No limit on number of customers
- Each customer's Cloudinary quota is separate

---

### **Approach B: Single Cloudinary with Folders** (Fallback)

One Cloudinary account, separate folders per studio:

```
Your Cloudinary Account
└── studios/
    ├── studio_elite_designer/
    ├── studio_royal_boutique/
    └── studio_urumi_mounika/
```

**Use this for**:
- Trial customers (before they add their own Cloudinary)
- Small studios who don't want to manage Cloudinary
- Development/testing

---

## Recommended Hybrid Approach

```
Tier          | Cloudinary Setup
--------------|----------------------------------
Trial         | Shared account, 1GB limit
Basic         | Shared account, 5GB limit  
Premium       | Own Cloudinary account (BYOC)
Enterprise    | Own Cloudinary account (BYOC)
```

**Implementation**:
- Trial/Basic → Use your Cloudinary with folders
- Premium/Enterprise → Require customer's Cloudinary credentials


#### 3.4.3 Security: Encrypting Cloudinary Credentials

**Critical**: Never store API secrets in plain text!

```typescript
// src/lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Usage**:
```typescript
// When saving credentials
const encryptedSecret = encrypt(apiSecret);
await db.update(studios)
  .set({ cloudinary_api_secret: encryptedSecret })
  .where(eq(studios.id, studioId));

// When using credentials
const decryptedSecret = decrypt(studio.cloudinary_api_secret);
```

#### 3.4.4 Cloudinary Account Validation

```typescript
// src/lib/cloudinary/validate.ts

export async function validateCloudinaryCredentials(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    if (res.ok) {
      return { valid: true };
    } else if (res.status === 401) {
      return { valid: false, error: 'Invalid API credentials' };
    } else if (res.status === 404) {
      return { valid: false, error: 'Cloud name not found' };
    } else {
      return { valid: false, error: 'Unable to verify credentials' };
    }
  } catch (error) {
    return { valid: false, error: 'Connection failed' };
  }
}
```

#### 3.4.5 Migration Helper

**For customers switching from shared to own Cloudinary**:

```typescript
// src/lib/cloudinary/migrate.ts

export async function migrateStudioToOwnCloudinary(
  studioId: string,
  newCloudName: string,
  newApiKey: string,
  newApiSecret: string
) {
  // 1. Get all files currently stored in shared Cloudinary
  const files = await db
    .select()
    .from(referenceImages)
    .where(/* files belonging to this studio */);

  // 2. Download from shared Cloudinary
  // 3. Upload to new Cloudinary account
  // 4. Update URLs in database
  // 5. Delete from shared Cloudinary (optional)
  
  for (const file of files) {
    const imageBuffer = await downloadFromCloudinary(file.url);
    const newUrl = await uploadToCloudinary(
      imageBuffer,
      file.filename,
      { cloudName: newCloudName, apiKey: newApiKey, apiSecret: newApiSecret }
    );
    
    await db.update(referenceImages)
      .set({ url: newUrl })
      .where(eq(referenceImages.id, file.id));
  }
}
```

#### 3.4.6 Cost Comparison

| Setup | Your Cost | Customer Cost | Total |
|-------|-----------|---------------|-------|
| **Shared Cloudinary** | $89/month (100 studios) | $0 | $89/month |
| **Separate Cloudinary** | $0 | $0 (free) or $89/month | $0-89/customer |

**Recommendation**: 
- Start with shared Cloudinary (included in platform)
- Premium customers can add their own (optional)
- You save money, they get full control

#### 3.4.7 Files to Update

**Add studio Cloudinary config to all upload routes**:
- [ ] `src/lib/cloudinary/multi-account.ts` (NEW)
- [ ] `src/lib/encryption.ts` (NEW)
- [ ] `src/lib/cloudinary/validate.ts` (NEW)
- [ ] `src/app/api/upload/route.ts`
- [ ] `src/app/api/upload/audio/route.ts`
- [ ] `src/app/api/portal/[token]/upload/route.ts`
- [ ] `src/app/api/references/[id]/route.ts`
- [ ] `src/app/api/admin/studios/[id]/cloudinary/route.ts` (NEW - Admin to save credentials)

**Update upload functions** to include studio folder:

```typescript
// Before (current):
const folder = "urumi-by-mounika";

// After (multi-tenant):
const studioId = context.studio.id; // From middleware
const folder = `studios/${studioId}/references`;

// Examples:
// Logo: studios/studio_abc/branding/logo.png
// Reference: studios/studio_abc/references/ref_123.jpg
// Audio: studios/studio_abc/audio/voice_001.mp3
```

**Files to update**:
- [ ] `src/app/api/upload/route.ts` - Add studio context
- [ ] `src/app/api/upload/audio/route.ts` - Add studio context
- [ ] `src/app/api/portal/[token]/upload/route.ts` - Add studio context
- [ ] `src/app/api/references/[id]/route.ts` - Update delete path

**Example updated upload function**:
```typescript
async function uploadToCloudinary(
  buffer: Buffer, 
  originalName: string,
  studioId: string,
  uploadType: 'branding' | 'references' | 'customers' | 'audio'
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  
  // Multi-tenant folder structure
  const folder = `studios/${studioId}/${uploadType}`;
  
  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), originalName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Cloudinary upload failed");
  
  const data = await res.json();
  return data.secure_url;
}
```

#### 3.4.4 Cloudinary Benefits for Multi-Tenancy

**Why Cloudinary is Perfect**:
- ✅ **Automatic CDN** - Fast delivery worldwide
- ✅ **No storage management** - Cloudinary handles it
- ✅ **Transformations** - Resize images on-the-fly
- ✅ **Folder isolation** - Each studio has own folder
- ✅ **Built-in backup** - Cloudinary backs up your files
- ✅ **Easy migration** - Move folders between accounts if needed

**Cost (Cloudinary)**:
- Free tier: 25GB storage, 25GB bandwidth/month
- Paid: $89/month for 100GB storage, 100GB bandwidth
- **Recommended**: Start with free tier, upgrade at ~20 studios

#### 3.4.5 Storage Quota Management

**Requirements**:
- [ ] Track storage per studio in `studio_usage` table
- [ ] Query Cloudinary API for folder size
  ```typescript
  // Get folder size for a studio
  const folderSize = await getCloudinaryFolderSize(`studios/${studioId}`);
  ```
- [ ] Enforce limits:
  - Trial: 1GB
  - Basic: 5GB
  - Premium: 50GB
  - Enterprise: Unlimited
- [ ] Show storage usage in studio admin panel
- [ ] Block uploads when quota exceeded
- [ ] Send warning emails at 80% usage

**Cloudinary Admin API** (for quotas):
```typescript
async function getStudioStorageUsage(studioId: string): Promise<number> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/by_asset_folder?prefix=studios/${studioId}`,
    {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    }
  );

  const data = await res.json();
  const totalBytes = data.resources.reduce((sum: number, r: any) => sum + r.bytes, 0);
  return Math.round(totalBytes / (1024 * 1024)); // Convert to MB
}
```

#### 3.4.6 Cloudinary Cleanup (When Studio Deleted)

**Requirements**:
- [ ] Soft delete: Keep files for 30 days after studio cancellation
- [ ] Hard delete: After 30 days, delete Cloudinary folder
- [ ] Admin can manually trigger cleanup
- [ ] Bulk delete using Cloudinary API

```typescript
async function deleteStudioFiles(studioId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  // Delete all resources in studio folder
  await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/by_asset_folder?prefix=studios/${studioId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    }
  );
}
```

#### 3.4.7 CDN & Performance

**Cloudinary provides**:
- ✅ Global CDN (automatic)
- ✅ Image optimization (WebP, AVIF)
- ✅ Lazy loading URLs
- ✅ Responsive images

**Optimization examples**:
```typescript
// Original URL:
// https://res.cloudinary.com/yourcloud/image/upload/studios/studio_abc/references/ref_123.jpg

// Auto-optimized (WebP, quality 80):
// https://res.cloudinary.com/yourcloud/image/upload/f_auto,q_80/studios/studio_abc/references/ref_123.jpg

// Thumbnail (300x300):
// https://res.cloudinary.com/yourcloud/image/upload/w_300,h_300,c_fill/studios/studio_abc/references/ref_123.jpg
```

**Implementation**:
- [ ] Add transformation helper function
- [ ] Use optimized URLs in UI
- [ ] Generate thumbnails for galleries
- [ ] Lazy load images

#### 3.4.8 Backup Strategy (Cloudinary)

**Cloudinary handles backups, but also**:
- [ ] Weekly export of file URLs to database
- [ ] Store file metadata (size, type, upload date)
- [ ] Can re-download from Cloudinary if needed

#### 3.4.9 Migration from Local to Multi-Tenant Cloudinary

**For existing files** (if any local uploads exist):
```typescript
async function migrateLocalFilesToCloudinary(studioId: string) {
  // 1. Find all local file URLs in database (/uploads/*)
  // 2. Read from local filesystem
  // 3. Upload to Cloudinary with new studio path
  // 4. Update database URLs
  // 5. Delete local files
}
```

---

### 3.5 Billing & Subscriptions

#### 3.5.1 Stripe Integration

**Plans**:
| Plan | Price | Features |
|------|-------|----------|
| Trial | Free (14 days) | 10 customers, 20 orders |
| Basic | $99/month | 200 customers, 500 orders, 5GB storage |
| Premium | $199/month | Unlimited, 50GB storage, custom CSS |
| Enterprise | Custom | Unlimited, custom domain, priority support |

**Requirements**:
- [ ] Stripe Checkout integration
- [ ] Subscription creation on signup
- [ ] Webhook handling:
  - `checkout.session.completed` → Activate studio
  - `invoice.payment_succeeded` → Extend subscription
  - `invoice.payment_failed` → Mark past_due
  - `customer.subscription.deleted` → Suspend studio
- [ ] Billing portal (customer can manage subscription)
- [ ] Usage-based billing (overage charges)

#### 3.5.2 Trial Management

**Requirements**:
- [ ] 14-day free trial (no credit card)
- [ ] Email reminders:
  - 7 days left
  - 3 days left
  - Trial expired
- [ ] Automatic suspension after trial ends
- [ ] Easy upgrade flow

#### 3.5.3 Payment Failure Handling

**Flow**:
```
Payment fails
    ↓
Send email: "Payment failed, please update card"
    ↓
Grace period: 7 days (studio still active)
    ↓
If still not paid:
    ↓
Suspend studio (status = 'suspended')
    ↓
Show message: "Account suspended due to payment failure"
    ↓
Allow reactivation on successful payment
```

---

### 3.6 Monitoring & Analytics

#### 3.6.1 Health Monitoring

**Requirements**:
- [ ] Health check endpoint: `/api/health`
  ```json
  {
    "status": "healthy",
    "database": {
      "master": "connected",
      "tenants": 47
    },
    "uptime": 123456,
    "memory": "512MB / 2GB"
  }
  ```
- [ ] Database connection health (each tenant)
- [ ] Alert on failures (email, Slack, PagerDuty)

#### 3.6.2 Usage Analytics

**Per Studio Tracking**:
- [ ] Daily active users
- [ ] Total customers, orders, outfits
- [ ] Storage used
- [ ] Page views
- [ ] API calls
- [ ] Error rate

**Super Admin Dashboard**:
- [ ] Total MRR (Monthly Recurring Revenue)
- [ ] Churn rate
- [ ] Growth chart
- [ ] Top studios by usage
- [ ] Studios needing attention (errors, low activity)

#### 3.6.3 Error Tracking

**Requirements**:
- [ ] Integrate Sentry or similar
- [ ] Tag errors with `studioId`
- [ ] Alert on critical errors
- [ ] Error dashboard per studio

---

### 3.7 Security Requirements

#### 3.7.1 Data Isolation

**Requirements**:
- [ ] No query should access another studio's data
- [ ] All queries scoped to studio database
- [ ] Testing: Run security audit script
- [ ] Penetration testing before launch

#### 3.7.2 Rate Limiting

**Per Studio Rate Limits**:
```
Login attempts: 5/minute
API calls: 1000/hour (basic), 10000/hour (premium)
File uploads: 100MB/day (basic), 1GB/day (premium)
```

**Requirements**:
- [ ] Implement rate limiting per studio
- [ ] Store limits in Redis
- [ ] Return 429 with `Retry-After` header

#### 3.7.3 Encryption

**Requirements**:
- [ ] Encrypt sensitive data at rest:
  - Customer phone numbers
  - Email addresses
  - Payment info
- [ ] TLS 1.3 for all connections
- [ ] Encrypt database backups

#### 3.7.4 Compliance

**GDPR Requirements**:
- [ ] Data export (studio can download all data as JSON)
- [ ] Data deletion (hard delete after 30 days of soft delete)
- [ ] Privacy policy per studio
- [ ] Cookie consent banner
- [ ] Audit log of data access

---

## 4. Infrastructure Requirements

### 4.1 Hosting

**Recommended Setup**:

**Option 1: DigitalOcean** (Recommended for start)
- Droplet: $40/month (4GB RAM, 2 vCPUs, 80GB SSD)
- Managed PostgreSQL: $60/month (4GB RAM, 2 vCPUs, 61GB storage)
- Spaces (S3): $5/month (250GB)
- **Total**: ~$105/month
- **Capacity**: 50-100 studios

**Option 2: AWS** (For scale)
- EC2: t3.medium ($30/month)
- RDS PostgreSQL: db.t3.medium ($60/month)
- S3: $5/month
- CloudFront CDN: $10/month
- **Total**: ~$105/month

### 4.2 Web Server

**Caddy Configuration**:
```
# /etc/caddy/Caddyfile

# Automatic HTTPS for all domains
{
    email admin@yourplatform.com
    admin off
}

# Wildcard for all tenant domains
:443 {
    tls {
        on_demand
    }
    
    reverse_proxy localhost:3000 {
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote}
    }
}

# HTTP redirect
:80 {
    redir https://{host}{uri} permanent
}
```

**Features**:
- [ ] Automatic SSL (Let's Encrypt)
- [ ] On-demand TLS (provision SSL when new domain added)
- [ ] HTTP/2 and HTTP/3 support
- [ ] Gzip compression
- [ ] Static file caching

### 4.3 Database

**PostgreSQL Configuration**:
```
max_connections = 200
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
work_mem = 5MB
```

**Connection Pooling** (PgBouncer):
- [ ] Install PgBouncer
- [ ] Pool size: 50 per database
- [ ] Transaction mode
- [ ] Max client connections: 1000

### 4.4 Process Management

**PM2 Configuration**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'designer-studio-saas',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### 4.5 Monitoring

**Requirements**:
- [ ] Uptime monitoring (UptimeRobot or similar)
- [ ] Server monitoring (Netdata or Grafana)
- [ ] Application monitoring (Sentry)
- [ ] Log aggregation (Papertrail or Logtail)

---

## 5. Frontend Changes Required

### 5.1 Overview

**Current State**: Hard-coded branding ("urumi by mounika")
**Target State**: Dynamic branding per studio from database

**Key Changes**:
- Dynamic titles, logos, colors from studio context
- Brand-aware components (header, sidebar, footer)
- Studio context provider (React Context)
- Custom CSS injection per studio
- Favicon per studio

---

### 5.2 Core Infrastructure Changes

#### 5.2.1 Studio Context Provider

**Create**: `src/contexts/studio-context.tsx`

```typescript
"use client";

import { createContext, useContext, ReactNode } from "react";

export interface StudioBranding {
  id: string;
  domain: string;
  brandName: string;
  businessName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
  
  // Business info
  email?: string;
  phone?: string;
  address?: string;
  
  // Features
  features: {
    whatsappIntegration?: boolean;
    instagramFeed?: boolean;
    customerPortal?: boolean;
    aiMeasurements?: boolean;
  };
}

interface StudioContextValue {
  studio: StudioBranding;
  isLoading: boolean;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ 
  studio, 
  children 
}: { 
  studio: StudioBranding; 
  children: ReactNode;
}) {
  return (
    <StudioContext.Provider value={{ studio, isLoading: false }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return context;
}
```

#### 5.2.2 Server-Side Studio Resolution

**Update**: `src/middleware.ts`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  
  // Resolve domain to studio
  const studio = await getStudioByDomain(hostname);
  
  if (!studio) {
    return NextResponse.json({ error: "Studio not found" }, { status: 404 });
  }
  
  // Check if studio is active
  if (studio.status === 'suspended') {
    return NextResponse.redirect(new URL('/suspended', request.url));
  }
  
  // Pass studio data to app via headers
  const response = NextResponse.next();
  response.headers.set('x-studio-id', studio.id);
  response.headers.set('x-studio-data', JSON.stringify({
    id: studio.id,
    brandName: studio.brandName,
    logoUrl: studio.logoUrl,
    primaryColor: studio.primaryColor,
    features: studio.features
  }));
  
  return response;
}

async function getStudioByDomain(hostname: string) {
  // Query master database
  const [studio] = await masterDb
    .select()
    .from(studios)
    .where(eq(studios.domain, hostname))
    .limit(1);
  
  return studio;
}
```

#### 5.2.3 Root Layout with Dynamic Branding

**Update**: `src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { StudioProvider } from "@/contexts/studio-context";
import { Toaster } from "@/components/ui/toaster";
import { headers } from "next/headers";
import { getStudioFromHeaders } from "@/lib/multi-tenant/studio";

const inter = Inter({ subsets: ["latin"] });

// Generate dynamic metadata per studio
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const studio = await getStudioFromHeaders(headersList);
  
  return {
    title: studio.brandName,
    description: `${studio.brandName} - Custom Outfit Design & Production`,
    icons: {
      icon: studio.faviconUrl || "/favicon.png",
      apple: studio.faviconUrl || "/favicon.png",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const studio = await getStudioFromHeaders(headersList);
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inject studio custom CSS */}
        {studio.customCss && (
          <style dangerouslySetInnerHTML={{ __html: studio.customCss }} />
        )}
        
        {/* CSS variables for theme colors */}
        <style>{`
          :root {
            --studio-primary: ${studio.primaryColor || '#000000'};
            --studio-secondary: ${studio.secondaryColor || '#666666'};
          }
        `}</style>
      </head>
      <body className={inter.className}>
        <StudioProvider studio={studio}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </StudioProvider>
      </body>
    </html>
  );
}
```

---

### 5.3 Component Updates

#### 5.3.1 Sidebar Component

**Update**: `src/components/sidebar.tsx`

```typescript
"use client";

import { useStudio } from "@/contexts/studio-context";

export function Sidebar({ role, userName }: SidebarProps) {
  const { studio } = useStudio();
  const pathname = usePathname();
  const navItems = roleNavItems[role] || [];
  const [open, setOpen] = useState(false);

  return (
    <aside className="...">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          {studio.logoUrl ? (
            <img 
              src={studio.logoUrl} 
              alt={studio.brandName}
              className="h-8 w-auto"
            />
          ) : (
            <Scissors className="h-6 w-6" style={{ color: studio.primaryColor }} />
          )}
          <span className="text-lg font-bold">{studio.brandName}</span>
        </Link>
      </div>
      
      {/* Rest of sidebar */}
    </aside>
  );
}
```

#### 5.3.2 Login Page

**Update**: `src/app/login/page.tsx`

```typescript
import { getStudioFromRequest } from "@/lib/multi-tenant/studio";

export default async function LoginPage() {
  const studio = await getStudioFromRequest();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {studio.logoUrl ? (
            <img 
              src={studio.logoUrl} 
              alt={studio.brandName}
              className="h-16 mx-auto mb-4"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Scissors className="h-6 w-6 text-primary" />
            </div>
          )}
          <CardTitle className="text-2xl">{studio.brandName}</CardTitle>
          <CardDescription>
            Sign in to manage your production workflow
          </CardDescription>
        </CardHeader>
        {/* Login form */}
      </Card>
    </div>
  );
}
```

#### 5.3.3 Branded Button Component

**Create**: `src/components/ui/branded-button.tsx`

```typescript
"use client";

import { useStudio } from "@/contexts/studio-context";
import { Button, ButtonProps } from "./button";

export function BrandedButton({ style, ...props }: ButtonProps) {
  const { studio } = useStudio();
  
  return (
    <Button
      {...props}
      style={{
        ...style,
        backgroundColor: studio.primaryColor,
        ...props.style
      }}
    />
  );
}
```

#### 5.3.4 Footer Component

**Create**: `src/components/branded-footer.tsx`

```typescript
"use client";

import { useStudio } from "@/contexts/studio-context";

export function BrandedFooter() {
  const { studio } = useStudio();
  
  return (
    <footer className="border-t bg-card py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © 2024 {studio.brandName}. All rights reserved.
          </div>
          
          {studio.email && (
            <div className="flex gap-4 text-sm">
              <a href={`mailto:${studio.email}`} className="hover:text-primary">
                {studio.email}
              </a>
              {studio.phone && (
                <span>|</span>
              )}
              {studio.phone && (
                <a href={`tel:${studio.phone}`} className="hover:text-primary">
                  {studio.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
```

---

### 5.4 Feature-Specific Components

#### 5.4.1 Conditional Feature Rendering

**Pattern**: Use studio features to show/hide components

```typescript
"use client";

import { useStudio } from "@/contexts/studio-context";

export function CustomerPortalLink({ customerId }: { customerId: string }) {
  const { studio } = useStudio();
  
  // Only show if feature is enabled
  if (!studio.features.customerPortal) {
    return null;
  }
  
  return (
    <Button>
      Send Portal Link
    </Button>
  );
}

export function WhatsAppButton({ phone }: { phone: string }) {
  const { studio } = useStudio();
  
  if (!studio.features.whatsappIntegration) {
    return null;
  }
  
  return (
    <Button onClick={() => window.open(`https://wa.me/${phone}`)}>
      Send WhatsApp
    </Button>
  );
}
```

---

### 5.5 CSS & Styling Changes

#### 5.5.1 Update Tailwind Config

**Update**: `tailwind.config.ts`

```typescript
export default {
  theme: {
    extend: {
      colors: {
        // Allow CSS variables for studio colors
        'studio-primary': 'var(--studio-primary)',
        'studio-secondary': 'var(--studio-secondary)',
      }
    }
  }
}
```

#### 5.5.2 Use Studio Colors in Components

```tsx
<Button className="bg-studio-primary hover:bg-studio-primary/90">
  Book Appointment
</Button>

<div className="text-studio-primary">
  Powered by {studio.brandName}
</div>
```

---

### 5.6 Files to Create/Update

#### New Files:
- [ ] `src/contexts/studio-context.tsx` - Studio React context
- [ ] `src/lib/multi-tenant/studio.ts` - Studio utilities
- [ ] `src/lib/multi-tenant/database-manager.ts` - DB connection manager
- [ ] `src/components/branded-footer.tsx` - Branded footer
- [ ] `src/components/ui/branded-button.tsx` - Branded button
- [ ] `src/hooks/use-studio.ts` - Studio hook
- [ ] `src/app/suspended/page.tsx` - Account suspended page
- [ ] `src/app/(admin)/*` - Super admin panel pages

#### Files to Update:
- [ ] `src/app/layout.tsx` - Dynamic metadata & CSS injection
- [ ] `src/middleware.ts` - Domain resolution
- [ ] `src/components/sidebar.tsx` - Dynamic logo & brand name
- [ ] `src/app/login/page.tsx` - Branded login
- [ ] `src/app/dashboard/page.tsx` - Use studio context
- [ ] All upload routes - Add studio context to Cloudinary
- [ ] `tailwind.config.ts` - Add CSS variables
- [ ] `src/lib/auth.ts` - Include studio in JWT

---

### 5.7 Visual Changes Summary

#### Before (Single Tenant):
```
Header: "urumi by mounika" [HARD-CODED]
Logo: Scissors icon [HARD-CODED]
Colors: Default theme [HARD-CODED]
Footer: No contact info
Title: "urumi by mounika" [HARD-CODED]
Favicon: favicon.png [STATIC]
```

#### After (Multi-Tenant):
```
Header: "Elite Designer Studio" [FROM DATABASE]
Logo: elite-logo.png [FROM CLOUDINARY]
Colors: #FF69B4 primary [FROM DATABASE]
Footer: contact@elite.com | +1-555-0100 [FROM DATABASE]
Title: "Elite Designer Studio" [FROM DATABASE]
Favicon: elite-favicon.png [FROM CLOUDINARY]
```

---

### 5.8 Customer Portal Changes

**Update**: `src/app/portal/[token]/page.tsx`

```typescript
export default async function PortalPage({ 
  params 
}: { 
  params: Promise<{ token: string }> 
}) {
  const { token } = await params;
  const studio = await getStudioFromPortalToken(token);
  
  return (
    <StudioProvider studio={studio}>
      <div className="min-h-screen">
        {/* Branded header */}
        <header className="border-b py-4">
          <div className="container mx-auto px-4">
            {studio.logoUrl ? (
              <img 
                src={studio.logoUrl} 
                alt={studio.brandName}
                className="h-12"
              />
            ) : (
              <h1 className="text-2xl font-bold">{studio.brandName}</h1>
            )}
          </div>
        </header>
        
        {/* Portal content */}
        <main className="container mx-auto px-4 py-8">
          {/* Customer orders, etc. */}
        </main>
        
        {/* Branded footer */}
        <BrandedFooter />
      </div>
    </StudioProvider>
  );
}
```

---

### 5.9 Email Templates

**All emails need branding**:

```typescript
// src/lib/email/templates.ts

export function getOrderConfirmationEmail(studio: StudioBranding, order: Order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        .header { 
          background: ${studio.primaryColor || '#000'}; 
          color: white; 
          padding: 20px; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${studio.logoUrl ? 
          `<img src="${studio.logoUrl}" alt="${studio.brandName}" height="50">` :
          `<h1>${studio.brandName}</h1>`
        }
      </div>
      
      <div style="padding: 20px;">
        <h2>Order Confirmation</h2>
        <p>Thank you for your order #${order.orderNumber}</p>
        <!-- Order details -->
      </div>
      
      <div style="padding: 20px; background: #f5f5f5; text-align: center;">
        <p>${studio.brandName}</p>
        <p>${studio.email} | ${studio.phone}</p>
        <p>${studio.address}</p>
      </div>
    </body>
    </html>
  `;
}
```

---

### 5.10 Studio Registration & Onboarding Flow (Frontend)

#### 5.10.1 Public Registration Page

**Create**: `src/app/(public)/signup/page.tsx`

This is the entry point for new studios to register.

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    // Step 1: Business Info
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    
    // Step 2: Desired Domain
    desiredDomain: '',
    
    // Step 3: Admin User
    adminEmail: '',
    adminPassword: '',
    adminName: '',
    
    // Step 4: Subscription Plan
    planType: 'trial' as 'trial' | 'basic' | 'premium'
  });

  async function handleSubmit() {
    setLoading(true);
    
    try {
      const response = await fetch('/api/public/studios/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const { studioId, setupUrl } = await response.json();
        // Redirect to DNS setup instructions
        window.location.href = setupUrl;
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      alert('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Start Your Designer Studio</CardTitle>
          <CardDescription>
            Step {step} of 4 - {getStepTitle(step)}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Progress indicator */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map(s => (
              <div 
                key={s}
                className={`h-2 flex-1 rounded ${s <= step ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Business Name</Label>
                <Input
                  placeholder="Elite Designer Studio"
                  value={formData.businessName}
                  onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Owner Name</Label>
                <Input
                  placeholder="John Smith"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Business Email</Label>
                <Input
                  type="email"
                  placeholder="contact@elitestudio.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Phone Number</Label>
                <Input
                  placeholder="+1 555-0100"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              
              <Button onClick={() => setStep(2)} className="w-full">
                Continue
              </Button>
            </div>
          )}
          
          {/* Step 2: Domain Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Choose Your Domain</Label>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">designer.</span>
                  <Input
                    placeholder="elitestudio"
                    value={formData.desiredDomain}
                    onChange={(e) => setFormData({...formData, desiredDomain: e.target.value})}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.com</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll access your studio at: designer.{formData.desiredDomain || 'yourdomain'}.com
                </p>
              </div>
              
              <div className="p-4 bg-blue-50 rounded border border-blue-200">
                <p className="text-sm text-blue-900">
                  💡 <strong>Don't have a domain?</strong> No worries! We'll provide setup instructions after registration.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create your admin account to manage the studio
              </p>
              
              <div>
                <Label>Admin Name</Label>
                <Input
                  placeholder="John Smith"
                  value={formData.adminName}
                  onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Admin Email</Label>
                <Input
                  type="email"
                  placeholder="admin@elitestudio.com"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({...formData, adminPassword: e.target.value})}
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}
          
          {/* Step 4: Plan Selection */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Trial Plan */}
                <Card 
                  className={`cursor-pointer ${formData.planType === 'trial' ? 'border-primary' : ''}`}
                  onClick={() => setFormData({...formData, planType: 'trial'})}
                >
                  <CardHeader>
                    <CardTitle>Trial</CardTitle>
                    <div className="text-2xl font-bold">Free</div>
                    <CardDescription>14 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-2">
                      <li>✓ 10 customers</li>
                      <li>✓ 20 orders</li>
                      <li>✓ 1GB storage</li>
                    </ul>
                  </CardContent>
                </Card>
                
                {/* Basic Plan */}
                <Card 
                  className={`cursor-pointer ${formData.planType === 'basic' ? 'border-primary' : ''}`}
                  onClick={() => setFormData({...formData, planType: 'basic'})}
                >
                  <CardHeader>
                    <CardTitle>Basic</CardTitle>
                    <div className="text-2xl font-bold">$99<span className="text-sm">/mo</span></div>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-2">
                      <li>✓ 200 customers</li>
                      <li>✓ 500 orders</li>
                      <li>✓ 5GB storage</li>
                    </ul>
                  </CardContent>
                </Card>
                
                {/* Premium Plan */}
                <Card 
                  className={`cursor-pointer ${formData.planType === 'premium' ? 'border-primary' : ''}`}
                  onClick={() => setFormData({...formData, planType: 'premium'})}
                >
                  <CardHeader>
                    <CardTitle>Premium</CardTitle>
                    <div className="text-2xl font-bold">$199<span className="text-sm">/mo</span></div>
                  </CardHeader>
                  <CardContent>
                    <ul className="text-sm space-y-2">
                      <li>✓ Unlimited customers</li>
                      <li>✓ Unlimited orders</li>
                      <li>✓ 50GB storage</li>
                      <li>✓ Custom CSS</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? 'Creating Studio...' : 'Complete Registration'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getStepTitle(step: number) {
  switch(step) {
    case 1: return 'Business Information';
    case 2: return 'Domain Setup';
    case 3: return 'Admin Account';
    case 4: return 'Choose Plan';
    default: return '';
  }
}
```

#### 5.10.2 Registration API Endpoint

**Create**: `src/app/api/public/studios/register/route.ts`

```typescript
import { NextResponse } from "next/server";
import { masterDb } from "@/lib/db/master";
import { studios } from "@/lib/db/master-schema";
import { generatePrefixedId } from "@/lib/id";
import { hash } from "bcryptjs";
import { createTenantDatabase, runTenantMigrations } from "@/lib/multi-tenant/database-manager";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessName,
      ownerName,
      email,
      phone,
      desiredDomain,
      adminName,
      adminEmail,
      adminPassword,
      planType
    } = body;
    
    // Validate required fields
    if (!businessName || !email || !desiredDomain || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check if domain already exists
    const existingStudio = await masterDb
      .select()
      .from(studios)
      .where(eq(studios.domain, `designer.${desiredDomain}.com`))
      .limit(1);
    
    if (existingStudio.length > 0) {
      return NextResponse.json(
        { error: 'Domain already taken' },
        { status: 409 }
      );
    }
    
    // Generate IDs
    const studioId = generatePrefixedId('stu');
    const databaseName = `studio_${studioId.toLowerCase()}_db`;
    const domain = `designer.${desiredDomain}.com`;
    
    // Create studio in master database
    await masterDb.insert(studios).values({
      id: studioId,
      domain,
      database_name: databaseName,
      status: planType === 'trial' ? 'trial' : 'active',
      brand_name: businessName,
      business_name: businessName,
      business_email: email,
      business_phone: phone,
      plan_type: planType,
      trial_ends_at: planType === 'trial' 
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        : null,
      dns_verified: false,
      features: {
        whatsappIntegration: false,
        instagramFeed: false,
        customerPortal: true,
        aiMeasurements: false
      }
    });
    
    // Create tenant database
    await createTenantDatabase(databaseName);
    
    // Run migrations on tenant database
    await runTenantMigrations(databaseName);
    
    // Create admin user in tenant database
    const tenantDb = getTenantDb(databaseName);
    const hashedPassword = await hash(adminPassword, 10);
    
    await tenantDb.insert(users).values({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      active: true
    });
    
    // Create DNS verification record
    const verificationToken = generateRandomToken();
    await masterDb.insert(dnsRecords).values({
      studio_id: studioId,
      domain,
      record_type: 'TXT',
      record_name: `_verification.${domain}`,
      record_value: verificationToken
    });
    
    // Send welcome email
    await sendWelcomeEmail(email, {
      businessName,
      domain,
      adminEmail,
      setupUrl: `https://app.yourplatform.com/setup/${studioId}`
    });
    
    return NextResponse.json({
      success: true,
      studioId,
      domain,
      setupUrl: `/setup/${studioId}`,
      message: 'Studio created successfully!'
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
```

#### 5.10.3 DNS Setup Instructions Page

**Create**: `src/app/setup/[studioId]/page.tsx`

```typescript
export default async function SetupPage({
  params
}: {
  params: Promise<{ studioId: string }>
}) {
  const { studioId } = await params;
  const studio = await getStudioById(studioId);
  const dnsRecords = await getDNSRecords(studioId);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 p-4">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>🎉 Welcome to Your Designer Studio!</CardTitle>
          <CardDescription>
            Your studio has been created. Follow these steps to complete setup.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Step 1: DNS Setup */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Step 1: Configure Your Domain</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add these DNS records to your domain registrar (GoDaddy, Namecheap, etc.)
            </p>
            
            <div className="bg-gray-50 p-4 rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2">Type</th>
                    <th className="text-left pb-2">Name</th>
                    <th className="text-left pb-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2">CNAME</td>
                    <td className="py-2 font-mono text-xs">designer</td>
                    <td className="py-2 font-mono text-xs">proxy.yourplatform.com</td>
                  </tr>
                  <tr>
                    <td className="py-2">TXT</td>
                    <td className="py-2 font-mono text-xs">_verification</td>
                    <td className="py-2 font-mono text-xs">{dnsRecords.verificationToken}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <Button className="mt-4" onClick={() => checkDNS(studioId)}>
              I've Added DNS Records - Verify Now
            </Button>
          </div>
          
          {/* Step 2: Branding */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Step 2: Upload Your Branding</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Customize your studio's appearance
            </p>
            
            <Button variant="outline" asChild>
              <Link href={`/setup/${studioId}/branding`}>
                Configure Branding →
              </Link>
            </Button>
          </div>
          
          {/* Step 3: Cloudinary (Optional) */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Step 3: Connect Your Cloudinary (Optional)</h3>
            <p className="text-sm text-muted-foreground mb-4">
              For unlimited storage, connect your own Cloudinary account
            </p>
            
            <Button variant="outline" asChild>
              <Link href={`/setup/${studioId}/cloudinary`}>
                Connect Cloudinary →
              </Link>
            </Button>
          </div>
          
          {/* Step 4: Payment */}
          {studio.planType !== 'trial' && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Step 4: Setup Payment</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add payment method to activate your subscription
              </p>
              
              <Button asChild>
                <Link href={`/setup/${studioId}/payment`}>
                  Add Payment Method →
                </Link>
              </Button>
            </div>
          )}
          
          {/* Access Studio */}
          <div className="pt-4 border-t">
            <Button className="w-full" size="lg" asChild>
              <Link href={`https://${studio.domain}/login`}>
                Access Your Studio →
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 5.10.4 Branding Setup Page

**Create**: `src/app/setup/[studioId]/branding/page.tsx`

```typescript
"use client";

export default function BrandingSetupPage() {
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#000000');
  
  async function handleSave() {
    // Upload logo to Cloudinary
    const logoUrl = await uploadFile(logo);
    const faviconUrl = await uploadFile(favicon);
    
    // Update studio branding in master database
    await fetch(`/api/admin/studios/${studioId}/branding`, {
      method: 'PATCH',
      body: JSON.stringify({
        logoUrl,
        faviconUrl,
        primaryColor
      })
    });
    
    alert('Branding saved!');
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Studio Branding</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Logo Upload */}
        <div>
          <Label>Logo (PNG/SVG recommended)</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] || null)}
          />
        </div>
        
        {/* Favicon Upload */}
        <div>
          <Label>Favicon (32x32 PNG)</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setFavicon(e.target.files?.[0] || null)}
          />
        </div>
        
        {/* Primary Color */}
        <div>
          <Label>Primary Color</Label>
          <Input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
          />
        </div>
        
        <Button onClick={handleSave}>
          Save Branding
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

### 5.10.5 Files to Create for Registration Flow

**New Frontend Pages:**
- [ ] `src/app/(public)/signup/page.tsx` - Multi-step registration form
- [ ] `src/app/setup/[studioId]/page.tsx` - DNS setup instructions
- [ ] `src/app/setup/[studioId]/branding/page.tsx` - Logo/color upload
- [ ] `src/app/setup/[studioId]/cloudinary/page.tsx` - Connect Cloudinary
- [ ] `src/app/setup/[studioId]/payment/page.tsx` - Stripe payment setup

**New API Routes:**
- [ ] `src/app/api/public/studios/register/route.ts` - Create studio & DB
- [ ] `src/app/api/public/studios/check-domain/route.ts` - Check domain availability
- [ ] `src/app/api/admin/studios/[id]/branding/route.ts` - Update branding
- [ ] `src/app/api/admin/studios/[id]/dns/verify/route.ts` - Verify DNS setup

**Utilities:**
- [ ] `src/lib/multi-tenant/database-manager.ts` - Create/manage tenant DBs
- [ ] `src/lib/multi-tenant/dns-verifier.ts` - DNS verification logic
- [ ] `src/lib/email/welcome.ts` - Welcome email template

---

### 5.10.6 Registration Flow Summary

```
1. Customer visits: yourplatform.com/signup
   ↓
2. Fills multi-step form:
   - Business info
   - Desired domain
   - Admin credentials
   - Plan selection
   ↓
3. Submits → API creates:
   - Master DB: Studio record
   - PostgreSQL: New tenant database
   - Runs migrations on tenant DB
   - Creates admin user
   ↓
4. Redirects to: /setup/[studioId]
   ↓
5. Shows DNS setup instructions
   ↓
6. Customer adds DNS records
   ↓
7. Verifies DNS → SSL auto-provisioned
   ↓
8. Customer uploads logo/branding
   ↓
9. (Optional) Connects Cloudinary
   ↓
10. (If paid plan) Adds payment method
    ↓
11. Complete! → Access studio at designer.theirdomain.com
```

---

### 5.10 Testing Checklist

Frontend testing requirements:

- [ ] Login page shows correct branding per domain
- [ ] Sidebar shows correct logo and brand name
- [ ] Custom colors apply throughout UI
- [ ] Favicon updates per studio
- [ ] Page title updates per studio
- [ ] Footer shows correct contact info
- [ ] Customer portal is branded
- [ ] Email templates include branding
- [ ] Feature flags work (hide/show features)
- [ ] Custom CSS applies correctly
- [ ] Suspended page shows when status = suspended
- [ ] Mobile responsive with custom branding
- [ ] **Registration flow completes successfully**
- [ ] **DNS verification works**
- [ ] **Branding upload updates in real-time**
- [ ] **Payment integration works**

---

## 5. Migration Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Set up master database
- [ ] Create multi-tenant middleware
- [ ] Implement domain resolver
- [ ] Database connection manager
- [ ] Migration scripts for all tenants

### Phase 2: Admin Panel (Week 3-4)
- [ ] Super admin authentication
- [ ] Studio management CRUD
- [ ] DNS verification system
- [ ] Branding management UI
- [ ] Studio usage dashboard

### Phase 3: Billing (Week 5)
- [ ] Stripe integration
- [ ] Subscription plans
- [ ] Webhook handlers
- [ ] Trial management
- [ ] Payment failure handling

### Phase 4: Branding (Week 6)
- [ ] Theme provider
- [ ] Branded components
- [ ] Logo/favicon rendering
- [ ] Custom CSS support
- [ ] Email template branding

### Phase 5: Security & Testing (Week 7)
- [ ] Rate limiting
- [ ] Security audit
- [ ] Load testing (simulate 100 studios)
- [ ] Penetration testing
- [ ] Data isolation verification

### Phase 6: Deployment (Week 8)
- [ ] Production server setup
- [ ] Caddy configuration
- [ ] DNS configuration
- [ ] SSL setup
- [ ] Backup automation
- [ ] Monitoring setup

### Phase 7: Launch (Week 9)
- [ ] Migrate existing studio to tenant DB
- [ ] Onboard first paying customer
- [ ] Documentation
- [ ] Support system

---

## 6. Testing Requirements

### 6.1 Unit Tests
- [ ] Domain resolver
- [ ] Database connection manager
- [ ] Branding utilities
- [ ] Billing logic
- [ ] Migration runner

### 6.2 Integration Tests
- [ ] Multi-tenant request flow
- [ ] Database isolation (cannot access other tenant data)
- [ ] Stripe webhook handling
- [ ] DNS verification

### 6.3 Load Tests
- [ ] 100 concurrent studios
- [ ] 1000 requests/second
- [ ] Database connection pooling
- [ ] Memory usage under load

### 6.4 Security Tests
- [ ] SQL injection attempts across tenants
- [ ] Attempt to access other studio's data
- [ ] Rate limit bypass attempts
- [ ] XSS and CSRF testing

---

## 7. Documentation Requirements

### 7.1 Technical Documentation
- [ ] Architecture diagram
- [ ] Database schema documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide

### 7.2 User Documentation
- [ ] Studio setup guide
- [ ] Branding customization guide
- [ ] DNS configuration guide
- [ ] Billing FAQ
- [ ] Support contact info

### 7.3 Admin Documentation
- [ ] How to onboard new studio
- [ ] How to troubleshoot issues
- [ ] How to run migrations
- [ ] How to restore backups
- [ ] Emergency procedures

---

## 8. Success Metrics

### 8.1 Technical Metrics
- Uptime: 99.9%
- Page load time: < 200ms (p95)
- Database query time: < 50ms (p95)
- Zero data leakage incidents

### 8.2 Business Metrics
- 10 paying studios in first 3 months
- MRR: $1,500+ by month 3
- Churn rate: < 5%
- Customer satisfaction: 4.5/5 stars

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data leakage between tenants | Critical | Separate databases, security audit, tests |
| Database connection exhaustion | High | Connection pooling, monitoring, limits |
| SSL provisioning failure | Medium | Manual fallback, monitoring, alerts |
| Payment processing issues | High | Stripe status checks, grace period, alerts |
| Storage exhaustion | Medium | Quotas per studio, monitoring, upgrade prompts |
| Downtime during migrations | Medium | Zero-downtime migration strategy, maintenance window |

---

## 10. Budget Estimate

### 10.1 Development Cost
- Development time: 9 weeks
- Developer rate: $50/hour
- Hours: 320 hours (40h/week * 8 weeks)
- **Total**: $16,000

### 10.2 Infrastructure Cost (Monthly)
- Server: $40
- Database: $60
- Storage: $5
- CDN: $10
- Monitoring: $10
- **Total**: $125/month

### 10.3 Revenue Projection
- 10 studios @ $150/month = $1,500/month
- 50 studios @ $150/month = $7,500/month
- 100 studios @ $150/month = $15,000/month

**Break-even**: 1 studio (covers infrastructure)
**ROI**: 6 months to recover development cost (at 10 studios)

---

## 11. Next Steps

### Immediate Actions
1. ✅ Review and approve this requirements document
2. [ ] Set up staging environment
3. [ ] Create GitHub project board
4. [ ] Begin Phase 1: Foundation

### Questions to Answer
1. Which hosting provider? (DigitalOcean recommended)
2. Payment processor? (Stripe recommended)
3. Custom domain policy? (Require DNS verification?)
4. Trial length? (14 days recommended)
5. Pricing model? (Tiered vs usage-based?)

---

## 12. Appendix

### 12.1 Technology Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Authentication**: JWT (jose)
- **Payment**: Stripe
- **File Storage**: Local filesystem → S3/Spaces
- **Web Server**: Caddy
- **Process Manager**: PM2
- **Monitoring**: Sentry, Uptime Robot
- **Email**: SendGrid or AWS SES

### 12.2 Reference Projects
- Shopify (multi-store architecture)
- Slack (workspace model)
- Ghost (multi-tenant CMS)
- Cal.com (open-source scheduling with multi-tenancy)

### 12.3 Useful Resources
- [Multi-Tenancy in SaaS](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/multi-tenancy-in-saas.html)
- [Database-per-Tenant Pattern](https://martinfowler.com/articles/multi-tenant-saas.html)
- [Stripe Billing Best Practices](https://stripe.com/docs/billing/subscriptions/overview)

---

**Document Owner**: Development Team
**Last Updated**: 2026-11-05
**Status**: Draft → Ready for Implementation
