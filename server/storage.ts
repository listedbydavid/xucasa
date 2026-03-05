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
  users,
} from "@shared/schema";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";

export interface IStorage {
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

  // Valuation
  getValuation(beds: number, sqft: number, lat?: number, lng?: number): Promise<{
    estimatedLow: number;
    estimatedMid: number;
    estimatedHigh: number;
    pricePerSqft: number;
    compsCount: number;
    comps: { id: number; title: string; price: number; beds: number; sqft: number; location: string; distanceMiles?: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  private buildPropertyFilters(filters?: any) {
    let conditions: any[] = [];
    if (filters) {
      if (filters.location) {
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
      if (filters.maxHoaFee) conditions.push(sql`${properties.hoaFee} <= ${filters.maxHoaFee}`);
      if (filters.isOffMarket !== undefined) {
        conditions.push(eq(properties.isOffMarket, filters.isOffMarket === 'true'));
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

    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(whereClause)
      .orderBy(desc(properties.createdAt))
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
}

export const storage = new DatabaseStorage();
