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

export {};
