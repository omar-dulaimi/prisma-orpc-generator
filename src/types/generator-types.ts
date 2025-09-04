/**
 * Type definitions for the oRPC generator
 * Replaces generic types with proper TypeScript interfaces
 */

export type FieldKind = 'scalar' | 'object' | 'enum';
export type FieldType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Decimal'
  | 'Boolean'
  | 'DateTime'
  | 'Json'
  | 'Bytes';

export interface PrismaField {
  name: string;
  type: string;
  isId: boolean;
  isOptional: boolean;
  isReadOnly: boolean;
  isList: boolean;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
  kind: FieldKind;
  hasDefaultValue?: boolean;
  default?: unknown;
  isGenerated?: boolean;
  isUpdatedAt?: boolean;
}

export interface PrismaModel {
  name: string;
  dbName?: string;
  fields: PrismaField[];
  primaryKey?: {
    name?: string;
    fields: string[];
  };
  uniqueFields: string[][];
  uniqueIndexes: Array<{
    name: string;
    fields: string[];
  }>;
  isGenerated?: boolean;
}

export interface PrismaEnum {
  name: string;
  values: Array<{
    name: string;
    dbName?: string;
  }>;
  dbName?: string;
}

export interface GeneratorContext {
  prisma: {
    models: PrismaModel[];
    enums: PrismaEnum[];
    types: unknown[];
  };
  config: {
    generator: {
      name: string;
      provider: string;
      output: string;
      config: Record<string, string>;
    };
  };
}

export type AuthenticationStrategy = 'none' | 'jwt' | 'apikey' | 'oauth' | 'custom';
export type CacheStrategy = 'none' | 'memory' | 'redis' | 'custom';
export type SchemaLibrary = 'zod' | 'yup' | 'joi';
export type RuntimeTarget = 'node' | 'edge' | 'deno' | 'bun';

export interface RequestInfo {
  ip?: string;
  headers?: Record<string, string>;
  requestId?: string;
  correlationId?: string;
  userAgent?: string;
  method?: string;
  url?: string;
}

export interface TracingInfo {
  requestId: string;
  startTime: number;
  duration?: number;
}

export interface User {
  id: string;
  roles?: string[];
  permissions?: string[];
  scopes?: string[];
  [key: string]: unknown;
}

export interface CacheAdapter {
  get(_key: string): Promise<unknown>;
  set(_key: string, _value: unknown, _ttl?: number): Promise<void>;
  del(_key: string): Promise<void>;
  clear?(): Promise<void>;
  clearNamespace?(_namespace: string): Promise<void>;
}

export interface ExtendedCacheAdapter extends CacheAdapter {
  tagIndex: Map<string, Set<string>>;
}

export interface RateLimiter {
  check(_identifier: string, _limit: number, _windowMs: number): Promise<boolean>;
  reset(_identifier: string): Promise<void>;
}

export interface DataLoaders {
  _createModelLoader?(_modelName: string): unknown;
  [modelName: string]:
    | {
        load(_id: string): Promise<unknown>;
        loadMany(_ids: string[]): Promise<unknown[]>;
      }
    | ((_modelName: string) => unknown)
    | undefined;
}

export interface AuthAdapter {
  verify?(_token: string, _strategy: string, _options: unknown): Promise<User | null>;
  shouldRefresh?(_token: string, _user: User): Promise<boolean>;
  refresh?(_token: string, _user: User): Promise<{ token?: string; user?: User }>;
}

export interface ORPCContext {
  prisma: unknown; // PrismaClient - avoid direct dependency
  user?: User;
  request?: RequestInfo;
  cache?: ExtendedCacheAdapter;
  loaders?: DataLoaders;
  tracing?: TracingInfo;
  auth?: AuthAdapter;
  rateLimiter?: RateLimiter;
  [key: string]: unknown;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export type APIResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T = unknown> extends SuccessResponse<T[]> {
  meta: {
    pagination: PaginationMeta;
    [key: string]: unknown;
  };
}

export interface TestDataGenerator {
  generateTestData(
    _model: PrismaModel,
    _seed?: number,
    _isUpdate?: boolean
  ): Record<string, unknown>;
  generateCreateData(_model: PrismaModel): Record<string, unknown>;
  generateUpdateData(_model: PrismaModel): Record<string, unknown>;
}

export interface MiddlewareOptions<TContext = ORPCContext, TInput = unknown, TOutput = unknown> {
  context: TContext;
  input?: TInput;
  next: (_args: { context?: TContext; input?: TInput }) => Promise<TOutput>;
}

export interface MiddlewareResult<TContext = ORPCContext, TOutput = unknown> {
  context?: TContext;
  output?: TOutput;
}

export interface ProcedureHandlerOptions<TContext = ORPCContext, TInput = unknown> {
  context: TContext;
  input: TInput;
}

export type ProcedureHandler<TContext = ORPCContext, TInput = unknown, TOutput = unknown> = (
  _options: ProcedureHandlerOptions<TContext, TInput>
) => Promise<TOutput>;

// Reserved for future API documentation types

export interface ValidationOptions {
  strict: boolean;
  coerce: boolean;
  stripUnknown: boolean;
}

export interface GeneratorMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  homepage: string;
  repository: string;
}
