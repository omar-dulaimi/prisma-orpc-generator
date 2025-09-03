// Adapter & hook interface declarations (quick win scaffolding)
import type { DMMF } from '@prisma/generator-helper';
import { Config } from '../config/schema';
export interface CacheAdapter {
  get<T = unknown>(_key: string): Promise<T | null> | T | null;
  set<T = unknown>(_key: string, _value: T, _ttlSeconds?: number): Promise<void> | void;
  delete?(_key: string): Promise<void> | void;
  clearNamespace?(_ns: string): Promise<void> | void;
}

export interface RateLimiterAdapter {
  check(_identifier: string, _max: number, _windowMs: number): Promise<boolean> | boolean;
  /** Optional: return remaining tokens for introspection */
  remainingTokens?(_identifier: string): Promise<number> | number;
}

export interface AuthVerifierContext<TMeta = unknown> {
  scheme: string | null;
  meta: TMeta;
}

export interface AuthVerifier {
  (
    _token: string,
    _strategy: string,
    _ctx: AuthVerifierContext
  ): Promise<unknown | null> | unknown | null;
}

export interface PluginHookArgs {
  models: DMMF.Model[];
  dmmf: DMMF.Document;
  config: Config;
  outputDir: string;
  logger: {
    info: (..._args: unknown[]) => void;
    warn: (..._args: unknown[]) => void;
    error: (..._args: unknown[]) => void;
    debug: (..._args: unknown[]) => void;
  };
}

export interface ORPCPluginHooks {
  preGenerate?(_args: PluginHookArgs): Promise<void> | void;
  preModel?(_model: DMMF.Model, _args: PluginHookArgs): Promise<void> | void;
  postModel?(_model: DMMF.Model, _args: PluginHookArgs): Promise<void> | void;
  postSpec?(_spec: Record<string, unknown>, _args: PluginHookArgs): Promise<void> | void;
  postWrite?(_args: PluginHookArgs): Promise<void> | void;
}

export interface ORPCPlugin {
  name: string;
  hooks: ORPCPluginHooks;
}

export type PluginRegistry = ORPCPlugin[];
