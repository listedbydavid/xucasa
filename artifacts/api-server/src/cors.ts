import type { CorsOptions } from "cors";

function normalizeOrigin(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    );
    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedCorsOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    [
      env.REPLIT_EXPO_DEV_DOMAIN,
      env.REPLIT_DEV_DOMAIN,
      env.EXPO_PUBLIC_DOMAIN,
      ...(env.CORS_ALLOWED_ORIGINS?.split(",") ?? []),
    ]
      .filter((origin): origin is string => Boolean(origin?.trim()))
      .map(normalizeOrigin)
      .filter((origin): origin is string => origin !== null),
  );
}

export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const trustedOrigins = getTrustedCorsOrigins(env);

  return {
    credentials: true,
    origin: (origin, callback) => {
      // Native Expo requests do not include an Origin header.
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      return callback(null, normalizedOrigin !== null && trustedOrigins.has(normalizedOrigin));
    },
  };
}