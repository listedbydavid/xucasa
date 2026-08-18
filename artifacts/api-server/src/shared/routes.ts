import { z } from 'zod';
import { insertPropertySchema, insertSavedSearchSchema, searchCriteriaSchema, properties } from '@workspace/db';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  properties: {
    list: {
      method: 'GET' as const,
      path: '/api/properties' as const,
      input: z.object({
        location: z.string().optional(),
        city: z.string().optional(),
        county: z.string().optional(),
        minPrice: z.coerce.number().optional(),
        maxPrice: z.coerce.number().optional(),
        minBeds: z.coerce.number().optional(),
        minBaths: z.coerce.number().optional(),
        minSqft: z.coerce.number().optional(),
        maxSqft: z.coerce.number().optional(),
        maxHoaFee: z.coerce.number().optional(),
        isOffMarket: z.enum(['true', 'false']).optional(),
        propertyType: z.string().optional(),
        status: z.enum(['active', 'pending', 'sold']).optional(),
        sort: z.enum(['newest', 'price_asc', 'price_desc', 'sqft_desc']).optional(),
        limit: z.coerce.number().optional(),
        offset: z.coerce.number().optional(),
      }).optional(),
      responses: {
        200: z.object({
          properties: z.array(z.any()),
          total: z.number(),
          limit: z.number(),
          offset: z.number(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/properties/:id' as const,
      responses: {
        200: z.any(), // PropertyResponse
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/properties' as const,
      input: insertPropertySchema,
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/properties/:id' as const,
      input: (insertPropertySchema as z.ZodObject<any>).partial(),
      responses: {
        200: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/properties/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  savedProperties: {
    list: {
      method: 'GET' as const,
      path: '/api/saved-properties' as const,
      responses: {
        200: z.array(z.any()), // SavedPropertyResponse
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/saved-properties' as const,
      input: z.object({ propertyId: z.number(), listId: z.number().nullable().optional() }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/saved-properties/:propertyId' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  },
  savedSearches: {
    list: {
      method: 'GET' as const,
      path: '/api/saved-searches' as const,
      responses: {
        200: z.array(z.any()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/saved-searches' as const,
      input: z.object({
        name: z.string(),
        criteria: searchCriteriaSchema,
      }),
      responses: {
        201: z.any(),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/saved-searches/:id' as const,
      responses: {
        204: z.void(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
