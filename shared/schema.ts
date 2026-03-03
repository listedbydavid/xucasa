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
  isOffMarket: boolean("is_off_market").default(false).notNull(),
  agentId: varchar("agent_id").references(() => users.id),
  lat: decimal("lat"),
  lng: decimal("lng"),
  imageUrl: text("image_url"),
  photos: text("photos").array(),
  openHouseDate: timestamp("open_house_date"),
  openHouseTime: text("open_house_time"),
  status: text("status").default("active").notNull(),
  // IDX / MLS sync fields
  source: text("source").default("manual").notNull(),   // 'manual' | 'idx'
  idxId: text("idx_id").unique(),                       // IDX Broker listingID
  mlsNumber: text("mls_number"),                        // MLS # displayed to users
  listDate: timestamp("list_date"),                     // When listed on MLS
  idxUpdatedAt: timestamp("idx_updated_at"),            // Last sync from IDX
  createdAt: timestamp("created_at").defaultNow(),
});

// Tracks each IDX sync run for admin visibility
export const idxSyncLog = pgTable("idx_sync_log", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("running"), // 'running' | 'success' | 'error'
  added: integer("added").default(0),
  updated: integer("updated").default(0),
  removed: integer("removed").default(0),
  total: integer("total").default(0),
  error: text("error"),
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
  criteria: jsonb("criteria").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const searchHistory = pgTable("search_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  query: text("query").notNull(),
  criteria: jsonb("criteria").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userHomes = pgTable("user_homes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  nickname: text("nickname").notNull(),
  addressStreetNumber: text("address_street_number"),
  addressStreetName: text("address_street_name"),
  addressUnitNumber: text("address_unit_number"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  notes: text("notes"),
  lat: decimal("lat"),
  lng: decimal("lng"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientAgentLinks = pgTable("client_agent_links", {
  id: serial("id").primaryKey(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentEmail: text("agent_email").notNull(),
  agentId: varchar("agent_id").references(() => users.id),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  agent: one(users, { fields: [properties.agentId], references: [users.id] }),
  savedBy: many(savedProperties),
}));

export const savedPropertiesRelations = relations(savedProperties, ({ one }) => ({
  user: one(users, { fields: [savedProperties.userId], references: [users.id] }),
  property: one(properties, { fields: [savedProperties.propertyId], references: [properties.id] }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, { fields: [savedSearches.userId], references: [users.id] }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, { fields: [searchHistory.userId], references: [users.id] }),
}));

export const userHomesRelations = relations(userHomes, ({ one }) => ({
  user: one(users, { fields: [userHomes.userId], references: [users.id] }),
}));

export const clientAgentLinksRelations = relations(clientAgentLinks, ({ one }) => ({
  client: one(users, { fields: [clientAgentLinks.clientId], references: [users.id] }),
  agent: one(users, { fields: [clientAgentLinks.agentId], references: [users.id] }),
}));

export const sellLeads = pgTable("sell_leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  fullAddress: text("full_address"),
  addressStreetNumber: text("address_street_number"),
  addressStreetName: text("address_street_name"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  beds: integer("beds"),
  baths: decimal("baths"),
  sqft: integer("sqft"),
  lotSize: integer("lot_size"),
  yearBuilt: integer("year_built"),
  homeType: text("home_type"),
  condition: text("condition"),
  hoaFee: integer("hoa_fee"),
  timeline: text("timeline"),
  motivation: text("motivation"),
  estimatedValue: integer("estimated_value"),
  lat: decimal("lat"),
  lng: decimal("lng"),
  agentNote: text("agent_note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buyerProfiles = pgTable("buyer_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  displayName: text("display_name").notNull(),
  preApprovalAmount: integer("pre_approval_amount").notNull(),
  minBeds: integer("min_beds"),
  maxBeds: integer("max_beds"),
  minBaths: decimal("min_baths"),
  minSqft: integer("min_sqft"),
  maxSqft: integer("max_sqft"),
  minLotSize: integer("min_lot_size"),
  preferredCities: text("preferred_cities").array(),
  homeTypes: text("home_types").array(),
  mustHaves: text("must_haves").array(),
  niceToHaves: text("nice_to_haves").array(),
  dealBreakers: text("deal_breakers").array(),
  moveInTimeline: text("move_in_timeline"),
  bio: text("bio"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buyerMatches = pgTable("buyer_matches", {
  id: serial("id").primaryKey(),
  buyerProfileId: integer("buyer_profile_id").references(() => buyerProfiles.id).notNull(),
  propertyId: integer("property_id").references(() => properties.id),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  message: text("message"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buyerProfilesRelations = relations(buyerProfiles, ({ one, many }) => ({
  user: one(users, { fields: [buyerProfiles.userId], references: [users.id] }),
  matches: many(buyerMatches),
}));

export const buyerMatchesRelations = relations(buyerMatches, ({ one }) => ({
  buyerProfile: one(buyerProfiles, { fields: [buyerMatches.buyerProfileId], references: [buyerProfiles.id] }),
  property: one(properties, { fields: [buyerMatches.propertyId], references: [properties.id] }),
  sender: one(users, { fields: [buyerMatches.senderId], references: [users.id] }),
}));

// Insert Schemas
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertSellLeadSchema = createInsertSchema(sellLeads).omit({ id: true, createdAt: true });
export const insertBuyerProfileSchema = createInsertSchema(buyerProfiles).omit({ id: true, createdAt: true });
export const insertBuyerMatchSchema = createInsertSchema(buyerMatches).omit({ id: true, createdAt: true });
export const insertSavedPropertySchema = createInsertSchema(savedProperties).omit({ id: true, createdAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertUserHomeSchema = createInsertSchema(userHomes).omit({ id: true, createdAt: true });
export const insertClientAgentLinkSchema = createInsertSchema(clientAgentLinks).omit({ id: true, createdAt: true });

// Types
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type SavedProperty = typeof savedProperties.$inferSelect;
export type InsertSavedProperty = z.infer<typeof insertSavedPropertySchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type UserHome = typeof userHomes.$inferSelect;
export type InsertUserHome = z.infer<typeof insertUserHomeSchema>;
export type ClientAgentLink = typeof clientAgentLinks.$inferSelect;
export type InsertClientAgentLink = z.infer<typeof insertClientAgentLinkSchema>;
export type SellLead = typeof sellLeads.$inferSelect;
export type InsertSellLead = z.infer<typeof insertSellLeadSchema>;
export type BuyerProfile = typeof buyerProfiles.$inferSelect;
export type InsertBuyerProfile = z.infer<typeof insertBuyerProfileSchema>;
export type BuyerMatch = typeof buyerMatches.$inferSelect;
export type InsertBuyerMatch = z.infer<typeof insertBuyerMatchSchema>;

// Request Types
export type CreatePropertyRequest = InsertProperty;
export type UpdatePropertyRequest = Partial<InsertProperty>;
export type PropertyResponse = Property & { agent?: typeof users.$inferSelect | null };
export type SavedPropertyResponse = SavedProperty & { property: Property };
export type SavedSearchResponse = SavedSearch;
export type SearchHistoryResponse = SearchHistory;
export type UserHomeResponse = UserHome;

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
