import { GeneratorOptions } from '@prisma/generator-helper';
import path from 'path';
import pluralize from 'pluralize';
import { SourceFile } from 'ts-morph';

import { Config } from '../config/schema';
import { PrismaField, PrismaModel } from '../types/generator-types';
import {
  generateContextImport,
  generateProcedureCode,
  generateSchemaImports
} from '../utils/code-generation-utils';
import { Logger } from '../utils/logger';
import {
  getInputTypeByOpName,
  getOutputTypeByOpName,
  shouldGenerateOperation,
} from '../utils/operation-utils';
import { ProjectManager } from '../utils/project-manager';

export class CodeGenerator {
  constructor(
    private config: Config,
    private outputDir: string,
    private projectManager: ProjectManager,
    private logger: Logger
  ) {}


  async generateBaseRouter(options: GeneratorOptions): Promise<void> {
    this.logger.debug('Generating base router and utilities...');

    const createRouterFile = this.projectManager.createSourceFile(
      path.resolve(this.outputDir, 'routers', 'helpers', 'createRouter.ts'),
      undefined,
      { overwrite: true }
    );

    // Generate comprehensive base router with ORPC
    await this.generateBaseRouterContent(createRouterFile, options);

    // Format and save
    createRouterFile.formatText({ indentSize: 2 });
    this.logger.debug('Base router generated successfully');

    // Generate server error handling module if enabled
    if (this.config.generateErrorHandling) {
      await this.generateErrorHandlingModule();
    }
  }

