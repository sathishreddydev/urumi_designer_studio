/**
 * ⚠️  DEPRECATED — DO NOT USE
 *
 * This file is an old, out-of-sync schema definition that is NOT used by the application.
 * The canonical schema is at:  src/lib/db/schema.ts
 *
 * This file is kept only to avoid breaking any external tooling that may reference it,
 * but it should not be imported in application code.
 *
 * Differences from the real schema:
 *  - Uses gen_random_uuid() instead of app-generated prefixed IDs
 *  - Uses lowercase enum values instead of UPPER_CASE
 *  - Missing columns: orders.estimatedAmount, orders.advanceAmount
 *  - Missing columns: payments.status, payments.transactionRef, payments.outfitId,
 *                     payments.invoiceId, payments.customerId
 *  - Missing tables: invoices, customerMeasurements (partially), measurementTemplates
 *  - Missing: outfits.price, outfits.trialNotes, outfits.alterationNotes
 */

export {};
