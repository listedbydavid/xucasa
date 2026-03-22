import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, varchar, uniqueIndex } from "drizzle-orm/pg-core";
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
  addressCounty: text("address_county"),
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
  propertyType: text("property_type"),                   // SFH, Condo, Townhome, Land, Multi-Family, etc.
  listDate: timestamp("list_date"),                     // When listed on MLS
  idxUpdatedAt: timestamp("idx_updated_at"),            // Last sync from IDX
  // SDMLS 12.16(e) listing attribution
  listingBrokerage: text("listing_brokerage"),
  listingAgentName: text("listing_agent_name"),
  listingAgentEmail: text("listing_agent_email"),
  listingAgentPhone: text("listing_agent_phone"),
  // Agent MLS confidential fields (visible only to verified agents)
  confidentialRemarks: text("confidential_remarks"),
  showingInstructions: text("showing_instructions"),
  showingContactName: text("showing_contact_name"),
  showingContactPhone: text("showing_contact_phone"),
  lockboxType: text("lockbox_type"),
  accessInstructions: text("access_instructions"),
  listingAgentMlsId: text("listing_agent_mls_id"),
  listingAgentLicenseNumber: text("listing_agent_license_number"),
  coListingAgentName: text("co_listing_agent_name"),
  coListingAgentEmail: text("co_listing_agent_email"),
  coListingAgentPhone: text("co_listing_agent_phone"),
  listingOfficeMlsId: text("listing_office_mls_id"),
  listingOfficePhone: text("listing_office_phone"),
  buyerAgentCommission: text("buyer_agent_commission"),
  specialConditions: text("special_conditions"),
  mlsDocuments: jsonb("mls_documents"),
  virtualTourUrl: text("virtual_tour_url"),
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

