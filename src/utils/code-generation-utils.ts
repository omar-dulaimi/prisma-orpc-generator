import { GeneratorOptions } from '@prisma/generator-helper';
import path from 'path';
import { SourceFile } from 'ts-morph';
import { Config } from '../config/schema';
import { getAvailableAggregations } from './model-utils';
import { getPrismaMethodName, getValidationRequirements } from './operation-utils';

// Type interfaces for code generation
interface CodeGenField {
  name: string;
  type: string;
  isId?: boolean;
  isOptional?: boolean;
  hasDefaultValue?: boolean;
  isUpdatedAt?: boolean;
  relationName?: string;
  kind?: string;
  isList?: boolean;
}

interface CodeGenModel {
  name: string;
  fields: CodeGenField[];
}

/**
 * Generate ORPC imports for a source file
 */
export function generateORPCImports(sourceFile: SourceFile): void {
  // Core ORPC imports for v1.7.10
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === '@orpc/server');
  if (existing) {
    const have = new Set(existing.getNamedImports().map((n) => n.getName()));
    if (!have.has('os')) existing.addNamedImport('os');
    if (!have.has('ORPCError')) existing.addNamedImport('ORPCError');
  } else {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@orpc/server',
      namedImports: ['os', 'ORPCError'],
    });
  }

  // Do not import @orpc/zod plugin (oz). Validation schemas are handled directly per-operation.

  // Additional imports based on configuration - currently disabled to avoid config type issues
  // These can be enabled when the config schema includes the necessary properties
}

/**
 * Generate context import
 */
export function generateContextImport(
  sourceFile: SourceFile,
  _fromDir: string,
  config: Config,
  options: GeneratorOptions
): void {
  // If a contextPath is provided, re-export its Context (optionally widened below)
  if (config.contextPath) {
    // Compute absolute path to the context file (relative to schema when not absolute)
    const fileDir = path.dirname(sourceFile.getFilePath());
    const schemaDir = options.schemaPath ? path.dirname(options.schemaPath) : process.cwd();
    const absoluteTargetPath = path.isAbsolute(config.contextPath)
      ? config.contextPath
      : path.resolve(schemaDir, config.contextPath);

    // Compute relative module specifier from the generated file to the context file
    let relative = path.relative(fileDir, absoluteTargetPath);
    // Normalize separators to POSIX for TS module specifiers
    relative = relative.replace(/\\/g, '/');
    // Drop .ts extension if present
    relative = relative.replace(/\.ts$/i, '');
    // Ensure it starts with './' or '../'
    if (!relative.startsWith('.') && !relative.startsWith('/')) {
      relative = `./${relative}`;
    }

    // Simple pass-through re-export
    sourceFile.addStatements(`
import type { Context } from '${relative}';
export type { Context };
`);
    return;
  }
  // No contextPath provided: do not inline here. The base router generator will declare
  // PrismaClient import and a full Context interface with any feature-driven fields.
  // This avoids duplicate identifiers when both utilities run.
}

/**
 * Generate schema imports based on validation library
 */
