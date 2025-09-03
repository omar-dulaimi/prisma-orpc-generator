import { Config } from '../config/schema';
import type { DMMF } from '@prisma/generator-helper';
import { FieldKind, PrismaField, PrismaModel } from '../types/generator-types';

interface ValidationConstraint {
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  email?: boolean;
  url?: boolean;
  [key: string]: unknown;
}

/**
 * Convert DMMF Field to PrismaField
 */
function convertDMMFFieldToPrismaField(field: DMMF.Field): PrismaField {
  return {
    name: field.name,
    type: field.type,
    isId: field.isId,
    isOptional: !field.isRequired,
    isReadOnly: field.isReadOnly,
    isList: field.isList,
    relationName: field.relationName || undefined,
    relationFromFields: field.relationFromFields ? [...field.relationFromFields] : undefined,
    relationToFields: field.relationToFields ? [...field.relationToFields] : undefined,
    kind: field.kind as FieldKind,
    hasDefaultValue: field.hasDefaultValue,
    default: field.default,
    isGenerated: field.isGenerated,
    isUpdatedAt: field.isUpdatedAt,
  };
}

/**
 * Convert DMMF Model to PrismaModel
 */
export function convertDMMFModelToPrismaModel(model: DMMF.Model): PrismaModel {
  return {
    name: model.name,
    dbName: model.dbName || undefined,
    fields: model.fields.map(convertDMMFFieldToPrismaField),
    primaryKey: model.primaryKey
      ? {
          name: model.primaryKey.name || undefined,
          fields: [...model.primaryKey.fields],
        }
      : undefined,
    uniqueFields: model.uniqueFields
      ? model.uniqueFields.map((field: ReadonlyArray<string>) => [...field])
      : [],
    uniqueIndexes: (model.uniqueIndexes || []).map(
      (index: { name: string; fields: ReadonlyArray<string> }) => ({
        name: index.name,
        fields: [...index.fields],
      })
    ),
    isGenerated: model.isGenerated,
  };
}

/**
 * Convert array of DMMF Models to PrismaModels
 */
export function convertDMMFModelsToPrismaModels(models: DMMF.Model[]): PrismaModel[] {
  return models.map(convertDMMFModelToPrismaModel);
}

/**
 * Resolve model comments to determine hidden models
 */
export function resolveModelsComments(models: DMMF.Model[], hiddenModels: string[]): void {
  for (const model of models) {
    if (model.documentation) {
      // Check for hide directive in documentation
      const hideMatch = model.documentation.match(/@@@Gen\.model\(hide:\s*true\)/);
      if (hideMatch) {
        hiddenModels.push(model.name);
      }
    }
  }
}

/**
 * Enhance models with metadata from configuration
 */
export function enhanceModelsWithMetadata(models: DMMF.Model[], config: Config): DMMF.Model[] {
  return models.map((model) => ({
    ...model,
    metadata: {
      generateRouter: true,
      enableSoftDeletes: config.enableSoftDeletes,
      ...extractModelMetadata(model),
    },
  }));
}

/**
 * Extract metadata from model documentation
 */
function extractModelMetadata(model: DMMF.Model): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (!model.documentation) return metadata;

  // Parse custom directives from documentation
  const directives = model.documentation.match(/@@@\w+\([^)]+\)/g) || [];

  for (const directive of directives) {
    const match = directive.match(/@@@(\w+)\(([^)]+)\)/);
    if (match) {
      const [, directiveName, params] = match;

      switch (directiveName) {
        case 'Auth':
          metadata.authRequired = parseDirectiveParams(params)['required'] === 'true';
          break;
        case 'Cache': {
          const cacheParams = parseDirectiveParams(params);
          metadata.cacheTTL = parseInt(cacheParams['ttl'] || '300');
          metadata.cacheEnabled = cacheParams['enabled'] !== 'false';
          break;
        }
        case 'RateLimit': {
          const rateLimitParams = parseDirectiveParams(params);
          metadata.rateLimit = {
            requests: parseInt(rateLimitParams['requests'] || '100'),
            windowMs: parseInt(rateLimitParams['windowMs'] || '900000'),
          };
          break;
        }
      }
    }
  }

  return metadata;
}

/**
 * Parse directive parameters
 */
