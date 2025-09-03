/**
 * prisma-orpc-generator
 * Prisma generator for ORPC with advanced features
 *
 * This is the main entry point for the generator that creates
 * fully-featured ORPC routers from Prisma schemas with:
 * - Multi-runtime compatibility
 * - Advanced middleware system
 * - Strong type safety
 * - Enhanced developer experience
 */

export { Config, configSchema } from './config/schema';
export type { Config as GeneratorConfig, ModelAction, SchemaLibrary } from './config/schema';
export { generate } from './generators/orpc-generator';

// Re-export utilities for advanced usage
export { Logger, LogLevel } from './utils/logger';
export {
  enhanceModelsWithMetadata,
  getFilterableFields,
  getModelRelations,
  getSearchableFields,
  getSortableFields,
  getUniqueFields,
  getValidationConstraints,
  hasSoftDeleteField,
  resolveModelsComments,
  shouldHaveAuditFields,
  supportsFullTextSearch
} from './utils/model-utils';
export {
  getHttpMethod,
  getInputTypeByOpName,
  getOperationDescription,
  getOperationSummary,
  getOutputTypeByOpName,
  getRestPath,
  getValidationRequirements,
  requiresAuthentication,
  returnsMultiple,
  shouldGenerateOperation,
  supportsCaching
} from './utils/operation-utils';
export { ProjectManager } from './utils/project-manager';

// Version information
export const VERSION = '0.0.1';
export const GENERATOR_NAME = 'prisma-orpc-generator';

// Generator metadata
export const GENERATOR_METADATA = {
  name: GENERATOR_NAME,
  version: VERSION,
  description: 'Prisma generator for ORPC with advanced features',
  author: 'Advanced Code Generation Team',
  repository: 'https://github.com/omar-dulaimi/prisma-orpc-generator',
  homepage: 'https://prisma-orpc-generator.dev',
  bugs: 'https://github.com/omar-dulaimi/prisma-orpc-generator/issues',
  keywords: ['prisma', 'orpc', 'generator', 'typescript', 'api', 'rpc', 'type-safe', 'codegen'],
  capabilities: [
    'Advanced ORPC router generation',
    'Zod schema validation with full type safety',
    'Comprehensive middleware system',
    'Interactive documentation',
    'Test generation',
    'Enhanced error handling',
    'Caching strategies',
    'Authentication & RBAC',
    'Rate limiting',
  ],
} as const;

// Default configurations for quick setup
export const PRESET_CONFIGS = {
  basic: {
    enableCaching: 'false',
  },

  production: {
    enableCaching: 'true',
    cacheStrategy: 'redis',
    generateHealthChecks: 'true',
    enableMetrics: 'true',
    generateTests: 'true',
  },

  serverless: {
    cacheStrategy: 'memory',
  },

  enterprise: {
    enableCaching: 'true',
    cacheStrategy: 'redis',
    enableMetrics: 'true',
    generateTests: 'true',
  },
} as const;

/**
 * Utility function to get preset configuration
 */
export function getPresetConfig(preset: keyof typeof PRESET_CONFIGS): Record<string, string> {
  return { ...PRESET_CONFIGS[preset] };
}

/**
 * Check if the generator is compatible with the current environment
 */
export function checkCompatibility(): {
  compatible: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0');

  if (majorVersion < 18) {
    issues.push(`Node.js ${nodeVersion} is not supported. Minimum required version is 18.0.0`);
  } else if (majorVersion < 20) {
    recommendations.push('Consider upgrading to Node.js 20+ for better performance and features');
  }

  // Check for required dependencies
  try {
    require('@orpc/server');
  } catch {
    issues.push(
      'Missing required dependency: @orpc/server. Install with: npm install @orpc/server'
    );
  }

  try {
    require('@prisma/client');
  } catch {
    issues.push(
      'Missing required dependency: @prisma/client. Install with: npm install @prisma/client'
    );
  }

  return {
    compatible: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Display generator information
 */
export function displayInfo(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                   ${GENERATOR_METADATA.name}                       ║
║                    Prisma ORPC Generator                           ║
╠════════════════════════════════════════════════════════════════════╣
║ Version: ${GENERATOR_METADATA.version}                             ║
║ Description: ${GENERATOR_METADATA.description.substring(0, 36)}... ║
║                                                                    ║
║ 🚀 Advanced Features:                                              ║
║   • Type-safe routers and validation                               ║
║   • Documentation helpers                                          ║
║   • Enhanced error handling                                        ║
║                                                                    ║
║ 📚 Documentation: ${GENERATOR_METADATA.homepage}                   ║
║ 🐛 Issues: ${GENERATOR_METADATA.bugs}                              ║
╚════════════════════════════════════════════════════════════════════╝
`);
}
// Request body envelope normalization helper (inline to avoid module resolution issues)
export type NormalizedBodyEnvelope = string | undefined;

interface ParsedRequestBody {
  input?: unknown;
  json?: unknown;
  // Using only json/meta envelope fields
  meta?: unknown;
  [key: string]: unknown;
}

export function normalizeBodyEnvelope(raw: string | undefined): NormalizedBodyEnvelope {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as ParsedRequestBody;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const hasJson = Object.prototype.hasOwnProperty.call(parsed, 'json');
      const hasMeta = 'meta' in parsed;
      if (hasJson || hasMeta) return raw; // already valid
      if ('input' in parsed && !hasJson) {
        return JSON.stringify({ json: parsed.input });
      }
      return JSON.stringify({ json: parsed });
    }
  } catch {
    /* ignore parse errors */
  }
  return raw;
}
// FEATURE:request-body-envelope-normalization:done