  private async generateBaseRouterContent(
    sourceFile: SourceFile,
    options: GeneratorOptions
  ): Promise<void> {
    // Add ORPC imports including onError for centralized error handling
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@orpc/server',
      namedImports: ['os', 'ORPCError', 'onError'],
    });

    // Only add zod import if validation is enabled
    if (this.config.generateInputValidation || this.config.generateOutputValidation) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: 'zod',
        namedImports: ['z'],
      });
    }

    // Note: Removed dependency on prisma-error-mapper utility for simpler centralized error handling

    // Add context import
    generateContextImport(sourceFile, this.outputDir, this.config, options);

    // If user did not supply a contextPath, provide a sensible default Context that includes Prisma.
    if (!this.config.contextPath && !sourceFile.getInterface('Context')) {
      // Ensure PrismaClient type is available to consumers
      sourceFile.addStatements(
        `import type { PrismaClient } from '${this.config.prismaClientPath}';`
      );

      const extraFields: string[] = [];

      sourceFile.addStatements(`
// Proper interface definitions for type safety
export interface User {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
  permissions?: string[];
}

export interface Context {
  prisma: PrismaClient;
  user?: User;${extraFields.map((field) => `\n  ${field};`).join('')}
}`);
    }

    // Generate clean base ORPC instance (error handling at server level)
    sourceFile.addStatements(`
/**
 * Base ORPC router configuration with context
 */
export const or = os.$context<Context>();

/**
 * Base procedure for all operations
 */
const baseProcedure = or;

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = baseProcedure;

/**
 * Protected procedure - includes authentication
 */
export const protectedProcedure = baseProcedure;

${this.generateUtilityFunctions()}
`);
  }

  private generateUtilityFunctions(): string {
    const successHelpers = this.config.wrapResponses
      ? `
 /**
  * Create standardized success response
  */
 export function createSuccessResponse<T>(data: T, meta?: Record<string, unknown>): { success: true; data: T; meta: Record<string, unknown> } {
   const nowMeta: Record<string, unknown> = { timestamp: new Date().toISOString(), ...meta };
   if (meta?.requestId) nowMeta.requestId = meta.requestId;
   if (meta?.correlationId) nowMeta.correlationId = meta.correlationId;
   return { success: true as const, data, meta: nowMeta };
 }`
      : '';

    const callerHelper = `
 /**
  * Create a lightweight caller for a router (for tests and simple usage)
  */
 export function createCaller(router: Record<string, any>, context: Context) {
   const out: Record<string, any> = {};
   for (const [k, v] of Object.entries(router || {})) {
     const h = (v as any)?.['~orpc']?.handler;
     if (typeof h === 'function') {
       out[k] = (input?: unknown) => h({ input, context });
     }
   }
   return out;
 }
 `;

    return [successHelpers, callerHelper].filter(Boolean).join('\n');
  }

  async generateModelRouter(model: PrismaModel, modelOperations: unknown[]): Promise<void> {
    const modelName = model.name;

    this.logger.debug(`Generating router for model: ${modelName}`);

    const modelRouter = this.projectManager.createSourceFile(
      path.resolve(this.outputDir, 'routers', 'models', `${modelName}.router.ts`),
      undefined,
      { overwrite: true }
    );

    await this.generateModelRouterContent(modelRouter, model, modelOperations);

    modelRouter.formatText({ indentSize: 2 });
    this.logger.debug(`Router generated for model: ${modelName}`);
  }

  private async generateModelRouterContent(
    sourceFile: SourceFile,
    model: PrismaModel,
    modelOperations: unknown[]
  ): Promise<void> {
    const modelName = model.name;
    const routerName = pluralize(modelName.toLowerCase());

    // Add imports
    const baseImports = ['or', 'publicProcedure', 'protectedProcedure'];
    if (this.config.wrapResponses) {
      baseImports.push('createSuccessResponse');
    }

    sourceFile.addImportDeclaration({
      moduleSpecifier: '../helpers/createRouter',
      namedImports: baseImports,
    });

    // Type-only Context import for handler annotations
    sourceFile.addImportDeclaration({
      moduleSpecifier: '../helpers/createRouter',
      isTypeOnly: true,
      namedImports: ['Context'],
    });

    // Add ORPCError import
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@orpc/server',
      namedImports: ['ORPCError'],
    });

    // Add Prisma imports for proper typing
    sourceFile.addImportDeclaration({
      moduleSpecifier: this.config.prismaClientPath || '@prisma/client',
      namedImports: ['Prisma'],
    });

    // Note: Prisma error handling is now centralized in base procedure
    // No need to import PrismaClientKnownRequestError or mapPrismaErrorToHttp in individual routers

    if (this.config.generateInputValidation || this.config.generateOutputValidation) {
      generateSchemaImports(sourceFile, modelName, this.config);
    }

    // Generate procedures
    let procedures = await this.generateModelProcedures(model, modelOperations);

    if (this.config.generateRelationResolvers) {
      const relProcedures = this.generateRelationProcedures(model);
      if (relProcedures) {
        procedures = procedures + (procedures ? ',\n\n' : '') + relProcedures;
      }
    }

    sourceFile.addStatements(`
/**
 * ${modelName} router with comprehensive CRUD operations
 * Generated with strong type safety
 */
const ${routerName}Procedures = {
${procedures}
};
// Export procedures directly instead of wrapping in or.router() for OpenAPIHandler compatibility
export const ${routerName}Router = ${routerName}Procedures;
export type ${modelName}Router = typeof ${routerName}Router;
export { ${routerName}Procedures };
`);
  }

  private generateRelationProcedures(model: PrismaModel): string {
    const modelName = model.name;
    const modelVar = modelName.toLowerCase();
    const relFields = model.fields.filter(
      (f: PrismaField) => f.relationName && f.kind === 'object'
    );
    if (!relFields.length) return '';

    return relFields
      .map((field: PrismaField) => {
        const relName = field.name;
        const procedureName = `${modelVar}${this.capitalize(relName)}`;

        // Only use z.object if validation is enabled
        const inputPart = (this.config.generateInputValidation || this.config.generateOutputValidation)
          ? `.input(z.object({ id: z.string() }))`
          : '';

        return `  /**
   * ${procedureName} - relation resolver for ${modelName}.${relName}
   */
  ${procedureName}: publicProcedure${inputPart}
    .handler(async (opt: import('@orpc/server').ProcedureHandlerOptions<Context, ${inputPart ? '{ id: string }' : 'unknown'}, any, any>) => {
      const { input, context } = opt;
      const id = ${inputPart ? 'input.id' : '(input as any)?.id'};
      const related = await context.prisma.${modelVar}.findUnique({
        where: { id }
      }).${relName}();
      return related;
    })`;
      })
      .join(',\n\n');
  }

  private capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private async generateModelProcedures(
    model: PrismaModel,
    modelOperations: unknown[]
  ): Promise<string> {
    const modelName = model.name;
    const operations = modelOperations.find(
      (op: unknown) => (op as { model?: string }).model === modelName
    );

    if (!operations) return '';

    const procedures: string[] = [];
    const generatedOperations = new Set<string>();

    // Essential CRUD operations
    const essentialOperations = ['create', 'findMany', 'findUnique', 'update', 'delete', 'count'];

    // Generate each operation
    for (const [opType, opName] of Object.entries(operations)) {
      if (opType === 'model') continue;

      const baseOpType = opType.replace('OrThrow', '');

      if (generatedOperations.has(baseOpType)) continue;

      if (shouldGenerateOperation(baseOpType, this.config)) {
        const procedureCode = await this.generateSingleProcedure(
          modelName,
          opName as string,
          opType,
          baseOpType,
          model
        );
        procedures.push(procedureCode);
        generatedOperations.add(baseOpType);
      }
    }

    // Ensure essential operations are included
    for (const essentialOp of essentialOperations) {
      if (
        !generatedOperations.has(essentialOp) &&
        shouldGenerateOperation(essentialOp, this.config)
      ) {
        const procedureCode = await this.generateSingleProcedure(
          modelName,
          essentialOp,
          essentialOp,
          essentialOp,
          model
        );
        procedures.push(procedureCode);
        generatedOperations.add(essentialOp);
      }
    }

    return procedures.join(',\n\n');
  }

  private async generateSingleProcedure(
    modelName: string,
    operationName: string,
    opType: string,
    baseOpType: string,
    model: PrismaModel
  ): Promise<string> {
    const procedureName = this.getProcedureName(baseOpType, modelName);
    const inputType = getInputTypeByOpName(baseOpType, modelName);
    const outputType = getOutputTypeByOpName(baseOpType, modelName);

    // Determine procedure type (public/protected)
    const procedureType = this.getProcedureType(baseOpType);

    // Compute OpenAPI route (RPC-style) so OpenAPIHandler can match:
    // POST /{model}/{segment}
    // Examples:
    //   user + findMany  -> /user/findMany
    //   user + create    -> /user/create
    //   user + findUnique-> /user/findById
    const opToSegment: Record<string, string> = {
      create: 'create',
      createMany: 'createMany',
      findFirst: 'findFirst',
      findMany: 'findMany',
      findUnique: 'findById',
      update: 'update',
      updateMany: 'updateMany',
      upsert: 'upsert',
      delete: 'delete',
      deleteMany: 'deleteMany',
      count: 'count',
      aggregate: 'aggregate',
      groupBy: 'groupBy',
    };
    const segment = opToSegment[baseOpType] ?? baseOpType;
    // Include model name in path for OpenAPIHandler to avoid path conflicts
    const routePath = `/${modelName.toLowerCase()}/${segment}`;

    // Generate the procedure
    return generateProcedureCode({
      name: procedureName,
      operationName,
      inputType,
      outputType,
      procedureType,
      openApiRoute: { method: 'POST', path: routePath },
      modelName,
      opType,
      baseOpType,
      model,
      config: this.config,
    });
  }

  private getProcedureName(baseOpType: string, modelName: string): string {
    const prefix = this.config.showModelNameInProcedure ? modelName.toLowerCase() : '';

    const operationMap: Record<string, string> = {
      create: 'create',
      createMany: 'createMany',
      findFirst: 'findFirst',
      findMany: 'findMany',
      findUnique: 'findById',
      update: 'update',
      updateMany: 'updateMany',
      upsert: 'upsert',
      delete: 'delete',
      deleteMany: 'deleteMany',
      count: 'count',
      aggregate: 'aggregate',
      groupBy: 'groupBy',
    };

    const operation = operationMap[baseOpType] || baseOpType;
    return prefix
      ? `${prefix}${operation.charAt(0).toUpperCase()}${operation.slice(1)}`
      : operation;
  }

  private getProcedureType(_baseOpType: string): 'public' | 'protected' {
    // NOTE: All procedures are public for now. If auth is needed, switch based on _baseOpType.
    // const protectedOperations = ['create','createMany','update','updateMany','delete','deleteMany','upsert'];
    return 'public';
  }

  async generateAppRouter(models: PrismaModel[]): Promise<void> {
    this.logger.debug('Generating main application router...');

    const appRouter = this.projectManager.createSourceFile(
      path.resolve(this.outputDir, 'routers', 'index.ts'),
      undefined,
      { overwrite: true }
    );

    // Main app router uses plain object structure for OpenAPIHandler compatibility

    // Import all model routers
    for (const model of models) {
      const routerName = pluralize(model.name.toLowerCase());
      appRouter.addImportDeclaration({
        moduleSpecifier: `./models/${model.name}.router`,
        namedImports: [`${routerName}Router`],
      });
    }

    // Generate the main app router
    const routerEntries = models
      .map((model) => {
        const routerName = pluralize(model.name.toLowerCase());
        return `  ${model.name.toLowerCase()}: ${routerName}Router`;
      })
      .join(',\n');

    appRouter.addStatements(`
/**
 * Main application router combining all model routers
 * Generated with advanced ORPC architecture
 */
export const appRouter = {
${routerEntries}
};

/**
 * Type definition for the complete app router
 */
export type AppRouter = typeof appRouter;

/**
 * Export individual routers for modular usage
 */
export {${models
      .map((m) => {
        const r = pluralize(m.name.toLowerCase());
        return `${r}Router`;
      })
      .join(', ')}};
`);

    appRouter.formatText({ indentSize: 2 });
    this.logger.debug('Main application router generated');
  }

  private async generateErrorHandlingModule(): Promise<void> {
    const errorHandlingPath = path.resolve(this.outputDir, 'errorHandling.ts');
    
    const errorHandlingModule = `/**
 * Centralized Prisma Error Handling for ORPC
 * Auto-generated by prisma-orpc-generator
 * 
 * Usage:
 * import { prismaErrorMapper } from './generated/orpc/errorHandling';
 * import { onError } from '@orpc/server';
 * 
 * const openapi = new OpenAPIHandler(router, {
 *   interceptors: [onError(prismaErrorMapper)]
 * });
 */
import { ORPCError } from '@orpc/server';
import { Prisma } from '@prisma/client';

/**
 * Type-safe property checker utility
 */
function hasProp<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Type guard for ORPC-like errors
 */
type ORPCishError = { code: string; status: number };

function isORPCError(err: unknown): err is ORPCishError {
  return (
    hasProp(err, 'code') &&
    typeof (err as Record<'code', unknown>).code === 'string' &&
    hasProp(err, 'status') &&
    typeof (err as Record<'status', unknown>).status === 'number'
  );
}

/**
 * Type guard for Prisma known request errors
 */
function isPrismaKnownError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    hasProp(err, 'code') &&
    typeof (err as Record<'code', unknown>).code === 'string' &&
    hasProp(err, 'name') &&
    (err as Record<'name', unknown>).name === 'PrismaClientKnownRequestError'
  );
}

/**
 * Type guard for Prisma validation errors
 */
function isPrismaValidationError(err: unknown): err is Prisma.PrismaClientValidationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    hasProp(err, 'name') &&
    (err as Record<'name', unknown>).name === 'PrismaClientValidationError'
  );
}

/**
 * Maps low-level Prisma errors into ORPC errors (type-safe, no 'any')
 * This is the main error mapper function - use with onError()
 */
export const prismaErrorMapper = (error: unknown): void => {
  // If it's already an ORPC error, preserve it
  if (isORPCError(error)) {
    throw error;
  }

  // Handle Prisma known request errors
  if (isPrismaKnownError(error)) {
    switch (error.code) {
      case 'P2002': // Unique constraint failed
      case 'P2003': // FK constraint failed
        throw new ORPCError('CONFLICT');

      case 'P2025': // Record not found
      case 'P2016': // Query interpretation (missing record)
      case 'P2021': // Table does not exist
        throw new ORPCError('NOT_FOUND');

      case 'P2022': // Column does not exist
      case 'P2000': // Value too long / invalid
        throw new ORPCError('BAD_REQUEST');
    }
  }

  // Handle Prisma validation errors
  if (isPrismaValidationError(error)) {
    throw new ORPCError('BAD_REQUEST');
  }

  // Fallback for unknown errors
  throw new ORPCError('INTERNAL_SERVER_ERROR');
};


`;

    const errorHandlingFile = this.projectManager.createSourceFile(errorHandlingPath, undefined, { overwrite: true });
    
    // Add the module content manually
    errorHandlingFile.replaceWithText(errorHandlingModule);
    
    // Export is already included in the template string
    
    errorHandlingFile.formatText({ indentSize: 2 });
    this.logger.debug('Error handling module generated');
  }
}
