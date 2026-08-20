declare global {
  namespace Express {
    interface User {
      claims: {
        sub: string;
        email?: string;
        name?: string;
        picture?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
      };
      id?: string;
      email?: string;
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    }
  }
}

// Extend express-session to support referral tracking fields
declare module "express-session" {
  interface SessionData {
    /** Verified referring agent ID stored when a visitor lands via ?agent= link */
    referringAgentId?: string;
    /** The property ID that was viewed with the referral link */
    referredPropertyId?: number;
  }
}

export {};