export function generateSchemaImports(
  sourceFile: SourceFile,
  modelName: string,
  config: Config
): void {
  if (!config.generateInputValidation && !config.generateOutputValidation) return;

  // Add zod import (only supported schema library)
  if (!sourceFile.getImportDeclaration((d) => d.getModuleSpecifierValue() === 'zod')) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'zod',
      namedImports: ['z'],
    });
  }

  // Import generated schemas (zod only)
  // Use configured external import path (defaults to './zod-schemas'), and prefer '/schemas' index
  const externalBase =
    config.externalZodImportPath || config.zodSchemasOutputPath || './zod-schemas';
  // Determine module specifier relative to the generated file
  const fileDir = path.dirname(sourceFile.getFilePath());
  let zodModule: string;
  if (externalBase.startsWith('.') || externalBase.startsWith('/')) {
    const outputRoot = path.resolve(fileDir, '..', '..'); // routers/models -> output root
    const abs = path.resolve(outputRoot, externalBase, 'schemas', 'index');
    let rel = path.relative(fileDir, abs).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    zodModule = rel;
  } else {
    // Bare module specifier, append '/schemas/index' to be bundler-friendly
    zodModule = `${externalBase}/schemas/index`;
  }

  if (config.generateInputValidation) {
    // Import CRUD operation schemas instead of generic input schemas
    sourceFile.addImportDeclaration({
      moduleSpecifier: zodModule,
      namedImports: [
        `${modelName}FindManySchema`,
        `${modelName}FindFirstSchema`,
        `${modelName}FindUniqueSchema`,
        `${modelName}CreateOneSchema`,
        `${modelName}CreateManySchema`,
        `${modelName}UpdateOneSchema`,
        `${modelName}UpdateManySchema`,
        `${modelName}DeleteOneSchema`,
        `${modelName}DeleteManySchema`,
        `${modelName}GroupBySchema`,
        `${modelName}AggregateSchema`,
        `${modelName}CountSchema`,
      ],
    });

    // No need for aliases - use the CRUD schemas directly
  }
}

/**
 * Generate procedure code with enhanced features
 */
export function generateProcedureCode(params: {
  name: string;
  operationName: string;
  inputType?: string;
  outputType?: string;
  procedureType: 'public' | 'protected';
  openApiRoute?: { method: string; path: string; successStatus?: number } | null;
  modelName: string;
  opType: string;
  baseOpType: string;
  model: CodeGenModel;
  config: Config;
  extraDescription?: string;
}): string {
  const {
    name,
    operationName,
    inputType,
    outputType,
    procedureType,
    modelName,
    baseOpType,
    config,
  } = params;

  const procedure = procedureType === 'public' ? 'publicProcedure' : 'protectedProcedure';
  const inputSchema = inputType ? `${inputType}Schema` : undefined;
  // Build output schema expression for zod
  let outputSchemaExpr: string | undefined = undefined;
  if (config.generateOutputValidation) {
    if (config.schemaLibrary === 'zod') {
      // Use conservative, always-available schemas to avoid depending on non-standard exports
      if (baseOpType === 'groupBy') outputSchemaExpr = 'z.unknown()';
      else if (baseOpType === 'aggregate') outputSchemaExpr = 'z.unknown()';
      else if (['createMany', 'updateMany', 'deleteMany', 'count'].includes(baseOpType))
        outputSchemaExpr = 'z.object({ count: z.number().int().nonnegative() })';
      else if (baseOpType === 'findMany') outputSchemaExpr = 'z.array(z.unknown())';
      else outputSchemaExpr = 'z.unknown()';
    } else if (outputType) {
      outputSchemaExpr = `${outputType}Schema`;
    }
  }

  // Build procedure chain
  const chainParts = [procedure];

  // Attach OpenAPI route metadata when provided
  if (params.openApiRoute) {
    const { method, path, successStatus } = params.openApiRoute;
    const statusPart = typeof successStatus === 'number' ? `, successStatus: ${successStatus}` : '';
    chainParts.push(`.route({ method: '${method}', path: '${path}'${statusPart} })`);
  }

  // Detect primary key int id for flexible delete schema
  const primaryIdField = (params.model?.fields || []).find((f: CodeGenField) => f.isId);
  const primaryIdIsInt = primaryIdField && ['Int', 'BigInt'].includes(primaryIdField.type);

  // Helper functions for zod schema syntax
  const getOptionalSyntax = (schemaExpr: string): string => {
    return `${schemaExpr}.optional()`;
  };

  const getObjectSyntax = (fields: string): string => {
    return `z.object({${fields}})`;
  };

  // Note: Generic any syntax function removed as unused

  // Map operations to their proper CRUD schemas
  let operationSchema: string | undefined;
  switch (baseOpType) {
    case 'findMany':
      operationSchema = `${modelName}FindManySchema`;
      break;
    case 'findFirst':
      operationSchema = `${modelName}FindFirstSchema`;
      break;
    case 'findUnique':
      operationSchema = `${modelName}FindUniqueSchema`;
      break;
    case 'create':
      operationSchema = `${modelName}CreateOneSchema`;
      break;
    case 'createMany':
      operationSchema = `${modelName}CreateManySchema`;
      break;
    case 'update':
      operationSchema = `${modelName}UpdateOneSchema`;
      break;
    case 'updateMany':
      operationSchema = `${modelName}UpdateManySchema`;
      break;
    case 'delete':
      operationSchema = `${modelName}DeleteOneSchema`;
      break;
    case 'deleteMany':
      operationSchema = `${modelName}DeleteManySchema`;
      break;
    case 'count':
      operationSchema = `${modelName}CountSchema`;
      break;
    case 'groupBy':
      operationSchema = `${modelName}GroupBySchema`;
      break;
    case 'aggregate':
      operationSchema = `${modelName}AggregateSchema`;
      break;
  }

  // Add input validation using proper CRUD schemas
  if (config.generateInputValidation && operationSchema) {
    chainParts.push(`.input(${operationSchema})`);
  }

  // Add output validation
  if (config.generateOutputValidation && outputSchemaExpr) {
    if (config.wrapResponses) {
      const dataSchema = outputSchemaExpr || 'z.unknown()';
      chainParts.push(
        `.output(z.object({ success: z.literal(true), data: ${dataSchema}, meta: z.object({}).passthrough().optional() }))`
      );
    } else {
      chainParts.push(`.output(${outputSchemaExpr})`);
    }
  }

  // Generate handler
  const handlerCode = generateHandlerCode(
    baseOpType,
    modelName,
    operationName,
    config,
    params.model
  );

  // Provide a compatible handler type to satisfy @orpc/server ProcedureHandler generics across versions
  chainParts.push(`.handler((${handlerCode}) as any)`);

  return `  /**
   * ${name} - ${baseOpType} operation for ${modelName}
  * Generated with advanced ORPC features${params.extraDescription ? `\n   * ${params.extraDescription}` : ''}
   */
  ${name}: ${chainParts.join('\n    ')}`;
}

