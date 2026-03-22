import { db } from "./db";
import {
  properties,
  savedProperties,
  savedSearches,
  searchHistory,
  userHomes,
  clientAgentLinks,
  sellLeads,
  buyerProfiles,
  buyerMatches,
  sellerPitches,
  favoriteLists,
  propertyOffers,
  swipeNotifications,
  propertyReviews,
  type Property,
  type InsertProperty,
  type SavedProperty,
  type SavedSearch,
  type InsertSavedSearch,
  type SearchHistory,
  type UserHome,
  type InsertUserHome,
  type ClientAgentLink,
  type SellLead,
  type InsertSellLead,
  type BuyerProfile,
  type InsertBuyerProfile,
  type BuyerMatch,
  type InsertBuyerMatch,
  type SellerPitch,
  type InsertSellerPitch,
  type FavoriteList,
  type PropertyOffer,
  type InsertPropertyOffer,
  type SwipeNotification,
  type InsertSwipeNotification,
  type PropertyReview,
  type InsertPropertyReview,
  agentContacts,
  contactTags,
  contactTagAssignments,
  errorReports,
  type AgentContact,
  type InsertAgentContact,
  type ContactTag,
  type InsertContactTag,
  type ContactTagAssignment,
  type ErrorReport,
  type InsertErrorReport,
  type Notification,
  type InsertNotification,
  notifications,
  notificationPreferences,
  type NotificationPreference,
  buyerInterest,
  conversations,
  messages,
  showingRequests,
  type BuyerInterest,
  type InsertBuyerInterest,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ShowingRequest,
  type InsertShowingRequest,
  users,
} from "@shared/schema";
import { eq, and, desc, asc, sql, gte, count, inArray } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  getUser(id: string): Promise<any>;

  // Properties
  getProperties(filters?: any): Promise<(Property & { agent: any })[]>;
  getPropertiesCount(filters?: any): Promise<number>;
  getPropertiesByAgent(agentId: string): Promise<(Property & { agent: any })[]>;
  getPropertiesNeedingGeocode(limit: number): Promise<Property[]>;
  getProperty(id: number): Promise<(Property & { agent: any }) | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, updates: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: number): Promise<void>;

  // Favorite Lists
  getFavoriteLists(userId: string): Promise<FavoriteList[]>;
  createFavoriteList(userId: string, name: string): Promise<FavoriteList>;
  renameFavoriteList(id: number, userId: string, name: string): Promise<FavoriteList>;
  deleteFavoriteList(id: number, userId: string): Promise<void>;

  // Saved Properties
  getSavedProperties(userId: string): Promise<(SavedProperty & { property: Property })[]>;
  saveProperty(userId: string, propertyId: number, listId?: number | null): Promise<SavedProperty>;
  removeSavedProperty(userId: string, propertyId: number): Promise<void>;
  movePropertyToList(userId: string, propertyId: number, listId: number | null): Promise<void>;

  // Saved Searches
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  createSavedSearch(userId: string, search: Omit<InsertSavedSearch, 'userId'>): Promise<SavedSearch>;
  renameSavedSearch(id: number, userId: string, name: string): Promise<void>;
  deleteSavedSearch(id: number, userId: string): Promise<void>;

  // Search History
  getSearchHistory(userId: string): Promise<SearchHistory[]>;
  addSearchHistory(userId: string, query: string, criteria: object): Promise<SearchHistory>;
  deleteSearchHistory(id: number, userId: string): Promise<void>;
  clearSearchHistory(userId: string): Promise<void>;

  // User Homes
  getUserHomes(userId: string): Promise<UserHome[]>;
  createUserHome(userId: string, home: Omit<InsertUserHome, 'userId'>): Promise<UserHome>;
  updateUserHome(id: number, userId: string, updates: Partial<InsertUserHome>): Promise<UserHome>;
  deleteUserHome(id: number, userId: string): Promise<void>;

  // Client-Agent Links
  getClientAgentLink(clientId: string): Promise<ClientAgentLink | undefined>;
  upsertClientAgentLink(clientId: string, agentEmail: string): Promise<ClientAgentLink>;
  deleteClientAgentLink(clientId: string): Promise<void>;
  getAgentClients(agentEmail: string): Promise<(ClientAgentLink & { client: any })[]>;

  // Open Houses
  getUpcomingOpenHouses(): Promise<(Property & { agent: any })[]>;

  // Sell Leads
  createSellLead(lead: InsertSellLead): Promise<SellLead>;
  getSellLeads(): Promise<SellLead[]>;

  // Buyer Profiles
  getBuyerProfiles(filters?: any): Promise<(BuyerProfile & { user: any })[]>;
  getBuyerProfile(id: number): Promise<(BuyerProfile & { user: any }) | undefined>;
  createBuyerProfile(profile: InsertBuyerProfile): Promise<BuyerProfile>;
  updateBuyerProfile(id: number, userId: string, updates: Partial<InsertBuyerProfile>): Promise<BuyerProfile>;
  deleteBuyerProfile(id: number, userId: string): Promise<void>;
  getUserBuyerProfile(userId: string): Promise<BuyerProfile | undefined>;
  getAgentBuyerProfiles(agentId: string): Promise<BuyerProfile[]>;

  // Beacon
  matchBuyersForListing(criteria: { price: number; beds: number; baths: number; sqft: number; city: string; propertyType: string }): Promise<(BuyerProfile & { user: any })[]>;

  // Buyer Matches
  createBuyerMatch(match: InsertBuyerMatch): Promise<BuyerMatch>;
  getBuyerMatchesForProfile(profileId: number): Promise<(BuyerMatch & { property: Property | null; sender: any })[]>;
  getBuyerMatchesForSender(senderId: string): Promise<(BuyerMatch & { buyerProfile: BuyerProfile })[]>;

  // Seller Pitches
  createSellerPitch(pitch: InsertSellerPitch): Promise<SellerPitch>;
  getSellerPitches(): Promise<(SellerPitch & { user: any })[]>;
  getSellerPitch(id: number): Promise<(SellerPitch & { user: any }) | undefined>;
  updateSellerPitchStatus(id: number, status: string, adminNotes?: string): Promise<SellerPitch>;

  // Autocomplete
  autocompleteCities(query: string, limit?: number): Promise<{ city: string; state: string; count: number }[]>;
  autocompleteCounties(query: string, limit?: number): Promise<{ county: string; state: string; count: number }[]>;
  autocompleteProperties(query: string, limit?: number): Promise<{
    id: number;
    title: string;
    price: number;
    beds: number;
    baths: string;
    sqft: number | null;
    status: string;
    isOffMarket: boolean;
    imageUrl: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  }[]>;

  // Property Offers (Reverse Offers)
  createPropertyOffer(offer: InsertPropertyOffer): Promise<PropertyOffer>;
  getPropertyOffersForProperty(propertyId: number): Promise<(PropertyOffer & { property: Property; buyer: any })[]>;
  getPropertyOffersForBuyer(userId: string): Promise<(PropertyOffer & { property: Property })[]>;
  getPropertyOffersForAgent(agentId: string): Promise<(PropertyOffer & { property: Property; buyer: any })[]>;
  updatePropertyOfferStatus(id: number, status: string, adminNotes?: string): Promise<PropertyOffer>;

  // Property Reviews
  createPropertyReview(review: InsertPropertyReview): Promise<PropertyReview>;
  getPropertyReviews(propertyId: number): Promise<(PropertyReview & { user: any })[]>;
  updateReviewVisibility(id: number, isPublic: boolean, moderatedBy: string): Promise<PropertyReview>;
  deletePropertyReview(id: number): Promise<void>;
  getUserReviewForProperty(userId: string, propertyId: number): Promise<PropertyReview | undefined>;

  // Swipe Notifications
  createSwipeNotification(notification: InsertSwipeNotification): Promise<SwipeNotification>;
  getSwipeNotificationsForUser(userId: string): Promise<(SwipeNotification & { property: Property; buyer: any })[]>;
  getAdminSwipeNotifications(): Promise<(SwipeNotification & { property: Property; buyer: any })[]>;
  updateSwipeNotificationStatus(id: number, status: string, offerId?: number): Promise<SwipeNotification>;
  getExistingSwipeNotification(buyerUserId: string, propertyId: number): Promise<SwipeNotification | undefined>;

  // Valuation
  getValuation(beds: number, sqft: number, lat?: number, lng?: number): Promise<{
    estimatedLow: number;
    estimatedMid: number;
    estimatedHigh: number;
    pricePerSqft: number;
    compsCount: number;
    comps: { id: number; title: string; price: number; beds: number; sqft: number; location: string; distanceMiles?: number }[];
  }>;

  // Agent CRM - Contacts
  getAgentContacts(agentId: string, tagId?: number): Promise<(AgentContact & { tags: ContactTag[] })[]>;
  getAgentContact(id: number, agentId: string): Promise<(AgentContact & { tags: ContactTag[] }) | undefined>;
  createAgentContact(contact: InsertAgentContact): Promise<AgentContact>;
  createAgentContactsBulk(contacts: InsertAgentContact[]): Promise<AgentContact[]>;
  updateAgentContact(id: number, agentId: string, updates: Partial<InsertAgentContact>): Promise<AgentContact>;
  deleteAgentContact(id: number, agentId: string): Promise<void>;

  // Agent CRM - Tags
  getContactTags(agentId: string): Promise<ContactTag[]>;
  createContactTag(tag: InsertContactTag): Promise<ContactTag>;
  updateContactTag(id: number, agentId: string, updates: Partial<InsertContactTag>): Promise<ContactTag>;
  deleteContactTag(id: number, agentId: string): Promise<void>;

  // Agent CRM - Tag Assignments
  assignTagToContact(contactId: number, tagId: number): Promise<ContactTagAssignment>;
  removeTagFromContact(contactId: number, tagId: number): Promise<void>;
  assignTagToContacts(contactIds: number[], tagId: number): Promise<void>;

  // Error Reports
  createErrorReport(report: InsertErrorReport): Promise<ErrorReport>;
  getErrorReports(filters?: { status?: string; resolved?: boolean }): Promise<ErrorReport[]>;
  getErrorReport(id: number): Promise<ErrorReport | undefined>;
  updateErrorReport(id: number, updates: Partial<{ status: string; adminNotes: string; resolved: boolean }>): Promise<ErrorReport>;
  incrementErrorOccurrence(fingerprint: string, url: string): Promise<ErrorReport | null>;

  // Notifications
  getNotifications(userId: string, filters?: { unreadOnly?: boolean; archived?: boolean }): Promise<Notification[]>;
  getUnreadCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number, userId: string): Promise<Notification>;
  markAllNotificationsRead(userId: string): Promise<void>;
  archiveNotification(id: number, userId: string): Promise<Notification>;
  deleteNotification(id: number, userId: string): Promise<boolean>;

  getNotificationPreferences(userId: string): Promise<NotificationPreference | null>;
  upsertNotificationPreferences(userId: string, prefs: Partial<NotificationPreference>): Promise<NotificationPreference>;
  incrementEmailCount(userId: string): Promise<void>;
  resetDailyEmailCount(userId: string): Promise<void>;

  // Buyer Interest
  upsertBuyerInterest(propertyId: number, buyerUserId: string, source?: string): Promise<BuyerInterest>;
  getBuyerInterestForAgent(agentUserId: string): Promise<(BuyerInterest & { property: Property; buyer: any })[]>;
  getBuyerInterestForBuyer(buyerUserId: string): Promise<(BuyerInterest & { property: Property })[]>;

  // Conversations
  getOrCreateConversation(propertyId: number, buyerUserId: string, agentUserId: string, initiatedBy?: string): Promise<Conversation>;
  getConversation(id: number): Promise<(Conversation & { property: Property; buyer: any; agent: any }) | undefined>;
  getConversationsForUser(userId: string): Promise<(Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; unreadCount: number })[]>;
  updateConversationReadAt(conversationId: number, userId: string, role: 'buyer' | 'agent'): Promise<void>;
  getAllConversations(filters?: { search?: string; status?: string; limit?: number; offset?: number }): Promise<{ conversations: (Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; messageCount: number })[]; total: number }>;
  getConversationWithMessages(id: number): Promise<{ conversation: Conversation & { property: Property; buyer: any; agent: any }; messages: (Message & { sender: any })[] } | undefined>;
  updateBuyerMatchConversationId(matchId: number, conversationId: number): Promise<void>;

  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessagesForConversation(conversationId: number, limit?: number, before?: number): Promise<(Message & { sender: any })[]>;

  // Showing Requests
  createShowingRequest(request: InsertShowingRequest): Promise<ShowingRequest>;
  getShowingRequest?(id: number): Promise<ShowingRequest | undefined>;
  getShowingRequestsForUser(userId: string): Promise<(ShowingRequest & { property: Property; buyer: any; agent: any })[]>;
  updateShowingRequestStatus(id: number, status: string, confirmedDate?: Date): Promise<ShowingRequest>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<any> {
    return authStorage.getUser(id);
  }

  private buildPropertyFilters(filters?: any) {
    let conditions: any[] = [];
    if (filters) {
      if (filters.city) {
        conditions.push(sql`LOWER(${properties.addressCity}) = LOWER(${filters.city})`);
      } else if (filters.county) {
        conditions.push(sql`LOWER(${properties.addressCounty}) = LOWER(${filters.county})`);
      } else if (filters.location) {
        const q = `%${filters.location}%`;
        const fullAddr = sql`CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, ', ', ${properties.addressCity}, ', ', ${properties.addressState}, ' ', ${properties.addressZip})`;
        conditions.push(sql`(
          ${properties.location} ILIKE ${q}
          OR ${properties.addressCity} ILIKE ${q}
          OR ${properties.addressStreetName} ILIKE ${q}
          OR ${properties.addressZip} ILIKE ${q}
          OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}) ILIKE ${q}
          OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, ', ', ${properties.addressCity}) ILIKE ${q}
          OR ${fullAddr} ILIKE ${q}
          OR ${q} ILIKE CONCAT('%', ${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, '%')
        )`);
      }
      if (filters.minPrice) conditions.push(sql`${properties.price} >= ${filters.minPrice}`);
      if (filters.maxPrice) conditions.push(sql`${properties.price} <= ${filters.maxPrice}`);
      if (filters.minBeds) conditions.push(sql`${properties.beds} >= ${filters.minBeds}`);
      if (filters.minBaths) conditions.push(sql`${properties.baths} >= ${filters.minBaths}`);
      if (filters.minSqft) conditions.push(sql`${properties.sqft} >= ${filters.minSqft}`);
      if (filters.maxSqft) conditions.push(sql`${properties.sqft} <= ${filters.maxSqft}`);
      if (filters.maxHoaFee) conditions.push(sql`${properties.hoaFee} <= ${filters.maxHoaFee}`);
      if (filters.isOffMarket !== undefined) {
        conditions.push(eq(properties.isOffMarket, filters.isOffMarket === 'true'));
      }
      if (filters.propertyType) {
        const types = filters.propertyType.split(',').map((t: string) => t.trim()).filter(Boolean);
        if (types.length > 0) {
          const typeConds = types.map((t: string) => sql`${properties.propertyType} ILIKE ${t}`);
          conditions.push(sql`(${sql.join(typeConds, sql` OR `)})`);
        }
      }
      if (filters.status) {
        conditions.push(sql`LOWER(${properties.status}) = LOWER(${filters.status})`);
      }
      if (filters.source) {
        conditions.push(eq(properties.source, filters.source));
      }
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async getProperties(filters?: any): Promise<(Property & { agent: any })[]> {
    const whereClause = this.buildPropertyFilters(filters);
    const limit = filters?.limit ? Math.min(Number(filters.limit), 200) : 50;
    const offset = filters?.offset ? Number(filters.offset) : 0;

    let orderByClause;
    switch (filters?.sort) {
      case 'price_asc':
        orderByClause = sql`${properties.price} ASC`;
        break;
      case 'price_desc':
        orderByClause = sql`${properties.price} DESC`;
        break;
      case 'sqft_desc':
        orderByClause = sql`${properties.sqft} DESC`;
        break;
      case 'newest':
      default:
        orderByClause = sql`${properties.createdAt} DESC`;
        break;
    }

    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return results.map(r => ({ ...r.property, agent: r.agent }));
  }

  async getPropertiesCount(filters?: any): Promise<number> {
    const whereClause = this.buildPropertyFilters(filters);
    const result = await db
      .select({ total: count() })
      .from(properties)
      .where(whereClause);
    return result[0]?.total ?? 0;
  }

  async getPropertiesNeedingGeocode(limit: number): Promise<Property[]> {
    const results = await db
      .select()
      .from(properties)
      .where(sql`(${properties.lat} IS NULL OR ${properties.lng} IS NULL)`)
      .limit(limit);
    return results;
  }

  async getPropertiesByAgent(agentId: string): Promise<(Property & { agent: any })[]> {
    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(eq(properties.agentId, agentId));
    return results.map(r => ({ ...r.property, agent: r.agent }));
  }

  async getProperty(id: number): Promise<(Property & { agent: any }) | undefined> {
    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(eq(properties.id, id));

    if (results.length === 0) return undefined;
    return { ...results[0].property, agent: results[0].agent };
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }

  async updateProperty(id: number, updates: Partial<InsertProperty>): Promise<Property> {
    const [updated] = await db.update(properties).set(updates).where(eq(properties.id, id)).returning();
    return updated;
  }

  async deleteProperty(id: number): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  async getFavoriteLists(userId: string): Promise<FavoriteList[]> {
    return await db.select().from(favoriteLists).where(eq(favoriteLists.userId, userId)).orderBy(desc(favoriteLists.createdAt));
  }

  async createFavoriteList(userId: string, name: string): Promise<FavoriteList> {
    const [list] = await db.insert(favoriteLists).values({ userId, name }).returning();
    return list;
  }

  async renameFavoriteList(id: number, userId: string, name: string): Promise<FavoriteList> {
    const [list] = await db.update(favoriteLists).set({ name }).where(and(eq(favoriteLists.id, id), eq(favoriteLists.userId, userId))).returning();
    return list;
  }

  async deleteFavoriteList(id: number, userId: string): Promise<void> {
    await db.update(savedProperties).set({ listId: null }).where(and(eq(savedProperties.userId, userId), eq(savedProperties.listId, id)));
    await db.delete(favoriteLists).where(and(eq(favoriteLists.id, id), eq(favoriteLists.userId, userId)));
  }

  async getSavedProperties(userId: string): Promise<(SavedProperty & { property: Property })[]> {
    const results = await db
      .select({ savedProperty: savedProperties, property: properties })
      .from(savedProperties)
      .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
      .where(eq(savedProperties.userId, userId));

    return results.map(r => ({ ...r.savedProperty, property: r.property }));
  }

  async saveProperty(userId: string, propertyId: number, listId?: number | null): Promise<SavedProperty> {
    const [saved] = await db.insert(savedProperties).values({ userId, propertyId, listId: listId ?? null }).returning();
    return saved;
  }

  async removeSavedProperty(userId: string, propertyId: number): Promise<void> {
    await db.delete(savedProperties).where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)));
  }

  async movePropertyToList(userId: string, propertyId: number, listId: number | null): Promise<void> {
    await db.update(savedProperties).set({ listId }).where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)));
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(userId: string, search: Omit<InsertSavedSearch, 'userId'>): Promise<SavedSearch> {
    const [saved] = await db.insert(savedSearches).values({ ...search, userId }).returning();
    return saved;
  }

  async renameSavedSearch(id: number, userId: string, name: string): Promise<void> {
    await db.update(savedSearches).set({ name }).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
  }

  async deleteSavedSearch(id: number, userId: string): Promise<void> {
    await db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)));
  }

  async getSearchHistory(userId: string): Promise<SearchHistory[]> {
    return await db.select().from(searchHistory)
      .where(eq(searchHistory.userId, userId))
      .orderBy(desc(searchHistory.createdAt))
      .limit(50);
  }

  async addSearchHistory(userId: string, query: string, criteria: object): Promise<SearchHistory> {
    const [entry] = await db.insert(searchHistory).values({ userId, query, criteria }).returning();
    return entry;
  }

  async deleteSearchHistory(id: number, userId: string): Promise<void> {
    await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));
  }

  async clearSearchHistory(userId: string): Promise<void> {
    await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
  }

  async getUserHomes(userId: string): Promise<UserHome[]> {
    return await db.select().from(userHomes).where(eq(userHomes.userId, userId)).orderBy(desc(userHomes.createdAt));
  }

  async createUserHome(userId: string, home: Omit<InsertUserHome, 'userId'>): Promise<UserHome> {
    const [newHome] = await db.insert(userHomes).values({ ...home, userId }).returning();
    return newHome;
  }

  async updateUserHome(id: number, userId: string, updates: Partial<InsertUserHome>): Promise<UserHome> {
    const [updated] = await db.update(userHomes).set(updates).where(and(eq(userHomes.id, id), eq(userHomes.userId, userId))).returning();
    return updated;
  }

  async deleteUserHome(id: number, userId: string): Promise<void> {
    await db.delete(userHomes).where(and(eq(userHomes.id, id), eq(userHomes.userId, userId)));
  }

  async getClientAgentLink(clientId: string): Promise<ClientAgentLink | undefined> {
    const rows = await db.select().from(clientAgentLinks).where(eq(clientAgentLinks.clientId, clientId)).limit(1);
    return rows[0];
  }

  async upsertClientAgentLink(clientId: string, agentEmail: string): Promise<ClientAgentLink> {
    await db.delete(clientAgentLinks).where(eq(clientAgentLinks.clientId, clientId));
    const agentUser = await db.select().from(users).where(eq(users.email, agentEmail)).limit(1);
    const agentId = agentUser[0]?.id ?? null;
    const status = agentId ? "active" : "pending";
    const [link] = await db.insert(clientAgentLinks).values({ clientId, agentEmail, agentId, status }).returning();
    return link;
  }

  async deleteClientAgentLink(clientId: string): Promise<void> {
    await db.delete(clientAgentLinks).where(eq(clientAgentLinks.clientId, clientId));
  }

  async getAgentClients(agentEmail: string): Promise<(ClientAgentLink & { client: any })[]> {
    const results = await db
      .select({ link: clientAgentLinks, client: users })
      .from(clientAgentLinks)
      .innerJoin(users, eq(clientAgentLinks.clientId, users.id))
      .where(eq(clientAgentLinks.agentEmail, agentEmail));
    return results.map(r => ({ ...r.link, client: r.client }));
  }

  async getUpcomingOpenHouses(): Promise<(Property & { agent: any })[]> {
    const now = new Date();
    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(gte(properties.openHouseDate, now));
    return results.map(r => ({ ...r.property, agent: r.agent }));
  }

  async createSellLead(lead: InsertSellLead): Promise<SellLead> {
    const [newLead] = await db.insert(sellLeads).values(lead).returning();
    return newLead;
  }

  async getSellLeads(): Promise<SellLead[]> {
    return await db.select().from(sellLeads).orderBy(desc(sellLeads.createdAt));
  }

  async autocompleteCities(query: string, limit: number = 10) {
    if (!query || query.length < 2) return [];
    const q = `%${query}%`;
    const results = await db
      .select({
        city: properties.addressCity,
        state: properties.addressState,
        count: count(),
      })
      .from(properties)
      .where(sql`${properties.addressCity} ILIKE ${q} AND ${properties.addressCity} IS NOT NULL`)
      .groupBy(properties.addressCity, properties.addressState)
      .orderBy(desc(count()))
      .limit(limit);
    return results.map(r => ({
      city: r.city!,
      state: r.state || "CA",
      count: Number(r.count),
    }));
  }

  async autocompleteCounties(query: string, limit: number = 5) {
    if (!query || query.length < 2) return [];
    const q = `%${query}%`;
    const results = await db
      .select({
        county: properties.addressCounty,
        state: properties.addressState,
        count: count(),
      })
      .from(properties)
      .where(sql`${properties.addressCounty} ILIKE ${q} AND ${properties.addressCounty} IS NOT NULL`)
      .groupBy(properties.addressCounty, properties.addressState)
      .orderBy(desc(count()))
      .limit(limit);
    return results.map(r => ({
      county: r.county!,
      state: r.state || "CA",
      count: Number(r.count),
    }));
  }

  async autocompleteProperties(query: string, limit: number = 8) {
    if (!query || query.length < 2) return [];
    const q = `%${query}%`;
    const fullAddr = sql`CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, ', ', ${properties.addressCity}, ', ', ${properties.addressState}, ' ', ${properties.addressZip})`;
    const results = await db.select({
      id: properties.id,
      title: properties.title,
      price: properties.price,
      beds: properties.beds,
      baths: properties.baths,
      sqft: properties.sqft,
      status: properties.status,
      isOffMarket: properties.isOffMarket,
      imageUrl: properties.imageUrl,
      addressCity: properties.addressCity,
      addressState: properties.addressState,
      addressZip: properties.addressZip,
    }).from(properties)
      .where(sql`(
        ${properties.title} ILIKE ${q}
        OR ${properties.addressCity} ILIKE ${q}
        OR ${properties.addressStreetName} ILIKE ${q}
        OR ${properties.addressZip} ILIKE ${q}
        OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}) ILIKE ${q}
        OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, ', ', ${properties.addressCity}) ILIKE ${q}
        OR ${fullAddr} ILIKE ${q}
      )`)
      .orderBy(desc(properties.price))
      .limit(limit);
    return results;
  }

  async getValuation(beds: number, sqft: number, lat?: number, lng?: number): Promise<{
    estimatedLow: number;
    estimatedMid: number;
    estimatedHigh: number;
    pricePerSqft: number;
    compsCount: number;
    comps: { id: number; title: string; price: number; beds: number; sqft: number; location: string; distanceMiles?: number }[];
  }> {
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 3959;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const allProps = await db.select().from(properties)
      .where(eq(properties.isOffMarket, false));

    const compsWithData = allProps
      .filter(p => p.sqft && p.sqft > 0 && p.price > 0)
      .map(p => ({
        ...p,
        distanceMiles: (lat && lng && p.lat && p.lng)
          ? haversine(lat, lng, parseFloat(p.lat as string), parseFloat(p.lng as string))
          : undefined,
      }));

    const sqftLow = sqft * 0.60;
    const sqftHigh = sqft * 1.40;
    const bedsLow = Math.max(1, beds - 1);
    const bedsHigh = beds + 1;

    const byBedsSqft = compsWithData.filter(p =>
      p.sqft! >= sqftLow && p.sqft! <= sqftHigh &&
      p.beds >= bedsLow && p.beds <= bedsHigh
    );

    // Separate comps that have real GPS coordinates vs. those that don't
    const withCoords = byBedsSqft.filter(p => p.distanceMiles !== undefined);
    const withoutCoords = byBedsSqft.filter(p => p.distanceMiles === undefined);

    let comps = byBedsSqft;

    if (lat && lng) {
      // Step 1: try nearby comps (within 50 mi) with correct beds/sqft
      const nearby50 = withCoords.filter(p => p.distanceMiles! <= 50);
      if (nearby50.length >= 1) {
        comps = nearby50;
      } else {
        // Step 2: loosen sqft filter but stay nearby (150 mi)
        const looseSqft = compsWithData.filter(p =>
          p.distanceMiles !== undefined &&
          p.sqft! >= sqft * 0.50 && p.sqft! <= sqft * 1.70 &&
          p.beds >= Math.max(1, beds - 2) && p.beds <= beds + 2
        );
        const nearby150 = looseSqft.filter(p => p.distanceMiles! <= 150);
        if (nearby150.length >= 1) {
          comps = nearby150;
        } else if (withCoords.length >= 1) {
          // Step 3: use whatever coordinated comps we have (best effort)
          comps = withCoords;
        } else {
          // Step 4: last resort — use all beds/sqft matches even without coords
          comps = withoutCoords.length > 0 ? withoutCoords : byBedsSqft;
        }
      }
    } else {
      // No user location — fall back to all beds/sqft matches
      if (comps.length < 2) {
        comps = compsWithData.filter(p =>
          p.sqft! >= sqft * 0.50 && p.sqft! <= sqft * 1.60
        );
      }
    }

    if (comps.length === 0) {
      comps = compsWithData;
    }

    // Sort by distance (closest first) if location available
    if (lat && lng) {
      comps = comps.sort((a, b) => (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999));
    }

    const pricePerSqftValues = comps.map(p => p.price / p.sqft!);
    const medianPricePerSqft = median(pricePerSqftValues) || 500;

    const estimatedMid = Math.round(medianPricePerSqft * sqft);
    const estimatedLow = Math.round(estimatedMid * 0.88);
    const estimatedHigh = Math.round(estimatedMid * 1.12);

    return {
      estimatedLow,
      estimatedMid,
      estimatedHigh,
      pricePerSqft: Math.round(medianPricePerSqft),
      compsCount: comps.length,
      comps: comps.slice(0, 4).map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        beds: p.beds,
        sqft: p.sqft!,
        location: p.addressCity ? `${p.addressCity}, ${p.addressState}` : p.location,
        distanceMiles: p.distanceMiles !== undefined ? Math.round(p.distanceMiles) : undefined,
      })),
    };
  }

  async getBuyerProfiles(filters?: any): Promise<(BuyerProfile & { user: any })[]> {
    let conditions: any[] = [eq(buyerProfiles.isActive, true)];

    if (filters) {
      if (filters.minBudget) conditions.push(sql`${buyerProfiles.preApprovalAmount} >= ${parseInt(filters.minBudget)}`);
      if (filters.maxBudget) conditions.push(sql`${buyerProfiles.preApprovalAmount} <= ${parseInt(filters.maxBudget)}`);
      if (filters.minBeds) conditions.push(sql`${buyerProfiles.minBeds} >= ${parseInt(filters.minBeds)}`);
      if (filters.city) conditions.push(sql`${filters.city} = ANY(${buyerProfiles.preferredCities})`);
    }

    const results = await db
      .select({ profile: buyerProfiles, user: users })
      .from(buyerProfiles)
      .leftJoin(users, eq(buyerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(buyerProfiles.createdAt));

    return results.map(r => ({ ...r.profile, user: r.user }));
  }

  async getBuyerProfile(id: number): Promise<(BuyerProfile & { user: any }) | undefined> {
    const results = await db
      .select({ profile: buyerProfiles, user: users })
      .from(buyerProfiles)
      .leftJoin(users, eq(buyerProfiles.userId, users.id))
      .where(eq(buyerProfiles.id, id));
    if (results.length === 0) return undefined;
    return { ...results[0].profile, user: results[0].user };
  }

  async createBuyerProfile(profile: InsertBuyerProfile): Promise<BuyerProfile> {
    const [newProfile] = await db.insert(buyerProfiles).values(profile).returning();
    return newProfile;
  }

  async updateBuyerProfile(id: number, userId: string, updates: Partial<InsertBuyerProfile>): Promise<BuyerProfile> {
    const [updated] = await db.update(buyerProfiles).set(updates)
      .where(and(eq(buyerProfiles.id, id), eq(buyerProfiles.userId, userId)))
      .returning();
    return updated;
  }

  async deleteBuyerProfile(id: number, userId: string): Promise<void> {
    await db.delete(buyerProfiles).where(and(eq(buyerProfiles.id, id), eq(buyerProfiles.userId, userId)));
  }

  async getUserBuyerProfile(userId: string): Promise<BuyerProfile | undefined> {
    const rows = await db.select().from(buyerProfiles).where(eq(buyerProfiles.userId, userId)).limit(1);
    return rows[0];
  }

  async getAgentBuyerProfiles(agentId: string): Promise<BuyerProfile[]> {
    return db.select().from(buyerProfiles)
      .where(eq(buyerProfiles.agentId, agentId))
      .orderBy(desc(buyerProfiles.createdAt));
  }

  async matchBuyersForListing(criteria: {
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    city: string;
    propertyType: string;
  }): Promise<(BuyerProfile & { user: any })[]> {
    const conditions: any[] = [eq(buyerProfiles.isActive, true)];

    conditions.push(sql`${buyerProfiles.preApprovalAmount} >= ${criteria.price}`);

    if (criteria.beds) {
      conditions.push(sql`(${buyerProfiles.minBeds} IS NULL OR ${buyerProfiles.minBeds} <= ${criteria.beds})`);
      conditions.push(sql`(${buyerProfiles.maxBeds} IS NULL OR ${buyerProfiles.maxBeds} >= ${criteria.beds})`);
    }
    if (criteria.baths) {
      conditions.push(sql`(${buyerProfiles.minBaths} IS NULL OR ${buyerProfiles.minBaths} <= ${criteria.baths})`);
    }
    if (criteria.sqft) {
      conditions.push(sql`(${buyerProfiles.minSqft} IS NULL OR ${buyerProfiles.minSqft} <= ${criteria.sqft})`);
      conditions.push(sql`(${buyerProfiles.maxSqft} IS NULL OR ${buyerProfiles.maxSqft} >= ${criteria.sqft})`);
    }
    if (criteria.city) {
      conditions.push(sql`(${buyerProfiles.preferredCities} IS NULL OR array_length(${buyerProfiles.preferredCities}, 1) IS NULL OR LOWER(${criteria.city}) = ANY(SELECT LOWER(unnest(${buyerProfiles.preferredCities}))))`);
    }
    if (criteria.propertyType) {
      conditions.push(sql`(${buyerProfiles.homeTypes} IS NULL OR array_length(${buyerProfiles.homeTypes}, 1) IS NULL OR ${criteria.propertyType} = ANY(${buyerProfiles.homeTypes}))`);
    }

    const results = await db
      .select({ profile: buyerProfiles, user: users })
      .from(buyerProfiles)
      .leftJoin(users, eq(buyerProfiles.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(buyerProfiles.preApprovalAmount));

    return results.map(r => ({ ...r.profile, user: r.user }));
  }

  async createBuyerMatch(match: InsertBuyerMatch): Promise<BuyerMatch> {
    const [newMatch] = await db.insert(buyerMatches).values(match).returning();
    return newMatch;
  }

  async getBuyerMatchesForProfile(profileId: number): Promise<(BuyerMatch & { property: Property | null; sender: any })[]> {
    const results = await db
      .select({ match: buyerMatches, property: properties, sender: users })
      .from(buyerMatches)
      .leftJoin(properties, eq(buyerMatches.propertyId, properties.id))
      .leftJoin(users, eq(buyerMatches.senderId, users.id))
      .where(eq(buyerMatches.buyerProfileId, profileId))
      .orderBy(desc(buyerMatches.createdAt));
    return results.map(r => ({ ...r.match, property: r.property, sender: r.sender }));
  }

  async getBuyerMatchesForSender(senderId: string): Promise<(BuyerMatch & { buyerProfile: BuyerProfile })[]> {
    const results = await db
      .select({ match: buyerMatches, buyerProfile: buyerProfiles })
      .from(buyerMatches)
      .innerJoin(buyerProfiles, eq(buyerMatches.buyerProfileId, buyerProfiles.id))
      .where(eq(buyerMatches.senderId, senderId))
      .orderBy(desc(buyerMatches.createdAt));
    return results.map(r => ({ ...r.match, buyerProfile: r.buyerProfile }));
  }

  async createSellerPitch(pitch: InsertSellerPitch): Promise<SellerPitch> {
    const [newPitch] = await db.insert(sellerPitches).values(pitch).returning();
    return newPitch;
  }

  async getSellerPitches(): Promise<(SellerPitch & { user: any })[]> {
    const results = await db
      .select({ pitch: sellerPitches, user: users })
      .from(sellerPitches)
      .leftJoin(users, eq(sellerPitches.userId, users.id))
      .orderBy(desc(sellerPitches.createdAt));
    return results.map(r => ({ ...r.pitch, user: r.user }));
  }

  async getSellerPitch(id: number): Promise<(SellerPitch & { user: any }) | undefined> {
    const results = await db
      .select({ pitch: sellerPitches, user: users })
      .from(sellerPitches)
      .leftJoin(users, eq(sellerPitches.userId, users.id))
      .where(eq(sellerPitches.id, id))
      .limit(1);
    if (!results[0]) return undefined;
    return { ...results[0].pitch, user: results[0].user };
  }

  async updateSellerPitchStatus(id: number, status: string, adminNotes?: string): Promise<SellerPitch> {
    const updates: any = { status };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [updated] = await db.update(sellerPitches).set(updates).where(eq(sellerPitches.id, id)).returning();
    return updated;
  }

  async createPropertyOffer(offer: InsertPropertyOffer): Promise<PropertyOffer> {
    const [created] = await db.insert(propertyOffers).values(offer).returning();
    return created;
  }

  async getPropertyOffersForProperty(propertyId: number): Promise<(PropertyOffer & { property: Property; buyer: any })[]> {
    const rows = await db
      .select({ offer: propertyOffers, property: properties, buyer: users })
      .from(propertyOffers)
      .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
      .leftJoin(users, eq(propertyOffers.buyerUserId, users.id))
      .where(eq(propertyOffers.propertyId, propertyId))
      .orderBy(desc(propertyOffers.createdAt));
    return rows.map(r => ({ ...r.offer, property: r.property, buyer: r.buyer }));
  }

  async getPropertyOffersForBuyer(userId: string): Promise<(PropertyOffer & { property: Property })[]> {
    const rows = await db
      .select({ offer: propertyOffers, property: properties })
      .from(propertyOffers)
      .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
      .where(eq(propertyOffers.buyerUserId, userId))
      .orderBy(desc(propertyOffers.createdAt));
    return rows.map(r => ({ ...r.offer, property: r.property }));
  }

  async getPropertyOffersForAgent(agentId: string): Promise<(PropertyOffer & { property: Property; buyer: any })[]> {
    const rows = await db
      .select({ offer: propertyOffers, property: properties, buyer: users })
      .from(propertyOffers)
      .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
      .leftJoin(users, eq(propertyOffers.buyerUserId, users.id))
      .where(sql`${propertyOffers.listingAgentId} = ${agentId} OR ${propertyOffers.buyerAgentId} = ${agentId}`)
      .orderBy(desc(propertyOffers.createdAt));
    return rows.map(r => ({ ...r.offer, property: r.property, buyer: r.buyer }));
  }

  async updatePropertyOfferStatus(id: number, status: string, adminNotes?: string): Promise<PropertyOffer> {
    const updates: any = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [updated] = await db.update(propertyOffers).set(updates).where(eq(propertyOffers.id, id)).returning();
    return updated;
  }

  async createSwipeNotification(notification: InsertSwipeNotification): Promise<SwipeNotification> {
    const [created] = await db.insert(swipeNotifications).values(notification).returning();
    return created;
  }

  async getSwipeNotificationsForUser(userId: string): Promise<(SwipeNotification & { property: Property; buyer: any })[]> {
    const rows = await db
      .select({ notification: swipeNotifications, property: properties, buyer: users })
      .from(swipeNotifications)
      .innerJoin(properties, eq(swipeNotifications.propertyId, properties.id))
      .leftJoin(users, eq(swipeNotifications.buyerUserId, users.id))
      .where(eq(swipeNotifications.notifiedUserId, userId))
      .orderBy(desc(swipeNotifications.createdAt));
    return rows.map(r => ({ ...r.notification, property: r.property, buyer: r.buyer }));
  }

  async getAdminSwipeNotifications(): Promise<(SwipeNotification & { property: Property; buyer: any })[]> {
    const rows = await db
      .select({ notification: swipeNotifications, property: properties, buyer: users })
      .from(swipeNotifications)
      .innerJoin(properties, eq(swipeNotifications.propertyId, properties.id))
      .leftJoin(users, eq(swipeNotifications.buyerUserId, users.id))
      .orderBy(desc(swipeNotifications.createdAt));
    return rows.map(r => ({ ...r.notification, property: r.property, buyer: r.buyer }));
  }

  async updateSwipeNotificationStatus(id: number, status: string, offerId?: number): Promise<SwipeNotification> {
    const updates: any = { status };
    if (offerId !== undefined) updates.offerId = offerId;
    const [updated] = await db.update(swipeNotifications).set(updates).where(eq(swipeNotifications.id, id)).returning();
    return updated;
  }

  async getExistingSwipeNotification(buyerUserId: string, propertyId: number): Promise<SwipeNotification | undefined> {
    const rows = await db
      .select()
      .from(swipeNotifications)
      .where(and(eq(swipeNotifications.buyerUserId, buyerUserId), eq(swipeNotifications.propertyId, propertyId)))
      .limit(1);
    return rows[0];
  }
  async createPropertyReview(review: InsertPropertyReview): Promise<PropertyReview> {
    const [newReview] = await db.insert(propertyReviews).values(review).returning();
    return newReview;
  }

  async getPropertyReviews(propertyId: number): Promise<(PropertyReview & { user: any })[]> {
    const rows = await db
      .select({ review: propertyReviews, user: users })
      .from(propertyReviews)
      .leftJoin(users, eq(propertyReviews.userId, users.id))
      .where(eq(propertyReviews.propertyId, propertyId))
      .orderBy(desc(propertyReviews.createdAt));
    return rows.map(r => ({ ...r.review, user: r.user }));
  }

  async updateReviewVisibility(id: number, isPublic: boolean, moderatedBy: string): Promise<PropertyReview> {
    const [updated] = await db
      .update(propertyReviews)
      .set({ isPublic, moderatedBy })
      .where(eq(propertyReviews.id, id))
      .returning();
    return updated;
  }

  async deletePropertyReview(id: number): Promise<void> {
    await db.delete(propertyReviews).where(eq(propertyReviews.id, id));
  }

  async getUserReviewForProperty(userId: string, propertyId: number): Promise<PropertyReview | undefined> {
    const rows = await db
      .select()
      .from(propertyReviews)
      .where(and(eq(propertyReviews.userId, userId), eq(propertyReviews.propertyId, propertyId)))
      .limit(1);
    return rows[0];
  }

  // === Agent CRM - Contacts ===
  async getAgentContacts(agentId: string, tagId?: number): Promise<(AgentContact & { tags: ContactTag[] })[]> {
    let rows: AgentContact[];
    if (tagId) {
      const matched = await db
        .select({ contact: agentContacts })
        .from(agentContacts)
        .innerJoin(contactTagAssignments, eq(contactTagAssignments.contactId, agentContacts.id))
        .where(and(eq(agentContacts.agentId, agentId), eq(contactTagAssignments.tagId, tagId)))
        .orderBy(desc(agentContacts.createdAt));
      rows = matched.map(r => r.contact);
    } else {
      rows = await db
        .select()
        .from(agentContacts)
        .where(eq(agentContacts.agentId, agentId))
        .orderBy(desc(agentContacts.createdAt));
    }

    const allAssignments = rows.length > 0
      ? await db
          .select({ assignment: contactTagAssignments, tag: contactTags })
          .from(contactTagAssignments)
          .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
          .where(sql`${contactTagAssignments.contactId} IN (${sql.join(rows.map(r => sql`${r.id}`), sql`, `)})`)
      : [];

    const tagsByContact = new Map<number, ContactTag[]>();
    for (const row of allAssignments) {
      const existing = tagsByContact.get(row.assignment.contactId) || [];
      existing.push(row.tag);
      tagsByContact.set(row.assignment.contactId, existing);
    }

    return rows.map(c => ({ ...c, tags: tagsByContact.get(c.id) || [] }));
  }

  async getAgentContact(id: number, agentId: string): Promise<(AgentContact & { tags: ContactTag[] }) | undefined> {
    const rows = await db.select().from(agentContacts)
      .where(and(eq(agentContacts.id, id), eq(agentContacts.agentId, agentId)));
    if (rows.length === 0) return undefined;
    const contact = rows[0];

    const tagRows = await db
      .select({ tag: contactTags })
      .from(contactTagAssignments)
      .innerJoin(contactTags, eq(contactTagAssignments.tagId, contactTags.id))
      .where(eq(contactTagAssignments.contactId, id));

    return { ...contact, tags: tagRows.map(r => r.tag) };
  }

  async createAgentContact(contact: InsertAgentContact): Promise<AgentContact> {
    const [created] = await db.insert(agentContacts).values(contact).returning();
    return created;
  }

  async createAgentContactsBulk(contacts: InsertAgentContact[]): Promise<AgentContact[]> {
    if (contacts.length === 0) return [];
    const created = await db.insert(agentContacts).values(contacts).returning();
    return created;
  }

  async updateAgentContact(id: number, agentId: string, updates: Partial<InsertAgentContact>): Promise<AgentContact> {
    const [updated] = await db
      .update(agentContacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agentContacts.id, id), eq(agentContacts.agentId, agentId)))
      .returning();
    return updated;
  }

  async deleteAgentContact(id: number, agentId: string): Promise<void> {
    await db.delete(agentContacts)
      .where(and(eq(agentContacts.id, id), eq(agentContacts.agentId, agentId)));
  }

  // === Agent CRM - Tags ===
  async getContactTags(agentId: string): Promise<ContactTag[]> {
    return await db.select().from(contactTags)
      .where(eq(contactTags.agentId, agentId))
      .orderBy(contactTags.name);
  }

  async createContactTag(tag: InsertContactTag): Promise<ContactTag> {
    const [created] = await db.insert(contactTags).values(tag).returning();
    return created;
  }

  async updateContactTag(id: number, agentId: string, updates: Partial<InsertContactTag>): Promise<ContactTag> {
    const [updated] = await db
      .update(contactTags)
      .set(updates)
      .where(and(eq(contactTags.id, id), eq(contactTags.agentId, agentId)))
      .returning();
    return updated;
  }

  async deleteContactTag(id: number, agentId: string): Promise<void> {
    await db.delete(contactTags)
      .where(and(eq(contactTags.id, id), eq(contactTags.agentId, agentId)));
  }

  // === Agent CRM - Tag Assignments ===
  async assignTagToContact(contactId: number, tagId: number): Promise<ContactTagAssignment> {
    const existing = await db.select().from(contactTagAssignments)
      .where(and(eq(contactTagAssignments.contactId, contactId), eq(contactTagAssignments.tagId, tagId)))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [created] = await db.insert(contactTagAssignments).values({ contactId, tagId }).returning();
    return created;
  }

  async removeTagFromContact(contactId: number, tagId: number): Promise<void> {
    await db.delete(contactTagAssignments)
      .where(and(eq(contactTagAssignments.contactId, contactId), eq(contactTagAssignments.tagId, tagId)));
  }

  async assignTagToContacts(contactIds: number[], tagId: number): Promise<void> {
    if (contactIds.length === 0) return;
    const values = contactIds.map(contactId => ({ contactId, tagId }));
    await db.insert(contactTagAssignments).values(values).onConflictDoNothing();
  }

  // === Error Reports ===
  async createErrorReport(report: InsertErrorReport): Promise<ErrorReport> {
    const [created] = await db.insert(errorReports).values(report).returning();
    return created;
  }

  async getErrorReports(filters?: { status?: string; resolved?: boolean }): Promise<ErrorReport[]> {
    let conditions: any[] = [];
    if (filters?.status) conditions.push(eq(errorReports.status, filters.status));
    if (filters?.resolved !== undefined) conditions.push(eq(errorReports.resolved, filters.resolved));
    const query = conditions.length > 0
      ? db.select().from(errorReports).where(and(...conditions)).orderBy(desc(errorReports.lastSeen)).limit(200)
      : db.select().from(errorReports).orderBy(desc(errorReports.lastSeen)).limit(200);
    return query;
  }

  async getErrorReport(id: number): Promise<ErrorReport | undefined> {
    const [report] = await db.select().from(errorReports).where(eq(errorReports.id, id)).limit(1);
    return report;
  }

  async updateErrorReport(id: number, updates: Partial<{ status: string; adminNotes: string; resolved: boolean }>): Promise<ErrorReport> {
    const [updated] = await db.update(errorReports).set(updates).where(eq(errorReports.id, id)).returning();
    return updated;
  }

  async incrementErrorOccurrence(fingerprint: string, url: string): Promise<ErrorReport | null> {
    const conditions = [eq(errorReports.message, fingerprint), eq(errorReports.resolved, false)];
    if (url) conditions.push(eq(errorReports.url, url));
    const existing = await db.select().from(errorReports)
      .where(and(...conditions))
      .limit(1);
    if (existing.length === 0) return null;
    const [updated] = await db.update(errorReports)
      .set({ occurrences: sql`${errorReports.occurrences} + 1`, lastSeen: new Date() })
      .where(eq(errorReports.id, existing[0].id))
      .returning();
    return updated;
  }

  async getNotifications(userId: string, filters?: { unreadOnly?: boolean; archived?: boolean }): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];
    if (filters?.unreadOnly) conditions.push(eq(notifications.read, false));
    if (filters?.archived === true) {
      conditions.push(eq(notifications.archived, true));
    } else if (filters?.archived === false || !filters?.archived) {
      conditions.push(eq(notifications.archived, false));
    }
    return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(100);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db.select({ value: count() }).from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false), eq(notifications.archived, false)));
    return result?.value || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: number, userId: string): Promise<Notification> {
    const [updated] = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  async archiveNotification(id: number, userId: string): Promise<Notification> {
    const [updated] = await db.update(notifications).set({ archived: true, read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning();
    return updated;
  }

  async deleteNotification(id: number, userId: string): Promise<boolean> {
    const result = await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id });
    return result.length > 0;
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreference | null> {
    const rows = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
    return rows[0] || null;
  }

  async upsertNotificationPreferences(userId: string, prefs: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);
    if (existing) {
      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      const allowedKeys: Array<keyof NotificationPreference> = [
        "emailEnabled", "emailNewListing", "emailPriceDrop", "emailOpenHouse",
        "emailAgentMatch", "emailSystem", "emailDigestFrequency",
        "inAppEnabled", "inAppNewListing", "inAppPriceDrop", "inAppOpenHouse",
        "inAppAgentMatch", "inAppSystem",
      ];
      for (const key of allowedKeys) {
        if (prefs[key] !== undefined) {
          updateFields[key] = prefs[key];
        }
      }
      const [updated] = await db.update(notificationPreferences)
        .set(updateFields)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(notificationPreferences)
      .values({
        userId,
        emailEnabled: prefs.emailEnabled ?? true,
        emailNewListing: prefs.emailNewListing ?? true,
        emailPriceDrop: prefs.emailPriceDrop ?? true,
        emailOpenHouse: prefs.emailOpenHouse ?? true,
        emailAgentMatch: prefs.emailAgentMatch ?? true,
        emailSystem: prefs.emailSystem ?? true,
        emailDigestFrequency: prefs.emailDigestFrequency ?? "instant",
        inAppEnabled: prefs.inAppEnabled ?? true,
        inAppNewListing: prefs.inAppNewListing ?? true,
        inAppPriceDrop: prefs.inAppPriceDrop ?? true,
        inAppOpenHouse: prefs.inAppOpenHouse ?? true,
        inAppAgentMatch: prefs.inAppAgentMatch ?? true,
        inAppSystem: prefs.inAppSystem ?? true,
        emailsSentToday: 0,
        lastEmailResetDate: null,
        lastEmailSentAt: null,
      })
      .returning();
    return created;
  }

  async incrementEmailCount(userId: string): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const prefs = await this.getNotificationPreferences(userId);
    if (!prefs) return;

    if (prefs.lastEmailResetDate !== today) {
      await db.update(notificationPreferences)
        .set({ emailsSentToday: 1, lastEmailResetDate: today, lastEmailSentAt: new Date() })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      await db.update(notificationPreferences)
        .set({ emailsSentToday: sql`${notificationPreferences.emailsSentToday} + 1`, lastEmailSentAt: new Date() })
        .where(eq(notificationPreferences.userId, userId));
    }
  }

  async resetDailyEmailCount(userId: string): Promise<void> {
    await db.update(notificationPreferences)
      .set({ emailsSentToday: 0, lastEmailResetDate: new Date().toISOString().split("T")[0] })
      .where(eq(notificationPreferences.userId, userId));
  }

  // ── Buyer Interest ──────────────────────────────────────────────────────────

  async upsertBuyerInterest(propertyId: number, buyerUserId: string, source: string = "swipe"): Promise<BuyerInterest> {
    const existing = await db.select().from(buyerInterest)
      .where(and(eq(buyerInterest.propertyId, propertyId), eq(buyerInterest.buyerUserId, buyerUserId)))
      .limit(1);
    const stageMap: Record<string, string> = {
      swipe: "new",
      inquiry: "engaged",
      text: "engaged",
      info_request: "engaged",
      showing_request: "showing",
      offer: "offer",
    };
    const stageOrder = ["new", "engaged", "showing", "offer"];
    if (existing.length > 0) {
      const newStage = stageMap[source] || existing[0].stage;
      const shouldUpgrade = stageOrder.indexOf(newStage) > stageOrder.indexOf(existing[0].stage);
      const [updated] = await db.update(buyerInterest)
        .set({
          source,
          stage: shouldUpgrade ? newStage : existing[0].stage,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(buyerInterest.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(buyerInterest).values({
      propertyId,
      buyerUserId,
      source,
      stage: stageMap[source] || "new",
    }).returning();
    return created;
  }

  async getBuyerInterestForAgent(agentUserId: string): Promise<(BuyerInterest & { property: Property; buyer: any })[]> {
    const rows = await db.select().from(buyerInterest)
      .innerJoin(properties, eq(buyerInterest.propertyId, properties.id))
      .where(eq(properties.agentId, agentUserId))
      .orderBy(desc(buyerInterest.lastActivityAt));
    const results: (BuyerInterest & { property: Property; buyer: any })[] = [];
    for (const row of rows) {
      const buyer = await this.getUser(row.buyer_interest.buyerUserId);
      results.push({ ...row.buyer_interest, property: row.properties, buyer });
    }
    return results;
  }

  async getBuyerInterestForBuyer(buyerUserId: string): Promise<(BuyerInterest & { property: Property })[]> {
    const rows = await db.select().from(buyerInterest)
      .innerJoin(properties, eq(buyerInterest.propertyId, properties.id))
      .where(eq(buyerInterest.buyerUserId, buyerUserId))
      .orderBy(desc(buyerInterest.lastActivityAt));
    return rows.map(row => ({ ...row.buyer_interest, property: row.properties }));
  }

  // ── Conversations ───────────────────────────────────────────────────────────

  async getOrCreateConversation(propertyId: number, buyerUserId: string, agentUserId: string, initiatedBy: string = "buyer"): Promise<Conversation> {
    const existing = await db.select().from(conversations)
      .where(and(
        eq(conversations.propertyId, propertyId),
        eq(conversations.buyerUserId, buyerUserId),
        eq(conversations.agentUserId, agentUserId),
      ))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [created] = await db.insert(conversations).values({
      propertyId, buyerUserId, agentUserId,
      initiatedBy,
      buyerLastReadAt: new Date(),
      agentLastReadAt: new Date(),
    }).returning();
    const now = new Date();
    const existingInterest = await db.select().from(buyerInterest)
      .where(and(eq(buyerInterest.propertyId, propertyId), eq(buyerInterest.buyerUserId, buyerUserId)))
      .limit(1);
    if (existingInterest.length > 0) {
      const stageOrder = ["new", "engaged", "showing", "offer"];
      const currentIdx = stageOrder.indexOf(existingInterest[0].stage);
      const engagedIdx = stageOrder.indexOf("engaged");
      const newStage = engagedIdx > currentIdx ? "engaged" : existingInterest[0].stage;
      await db.update(buyerInterest)
        .set({ conversationId: created.id, stage: newStage, lastActivityAt: now, updatedAt: now })
        .where(eq(buyerInterest.id, existingInterest[0].id));
    }
    return created;
  }

  async getConversation(id: number): Promise<(Conversation & { property: Property; buyer: any; agent: any }) | undefined> {
    const rows = await db.select().from(conversations)
      .innerJoin(properties, eq(conversations.propertyId, properties.id))
      .where(eq(conversations.id, id))
      .limit(1);
    if (rows.length === 0) return undefined;
    const row = rows[0];
    const buyer = await this.getUser(row.conversations.buyerUserId);
    const agent = await this.getUser(row.conversations.agentUserId);
    return { ...row.conversations, property: row.properties, buyer, agent };
  }

  async getConversationsForUser(userId: string): Promise<(Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; unreadCount: number })[]> {
    const rows = await db.select().from(conversations)
      .innerJoin(properties, eq(conversations.propertyId, properties.id))
      .where(sql`${conversations.buyerUserId} = ${userId} OR ${conversations.agentUserId} = ${userId}`)
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.updatedAt})`));
    const results: (Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; unreadCount: number })[] = [];
    for (const row of rows) {
      const conv = row.conversations;
      const buyer = await this.getUser(conv.buyerUserId);
      const agent = await this.getUser(conv.agentUserId);
      const lastMsgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const lastMessage = lastMsgs.length > 0 ? lastMsgs[0] : null;
      const isBuyer = conv.buyerUserId === userId;
      const readAt = isBuyer ? conv.buyerLastReadAt : conv.agentLastReadAt;
      const unreadRows = await db.select({ count: count() }).from(messages)
        .where(and(
          eq(messages.conversationId, conv.id),
          sql`${messages.senderUserId} != ${userId}`,
          readAt ? sql`${messages.createdAt} > ${readAt}` : sql`1=1`,
        ));
      const unreadCount = Number(unreadRows[0]?.count || 0);
      results.push({ ...conv, property: row.properties, buyer, agent, lastMessage, unreadCount });
    }
    return results;
  }

  async updateConversationReadAt(conversationId: number, userId: string, role: 'buyer' | 'agent'): Promise<void> {
    const now = new Date();
    if (role === 'buyer') {
      await db.update(conversations).set({ buyerLastReadAt: now }).where(eq(conversations.id, conversationId));
    } else {
      await db.update(conversations).set({ agentLastReadAt: now }).where(eq(conversations.id, conversationId));
    }
  }

  async getAllConversations(filters?: { search?: string; status?: string; limit?: number; offset?: number }): Promise<{ conversations: (Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; messageCount: number })[]; total: number }> {
    const conditions: any[] = [];
    if (filters?.status && filters.status !== "all") {
      conditions.push(eq(conversations.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const safeLimit = Math.min(Math.max((filters?.limit || 50), 1), 200);
    const safeOffset = Math.max((filters?.offset || 0), 0);

    const rows = await db.select().from(conversations)
      .innerJoin(properties, eq(conversations.propertyId, properties.id))
      .where(whereClause)
      .orderBy(desc(sql`COALESCE(${conversations.lastMessageAt}, ${conversations.updatedAt})`));

    const allResults: (Conversation & { property: Property; buyer: any; agent: any; lastMessage: Message | null; messageCount: number })[] = [];

    for (const row of rows) {
      const conv = row.conversations;
      const buyer = await this.getUser(conv.buyerUserId);
      const agent = await this.getUser(conv.agentUserId);

      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const buyerName = `${buyer?.firstName || ""} ${buyer?.lastName || ""}`.trim().toLowerCase();
        const agentName = `${agent?.firstName || ""} ${agent?.lastName || ""}`.trim().toLowerCase();
        const buyerEmail = (buyer?.email || "").toLowerCase();
        const agentEmail = (agent?.email || "").toLowerCase();
        if (!buyerName.includes(q) && !agentName.includes(q) && !buyerEmail.includes(q) && !agentEmail.includes(q)) {
          continue;
        }
      }

      const lastMsgs = await db.select().from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      const lastMessage = lastMsgs.length > 0 ? lastMsgs[0] : null;

      const msgCountRows = await db.select({ count: count() }).from(messages)
        .where(eq(messages.conversationId, conv.id));
      const messageCount = Number(msgCountRows[0]?.count || 0);

      allResults.push({ ...conv, property: row.properties, buyer, agent, lastMessage, messageCount });
    }

    const total = allResults.length;
    const paginatedResults = allResults.slice(safeOffset, safeOffset + safeLimit);

    return { conversations: paginatedResults, total };
  }

  async getConversationWithMessages(id: number): Promise<{ conversation: Conversation & { property: Property; buyer: any; agent: any }; messages: (Message & { sender: any })[] } | undefined> {
    const convo = await this.getConversation(id);
    if (!convo) return undefined;
    const msgs = await this.getMessagesForConversation(id, 10000);
    return { conversation: convo, messages: msgs };
  }

  async updateBuyerMatchConversationId(matchId: number, conversationId: number): Promise<void> {
    await db.update(buyerMatches).set({ conversationId }).where(eq(buyerMatches.id, matchId));
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    const now = new Date();
    await db.update(conversations).set({ updatedAt: now, lastMessageAt: now }).where(eq(conversations.id, message.conversationId));
    const convo = await db.select().from(conversations).where(eq(conversations.id, message.conversationId)).limit(1);
    if (convo.length > 0) {
      await db.update(buyerInterest)
        .set({ lastActivityAt: now, updatedAt: now })
        .where(and(eq(buyerInterest.propertyId, convo[0].propertyId), eq(buyerInterest.buyerUserId, convo[0].buyerUserId)));
    }
    return created;
  }

  async getMessagesForConversation(conversationId: number, limit: number = 50, before?: number): Promise<(Message & { sender: any })[]> {
    let query = db.select().from(messages)
      .where(before
        ? and(eq(messages.conversationId, conversationId), sql`${messages.id} < ${before}`)
        : eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    const rows = await query;
    const results: (Message & { sender: any })[] = [];
    for (const msg of rows) {
      const sender = await this.getUser(msg.senderUserId);
      results.push({ ...msg, sender });
    }
    return results.reverse();
  }

  // ── Showing Requests ────────────────────────────────────────────────────────

  async createShowingRequest(request: InsertShowingRequest): Promise<ShowingRequest> {
    const [created] = await db.insert(showingRequests).values(request).returning();
    return created;
  }

  async getShowingRequest(id: number): Promise<ShowingRequest | undefined> {
    const [row] = await db.select().from(showingRequests).where(eq(showingRequests.id, id));
    return row;
  }

  async getShowingRequestsForUser(userId: string): Promise<(ShowingRequest & { property: Property; buyer: any; agent: any })[]> {
    const rows = await db.select().from(showingRequests)
      .innerJoin(properties, eq(showingRequests.propertyId, properties.id))
      .where(sql`${showingRequests.buyerUserId} = ${userId} OR ${showingRequests.agentUserId} = ${userId}`)
      .orderBy(desc(showingRequests.createdAt));
    const results: (ShowingRequest & { property: Property; buyer: any; agent: any })[] = [];
    for (const row of rows) {
      const buyer = await this.getUser(row.showing_requests.buyerUserId);
      const agent = await this.getUser(row.showing_requests.agentUserId);
      results.push({ ...row.showing_requests, property: row.properties, buyer, agent });
    }
    return results;
  }

  async updateShowingRequestStatus(id: number, status: string, confirmedDate?: Date): Promise<ShowingRequest> {
    const updates: any = { status, updatedAt: new Date() };
    if (confirmedDate) updates.confirmedDate = confirmedDate;
    const [updated] = await db.update(showingRequests).set(updates).where(eq(showingRequests.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
