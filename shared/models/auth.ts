import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user"),
  status: varchar("status").default("active"),
  adminNotes: text("admin_notes"),
  licenseNumber: varchar("license_number"),
  licenseState: varchar("license_state"),
  association: varchar("association"),
  brokerageName: varchar("brokerage_name"),
  agentVerified: boolean("agent_verified").default(false),
  agentVerifiedAt: timestamp("agent_verified_at"),
  agentMlsId: varchar("agent_mls_id"),
  passwordHash: varchar("password_hash"),
  phone: varchar("phone"),
  emailVerified: boolean("email_verified").default(false),
  mailingAddress: text("mailing_address"),
  assignedAgentUserId: varchar("assigned_agent_user_id"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.assignedAgentUserId], foreignColumns: [table.id] }),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