/**
 * Generate handler code for different operations
 */
function generateHandlerCode(
  baseOpType: string,
  modelName: string,
  operationName: string,
  config: Config,
  model: CodeGenModel
): string {
  const modelVar = modelName.toLowerCase();
  const _isWrite = [
    'create',
    'createMany',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
    'upsert',
  ].includes(baseOpType);
  const hasDeletedAt = !!model?.fields?.some((f: CodeGenField) => f.name === 'deletedAt');
  // Note: Operation type analysis variables removed as unused

  // Base handler structure - clean and simple, error handling is done at server level
  let handler = `async (opt: import('@orpc/server').ProcedureHandlerOptions<Context, unknown, any, any>) => {
    const { input: rawInput, context } = opt;
    const input = rawInput as any;
    const ctx = context as Context;
    const baseOpType = '${baseOpType}';`;

  // Add caching for read operations

  // Add the main operation with correct Prisma method calls
  const prismaMethod = getPrismaMethodName(baseOpType);

  // Handle specific input patterns for different operations
  // Now that we use proper CRUD schemas, the input already has the correct structure
  let inputParam = '';
  switch (baseOpType) {
    case 'create':
      // CreateOneSchema provides { data: ... } structure
      inputParam = '{ data: input.data }';
      break;
    case 'createMany':
      // CreateManySchema provides { data: ... } where data is array or single item
      inputParam = 'input';
      break;
    case 'findFirst':
    case 'findMany':
      // FindManySchema provides full Prisma args structure
      inputParam = 'input';
      break;
    case 'findUnique':
      // FindUniqueSchema provides { where: ... } structure
      inputParam = '{ where: input.where }';
      break;
    case 'update':
      // UpdateOneSchema provides { where: ..., data: ... } structure
      if (config.enableSoftDeletes && hasDeletedAt) {
        inputParam = '{ where: { ...input.where, deletedAt: null }, data: input.data }';
      } else {
        inputParam = '{ where: input.where, data: input.data }';
      }
      break;
    case 'updateMany':
      // UpdateManySchema provides { where: ..., data: ... } structure
      if (config.enableSoftDeletes && hasDeletedAt) {
        inputParam = '{ where: { ...input.where, deletedAt: null }, data: input.data }';
      } else {
        inputParam = '{ where: input.where, data: input.data }';
      }
      break;
    case 'delete':
      // DeleteOneSchema provides { where: ... } structure
      inputParam = '{ where: input.where }';
      break;
    case 'deleteMany':
      // DeleteManySchema provides { where: ... } structure
      inputParam = '{ where: input.where }';
      break;
    case 'count':
    case 'aggregate':
    case 'groupBy':
      // These schemas provide full Prisma args structure
      inputParam = 'input';
      break;
    case 'upsert':
      inputParam = '{ where: input.where, create: input.create, update: input.update }';
      break;
    default:
      inputParam = 'input';
  }

  // For soft delete aware reads, inject deletedAt filter lazily
  if (
    (config.enableSoftDeletes || hasDeletedAt) &&
    hasDeletedAt &&
    ['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(baseOpType)
  ) {
    handler += `
      // Apply soft-delete filter - input now has proper CRUD schema structure
  const queryArgs: { where?: { [k: string]: unknown } } = { ...(input as any) };
      if (!queryArgs.where) queryArgs.where = {};
      if (queryArgs.where.deletedAt === undefined) {
        (queryArgs.where as { [k: string]: unknown }).deletedAt = null;
      }
      const result = await ctx.prisma.${modelVar}.${prismaMethod}(queryArgs as unknown);`;
  } else if (
    (config.enableSoftDeletes || hasDeletedAt) &&
    hasDeletedAt &&
    baseOpType === 'findUnique'
  ) {
    handler += `
      // Ensure soft-deleted records are excluded - input has { where: ... } structure
  const uniqueArgs = { ...input };
      if (!uniqueArgs.where) uniqueArgs.where = {};
      if ((uniqueArgs.where as any).deletedAt === undefined) (uniqueArgs.where as any).deletedAt = null;
      const result = await ctx.prisma.${modelVar}.findUnique(uniqueArgs);`;
  } else if (
    (config.enableSoftDeletes || hasDeletedAt) &&
    hasDeletedAt &&
    baseOpType === 'delete'
  ) {
    handler += `
      // Soft delete via update (set deletedAt) - input has { where: ... } structure
  const result = await ctx.prisma.${modelVar}.update({ where: input.where, data: { deletedAt: new Date() } });`;
  } else if (
    (config.enableSoftDeletes || hasDeletedAt) &&
    hasDeletedAt &&
    baseOpType === 'deleteMany'
  ) {
    handler += `
      // Soft delete many via updateMany (set deletedAt) - input has { where: ... } structure
  const result = await ctx.prisma.${modelVar}.updateMany({ where: input.where, data: { deletedAt: new Date() } });`;
  } else if (baseOpType === 'groupBy') {
    // Analyze which aggregations are available for this model
    const aggregations = getAvailableAggregations(model);

    handler += `
  type _GroupByArgs = Partial<Prisma.${modelName}GroupByArgs> & { by: Prisma.${modelName}ScalarFieldEnum[] };
      const args: _GroupByArgs = {} as _GroupByArgs;
      if (input?.by) (args as any).by = (input.by as any[]).length ? input.by : ['id'];
      if (input?.where) (args as any).where = input.where as Prisma.${modelName}WhereInput;
      if (input?.orderBy) (args as any).orderBy = input.orderBy as any;
      if (input?.having) (args as any).having = input.having as any;
      if (input?.take) (args as any).take = Math.min(input.take as number, 500);
      if (input?.skip) (args as any).skip = input.skip as number;`;
    handler += `
      if (((args as any).take || (args as any).skip) && !(args as any).orderBy) { (args as any).orderBy = [{ id: 'asc' }] as any; }`;

    // Only include aggregations that are supported by the model
    if (aggregations.supportsCount) {
      handler += `
      if (input?._count) args._count = input._count;`;
    }
    if (aggregations.supportsSum) {
      handler += `
      if (input?._sum) args._sum = input._sum;`;
    }
    if (aggregations.supportsAvg) {
      handler += `
      if (input?._avg) args._avg = input._avg;`;
    }
    if (aggregations.supportsMin) {
      handler += `
      if (input?._min) args._min = input._min;`;
    }
    if (aggregations.supportsMax) {
      handler += `
      if (input?._max) args._max = input._max;`;
    }

    handler += `
  const result = await ctx.prisma.${modelVar}.groupBy(args as any);`;
  } else if (baseOpType === 'aggregate') {
    handler += `
  const aggArgs: { [k: string]: unknown; _count?: unknown; _avg?: unknown; _sum?: unknown; _min?: unknown; _max?: unknown } = input ? { ...(input as Record<string, unknown>) } : {};
      if (!aggArgs._count && !aggArgs._avg && !aggArgs._sum && !aggArgs._min && !aggArgs._max) {
        (aggArgs as { [k: string]: unknown })._count = { _all: true }; // ensure at least one selection to satisfy Prisma
      }
      const result = await ctx.prisma.${modelVar}.aggregate(aggArgs as Prisma.${modelName}AggregateArgs);`;
  } else {
    // Map base operation to Prisma Args type for precise typing
    const opToArgs: Record<string, string> = {
      create: 'CreateArgs',
      createMany: 'CreateManyArgs',
      findFirst: 'FindFirstArgs',
      findMany: 'FindManyArgs',
      findUnique: 'FindUniqueArgs',
      update: 'UpdateArgs',
      updateMany: 'UpdateManyArgs',
      upsert: 'UpsertArgs',
      delete: 'DeleteArgs',
      deleteMany: 'DeleteManyArgs',
      count: 'CountArgs',
    };
    const argsType = opToArgs[baseOpType] || 'FindManyArgs';
    if (baseOpType === 'delete') {
      handler += `
      // DeleteOneSchema provides { where: ... } structure
      const result = await ctx.prisma.${modelVar}.delete({ where: input.where } as Prisma.${modelName}DeleteArgs);`;
    } else if (baseOpType === 'deleteMany') {
      handler += `
      // DeleteManySchema provides { where: ... } structure  
      const result = await ctx.prisma.${modelVar}.deleteMany({ where: input.where } as Prisma.${modelName}DeleteManyArgs);`;
    } else {
      handler += `
      const result = await ctx.prisma.${modelVar}.${prismaMethod}((${inputParam}) as Prisma.${modelName}${argsType});`;
    }
  }

  // Handle not found cases
  if (baseOpType === 'findUnique' || baseOpType === 'findFirst') {
    handler += `
      
      if (!result) {
        throw new ORPCError('NOT_FOUND', { data: { message: \`${modelName} not found\` } });
      }`;
    if ((config.enableSoftDeletes || hasDeletedAt) && hasDeletedAt) {
      handler += `
      if (result && result.deletedAt) {
        throw new ORPCError('NOT_FOUND', { data: { message: \`${modelName} not found\` } });
      }`;
    }
  }

  // Return results (optionally wrapped)
  if (config.wrapResponses) {
    if (baseOpType === 'count') {
      handler += `
  return createSuccessResponse({ count: result }, { operation: baseOpType });`;
    } else {
      handler += `
  return createSuccessResponse(result, { operation: baseOpType });`;
    }
  } else {
    if (baseOpType === 'count') {
      handler += `
  return { count: result };`;
    } else {
      handler += `
  return result;`;
    }
  }

  handler += `
  }`;

  return handler;
}

// Helper functions for schema name generation removed as they were unused
// If needed in the future, they can generate input and output schema names for models
