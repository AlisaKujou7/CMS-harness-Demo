import { z } from 'zod';
import { errorEnvelope } from './contract-schemas.js';
import { API_ROUTES, type ApiRoute, type Auth } from './routes.js';

type JsonObject = Record<string, unknown>;

const SECURITY: Readonly<Record<Auth, readonly JsonObject[] | undefined>> = {
  none: undefined,
  bearer: [{ bearerAuth: [] }],
  apiKey: [{ apiKeyAuth: [] }],
  refreshCookie: [{ refreshCookie: [] }],
};

function toSchema(schema: z.ZodType, io: 'input' | 'output'): JsonObject {
  const json = z.toJSONSchema(schema, {
    io,
    target: 'draft-2020-12',
    unrepresentable: 'any',
  }) as JsonObject;
  return Object.fromEntries(Object.entries(json).filter(([key]) => key !== '$schema'));
}

const CACHE_HEADERS = {
  ETag: { description: 'Names this version of the response', schema: { type: 'string' } },
  'Last-Modified': {
    description: 'For information. Only If-None-Match can get a 304',
    schema: { type: 'string' },
  },
  'Cache-Control': { description: 'How long to reuse the response', schema: { type: 'string' } },
};

function requiredHeaderParameters(route: ApiRoute): JsonObject[] {
  return Object.entries(route.requiredHeaders ?? {}).map(([name, value]) => ({
    name,
    in: 'header',
    required: true,
    schema: { type: 'string', const: value },
  }));
}

function extraResponses(route: ApiRoute): JsonObject {
  const error = { $ref: '#/components/responses/Error' };
  return {
    ...(route.cacheHeaders
      ? { '304': { description: 'The version named by If-None-Match is still current' } }
      : {}),
    ...(route.rateLimited
      ? {
          '429': {
            description: 'Too many requests. Wait as long as Retry-After says',
            headers: {
              'Retry-After': { description: 'Seconds to wait', schema: { type: 'integer' } },
            },
            content: { 'application/json': { schema: toSchema(errorEnvelope, 'output') } },
          },
        }
      : {}),
    ...(route.unavailableStatus !== undefined && typeof route.response === 'object'
      ? {
          [String(route.unavailableStatus)]: {
            description: 'Not able to serve requests',
            content: jsonContent(toSchema(route.response, 'output')),
          },
        }
      : {}),
    default: error,
  };
}

function pathParameters(path: string): JsonObject[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: 'path',
    required: true,
    schema: name === 'version' ? { type: 'integer', minimum: 1 } : { type: 'string' },
  }));
}

function queryParameters(query: z.ZodObject): JsonObject[] {
  const { properties = {}, required = [] } = toSchema(query, 'input') as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, schema]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    // A coerced number accepts anything as its input, but what makes sense to send is a number.
    schema: Object.keys(schema).length === 0 ? { type: 'integer', minimum: 1 } : schema,
  }));
}

function jsonContent(schema: JsonObject): JsonObject {
  return { 'application/json': { schema } };
}

function successResponse(route: ApiRoute): JsonObject {
  const description = route.summary;
  const headers = route.cacheHeaders ? { headers: CACHE_HEADERS } : {};
  if (route.response === undefined) return { description };
  if (route.response === 'text/csv') {
    return { description, content: { 'text/csv': { schema: { type: 'string' } } } };
  }
  return { description, ...headers, content: jsonContent(toSchema(route.response, 'output')) };
}

function toOperation(route: ApiRoute): JsonObject {
  const parameters = [
    ...pathParameters(route.path),
    ...requiredHeaderParameters(route),
    ...(route.query ? queryParameters(route.query) : []),
  ];
  const security = SECURITY[route.auth];
  return {
    operationId: route.id,
    summary: route.summary,
    description: route.roles ? `${route.summary}. Requires: ${route.roles}.` : route.summary,
    tags: [route.tag],
    ...(security ? { security } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            // Controllers read a missing body as an empty one, so it is only needed if that fails.
            required: !route.body.safeParse({}).success,
            content: jsonContent(toSchema(route.body, 'input')),
          },
        }
      : {}),
    responses: {
      [String(route.status)]: successResponse(route),
      ...extraResponses(route),
    },
  };
}

// FR-PUBAPI-07 and ADR-0008. Requests come from the very schemas the controllers validate with.
export function buildOpenApiDocument(routes: readonly ApiRoute[] = API_ROUTES): JsonObject {
  const paths: Record<string, Record<string, JsonObject>> = {};
  for (const route of routes) {
    paths[route.path] = { ...paths[route.path], [route.method]: toOperation(route) };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'CMS API',
      version: '1.0.0',
      description:
        'The Admin API for the admin application, and the read-only Public API for frontends.',
      contact: { name: 'CMS team' },
    },
    servers: [{ url: '/', description: 'This server' }],
    tags: [...new Set(routes.map((route) => route.tag))].map((name) => ({
      name,
      description: `${name} endpoints`,
    })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        refreshCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'cms_refresh',
          description: 'The session cookie set at login',
        },
      },
      responses: {
        Error: {
          description: 'An error, in the standard envelope',
          content: jsonContent(toSchema(errorEnvelope, 'output')),
        },
      },
    },
  };
}
