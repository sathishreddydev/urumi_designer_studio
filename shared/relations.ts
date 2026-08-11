import { relations } from "drizzle-orm";
import {
  users,
  customers,
  orders,
  outfits,
  measurements,
  referenceImages,
  dependencies,
  payments,
  productionLogs,
  auditLogs,
} from "./tables";

export const usersRelations = relations(users, ({ many }) => ({
  assignedOutfits: many(outfits, { relationName: "designer" }),
  masterOutfits: many(outfits, { relationName: "master" }),
  raisedDependencies: many(dependencies),
  auditLogs: many(auditLogs),
  productionLogs: many(productionLogs),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  outfits: many(outfits),
  payments: many(payments),
}));

export const outfitsRelations = relations(outfits, ({ one, many }) => ({
  order: one(orders, {
    fields: [outfits.orderId],
    references: [orders.id],
  }),
  designer: one(users, {
    fields: [outfits.designerId],
    references: [users.id],
    relationName: "designer",
  }),
  master: one(users, {
    fields: [outfits.masterId],
    references: [users.id],
    relationName: "master",
  }),
  measurements: many(measurements),
  references: many(referenceImages),
  dependencies: many(dependencies),
  productionLogs: many(productionLogs),
}));

export const measurementsRelations = relations(measurements, ({ one }) => ({
  outfit: one(outfits, {
    fields: [measurements.outfitId],
    references: [outfits.id],
  }),
}));

export const referenceImagesRelations = relations(referenceImages, ({ one }) => ({
  outfit: one(outfits, {
    fields: [referenceImages.outfitId],
    references: [outfits.id],
  }),
}));

export const dependenciesRelations = relations(dependencies, ({ one }) => ({
  outfit: one(outfits, {
    fields: [dependencies.outfitId],
    references: [outfits.id],
  }),
  raisedByUser: one(users, {
    fields: [dependencies.raisedBy],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const productionLogsRelations = relations(productionLogs, ({ one }) => ({
  outfit: one(outfits, {
    fields: [productionLogs.outfitId],
    references: [outfits.id],
  }),
  createdByUser: one(users, {
    fields: [productionLogs.createdBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
