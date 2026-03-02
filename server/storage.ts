import { db } from "./db";
import {
  properties,
  savedProperties,
  savedSearches,
  searchHistory,
  userHomes,
  clientAgentLinks,
  type Property,
  type InsertProperty,
  type SavedProperty,
  type SavedSearch,
  type InsertSavedSearch,
  type SearchHistory,
  type UserHome,
  type InsertUserHome,
  type ClientAgentLink,
  users,
} from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export interface IStorage {
  // Properties
  getProperties(filters?: any): Promise<(Property & { agent: any })[]>;
  getProperty(id: number): Promise<(Property & { agent: any }) | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: number, updates: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: number): Promise<void>;

  // Saved Properties
  getSavedProperties(userId: string): Promise<(SavedProperty & { property: Property })[]>;
  saveProperty(userId: string, propertyId: number): Promise<SavedProperty>;
  removeSavedProperty(userId: string, propertyId: number): Promise<void>;

  // Saved Searches
  getSavedSearches(userId: string): Promise<SavedSearch[]>;
  createSavedSearch(userId: string, search: Omit<InsertSavedSearch, 'userId'>): Promise<SavedSearch>;
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
}

export class DatabaseStorage implements IStorage {
  async getProperties(filters?: any): Promise<(Property & { agent: any })[]> {
    let conditions = [];

    if (filters) {
      if (filters.location) {
        const q = `%${filters.location}%`;
        conditions.push(sql`(
          ${properties.location} ILIKE ${q}
          OR ${properties.addressCity} ILIKE ${q}
          OR ${properties.addressStreetName} ILIKE ${q}
          OR ${properties.addressZip} ILIKE ${q}
          OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}) ILIKE ${q}
          OR CONCAT(${properties.addressStreetNumber}, ' ', ${properties.addressStreetName}, ', ', ${properties.addressCity}) ILIKE ${q}
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
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({ property: properties, agent: users })
      .from(properties)
      .leftJoin(users, eq(properties.agentId, users.id))
      .where(whereClause);

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

  async getSavedProperties(userId: string): Promise<(SavedProperty & { property: Property })[]> {
    const results = await db
      .select({ savedProperty: savedProperties, property: properties })
      .from(savedProperties)
      .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
      .where(eq(savedProperties.userId, userId));

    return results.map(r => ({ ...r.savedProperty, property: r.property }));
  }

  async saveProperty(userId: string, propertyId: number): Promise<SavedProperty> {
    const [saved] = await db.insert(savedProperties).values({ userId, propertyId }).returning();
    return saved;
  }

  async removeSavedProperty(userId: string, propertyId: number): Promise<void> {
    await db.delete(savedProperties).where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)));
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db.select().from(savedSearches).where(eq(savedSearches.userId, userId)).orderBy(desc(savedSearches.createdAt));
  }

  async createSavedSearch(userId: string, search: Omit<InsertSavedSearch, 'userId'>): Promise<SavedSearch> {
    const [saved] = await db.insert(savedSearches).values({ ...search, userId }).returning();
    return saved;
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
}

export const storage = new DatabaseStorage();
