# Tasks: Role-Based Access Control & Production Workflow

## Task 1: Create Permission Service
- [ ] Create `src/lib/permissions.ts` with:
  - Role type, Resource type, Action type definitions
  - PERMISSION_MATRIX constant mapping all 5 roles × 11 resources × actions
  - `hasPermission(role, resource, action, context?)` function
  - `requirePermission()` that throws on failure
  - Admin always returns true (full access override)
  - Master contextual check (assigned outfits only)

## Task 2: Create Workflow State Machine
- [ ] Create `src/lib/workflow.ts` with:
  - TRANSITION_RULES array (18 rules) with from/to/allowedRoles/preconditions
  - `validateTransition(outfitId, from, to, role, context)` function
  - `getAvailableTransitions(outfitId, currentStatus, role)` function
  - `evaluatePrecondition(outfitId, precondition)` function
  - Precondition types: references_locked, no_pending_dependencies, maggam_required, maggam_not_required

## Task 3: Create API Permission Guard
- [ ] Create `src/lib/api-guard.ts` with:
  - `withPermission(config, handler)` wrapper
  - Extracts session, checks permission, passes to handler
  - Returns 401/403 with descriptive messages
  - Handles concurrent status updates (409 conflict)

## Task 4: Create Status Transition API Endpoint
- [ ] Create `src/app/api/outfits/[id]/transition/route.ts`
  - POST handler using `withPermission` + `validateTransition`
  - Updates outfit status in DB
  - Creates productionLog entry (audit)
  - Returns new status + available next transitions

## Task 5: Update All API Routes with Permission Guards
- [ ] Update `src/app/api/customers/route.ts` — create: ADMIN+RECEPTION, read: all staff
- [ ] Update `src/app/api/customers/[id]/route.ts` — update: ADMIN+RECEPTION
- [ ] Update `src/app/api/orders/route.ts` — create: ADMIN+RECEPTION, read: all staff
- [ ] Update `src/app/api/orders/[id]/route.ts` — update: ADMIN+RECEPTION
- [ ] Update `src/app/api/outfits/route.ts` — create: ADMIN+RECEPTION+DESIGNER
- [ ] Update `src/app/api/outfits/[id]/route.ts` — use workflow for status changes
- [ ] Update `src/app/api/outfits/[id]/measurements/route.ts` — create/edit: ADMIN+DESIGNER
- [ ] Update `src/app/api/outfits/[id]/references/route.ts` — upload/select/lock: ADMIN+DESIGNER
- [ ] Update `src/app/api/outfits/[id]/dependencies/route.ts` — create: ADMIN+MASTER
- [ ] Update `src/app/api/payments/route.ts` — create: ADMIN+RECEPTION
- [ ] Update `src/app/api/users/route.ts` — ADMIN only

## Task 6: Add Master Data Scoping
- [ ] In outfits GET API: filter by masterId when role is MASTER
- [ ] In outfit detail API: verify master is assigned before returning data
- [ ] In references API: only return LOCKED references for MASTER role
- [ ] In measurements API: read-only for MASTER (no create/update)

## Task 7: Create Client Permission Hook
- [ ] Create `src/hooks/use-permissions.ts`
  - `usePermissions()` hook that reads session from API/context
  - Exposes `can(action, resource)` helper
  - Exposes `role`, `isAdmin` properties

## Task 8: Update Sidebar with Role-Based Navigation
- [ ] Already partially done — verify sidebar items match permission matrix
- [ ] Add badge counts for Master (production card count)
- [ ] Hide settings/users for non-Admin roles

## Task 9: Update Outfit Detail Page with Workflow UI
- [ ] Show available transitions as buttons based on role
- [ ] Disable status buttons if preconditions not met
- [ ] Show precondition hints (e.g., "Lock references first")
- [ ] Hide internal data (designer notes, dependencies) from Master

## Task 10: Update Customer Portal Data Filtering
- [ ] Portal API: Never return designerNotes, specialInstructions, staff names, dependencies
- [ ] Only return LOCKED references
- [ ] Only return basic status + dates + payment summary
