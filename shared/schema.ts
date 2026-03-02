import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, sessions } from "./models/auth";

export { users, sessions };

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  addressStreetNumber: text("address_street_number"),
  addressStreetName: text("address_street_name"),
  addressUnitNumber: text("address_unit_number"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  location: text("location").notNull(),
  beds: integer("beds").notNull(),
  baths: decimal("baths").notNull(),
  sqft: integer("sqft").notNull(),
  lotSize: integer("lot_size"),
  hoaFee: integer("hoa_fee"),
  isOffMarket: boolean("is_off_market").default(false).notNull(), // For the make me move feature
  agentId: varchar("agent_id").references(() => users.id),
  imageUrl: text("image_url"),
  status: text("status").default("active").notNull(), // active, pending, sold
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedProperties = pgTable("saved_properties", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedSearches = pgTable("saved_searches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  criteria: jsonb("criteria").notNull(), // e.g., { minPrice, maxPrice, beds, location }
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  agent: one(users, {
    fields: [properties.agentId],
    references: [users.id],
  }),
  savedBy: many(savedProperties),
}));

export const savedPropertiesRelations = relations(savedProperties, ({ one }) => ({
  user: one(users, {
    fields: [savedProperties.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [savedProperties.propertyId],
    references: [properties.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

// Schemas
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertSavedPropertySchema = createInsertSchema(savedProperties).omit({ id: true, createdAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });

// Types
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type SavedProperty = typeof savedProperties.$inferSelect;
export type InsertSavedProperty = z.infer<typeof insertSavedPropertySchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;

// Request Types
export type CreatePropertyRequest = InsertProperty;
export type UpdatePropertyRequest = Partial<InsertProperty>;
export type PropertyResponse = Property & { agent?: typeof users.$inferSelect | null };
export type SavedPropertyResponse = SavedProperty & { property: Property };
export type SavedSearchResponse = SavedSearch;

// Criteria JSON type
export const searchCriteriaSchema = z.object({
  location: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minBeds: z.number().optional(),
  minBaths: z.number().optional(),
  minSqft: z.number().optional(),
  maxHoaFee: z.number().optional(),
});
export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;
