import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, desc, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'profileImageUrl' | 'phone'>>): Promise<User>;
  updateAgentInfo(id: string, updates: Partial<Pick<User, 'licenseNumber' | 'licenseState' | 'association' | 'brokerageName' | 'agentVerified' | 'agentVerifiedAt' | 'agentMlsId' | 'role'>>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  adminUpdateUser(id: string, updates: Partial<Pick<User, 'role' | 'status' | 'adminNotes'>>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getUserActivity(id: string): Promise<any>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values({ ...userData, lastLoginAt: new Date() })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning();
      return user;
    } catch (err: any) {
      if (err?.code === "23505" && userData.email) {
        const [existing] = await db.select().from(users).where(eq(users.email, userData.email));
        if (existing) {
          const [updated] = await db
            .update(users)
            .set({ ...userData, id: existing.id, lastLoginAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, existing.id))
            .returning();
          return updated;
        }
      }
      throw err;
    }
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'profileImageUrl' | 'phone'>>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateAgentInfo(id: string, updates: Partial<Pick<User, 'licenseNumber' | 'licenseState' | 'association' | 'brokerageName' | 'agentVerified' | 'agentVerifiedAt' | 'agentMlsId' | 'role'>>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async adminUpdateUser(id: string, updates: Partial<Pick<User, 'role' | 'status' | 'adminNotes'>>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserActivity(id: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM properties WHERE agent_id = ${id})::int AS listings_count,
        (SELECT COUNT(*) FROM saved_properties WHERE user_id = ${id})::int AS saved_count,
        (SELECT COUNT(*) FROM saved_searches WHERE user_id = ${id})::int AS searches_count,
        (SELECT COUNT(*) FROM search_history WHERE user_id = ${id})::int AS history_count,
        (SELECT COUNT(*) FROM buyer_profiles WHERE user_id = ${id})::int AS buyer_profiles_count,
        (SELECT COUNT(*) FROM buyer_matches WHERE sender_id = ${id})::int AS matches_sent_count,
        (SELECT COUNT(*) FROM sell_leads WHERE email = (SELECT email FROM users WHERE id = ${id}))::int AS sell_leads_count,
        (SELECT COUNT(*) FROM seller_pitches WHERE user_id = ${id})::int AS pitches_count,
        (SELECT COUNT(*) FROM user_homes WHERE user_id = ${id})::int AS homes_count,
        (SELECT COUNT(*) FROM favorite_lists WHERE user_id = ${id})::int AS fav_lists_count
    `);
    return result.rows[0] || {};
  }
}

export const authStorage = new AuthStorage();