function parseDirectiveParams(paramsString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = paramsString.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split(':').map((s) => s.trim());
    if (key && value) {
      params[key] = value.replace(/['"]/g, '');
    }
  }

  return params;
}

/**
 * Get model relations for enhanced router generation
 */
export function getModelRelations(model: DMMF.Model): DMMF.Field[] {
  return model.fields.filter((field: DMMF.Field) => field.relationName);
}

/**
 * Check if model has soft delete field
 */
export function hasSoftDeleteField(model: DMMF.Model): boolean {
  return model.fields.some(
    (field: DMMF.Field) => field.name === 'deletedAt' && field.type === 'DateTime'
  );
}

/**
 * Get model's unique fields for findUnique operations
 */
export function getUniqueFields(model: DMMF.Model): string[] {
  const uniqueFields: string[] = [];

  // Add primary key fields
  for (const field of model.fields) {
    if (field.isId) {
      uniqueFields.push(field.name);
    }
  }

  // Add @unique fields
  for (const field of model.fields) {
    if (field.isUnique) {
      uniqueFields.push(field.name);
    }
  }

  return uniqueFields;
}

/**
 * Get searchable fields for findMany operations
 */
export function getSearchableFields(model: DMMF.Model): string[] {
  const searchableTypes = ['String', 'Int', 'BigInt', 'Float', 'Decimal'];

  return model.fields
    .filter(
      (field: DMMF.Field) =>
        searchableTypes.includes(field.type) && !field.isList && field.name !== 'id'
    )
    .map((field: DMMF.Field) => field.name);
}

/**
 * Check if model supports full-text search
 */
export function supportsFullTextSearch(model: DMMF.Model): boolean {
  return model.fields.some(
    (field: DMMF.Field) => field.type === 'String' && field.documentation?.includes('@fulltext')
  );
}

/**
 * Get filterable fields for where clauses
 */
export function getFilterableFields(model: DMMF.Model): DMMF.Field[] {
  return model.fields.filter((field: DMMF.Field) => {
    // Include scalar fields and foreign keys
    return (
      !field.isList && (field.kind === 'scalar' || field.relationName) // Foreign key fields
    );
  });
}

/**
 * Get sortable fields for orderBy clauses
 */
export function getSortableFields(model: DMMF.Model): string[] {
  const sortableTypes = ['String', 'Int', 'BigInt', 'Float', 'Decimal', 'DateTime', 'Boolean'];

  return model.fields
    .filter((field: DMMF.Field) => sortableTypes.includes(field.type) && !field.isList)
    .map((field: DMMF.Field) => field.name);
}

/**
 * Generate model validation constraints from Prisma schema
 */
export function getValidationConstraints(model: DMMF.Model): Record<string, ValidationConstraint> {
  const constraints: Record<string, ValidationConstraint> = {};

  for (const field of model.fields) {
    const fieldConstraints: ValidationConstraint = {};

    // Required fields
    if (field.isRequired && !field.hasDefaultValue) {
      fieldConstraints.required = true;
    }

    // String length constraints
    if (field.type === 'String' && field.documentation) {
      const maxLengthMatch = field.documentation.match(/@db\.VarChar\((\d+)\)/);
      if (maxLengthMatch) {
        fieldConstraints.maxLength = parseInt(maxLengthMatch[1]);
      }
    }

    // Numeric constraints
    if (['Int', 'Float', 'Decimal'].includes(field.type)) {
      if (field.documentation) {
        const minMatch = field.documentation.match(/@min\((\d+)\)/);
        const maxMatch = field.documentation.match(/@max\((\d+)\)/);

        if (minMatch) fieldConstraints.min = parseInt(minMatch[1]);
        if (maxMatch) fieldConstraints.max = parseInt(maxMatch[1]);
      }
    }

    // Email validation
    if (field.name.toLowerCase().includes('email') && field.type === 'String') {
      fieldConstraints.email = true;
    }

    // URL validation
    if (field.name.toLowerCase().includes('url') && field.type === 'String') {
      fieldConstraints.url = true;
    }

    if (Object.keys(fieldConstraints).length > 0) {
      constraints[field.name] = fieldConstraints;
    }
  }

  return constraints;
}

/**
 * Check if model should have audit fields
 */
export function shouldHaveAuditFields(model: DMMF.Model): boolean {
  return model.fields.some((field: DMMF.Field) =>
    ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(field.name)
  );
}

interface FieldLike {
  type: string;
  isList?: boolean;
}

interface ModelWithFields {
  fields: FieldLike[];
}

/**
 * Get available aggregation functions for a model based on its field types
 * @param model The Prisma model
 * @returns Object with boolean flags for available aggregations
 */
export function getAvailableAggregations(model: ModelWithFields): {
  hasNumericFields: boolean;
  hasComparableFields: boolean;
  supportsSum: boolean;
  supportsAvg: boolean;
  supportsMin: boolean;
  supportsMax: boolean;
  supportsCount: boolean;
} {
  // Numeric field types that support _sum and _avg
  const numericTypes = ['Int', 'Float', 'Decimal', 'BigInt'];

  // Comparable field types that support _min and _max (includes numeric + date/string)
  const comparableTypes = [...numericTypes, 'DateTime', 'String'];

  const numericFields = model.fields.filter(
    (field: FieldLike) => numericTypes.includes(field.type) && !field.isList
  );

  const comparableFields = model.fields.filter(
    (field: FieldLike) => comparableTypes.includes(field.type) && !field.isList
  );

  return {
    hasNumericFields: numericFields.length > 0,
    hasComparableFields: comparableFields.length > 0,
    supportsSum: numericFields.length > 0,
    supportsAvg: numericFields.length > 0,
    supportsMin: comparableFields.length > 0,
    supportsMax: comparableFields.length > 0,
    supportsCount: true, // _count is always available
  };
}