export const favoriteLists = pgTable("favorite_lists", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedProperties = pgTable("saved_properties", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  listId: integer("list_id").references(() => favoriteLists.id),
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
  beds: integer("beds"),
  baths: decimal("baths"),
  sqft: integer("sqft"),
  lotSize: integer("lot_size"),
  yearBuilt: integer("year_built"),
  homeType: text("home_type"),
  purchasePrice: integer("purchase_price"),
  purchaseDate: text("purchase_date"),
  principalBalance: integer("principal_balance"),
  appraisedValue: integer("appraised_value"),
  interestRate: decimal("interest_rate"),
  loanTerm: integer("loan_term"),
  monthlyPayment: integer("monthly_payment"),
  loanType: text("loan_type"),
  estimatedValue: integer("estimated_value"),
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
  needsToBuyNext: boolean("needs_to_buy_next").default(false),
  hasAgent: boolean("has_agent").default(false),
  sellerAgentName: text("seller_agent_name"),
  sellerAgentPhone: text("seller_agent_phone"),
  sellerAgentEmail: text("seller_agent_email"),
  agentId: varchar("agent_id").references(() => users.id),
  needsLenderReferral: boolean("needs_lender_referral").default(false),
  needsAgentReferral: boolean("needs_agent_referral").default(false),
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
  agentId: varchar("agent_id").references(() => users.id),
  clientName: text("client_name"),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  isPreApproved: boolean("is_pre_approved").default(false),
  preApprovalLetter: text("pre_approval_letter"),
  lenderName: text("lender_name"),
  lenderPhone: text("lender_phone"),
  lenderEmail: text("lender_email"),
  hasAgent: boolean("has_agent").default(false),
  buyerAgentName: text("buyer_agent_name"),
  buyerAgentPhone: text("buyer_agent_phone"),
  buyerAgentEmail: text("buyer_agent_email"),
  needsLenderReferral: boolean("needs_lender_referral").default(false),
  needsAgentReferral: boolean("needs_agent_referral").default(false),
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

export const sellerPitches = pgTable("seller_pitches", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  fullAddress: text("full_address"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  beds: integer("beds"),
  baths: decimal("baths"),
  sqft: integer("sqft"),
  lotSize: integer("lot_size"),
  price: integer("price"),
  homeType: text("home_type"),
  condition: text("condition"),
  description: text("description"),
  photos: text("photos").array(),
  timeline: text("timeline"),
  status: text("status").default("new").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sellerPitchesRelations = relations(sellerPitches, ({ one }) => ({
  user: one(users, { fields: [sellerPitches.userId], references: [users.id] }),
}));

export const propertyOffers = pgTable("property_offers", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  buyerProfileId: integer("buyer_profile_id").references(() => buyerProfiles.id),
  sellerUserId: varchar("seller_user_id").references(() => users.id),
  listingAgentId: varchar("listing_agent_id").references(() => users.id),
  buyerAgentId: varchar("buyer_agent_id").references(() => users.id),
  offerPrice: integer("offer_price"),
  escrowLengthDays: integer("escrow_length_days"),
  inspectionContingencyDays: integer("inspection_contingency_days"),
  loanContingencyDays: integer("loan_contingency_days"),
  appraisalContingencyDays: integer("appraisal_contingency_days"),
  insuranceContingencyDays: integer("insurance_contingency_days"),
  disclosureReviewDays: integer("disclosure_review_days"),
  leasedLienedItemsDays: integer("leased_liened_items_days"),
  sellerConcessions: integer("seller_concessions"),
  sellerConcessionNotes: text("seller_concession_notes"),
  buydownOffered: boolean("buydown_offered").default(false),
  buydownType: text("buydown_type"),
  buydownAmount: integer("buydown_amount"),
  additionalTerms: text("additional_terms"),
  status: text("status").default("pending_agent_review").notNull(),
  adminNotes: text("admin_notes"),
  triggeredBySwipe: boolean("triggered_by_swipe").default(true),
  conversationId: integer("conversation_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const propertyOffersRelations = relations(propertyOffers, ({ one }) => ({
  property: one(properties, { fields: [propertyOffers.propertyId], references: [properties.id] }),
  buyer: one(users, { fields: [propertyOffers.buyerUserId], references: [users.id] }),
  buyerProfile: one(buyerProfiles, { fields: [propertyOffers.buyerProfileId], references: [buyerProfiles.id] }),
  listingAgent: one(users, { fields: [propertyOffers.listingAgentId], references: [users.id] }),
  buyerAgent: one(users, { fields: [propertyOffers.buyerAgentId], references: [users.id] }),
}));

export const swipeNotifications = pgTable("swipe_notifications", {
  id: serial("id").primaryKey(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  notifiedParty: text("notified_party").notNull(),
  notifiedUserId: varchar("notified_user_id").references(() => users.id),
  notifiedEmail: text("notified_email"),
  buyerRepresented: boolean("buyer_represented").default(false),
  sellerRepresented: boolean("seller_represented").default(false),
  buyerAgentEmail: text("buyer_agent_email"),
  listingAgentEmail: text("listing_agent_email"),
  offerId: integer("offer_id").references(() => propertyOffers.id),
  status: text("status").default("notified").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const swipeNotificationsRelations = relations(swipeNotifications, ({ one }) => ({
  buyer: one(users, { fields: [swipeNotifications.buyerUserId], references: [users.id] }),
  property: one(properties, { fields: [swipeNotifications.propertyId], references: [properties.id] }),
  notifiedUser: one(users, { fields: [swipeNotifications.notifiedUserId], references: [users.id] }),
  offer: one(propertyOffers, { fields: [swipeNotifications.offerId], references: [propertyOffers.id] }),
}));

export const propertyReviews = pgTable("property_reviews", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  moderatedBy: varchar("moderated_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const propertyReviewsRelations = relations(propertyReviews, ({ one }) => ({
  property: one(properties, { fields: [propertyReviews.propertyId], references: [properties.id] }),
  user: one(users, { fields: [propertyReviews.userId], references: [users.id] }),
}));

// Agent CRM - Contacts & Tags
export const agentContacts = pgTable("agent_contacts", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  mailingAddress: text("mailing_address"),
  notes: text("notes"),
  source: text("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactTags = pgTable("contact_tags", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  color: text("color").default("blue").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactTagAssignments = pgTable("contact_tag_assignments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => agentContacts.id, { onDelete: "cascade" }).notNull(),
  tagId: integer("tag_id").references(() => contactTags.id, { onDelete: "cascade" }).notNull(),
});

export const agentContactsRelations = relations(agentContacts, ({ one, many }) => ({
  agent: one(users, { fields: [agentContacts.agentId], references: [users.id] }),
  tagAssignments: many(contactTagAssignments),
}));

export const contactTagsRelations = relations(contactTags, ({ one, many }) => ({
  agent: one(users, { fields: [contactTags.agentId], references: [users.id] }),
  assignments: many(contactTagAssignments),
}));

export const contactTagAssignmentsRelations = relations(contactTagAssignments, ({ one }) => ({
  contact: one(agentContacts, { fields: [contactTagAssignments.contactId], references: [agentContacts.id] }),
  tag: one(contactTags, { fields: [contactTagAssignments.tagId], references: [contactTags.id] }),
}));

// Insert Schemas
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true });
export const insertSellLeadSchema = createInsertSchema(sellLeads).omit({ id: true, createdAt: true });
export const insertBuyerProfileSchema = createInsertSchema(buyerProfiles).omit({ id: true, createdAt: true });
export const insertBuyerMatchSchema = createInsertSchema(buyerMatches).omit({ id: true, createdAt: true });
export const insertSellerPitchSchema = createInsertSchema(sellerPitches).omit({ id: true, createdAt: true });
export const insertFavoriteListSchema = createInsertSchema(favoriteLists).omit({ id: true, createdAt: true });
export const insertSavedPropertySchema = createInsertSchema(savedProperties).omit({ id: true, createdAt: true });
export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({ id: true, createdAt: true });
export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({ id: true, createdAt: true });
export const insertUserHomeSchema = createInsertSchema(userHomes).omit({ id: true, createdAt: true });
export const insertClientAgentLinkSchema = createInsertSchema(clientAgentLinks).omit({ id: true, createdAt: true });
export const insertPropertyOfferSchema = createInsertSchema(propertyOffers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSwipeNotificationSchema = createInsertSchema(swipeNotifications).omit({ id: true, createdAt: true });
export const insertPropertyReviewSchema = createInsertSchema(propertyReviews).omit({ id: true, createdAt: true });
export const insertAgentContactSchema = createInsertSchema(agentContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactTagSchema = createInsertSchema(contactTags).omit({ id: true, createdAt: true });
export const insertContactTagAssignmentSchema = createInsertSchema(contactTagAssignments).omit({ id: true });

export const errorReports = pgTable("error_reports", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  componentStack: text("component_stack"),
  url: text("url"),
  userAgent: text("user_agent"),
  userId: varchar("user_id"),
  sessionId: text("session_id"),
  breadcrumbs: jsonb("breadcrumbs"),
  metadata: jsonb("metadata"),
  status: text("status").default("new").notNull(),
  adminNotes: text("admin_notes"),
  resolved: boolean("resolved").default(false).notNull(),
  occurrences: integer("occurrences").default(1).notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
});

export const insertErrorReportSchema = createInsertSchema(errorReports).omit({ id: true, firstSeen: true, lastSeen: true });

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  propertyId: integer("property_id"),
  linkUrl: text("link_url"),
  read: boolean("read").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  emailNewListing: boolean("email_new_listing").default(true).notNull(),
  emailPriceDrop: boolean("email_price_drop").default(true).notNull(),
  emailOpenHouse: boolean("email_open_house").default(true).notNull(),
  emailAgentMatch: boolean("email_agent_match").default(true).notNull(),
  emailSystem: boolean("email_system").default(true).notNull(),
  emailDigestFrequency: text("email_digest_frequency").default("instant").notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  inAppNewListing: boolean("in_app_new_listing").default(true).notNull(),
  inAppPriceDrop: boolean("in_app_price_drop").default(true).notNull(),
  inAppOpenHouse: boolean("in_app_open_house").default(true).notNull(),
  inAppAgentMatch: boolean("in_app_agent_match").default(true).notNull(),
  inAppSystem: boolean("in_app_system").default(true).notNull(),
  emailsSentToday: integer("emails_sent_today").default(0).notNull(),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  lastEmailResetDate: text("last_email_reset_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });

// Buyer Interest (swipe right upsert — no conversation created)
export const buyerInterest = pgTable("buyer_interest", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  source: text("source").default("swipe").notNull(),
  stage: text("stage").default("new").notNull(),
  initiatedBy: text("initiated_by").default("buyer").notNull(),
  conversationId: integer("conversation_id"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("buyer_interest_property_buyer_idx").on(table.propertyId, table.buyerUserId),
]);

// Conversations between buyer and agent
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  agentUserId: varchar("agent_user_id").references(() => users.id).notNull(),
  status: text("status").default("active").notNull(),
  initiatedBy: text("initiated_by").default("buyer").notNull(),
  lastMessageAt: timestamp("last_message_at"),
  buyerLastReadAt: timestamp("buyer_last_read_at"),
  agentLastReadAt: timestamp("agent_last_read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages within a conversation
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  senderUserId: varchar("sender_user_id").references(() => users.id).notNull(),
  type: text("type").default("text").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Showing requests
export const showingRequests = pgTable("showing_requests", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  propertyId: integer("property_id").references(() => properties.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  agentUserId: varchar("agent_user_id").references(() => users.id).notNull(),
  requestedDates: jsonb("requested_dates").notNull(),
  confirmedDate: timestamp("confirmed_date"),
  status: text("status").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const buyerInterestRelations = relations(buyerInterest, ({ one }) => ({
  property: one(properties, { fields: [buyerInterest.propertyId], references: [properties.id] }),
  buyer: one(users, { fields: [buyerInterest.buyerUserId], references: [users.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  property: one(properties, { fields: [conversations.propertyId], references: [properties.id] }),
  buyer: one(users, { fields: [conversations.buyerUserId], references: [users.id] }),
  agent: one(users, { fields: [conversations.agentUserId], references: [users.id] }),
  messages: many(messages),
  showingRequests: many(showingRequests),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderUserId], references: [users.id] }),
}));

export const showingRequestsRelations = relations(showingRequests, ({ one }) => ({
  conversation: one(conversations, { fields: [showingRequests.conversationId], references: [conversations.id] }),
  property: one(properties, { fields: [showingRequests.propertyId], references: [properties.id] }),
  buyer: one(users, { fields: [showingRequests.buyerUserId], references: [users.id] }),
  agent: one(users, { fields: [showingRequests.agentUserId], references: [users.id] }),
}));

// Insert schemas for new tables
export const insertBuyerInterestSchema = createInsertSchema(buyerInterest).omit({ id: true, createdAt: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertShowingRequestSchema = createInsertSchema(showingRequests).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type BuyerInterest = typeof buyerInterest.$inferSelect;
export type InsertBuyerInterest = z.infer<typeof insertBuyerInterestSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ShowingRequest = typeof showingRequests.$inferSelect;
export type InsertShowingRequest = z.infer<typeof insertShowingRequestSchema>;

// Types
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type FavoriteList = typeof favoriteLists.$inferSelect;
export type InsertFavoriteList = z.infer<typeof insertFavoriteListSchema>;
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
export type SellerPitch = typeof sellerPitches.$inferSelect;
export type InsertSellerPitch = z.infer<typeof insertSellerPitchSchema>;
export type PropertyOffer = typeof propertyOffers.$inferSelect;
export type InsertPropertyOffer = z.infer<typeof insertPropertyOfferSchema>;
export type SwipeNotification = typeof swipeNotifications.$inferSelect;
export type InsertSwipeNotification = z.infer<typeof insertSwipeNotificationSchema>;
export type PropertyReview = typeof propertyReviews.$inferSelect;
export type InsertPropertyReview = z.infer<typeof insertPropertyReviewSchema>;
export type AgentContact = typeof agentContacts.$inferSelect;
export type InsertAgentContact = z.infer<typeof insertAgentContactSchema>;
export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type ContactTagAssignment = typeof contactTagAssignments.$inferSelect;
export type InsertContactTagAssignment = z.infer<typeof insertContactTagAssignmentSchema>;
export type ErrorReport = typeof errorReports.$inferSelect;
export type InsertErrorReport = z.infer<typeof insertErrorReportSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferencesSchema>;

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
  city: z.string().optional(),
  county: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minBeds: z.number().optional(),
  minBaths: z.number().optional(),
  minSqft: z.number().optional(),
  maxHoaFee: z.number().optional(),
});
export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;
